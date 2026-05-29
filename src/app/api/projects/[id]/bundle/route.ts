import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const projectId = params.id;

    const [activities, conflicts, alerts, notes, constraints, delays] = await Promise.all([
      prisma.activity.findMany({
        where: { projectId, deletedAt: null },
        orderBy: [{ plannedStart: "asc" }, { category: "asc" }],
        take: 500,
      }),
      prisma.conflict.findMany({
        where: { projectId, deletedAt: null },
        include: {
          conflictActivities: {
            include: {
              activity: {
                select: { id: true, activityDescription: true, location: true, subcontractor: { select: { name: true } } },
              },
            },
          },
          notes: { orderBy: { createdAt: "desc" } },
        },
        orderBy: [{ severity: "desc" }, { dateIdentified: "desc" }],
      }),
      prisma.alert.findMany({
        where: { projectId, deletedAt: null },
        include: { assignedTo: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.note.findMany({
        where: { projectId, deletedAt: null },
        include: { activity: { select: { activityDescription: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.constraint.findMany({
        where: { projectId, deletedAt: null },
        include: { activity: { select: { id: true, activityDescription: true, location: true } } },
        orderBy: [{ priority: "desc" }, { neededBy: "asc" }],
      }),
      prisma.delay.findMany({
        where: { projectId, deletedAt: null },
        include: {
          activity: { select: { id: true, activityDescription: true, location: true } },
          subcontractor: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({ activities, conflicts, alerts, notes, constraints, delays });
  } catch (err) {
    console.error("GET /api/projects/[id]/bundle error:", err);
    return NextResponse.json({ error: "Failed to fetch project data" }, { status: 500 });
  }
}
