import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const status    = searchParams.get("status");
    const severity  = searchParams.get("severity");

    const deleted = searchParams.get("deleted");
    const where: Record<string, unknown> = deleted === "only"
      ? { deletedAt: { not: null } }
      : { deletedAt: null };
    if (projectId) where.projectId = projectId;
    if (status)    where.status    = status;
    if (severity)  where.severity  = severity;

    const conflicts = await prisma.conflict.findMany({
      where,
      include: {
        conflictActivities: {
          include: {
            activity: {
              select: {
                id:                  true,
                activityDescription: true,
                location:            true,
                subcontractor:       { select: { name: true } },
              },
            },
          },
        },
        notes: { orderBy: { createdAt: "desc" } },
      },
      orderBy: [
        { severity: "desc" },
        { dateIdentified: "desc" },
      ],
    });

    return NextResponse.json(conflicts);
  } catch (err) {
    console.error("GET /api/conflicts error:", err);
    return NextResponse.json({ error: "Failed to fetch conflicts" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, ...updates } = await req.json();
    if (!id) return NextResponse.json({ error: "Conflict ID required" }, { status: 400 });

    const updated = await prisma.conflict.update({
      where: { id },
      data:  updates,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/conflicts error:", err);
    return NextResponse.json({ error: "Failed to update conflict" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { activityIds, ...conflictData } = body;

    const conflict = await prisma.conflict.create({ data: conflictData });

    if (activityIds?.length) {
      for (const activityId of activityIds) {
        await prisma.conflictActivity.create({
          data: { conflictId: conflict.id, activityId },
        });
      }
    }

    return NextResponse.json(conflict);
  } catch (err) {
    console.error("POST /api/conflicts error:", err);
    return NextResponse.json({ error: "Failed to create conflict" }, { status: 500 });
  }
}
