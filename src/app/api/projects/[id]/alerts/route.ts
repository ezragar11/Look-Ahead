import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getProjectRole, canManageAlerts, canCreateAlerts } from "@/lib/access";

export const dynamic = "force-dynamic";

// Helper to write audit log
async function audit(opts: {
  projectId: string; userId: string; entityId: string;
  action: string; fieldChanged?: string; oldValue?: string; newValue?: string;
}) {
  await prisma.auditLog.create({
    data: {
      projectId: opts.projectId,
      userId: opts.userId,
      changedBy: opts.userId,
      entityType: "ALERT",
      entityId: opts.entityId,
      action: opts.action,
      fieldChanged: opts.fieldChanged,
      oldValue: opts.oldValue,
      newValue: opts.newValue,
    },
  });
}

// ── GET — list alerts ──────────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as { id: string }).id;
    const role = await getProjectRole(userId, params.id);
    if (!role) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    const deleted = req.nextUrl.searchParams.get("deleted");
    const status = req.nextUrl.searchParams.get("status");
    const priority = req.nextUrl.searchParams.get("priority");
    const assignedToMe = req.nextUrl.searchParams.get("assignedToMe");

    const where: Record<string, unknown> = { projectId: params.id };
    if (deleted === "only") {
      where.deletedAt = { not: null };
    } else {
      where.deletedAt = null;
    }
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assignedToMe === "true") where.assignedToId = userId;

    const alerts = await prisma.alert.findMany({
      where,
      include: {
        projectLocation: { select: { id: true, name: true, zone: true, color: true } },
        activity: { select: { id: true, activityDescription: true, responsibleSubcontractorRaw: true } },
        subcontractor: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });

    // Sort: URGENT first, then HIGH, MEDIUM, LOW
    const priorityOrder: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    alerts.sort((a, b) => (priorityOrder[b.priority] ?? 0) - (priorityOrder[a.priority] ?? 0));

    return NextResponse.json(alerts);
  } catch (err) {
    console.error("GET /api/projects/[id]/alerts error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// ── POST — create alert (anyone on project) ────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as { id: string }).id;
    const role = await getProjectRole(userId, params.id);
    if (!canCreateAlerts(role)) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    const body = await req.json();
    const {
      title, description, alertType, priority, locationId, locationText,
      activityId, subcontractorId, assignedToId,
    } = body;

    if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });

    // Only alert managers can assign on creation
    const finalAssignedTo = canManageAlerts(role) ? (assignedToId || null) : null;
    const finalStatus = finalAssignedTo ? "ASSIGNED" : "OPEN";

    const alert = await prisma.alert.create({
      data: {
        projectId: params.id,
        title: title.trim(),
        description: description?.trim() || null,
        alertType: alertType || "GENERAL",
        priority: priority || "MEDIUM",
        status: finalStatus,
        locationId: locationId || null,
        locationText: locationText?.trim() || null,
        activityId: activityId || null,
        subcontractorId: subcontractorId || null,
        assignedToId: finalAssignedTo,
        createdById: userId,
      },
      include: {
        projectLocation: { select: { id: true, name: true, zone: true, color: true } },
        assignedTo: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    await audit({ projectId: params.id, userId, entityId: alert.id, action: "CREATED" });

    // Check for crew overlap warning
    let areaWarning: string | null = null;
    if (alert.priority === "URGENT" && (locationId || locationText)) {
      const locName = alert.projectLocation?.name ?? locationText;
      if (locationId) {
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
        const activitiesInArea = await prisma.activity.findMany({
          where: {
            projectId: params.id,
            locationId,
            deletedAt: null,
            plannedStart: { lte: todayEnd },
            plannedFinish: { gte: todayStart },
          },
          select: { responsibleSubcontractorRaw: true },
        });
        const crews = [...new Set(activitiesInArea.map(a => a.responsibleSubcontractorRaw).filter(Boolean))];
        if (crews.length > 1) {
          areaWarning = `${crews.join(", ")} are all scheduled in ${locName} today. This alert may affect multiple crews.`;
        }
      }
    }

    return NextResponse.json({ ...alert, areaWarning }, { status: 201 });
  } catch (err) {
    console.error("POST /api/projects/[id]/alerts error:", err);
    return NextResponse.json({ error: "Failed to create alert" }, { status: 500 });
  }
}

// ── PATCH — update alert ───────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as { id: string }).id;
    const role = await getProjectRole(userId, params.id);
    if (!role) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    const body = await req.json();
    const { alertId, status, priority, assignedToId, resolutionNote, description, locationId, locationText } = body;
    if (!alertId) return NextResponse.json({ error: "alertId required" }, { status: 400 });

    const existing = await prisma.alert.findUnique({ where: { id: alertId, projectId: params.id } });
    if (!existing) return NextResponse.json({ error: "Alert not found" }, { status: 404 });

    const data: Record<string, unknown> = {};

    // Assignment changes — only alert managers
    if (assignedToId !== undefined) {
      if (!canManageAlerts(role)) return NextResponse.json({ error: "Only admins/managers can assign alerts" }, { status: 403 });
      data.assignedToId = assignedToId || null;
      if (assignedToId && existing.status === "OPEN") data.status = "ASSIGNED";
      await audit({ projectId: params.id, userId, entityId: alertId, action: "UPDATED", fieldChanged: "assignedToId", oldValue: existing.assignedToId ?? undefined, newValue: assignedToId ?? undefined });
    }

    // Status changes
    if (status) {
      // Resolving requires a note
      if (status === "RESOLVED" || status === "CLOSED") {
        if (!resolutionNote?.trim() && !existing.resolutionNote) {
          return NextResponse.json({ error: "Resolution note required" }, { status: 400 });
        }
        data.resolvedById = userId;
        data.resolvedAt = new Date();
        if (resolutionNote?.trim()) data.resolutionNote = resolutionNote.trim();
      }
      data.status = status;
      await audit({ projectId: params.id, userId, entityId: alertId, action: "STATUS_CHANGED", fieldChanged: "status", oldValue: existing.status, newValue: status });
    }

    if (priority) {
      data.priority = priority;
      await audit({ projectId: params.id, userId, entityId: alertId, action: "UPDATED", fieldChanged: "priority", oldValue: existing.priority, newValue: priority });
    }
    if (description !== undefined) data.description = description?.trim() || null;
    if (locationId !== undefined) data.locationId = locationId || null;
    if (locationText !== undefined) data.locationText = locationText?.trim() || null;

    const updated = await prisma.alert.update({
      where: { id: alertId },
      data,
      include: {
        projectLocation: { select: { id: true, name: true, zone: true, color: true } },
        assignedTo: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/projects/[id]/alerts error:", err);
    return NextResponse.json({ error: "Failed to update alert" }, { status: 500 });
  }
}

// ── DELETE — soft-delete alert ─────────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as { id: string }).id;
    const role = await getProjectRole(userId, params.id);
    if (!canManageAlerts(role)) return NextResponse.json({ error: "Only admins/managers can delete alerts" }, { status: 403 });

    const { alertId } = await req.json();
    if (!alertId) return NextResponse.json({ error: "alertId required" }, { status: 400 });

    await prisma.alert.update({
      where: { id: alertId, projectId: params.id },
      data: { deletedAt: new Date(), deletedBy: userId },
    });

    await audit({ projectId: params.id, userId, entityId: alertId, action: "DELETED" });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/projects/[id]/alerts error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
