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

    const projectId    = searchParams.get("projectId");
    const lookaheadId  = searchParams.get("lookaheadId");
    const status       = searchParams.get("status");
    const category     = searchParams.get("category");
    const location     = searchParams.get("location");
    const subName      = searchParams.get("subcontractor");
    const search       = searchParams.get("search");
    const paginated    = searchParams.has("page");
    const page         = Math.max(1, parseInt(searchParams.get("page") ?? "1") || 1);
    const limit        = Math.min(1000, Math.max(1, parseInt(searchParams.get("limit") ?? "500") || 500));

    const where: Record<string, unknown> = { deletedAt: null };

    if (projectId)   where.projectId   = projectId;
    if (lookaheadId) where.lookaheadId = lookaheadId;
    if (status)      where.status      = status;
    if (category)    where.category    = category;
    if (location)    where.location    = { contains: location };

    if (subName) {
      where.responsibleSubcontractorRaw = { contains: subName };
    }

    if (search) {
      where.OR = [
        { activityDescription:         { contains: search } },
        { category:                    { contains: search } },
        { location:                    { contains: search } },
        { responsibleSubcontractorRaw: { contains: search } },
      ];
    }

    // If explicit ?page= param is passed, return paginated wrapper
    // Otherwise return flat array (what most pages expect)
    if (paginated) {
      const [activities, total] = await Promise.all([
        prisma.activity.findMany({
          where,
          orderBy: [{ plannedStart: "asc" }, { category: "asc" }],
          skip:  (page - 1) * limit,
          take:  limit,
        }),
        prisma.activity.count({ where }),
      ]);
      return NextResponse.json({ activities, total, page, limit });
    }

    const activities = await prisma.activity.findMany({
      where,
      orderBy: [{ plannedStart: "asc" }, { category: "asc" }],
      take: limit,
    });

    return NextResponse.json(activities);
  } catch (err) {
    console.error("GET /api/activities error:", err);
    return NextResponse.json({ error: "Failed to fetch activities" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { id, ...raw } = body;

    if (!id) {
      return NextResponse.json({ error: "Activity ID required" }, { status: 400 });
    }

    const ALLOWED_FIELDS = new Set([
      "status", "percentComplete", "actualStart", "actualFinish",
      "plannedStart", "plannedFinish", "delayReason", "priority",
      "responsibleSubcontractorRaw", "location", "category",
      "activityDescription", "locationId",
    ]);
    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (ALLOWED_FIELDS.has(k)) updates[k] = v;
    }

    const current = await prisma.activity.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    const userId = (session.user as { id: string }).id;
    const role = await getProjectRole(userId, current.projectId);
    if (!canManageWork(role)) {
      return NextResponse.json({ error: "View-only users cannot edit activities" }, { status: 403 });
    }

    const auditFields = ["status", "percentComplete", "actualStart", "actualFinish", "delayReason"];
    for (const field of auditFields) {
      if (field in updates && String(current[field as keyof typeof current]) !== String(updates[field])) {
        await prisma.auditLog.create({
          data: {
            projectId:   current.projectId,
            userId:      userId,
            entityType:  "ACTIVITY",
            entityId:    id,
            action:      field === "status" ? "STATUS_CHANGED" : "UPDATED",
            fieldChanged: field,
            oldValue:    String(current[field as keyof typeof current] ?? ""),
            newValue:    String(updates[field] ?? ""),
            changedBy:   userId,
          },
        });
      }
    }

    const updated = await prisma.activity.update({
      where: { id },
      data:  updates,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/activities error:", err);
    return NextResponse.json({ error: "Failed to update activity" }, { status: 500 });
  }
}
