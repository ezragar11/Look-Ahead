import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, writeAuditLog } from "@/lib/auth";
import { getProjectRole, canManageWork } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
        projectId:        body.projectId,
        activityId:       body.activityId ?? null,
        subcontractorId:  body.subcontractorId ?? null,
        title:            body.title,
        delayType:        body.delayType ?? undefined,
        daysDelayed:      typeof body.daysDelayed === "number" ? body.daysDelayed : null,
        cause:            body.cause ?? null,
        responsibleParty: body.responsibleParty ?? null,
        impact:           body.impact ?? null,
        status:           body.status ?? undefined,
        notes:            body.notes ?? null,
        createdBy:        session?.user?.name ?? "Unknown",
        startDate:        body.startDate ? new Date(body.startDate) : null,
        endDate:          body.endDate   ? new Date(body.endDate)   : null,
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

    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const existing = await prisma.delay.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const userId = (session.user as { id: string }).id;
    const role = await getProjectRole(userId, existing.projectId);
    if (!canManageWork(role)) {
      return NextResponse.json({ error: "View-only users cannot edit delays" }, { status: 403 });
    }

    const data: Record<string, unknown> = {};
    if (typeof body.title === "string")            data.title = body.title;
    if (typeof body.delayType === "string")        data.delayType = body.delayType;
    if (typeof body.cause === "string")            data.cause = body.cause;
    if (typeof body.responsibleParty === "string") data.responsibleParty = body.responsibleParty;
    if (typeof body.impact === "string")           data.impact = body.impact;
    if (typeof body.status === "string")           data.status = body.status;
    if (typeof body.notes === "string")            data.notes = body.notes;
    if (typeof body.daysDelayed === "number")      data.daysDelayed = body.daysDelayed;
    if ("activityId" in body)                      data.activityId = body.activityId || null;
    if ("subcontractorId" in body)                 data.subcontractorId = body.subcontractorId || null;
    if (body.startDate !== undefined)              data.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.endDate !== undefined)                data.endDate = body.endDate ? new Date(body.endDate) : null;

    const delay = await prisma.delay.update({
      where: { id },
      data,
    });

    if (session?.user && data.status) {
      await writeAuditLog({
        projectId:   delay.projectId,
        userId:      (session.user as { id: string }).id,
        changedBy:   session.user.name ?? "Unknown",
        entityType:  "DELAY",
        entityId:    delay.id,
        action:      "STATUS_CHANGED",
        fieldChanged: "status",
        newValue:    data.status as string,
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
