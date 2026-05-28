import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function computeHealth(p: { delayedCount: number; openConflicts: number; openConstraints: number; overdueCount: number }): string {
  const issues = p.delayedCount + p.openConflicts + p.openConstraints + p.overdueCount;
  if (issues === 0) return "HEALTHY";
  if (issues <= 3)  return "WATCH";
  if (issues <= 8)  return "AT_RISK";
  return "CRITICAL";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const company = await prisma.company.findUnique({
      where: { slug: params.slug },
      select: { id: true, name: true, slug: true },
    });
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    const projects = await prisma.project.findMany({
      where: { companyId: company.id, deletedAt: null },
      include: {
        _count: {
          select: { activities: true, conflicts: true, delays: true, lookaheads: true, constraints: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const projectIds = projects.map((p) => p.id);
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekEnd = new Date(today.getTime() + 7 * 86400000);

    const [
      delayedActivities, openConflicts, openConstraints, totalUsers,
      recentUploads, totalComplete, totalActivitiesCount,
    ] = await Promise.all([
      prisma.activity.count({
        where: { projectId: { in: projectIds }, status: "DELAYED", deletedAt: null },
      }),
      prisma.conflict.count({
        where: { projectId: { in: projectIds }, status: "OPEN", deletedAt: null },
      }),
      prisma.constraint.count({
        where: { projectId: { in: projectIds }, status: { in: ["OPEN", "IN_PROGRESS"] }, deletedAt: null },
      }),
      prisma.companyUser.count({
        where: { companyId: company.id, status: "ACTIVE" },
      }),
      prisma.lookahead.count({
        where: {
          projectId: { in: projectIds },
          deletedAt:  null,
          uploadDate: { gte: new Date(Date.now() - 7 * 86400000) },
        },
      }),
      prisma.activity.count({
        where: { projectId: { in: projectIds }, status: "COMPLETE", deletedAt: null },
      }),
      prisma.activity.count({
        where: { projectId: { in: projectIds }, deletedAt: null },
      }),
    ]);

    // This week's work across all projects
    const thisWeekActivities = await prisma.activity.count({
      where: {
        projectId: { in: projectIds },
        deletedAt: null,
        plannedStart: { lt: weekEnd },
        plannedFinish: { gte: today },
      },
    });

    // Overdue across all projects
    const overdueCount = await prisma.activity.count({
      where: {
        projectId: { in: projectIds },
        deletedAt: null,
        status: { not: "COMPLETE" },
        plannedFinish: { lt: today },
      },
    });

    // Per-project enrichment
    const enriched = await Promise.all(
      projects.map(async (p) => {
        const [dc, oc, ocon, compCount, totalCount, odCount] = await Promise.all([
          prisma.activity.count({ where: { projectId: p.id, status: "DELAYED", deletedAt: null } }),
          prisma.conflict.count({ where: { projectId: p.id, status: "OPEN", deletedAt: null } }),
          prisma.constraint.count({ where: { projectId: p.id, status: { in: ["OPEN", "IN_PROGRESS"] }, deletedAt: null } }),
          prisma.activity.count({ where: { projectId: p.id, status: "COMPLETE", deletedAt: null } }),
          prisma.activity.count({ where: { projectId: p.id, deletedAt: null } }),
          prisma.activity.count({ where: { projectId: p.id, deletedAt: null, status: { not: "COMPLETE" }, plannedFinish: { lt: today } } }),
        ]);
        const completionPct = totalCount > 0 ? Math.round((compCount / totalCount) * 100) : 0;
        return {
          id: p.id,
          projectName: p.projectName,
          slug: p.slug,
          status: p.status,
          location: p.location,
          client: p.client,
          startDate: p.startDate,
          endDate: p.endDate,
          _count: p._count,
          delayedCount: dc,
          openConflicts: oc,
          openConstraints: ocon,
          overdueCount: odCount,
          completionPct,
          healthScore: computeHealth({ delayedCount: dc, openConflicts: oc, openConstraints: ocon, overdueCount: odCount }),
        };
      })
    );

    const completionRate = totalActivitiesCount > 0 ? Math.round((totalComplete / totalActivitiesCount) * 100) : 0;
    const atRiskProjects = enriched.filter(p => p.healthScore === "AT_RISK" || p.healthScore === "CRITICAL").length;

    return NextResponse.json({
      company,
      projects: enriched,
      stats: {
        totalProjects:      projects.length,
        activeProjects:     projects.filter((p) => p.status === "ACTIVE").length,
        totalActivities:    totalActivitiesCount,
        completeActivities: totalComplete,
        completionRate,
        delayedActivities,
        overdueCount,
        openConflicts,
        openConstraints,
        totalUsers,
        recentUploads,
        thisWeekWork: thisWeekActivities,
        atRiskProjects,
      },
    });
  } catch (err) {
    console.error("GET /api/companies/[slug]/dashboard error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
