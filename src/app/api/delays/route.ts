import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, writeAuditLog } from "@/lib/auth";
import { getProjectRole, canManageWork } from "@/lib/access";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const status    = searchParams.get("status");
    const delayType = searchParams.get("delayType");

    const deleted = searchParams.get("deleted");
    const where: Record<string, unknown> = deleted === "only"
      ? { deletedAt: { not: null } }
      : { deletedAt: null };
    if (projectId) where.projectId = projectId;
    if (status)    where.status    = status;
    if (delayType) where.delayType = delayType;

    const delays = await prisma.delay.findMany({
      where,
      include: {
        activity:      { select: { id: true, activityDescription: true, location: true } },
        subcontractor: { select: { id: true, name: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    return NextResponse.json(delays);
  } catch (err) {
    console.error("GET /api/delays error:", err);
    return NextResponse.json({ error: "Failed to fetch delays" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    const userId = (session.user as { id: string }).id;
    if (body.projectId) {
      const role = await getProjectRole(userId, body.projectId);
      if (!canManageWork(role)) {
        return NextResponse.json({ error: "View-only users cannot create delays" }, { status: 403 });
      }
    }

    const delay = await prisma.delay.create({
      data: {
        ...body,
        createdBy: session?.user?.name ?? "Unknown",
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate:   body.endDate   ? new Date(body.endDate)   : null,
      },
    });

    if (session?.user) {
      await writeAuditLog({
        projectId:  delay.projectId,
        userId:     (session.user as { id: string }).id,
        changedBy:  session.user.name ?? "Unknown",
        entityType: "DELAY",
        entityId:   delay.id,
        action:     "CREATED",
        newValue:   delay.title,
      });
    }

    return NextResponse.json(delay);
  } catch (err) {
    console.error("POST /api/delays error:", err);
    return NextResponse.json({ error: "Failed to create delay" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, ...updates } = await req.json();
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const existing = await prisma.delay.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const userId = (session.user as { id: string }).id;
    const role = await getProjectRole(userId, existing.projectId);
    if (!canManageWork(role)) {
      return NextResponse.json({ error: "View-only users cannot edit delays" }, { status: 403 });
    }

    if (updates.startDate) updates.startDate = new Date(updates.startDate);
    if (updates.endDate)   updates.endDate   = new Date(updates.endDate);

    const delay = await prisma.delay.update({
      where: { id },
      data:  updates,
    });

    if (session?.user && updates.status) {
      await writeAuditLog({
        projectId:   delay.projectId,
        userId:      (session.user as { id: string }).id,
        changedBy:   session.user.name ?? "Unknown",
        entityType:  "DELAY",
        entityId:    delay.id,
        action:      "STATUS_CHANGED",
        fieldChanged: "status",
        newValue:    updates.status,
      });
    }

    return NextResponse.json(delay);
  } catch (err) {
    console.error("PATCH /api/delays error:", err);
    return NextResponse.json({ error: "Failed to update delay" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const existing = await prisma.delay.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const userId = (session.user as { id: string }).id;
    const role = await getProjectRole(userId, existing.projectId);
    if (!canManageWork(role)) {
      return NextResponse.json({ error: "View-only users cannot delete delays" }, { status: 403 });
    }

    const delay = await prisma.delay.update({
      where: { id },
      data:  { deletedAt: new Date() },
    });

    if (session?.user) {
      await writeAuditLog({
        projectId:  delay.projectId,
        userId:     (session.user as { id: string }).id,
        changedBy:  session.user.name ?? "Unknown",
        entityType: "DELAY",
        entityId:   delay.id,
        action:     "DELETED",
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/delays error:", err);
    return NextResponse.json({ error: "Failed to delete delay" }, { status: 500 });
  }
}
