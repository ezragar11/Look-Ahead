import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getProjectRole, canManageWork } from "@/lib/access";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
        projectLocation: { select: { id: true, name: true, zone: true, color: true } },
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
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, ...updates } = await req.json();
    if (!id) return NextResponse.json({ error: "Conflict ID required" }, { status: 400 });

    const conflict = await prisma.conflict.findUnique({ where: { id } });
    if (!conflict) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const userId = (session.user as { id: string }).id;
    const role = await getProjectRole(userId, conflict.projectId);
    if (!canManageWork(role)) {
      return NextResponse.json({ error: "View-only users cannot edit conflicts" }, { status: 403 });
    }

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
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { activityIds, ...conflictData } = body;

    if (conflictData.projectId) {
      const userId = (session.user as { id: string }).id;
      const role = await getProjectRole(userId, conflictData.projectId);
      if (!canManageWork(role)) {
        return NextResponse.json({ error: "View-only users cannot create conflicts" }, { status: 403 });
      }
    }

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
