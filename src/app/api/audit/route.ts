import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const projectId  = searchParams.get("projectId");
    const entityType = searchParams.get("entityType");
    const entityId   = searchParams.get("entityId");
    const action     = searchParams.get("action");
    const userId     = searchParams.get("userId");
    const limit      = parseInt(searchParams.get("limit") ?? "100");
    const offset     = parseInt(searchParams.get("offset") ?? "0");

    const where: Record<string, unknown> = {};
    if (projectId)  where.projectId  = projectId;
    if (entityType) where.entityType = entityType;
    if (entityId)   where.entityId   = entityId;
    if (action)     where.action     = action;
    if (userId)     where.userId     = userId;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take:    limit,
        skip:    offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({ logs, total });
  } catch (err) {
    console.error("GET /api/audit error:", err);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
