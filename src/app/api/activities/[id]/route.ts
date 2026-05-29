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

    // ── Auto-flag risk indicators ──
    const merged = { ...current, ...updates };

    // Started late: actual start is after planned start
    if (merged.actualStart && merged.plannedStart) {
      const actual = new Date(merged.actualStart).getTime();
      const planned = new Date(merged.plannedStart).getTime();
      if (actual > planned && !updates.delayReason) {
        const daysLate = Math.ceil((actual - planned) / 86400000);
        updates.needsFollowUp = true;
        if (!merged.delayReason) {
          updates.delayReason = `Started ${daysLate} day${daysLate > 1 ? "s" : ""} late`;
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
      updates.needsFollowUp = true;
    }

    // Status changed to DELAYED/BLOCKED/MISSED → auto-flag
    if (["DELAYED", "BLOCKED", "MISSED"].includes(merged.status)) {
      updates.needsFollowUp = true;
    }

    // Completed → clear follow-up flag
    if (merged.status === "COMPLETE" && merged.actualFinish) {
      updates.needsFollowUp = false;
    }

    const updated = await prisma.activity.update({
      where: { id: params.id },
      data:  updates,
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
