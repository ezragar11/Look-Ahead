import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getProjectRole, canManageWork } from "@/lib/access";

export const dynamic = "force-dynamic";

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

    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: "Conflict ID required" }, { status: 400 });

    const conflict = await prisma.conflict.findUnique({ where: { id } });
    if (!conflict) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const userId = (session.user as { id: string }).id;
    const role = await getProjectRole(userId, conflict.projectId);
    if (!canManageWork(role)) {
      return NextResponse.json({ error: "View-only users cannot edit conflicts" }, { status: 403 });
    }

    const data: Record<string, unknown> = {};
    if (typeof body.title === "string")           data.title = body.title;
    if (typeof body.description === "string")      data.description = body.description;
    if (typeof body.conflictType === "string")     data.conflictType = body.conflictType;
    if (typeof body.severity === "string")         data.severity = body.severity;
    if (typeof body.status === "string")           data.status = body.status;
    if (typeof body.owner === "string")            data.owner = body.owner;
    if (typeof body.location === "string")         data.location = body.location;
    if ("locationId" in body)                      data.locationId = body.locationId || null;
    if (typeof body.resolutionNotes === "string")  data.resolutionNotes = body.resolutionNotes;
    if (body.neededBy !== undefined)               data.neededBy = body.neededBy ? new Date(body.neededBy) : null;
    if (data.status === "RESOLVED" && !body.resolvedAt) data.resolvedAt = new Date();

    const updated = await prisma.conflict.update({
      where: { id },
      data,
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
    const { activityIds } = body;

    if (body.projectId) {
      const userId = (session.user as { id: string }).id;
      const role = await getProjectRole(userId, body.projectId);
      if (!canManageWork(role)) {
        return NextResponse.json({ error: "View-only users cannot create conflicts" }, { status: 403 });
      }
    }

    const conflict = await prisma.conflict.create({
      data: {
        projectId:       body.projectId,
        title:           body.title,
        description:     body.description ?? null,
        conflictType:    body.conflictType ?? undefined,
        severity:        body.severity ?? undefined,
        status:          body.status ?? undefined,
        owner:           body.owner ?? null,
        location:        body.location ?? null,
        locationId:      body.locationId ?? null,
        neededBy:        body.neededBy ? new Date(body.neededBy) : null,
        isAutoDetected:  body.isAutoDetected === true,
      },
    });

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
