import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";

export async function GET() {
  try {
    const now       = new Date();
    const todayStart = startOfDay(now);
    const todayEnd   = endOfDay(now);
    const weekStart  = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd    = endOfWeek(now, { weekStartsOn: 1 });

    // Status counts
    const statusCounts = await prisma.activity.groupBy({
      by:    ["status"],
      _count: { id: true },
    });

    const counts: Record<string, number> = {};
    for (const sc of statusCounts) {
      counts[sc.status] = sc._count.id;
    }

    // Open conflicts
    const openConflicts = await prisma.conflict.count({
      where: { status: { in: ["OPEN", "UNDER_REVIEW"] } },
    });

    // Today's activities (via occurrences)
    const todayOccurrences = await prisma.activityOccurrence.findMany({
      where: {
        plannedDate: { gte: todayStart, lte: todayEnd },
        isPlanned:   true,
      },
      include: {
        activity: {
          include: { subcontractor: true },
        },
      },
      orderBy: { plannedDate: "asc" },
    });

    // This week's activities
    const weekOccurrences = await prisma.activityOccurrence.findMany({
      where: {
        plannedDate: { gte: weekStart, lte: weekEnd },
        isPlanned:   true,
      },
      include: {
        activity: {
          include: { subcontractor: true },
        },
      },
      orderBy: { plannedDate: "asc" },
    });

    // Recent lookaheads
    const recentLookaheads = await prisma.lookahead.findMany({
      orderBy: { uploadDate: "desc" },
      take:    5,
      include: {
        project:   { select: { projectName: true } },
        _count:    { select: { activities: true } },
      },
    });

    // Subcontractor workload
    const subWorkload = await prisma.subcontractor.findMany({
      include: {
        activities: {
          select: { status: true },
        },
      },
    });

    const subcontractorWorkload = subWorkload
      .filter((s) => s.activities.length > 0)
      .map((s) => ({
        name:     s.name,
        total:    s.activities.length,
        complete: s.activities.filter((a) => a.status === "COMPLETE").length,
        delayed:  s.activities.filter((a) => a.status === "DELAYED").length,
        planned:  s.activities.filter((a) => a.status === "PLANNED").length,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    // Unique today activities (deduplicate by activity)
    const seenToday = new Set<string>();
    const todayActivities = todayOccurrences
      .filter((o) => {
        if (seenToday.has(o.activityId)) return false;
        seenToday.add(o.activityId);
        return true;
      })
      .map((o) => o.activity);

    const seenWeek = new Set<string>();
    const thisWeekActivities = weekOccurrences
      .filter((o) => {
        if (seenWeek.has(o.activityId)) return false;
        seenWeek.add(o.activityId);
        return true;
      })
      .map((o) => o.activity);

    return NextResponse.json({
      totalActivities:     Object.values(counts).reduce((a, b) => a + b, 0),
      planned:             counts["PLANNED"]         ?? 0,
      inProgress:          counts["IN_PROGRESS"]     ?? 0,
      complete:            counts["COMPLETE"]        ?? 0,
      delayed:             counts["DELAYED"]         ?? 0,
      missed:              counts["MISSED"]          ?? 0,
      blocked:             counts["BLOCKED"]         ?? 0,
      needsFollowUp:       counts["NEEDS_FOLLOW_UP"] ?? 0,
      openConflicts,
      todayActivities,
      thisWeekActivities,
      recentLookaheads,
      subcontractorWorkload,
    });
  } catch (err) {
    console.error("GET /api/dashboard error:", err);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
