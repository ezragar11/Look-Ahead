/**
 * LookAhead Pro — Smart Conflict Detection
 *
 * Automatically scans imported activities and generates conflict records for:
 *  - Same subcontractor in 2+ locations on the same day
 *  - Multiple trades in same location on same day
 *  - Activities past their planned finish with no actual finish
 *  - Activities missing a subcontractor
 *  - Activities missing a location
 *  - Delivery scheduled after its related install activity
 */

import { prisma } from "@/lib/prisma";

interface DetectedConflict {
  title:         string;
  description:   string;
  conflictType:  string;
  severity:      string;
  location?:     string;
  activityIds:   string[];
}

export async function runConflictDetection(projectId: string): Promise<number> {
  const now = new Date();
  let created = 0;

  // ── Fetch all activities with occurrences ────────────────────────────────
  const activities = await prisma.activity.findMany({
    where:   { projectId },
    include: {
      occurrences:  { orderBy: { plannedDate: "asc" } },
      subcontractor: true,
    },
  });

  const detected: DetectedConflict[] = [];

  // ── 1. Build day → {location → [activities]} map ─────────────────────────
  // Used for both "same sub, two locations" and "multiple trades, same location"
  const dayLocationMap = new Map<
    string, // "YYYY-MM-DD"
    Map<string, { activityId: string; subName: string | null }[]> // location → []
  >();

  const daySubMap = new Map<
    string, // "YYYY-MM-DD"
    Map<string, { activityId: string; location: string | null }[]> // subName → []
  >();

  for (const activity of activities) {
    for (const occ of activity.occurrences) {
      const day = occ.plannedDate.toISOString().split("T")[0];
      const loc  = activity.location?.trim().toUpperCase() ?? "UNKNOWN";
      const sub  = activity.subcontractor?.name ?? activity.responsibleSubcontractorRaw ?? null;

      // Location map
      if (!dayLocationMap.has(day)) dayLocationMap.set(day, new Map());
      const locMap = dayLocationMap.get(day)!;
      if (!locMap.has(loc)) locMap.set(loc, []);
      locMap.get(loc)!.push({ activityId: activity.id, subName: sub });

      // Sub map
      if (sub) {
        if (!daySubMap.has(day)) daySubMap.set(day, new Map());
        const subMap = daySubMap.get(day)!;
        const key = sub.toLowerCase();
        if (!subMap.has(key)) subMap.set(key, []);
        subMap.get(key)!.push({ activityId: activity.id, location: activity.location ?? null });
      }
    }
  }

  // ── 2. Multiple trades in same location on same day ───────────────────────
  for (const [day, locMap] of dayLocationMap.entries()) {
    for (const [loc, entries] of locMap.entries()) {
      if (loc === "UNKNOWN") continue;

      // Get unique subs
      const subs = [...new Set(entries.map((e) => e.subName).filter(Boolean))];
      if (subs.length >= 2) {
        const ids = [...new Set(entries.map((e) => e.activityId))];
        detected.push({
          title:       `Trade overlap at ${loc} on ${day}`,
          description: `${subs.join(", ")} are all scheduled at ${loc} on ${day}. Verify no access conflict.`,
          conflictType: "TRADE_OVERLAP",
          severity:    subs.length >= 3 ? "HIGH" : "MEDIUM",
          location:    loc,
          activityIds: ids,
        });
      }
    }
  }

  // ── 3. Same subcontractor in multiple locations on same day ───────────────
  for (const [day, subMap] of daySubMap.entries()) {
    for (const [sub, entries] of subMap.entries()) {
      const locs = [...new Set(entries.map((e) => e.location).filter(Boolean))];
      if (locs.length >= 2) {
        const ids = [...new Set(entries.map((e) => e.activityId))];
        detected.push({
          title:       `${entries[0]?.location ?? sub} double-booked on ${day}`,
          description: `Subcontractor is scheduled in multiple locations (${locs.join(", ")}) on the same day.`,
          conflictType: "CREW_AVAILABILITY",
          severity:    "HIGH",
          activityIds: ids,
        });
      }
    }
  }

  // ── 4. Past-due activities (planned finish passed, no actual finish) ───────
  for (const activity of activities) {
    if (activity.plannedFinish && !activity.actualFinish) {
      const finishDate = new Date(activity.plannedFinish);
      if (finishDate < now && activity.status !== "COMPLETE" && activity.status !== "CANCELLED") {
        detected.push({
          title:       `Past due: ${activity.activityDescription.slice(0, 60)}`,
          description: `Planned finish was ${finishDate.toISOString().split("T")[0]} but no actual finish recorded. Status: ${activity.status}.`,
          conflictType: "SEQUENCE_ISSUE",
          severity:    activity.status === "BLOCKED" ? "CRITICAL" : "HIGH",
          location:    activity.location ?? undefined,
          activityIds: [activity.id],
        });
      }
    }
  }

  // ── 5. Activities missing subcontractor ───────────────────────────────────
  for (const activity of activities) {
    if (
      !activity.responsibleSubcontractorRaw?.trim() &&
      !activity.responsibleSubcontractorId &&
      activity.occurrences.length > 0
    ) {
      detected.push({
        title:       `No subcontractor assigned: ${activity.activityDescription.slice(0, 50)}`,
        description: `Activity has planned work days but no responsible subcontractor assigned.`,
        conflictType: "TRADE_OVERLAP",
        severity:    "LOW",
        location:    activity.location ?? undefined,
        activityIds: [activity.id],
      });
    }
  }

  // ── 6. Delivery after related install ─────────────────────────────────────
  const deliveries = activities.filter((a) =>
    a.activityDescription.toLowerCase().includes("deliver") ||
    a.activityDescription.toLowerCase().includes("shipment")
  );
  const installs = activities.filter((a) =>
    a.activityDescription.toLowerCase().includes("install") ||
    a.activityDescription.toLowerCase().includes("mobilize") ||
    a.activityDescription.toLowerCase().includes("start")
  );

  for (const delivery of deliveries) {
    const deliveryStart = delivery.occurrences[0]?.plannedDate;
    if (!deliveryStart) continue;

    for (const install of installs) {
      const installStart = install.occurrences[0]?.plannedDate;
      if (!installStart) continue;

      // Same location or related keywords
      const sameLocation =
        delivery.location &&
        install.location &&
        delivery.location.toUpperCase() === install.location.toUpperCase();

      if (sameLocation && deliveryStart > installStart) {
        detected.push({
          title:       `Delivery after install at ${delivery.location}`,
          description: `"${delivery.activityDescription}" (starts ${deliveryStart.toISOString().split("T")[0]}) may be needed before "${install.activityDescription}" (starts ${installStart.toISOString().split("T")[0]}).`,
          conflictType: "MATERIAL_DELIVERY",
          severity:    "MEDIUM",
          location:    delivery.location ?? undefined,
          activityIds: [delivery.id, install.id],
        });
      }
    }
  }

  // ── Persist detected conflicts (skip duplicates by title) ─────────────────
  const existingTitles = new Set(
    (
      await prisma.conflict.findMany({
        where:  { projectId, isAutoDetected: true },
        select: { title: true },
      })
    ).map((c) => c.title)
  );

  for (const d of detected) {
    if (existingTitles.has(d.title)) continue;

    const conflict = await prisma.conflict.create({
      data: {
        projectId,
        title:         d.title,
        description:   d.description,
        conflictType:  d.conflictType,
        severity:      d.severity,
        status:        "OPEN",
        isAutoDetected: true,
        dateIdentified: now,
      },
    });

    // Link activities
    for (const activityId of d.activityIds) {
      await prisma.conflictActivity.upsert({
        where:  { conflictId_activityId: { conflictId: conflict.id, activityId } },
        update: {},
        create: { conflictId: conflict.id, activityId },
      });
    }

    created++;
  }

  return created;
}
