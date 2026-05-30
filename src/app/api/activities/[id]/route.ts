import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, writeAuditLog } from "@/lib/auth";
import { getProjectRole, canManageWork } from "@/lib/access";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const [activity, auditLogs] = await Promise.all([
      prisma.activity.findUnique({
        where: { id: params.id },
        include: {
          subcontractor: true,
          occurrences:   { orderBy: { plannedDate: "asc" } },
          lookahead:     { select: { id: true, name: true, uploadDate: true } },
          project:       { select: { id: true, projectName: true } },
          activityNotes: { orderBy: { createdAt: "desc" } },
          attachments:   { where: { deletedAt: null } },
        },
      }),
      prisma.auditLog.findMany({
        where:   { entityType: "ACTIVITY", entityId: params.id },
        orderBy: { createdAt: "desc" },
        take:    50,
        include: { user: { select: { id: true, name: true } } },
      }),
    ]);

    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    return NextResponse.json({ ...activity, auditLogs });
  } catch (err) {
    console.error("GET /api/activities/[id] error:", err);
    return NextResponse.json({ error: "Failed to fetch activity" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const current = await prisma.activity.findUnique({ where: { id: params.id } });
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const userId = (session.user as { id: string }).id;
    const role = await getProjectRole(userId, current.projectId);
    if (!canManageWork(role)) {
      return NextResponse.json({ error: "View-only users cannot delete activities" }, { status: 403 });
    }

    await prisma.activity.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });

    await writeAuditLog({
      projectId: current.projectId,
      userId,
      changedBy: session.user?.name ?? "Unknown",
      entityType: "ACTIVITY",
      entityId: params.id,
      action: "DELETED",
      oldValue: current.activityDescription,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/activities/[id] error:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const updates = await req.json();

    const current = await prisma.activity.findUnique({ where: { id: params.id } });
    if (!current) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    const userId = (session.user as { id: string }).id;
    const role = await getProjectRole(userId, current.projectId);
    if (!canManageWork(role)) {
      return NextResponse.json({ error: "View-only users cannot edit activities" }, { status: 403 });
    }
    const changedBy = session?.user?.name ?? updates.changedBy ?? "Unknown";

    // Audit tracked fields
    const tracked = [
      "status", "percentComplete", "actualStart", "actualFinish",
      "plannedStart", "plannedFinish", "delayReason", "location",
      "responsibleSubcontractorRaw",
    ];

    for (const field of tracked) {
      if (!(field in updates)) continue;
      const oldVal = String(current[field as keyof typeof current] ?? "");
      const newVal = String(updates[field] ?? "");
      if (oldVal === newVal) continue;

      await writeAuditLog({
        projectId:   current.projectId,
        userId:      userId ?? undefined,
        changedBy,
        entityType:  "ACTIVITY",
        entityId:    params.id,
        action:      field === "status" ? "STATUS_CHANGED" : "UPDATED",
        fieldChanged: field,
        oldValue:    oldVal || undefined,
        newValue:    newVal || undefined,
        changeReason: updates.changeReason ?? undefined,
      });
    }

    // Whitelist editable fields — never spread raw client input into the DB
    // (prevents reassigning projectId/lookaheadId or writing system fields).
    const data: Record<string, unknown> = {};
    if (typeof updates.category === "string")                    data.category = updates.category;
    if (typeof updates.activityDescription === "string")         data.activityDescription = updates.activityDescription;
    if ("responsibleSubcontractorId" in updates)                 data.responsibleSubcontractorId = updates.responsibleSubcontractorId || null;
    if (typeof updates.responsibleSubcontractorRaw === "string") data.responsibleSubcontractorRaw = updates.responsibleSubcontractorRaw;
    if ("location" in updates)                                   data.location = updates.location || null;
    if ("locationId" in updates)                                 data.locationId = updates.locationId || null;
    if ("plannedStart" in updates)                               data.plannedStart = updates.plannedStart ? new Date(updates.plannedStart) : null;
    if ("plannedFinish" in updates)                              data.plannedFinish = updates.plannedFinish ? new Date(updates.plannedFinish) : null;
    if ("actualStart" in updates)                                data.actualStart = updates.actualStart ? new Date(updates.actualStart) : null;
    if ("actualFinish" in updates)                               data.actualFinish = updates.actualFinish ? new Date(updates.actualFinish) : null;
    if (typeof updates.status === "string")                      data.status = updates.status;
    if (typeof updates.percentComplete === "number")             data.percentComplete = updates.percentComplete;
    if ("delayReason" in updates)                                data.delayReason = updates.delayReason || null;
    if (typeof updates.priority === "string")                    data.priority = updates.priority;
    if (typeof updates.needsFollowUp === "boolean")              data.needsFollowUp = updates.needsFollowUp;
    if (typeof updates.inspectionRequired === "boolean")         data.inspectionRequired = updates.inspectionRequired;
    if (typeof updates.outageRequired === "boolean")             data.outageRequired = updates.outageRequired;
    if (typeof updates.materialRequired === "boolean")           data.materialRequired = updates.materialRequired;
    if (typeof updates.safetyConcern === "boolean")              data.safetyConcern = updates.safetyConcern;
    if ("notes" in updates)                                      data.notes = updates.notes || null;

    // ── Auto-flag risk indicators ──
    const merged = { ...current, ...data };

    // Started late: actual start is after planned start
    if (merged.actualStart && merged.plannedStart) {
      const actual = new Date(merged.actualStart).getTime();
      const planned = new Date(merged.plannedStart).getTime();
      if (actual > planned && !data.delayReason) {
        const daysLate = Math.ceil((actual - planned) / 86400000);
        data.needsFollowUp = true;
        if (!merged.delayReason) {
          data.delayReason = `Started ${daysLate} day${daysLate > 1 ? "s" : ""} late`;
        }
      }
    }

    // In progress but missing actual finish and past planned finish
    if (
      merged.status === "IN_PROGRESS" &&
      !merged.actualFinish &&
      merged.plannedFinish &&
      new Date(merged.plannedFinish).getTime() < Date.now()
    ) {
      data.needsFollowUp = true;
    }

    // Status changed to DELAYED/BLOCKED/MISSED → auto-flag
    if (["DELAYED", "BLOCKED", "MISSED"].includes(merged.status)) {
      data.needsFollowUp = true;
    }

    // Completed → clear follow-up flag
    if (merged.status === "COMPLETE" && merged.actualFinish) {
      data.needsFollowUp = false;
    }

    const updated = await prisma.activity.update({
      where: { id: params.id },
      data,
      include: {
        subcontractor: true,
        occurrences:   { orderBy: { plannedDate: "asc" } },
        activityNotes: { orderBy: { createdAt: "desc" } },
      },
    });

    // Fetch fresh audit logs
    const auditLogs = await prisma.auditLog.findMany({
      where:   { entityType: "ACTIVITY", entityId: params.id },
      orderBy: { createdAt: "desc" },
      take:    50,
      include: { user: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ ...updated, auditLogs });
  } catch (err) {
    console.error("PATCH /api/activities/[id] error:", err);
    return NextResponse.json({ error: "Failed to update activity" }, { status: 500 });
  }
}
