import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessCompany } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string; projectSlug: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as { id: string }).id;
    const company = await prisma.company.findUnique({ where: { slug: params.slug } });
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    // Access check
    const hasAccess = await canAccessCompany(userId, company.id);
    if (!hasAccess) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    let project = await prisma.project.findFirst({
      where: { companyId: company.id, slug: params.projectSlug, deletedAt: null },
      include: {
        _count: { select: { activities: true, lookaheads: true, documents: true, conflicts: true, delays: true, constraints: true } },
      },
    });
    if (!project) {
      project = await prisma.project.findFirst({
        where: { companyId: company.id, id: params.projectSlug, deletedAt: null },
        include: {
          _count: { select: { activities: true, lookaheads: true, documents: true, conflicts: true, delays: true, constraints: true } },
        },
      });
    }
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Compute 3-week window: Mon of this week → Sun 3 weeks out
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const threeWeekEnd = new Date(monday);
    threeWeekEnd.setDate(monday.getDate() + 21);

    const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    // Get all non-deleted activities for this project
    const allActivities = await prisma.activity.findMany({
      where: { projectId: project.id, deletedAt: null },
      select: {
        id: true, activityDescription: true, status: true,
        plannedStart: true, plannedFinish: true,
        category: true, percentComplete: true,
        responsibleSubcontractorRaw: true, location: true, locationId: true,
        priority: true, needsFollowUp: true,
      },
      orderBy: { plannedStart: "asc" },
    });

    // Status counts
    const statusCounts: Record<string, number> = {};
    allActivities.forEach(a => { statusCounts[a.status] = (statusCounts[a.status] || 0) + 1; });

    // Activities in the 3-week window (overlaps with [monday, threeWeekEnd))
    const windowActivities = allActivities.filter(a => {
      if (!a.plannedStart) return false;
      const s = new Date(a.plannedStart);
      const e = a.plannedFinish ? new Date(a.plannedFinish) : s;
      return s < threeWeekEnd && e >= monday;
    });

    // Break into week 1 / week 2 / week 3
    function weekOf(date: Date, start: Date): number {
      const diff = Math.floor((date.getTime() - start.getTime()) / (7 * 86400000));
      return Math.min(2, Math.max(0, diff));
    }

    const weekBuckets: Array<typeof windowActivities> = [[], [], []];
    windowActivities.forEach(a => {
      const s = new Date(a.plannedStart!);
      const week = weekOf(s, monday);
      weekBuckets[week].push(a);
    });

    // Today's activities
    const todayActivities = allActivities.filter(a => {
      if (!a.plannedStart) return false;
      const s = new Date(a.plannedStart);
      const e = a.plannedFinish ? new Date(a.plannedFinish) : s;
      return s < tomorrow && e >= today;
    });

    // This week's activities
    const thisWeekActivities = allActivities.filter(a => {
      if (!a.plannedStart) return false;
      const s = new Date(a.plannedStart);
      const e = a.plannedFinish ? new Date(a.plannedFinish) : s;
      return s < weekEnd && e >= today;
    });

    // Subs on site this week
    const subsThisWeek = [...new Set(thisWeekActivities.map(a => a.responsibleSubcontractorRaw).filter(Boolean))] as string[];

    // Overdue: past planned finish, not complete
    const overdue = allActivities.filter(a => {
      if (a.status === "COMPLETE") return false;
      if (!a.plannedFinish) return false;
      return new Date(a.plannedFinish) < today;
    });

    // Conflicts, constraints, alerts — count anything NOT resolved/closed as "open"
    const [openConflicts, openConstraints, urgentAlerts, myAlerts, openAlerts] = await Promise.all([
      prisma.conflict.count({
        where: {
          projectId: project.id,
          deletedAt: null,
          status: { notIn: ["RESOLVED", "CLOSED"] },
        },
      }),
      prisma.constraint.count({ where: { projectId: project.id, status: { in: ["OPEN", "IN_PROGRESS"] }, deletedAt: null } }),
      prisma.alert.count({
        where: { projectId: project.id, deletedAt: null, priority: "URGENT", status: { notIn: ["RESOLVED", "CLOSED"] } },
      }),
      prisma.alert.count({
        where: { projectId: project.id, deletedAt: null, assignedToId: userId, status: { notIn: ["RESOLVED", "CLOSED"] } },
      }),
      prisma.alert.count({
        where: { projectId: project.id, deletedAt: null, status: { notIn: ["RESOLVED", "CLOSED"] } },
      }),
    ]);

    // Top 5 urgent/high alerts for dashboard display
    const topAlerts = await prisma.alert.findMany({
      where: { projectId: project.id, deletedAt: null, status: { notIn: ["RESOLVED", "CLOSED"] }, priority: { in: ["URGENT", "HIGH"] } },
      include: {
        projectLocation: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 5,
    });

    // Area conflict warnings — open conflicts in areas where work is scheduled today.
    // Match on the structured ProjectLocation FK first (canonical), with the free-text
    // location string as a fallback for activities/conflicts that predate the link.
    const todayLocationIds   = [...new Set(todayActivities.map(a => a.locationId).filter(Boolean))] as string[];
    const todayLocationNames = [...new Set(todayActivities.map(a => a.location).filter(Boolean))] as string[];
    const areaWhereOr: Array<Record<string, unknown>> = [];
    if (todayLocationIds.length > 0)   areaWhereOr.push({ locationId: { in: todayLocationIds } });
    if (todayLocationNames.length > 0) areaWhereOr.push({ location: { in: todayLocationNames } });

    const areaConflicts = areaWhereOr.length === 0 ? [] : await prisma.conflict.findMany({
      where: {
        projectId: project.id,
        deletedAt: null,
        status: { notIn: ["RESOLVED", "CLOSED"] },
        OR: areaWhereOr,
      },
      include: { projectLocation: { select: { id: true, name: true, color: true } } },
      orderBy: { severity: "desc" },
      take: 5,
    });

    // Recent 10 activities for feed
    const recentActivities = allActivities.slice(0, 15);

    return NextResponse.json({
      project: {
        id: project.id,
        projectName: project.projectName,
        slug: project.slug,
        status: project.status,
        location: project.location,
        client: project.client,
        contractor: project.contractor,
        description: project.description,
        startDate: project.startDate,
        endDate: project.endDate,
        _count: project._count,
      },
      stats: {
        total: allActivities.length,
        planned: statusCounts["PLANNED"] ?? 0,
        inProgress: statusCounts["IN_PROGRESS"] ?? 0,
        complete: statusCounts["COMPLETE"] ?? 0,
        delayed: statusCounts["DELAYED"] ?? 0,
        blocked: statusCounts["BLOCKED"] ?? 0,
        missed: statusCounts["MISSED"] ?? 0,
        openConflicts,
        openConstraints,
        todayCount: todayActivities.length,
        thisWeekCount: thisWeekActivities.length,
        overdueCount: overdue.length,
        subsOnSite: subsThisWeek.length,
        urgentAlerts,
        myAlerts,
        openAlerts,
      },
      // 3-week lookahead breakdown
      weekStart: monday.toISOString(),
      weeks: weekBuckets.map((acts, i) => {
        const ws = new Date(monday);
        ws.setDate(monday.getDate() + i * 7);
        const we = new Date(ws);
        we.setDate(ws.getDate() + 6);
        return {
          label: `Week ${i + 1}`,
          start: ws.toISOString(),
          end: we.toISOString(),
          total: acts.length,
          byStatus: {
            planned: acts.filter(a => a.status === "PLANNED").length,
            inProgress: acts.filter(a => a.status === "IN_PROGRESS").length,
            complete: acts.filter(a => a.status === "COMPLETE").length,
            delayed: acts.filter(a => a.status === "DELAYED" || a.status === "BLOCKED" || a.status === "MISSED").length,
          },
          subs: [...new Set(acts.map(a => a.responsibleSubcontractorRaw).filter(Boolean))],
        };
      }),
      todayActivities,
      subsThisWeek,
      overdue: overdue.slice(0, 10),
      recentActivities,
      topAlerts,
      areaConflicts,
    });
  } catch (err) {
    console.error("GET .../projects/[projectSlug]/dashboard error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
