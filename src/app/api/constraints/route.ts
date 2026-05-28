import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, writeAuditLog } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const status    = searchParams.get("status");
    const type      = searchParams.get("type");
    const priority  = searchParams.get("priority");

    const deleted = searchParams.get("deleted");
    const where: Record<string, unknown> = deleted === "only"
      ? { deletedAt: { not: null } }
      : { deletedAt: null };
    if (projectId) where.projectId = projectId;
    if (status)    where.status    = status;
    if (type)      where.type      = type;
    if (priority)  where.priority  = priority;

    const constraints = await prisma.constraint.findMany({
      where,
      include: {
        activity: { select: { id: true, activityDescription: true, location: true } },
      },
      orderBy: [{ priority: "desc" }, { neededBy: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(constraints);
  } catch (err) {
    console.error("GET /api/constraints error:", err);
    return NextResponse.json({ error: "Failed to fetch constraints" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const body    = await req.json();

    const constraint = await prisma.constraint.create({
      data: {
        ...body,
        createdBy: session?.user?.name ?? "Unknown",
        neededBy:  body.neededBy ? new Date(body.neededBy) : null,
      },
    });

    if (session?.user) {
      await writeAuditLog({
        projectId:  constraint.projectId,
        userId:     (session.user as { id: string }).id,
        changedBy:  session.user.name ?? "Unknown",
        entityType: "CONSTRAINT",
        entityId:   constraint.id,
        action:     "CREATED",
        newValue:   constraint.title,
      });
    }

    return NextResponse.json(constraint);
  } catch (err) {
    console.error("POST /api/constraints error:", err);
    return NextResponse.json({ error: "Failed to create constraint" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session       = await getSession();
    const { id, ...updates } = await req.json();
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    if (updates.status === "RESOLVED" && !updates.resolvedAt) {
      updates.resolvedAt = new Date();
    }
    if (updates.neededBy) updates.neededBy = new Date(updates.neededBy);

    const constraint = await prisma.constraint.update({
      where: { id },
      data:  updates,
    });

    if (session?.user && updates.status) {
      await writeAuditLog({
        projectId:   constraint.projectId,
        userId:      (session.user as { id: string }).id,
        changedBy:   session.user.name ?? "Unknown",
        entityType:  "CONSTRAINT",
        entityId:    constraint.id,
        action:      "STATUS_CHANGED",
        fieldChanged: "status",
        newValue:    updates.status,
      });
    }

    return NextResponse.json(constraint);
  } catch (err) {
    console.error("PATCH /api/constraints error:", err);
    return NextResponse.json({ error: "Failed to update constraint" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    const { id }  = await req.json();
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const constraint = await prisma.constraint.update({
      where: { id },
      data:  { deletedAt: new Date() },
    });

    if (session?.user) {
      await writeAuditLog({
        projectId:  constraint.projectId,
        userId:     (session.user as { id: string }).id,
        changedBy:  session.user.name ?? "Unknown",
        entityType: "CONSTRAINT",
        entityId:   constraint.id,
        action:     "DELETED",
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/constraints error:", err);
    return NextResponse.json({ error: "Failed to delete constraint" }, { status: 500 });
  }
}
