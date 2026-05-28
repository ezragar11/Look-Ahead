import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const oldId = req.nextUrl.searchParams.get("oldId");
    const newId = req.nextUrl.searchParams.get("newId");
    if (!oldId || !newId) return NextResponse.json({ error: "oldId and newId required" }, { status: 400 });

    const [oldLookahead, newLookahead] = await Promise.all([
      prisma.lookahead.findUnique({
        where: { id: oldId },
        include: { activities: { where: { deletedAt: null }, orderBy: { activityDescription: "asc" } } },
      }),
      prisma.lookahead.findUnique({
        where: { id: newId },
        include: { activities: { where: { deletedAt: null }, orderBy: { activityDescription: "asc" } } },
      }),
    ]);

    if (!oldLookahead || !newLookahead) {
      return NextResponse.json({ error: "Lookahead not found" }, { status: 404 });
    }

    const oldMap = new Map(oldLookahead.activities.map((a) => [a.activityDescription.toLowerCase().trim(), a]));
    const newMap = new Map(newLookahead.activities.map((a) => [a.activityDescription.toLowerCase().trim(), a]));

    const added: { description: string; sub: string | null; category: string | null }[] = [];
    const removed: { description: string; sub: string | null; category: string | null }[] = [];
    const moved: { description: string; oldStart: string | null; newStart: string | null; oldFinish: string | null; newFinish: string | null }[] = [];
    const subChanges: { description: string; oldSub: string | null; newSub: string | null }[] = [];

    for (const [key, newAct] of newMap) {
      const oldAct = oldMap.get(key);
      if (!oldAct) {
        added.push({ description: newAct.activityDescription, sub: newAct.responsibleSubcontractorRaw, category: newAct.category });
        continue;
      }

      const oldStart  = oldAct.plannedStart?.toISOString().split("T")[0] ?? null;
      const newStart  = newAct.plannedStart?.toISOString().split("T")[0] ?? null;
      const oldFinish = oldAct.plannedFinish?.toISOString().split("T")[0] ?? null;
      const newFinish = newAct.plannedFinish?.toISOString().split("T")[0] ?? null;

      if (oldStart !== newStart || oldFinish !== newFinish) {
        moved.push({ description: newAct.activityDescription, oldStart, newStart, oldFinish, newFinish });
      }

      if ((oldAct.responsibleSubcontractorRaw ?? "") !== (newAct.responsibleSubcontractorRaw ?? "")) {
        subChanges.push({ description: newAct.activityDescription, oldSub: oldAct.responsibleSubcontractorRaw, newSub: newAct.responsibleSubcontractorRaw });
      }
    }

    for (const [key, oldAct] of oldMap) {
      if (!newMap.has(key)) {
        removed.push({ description: oldAct.activityDescription, sub: oldAct.responsibleSubcontractorRaw, category: oldAct.category });
      }
    }

    // Detect repeated delays: activities pushed forward in consecutive uploads
    const pushedForward = moved.filter((m) => {
      if (!m.oldStart || !m.newStart) return false;
      return new Date(m.newStart) > new Date(m.oldStart);
    });

    return NextResponse.json({
      oldName: oldLookahead.name,
      newName: newLookahead.name,
      oldDate: oldLookahead.uploadDate,
      newDate: newLookahead.uploadDate,
      added,
      removed,
      moved,
      subChanges,
      pushedForward,
      summary: {
        addedCount: added.length,
        removedCount: removed.length,
        movedCount: moved.length,
        subChangeCount: subChanges.length,
        pushedForwardCount: pushedForward.length,
      },
    });
  } catch (err) {
    console.error("GET /api/lookaheads/compare error:", err);
    return NextResponse.json({ error: "Failed to compare" }, { status: 500 });
  }
}
