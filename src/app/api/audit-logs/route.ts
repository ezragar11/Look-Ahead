import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canAccessProject } from "@/lib/access";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const projectId  = req.nextUrl.searchParams.get("projectId");
    const page       = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1"));
    const pageSize   = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get("pageSize") ?? "50")));
    const entityType = req.nextUrl.searchParams.get("entityType");
    const action     = req.nextUrl.searchParams.get("action");
    const userId     = req.nextUrl.searchParams.get("userId");
    const search     = req.nextUrl.searchParams.get("search");

    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

    const callerId = (session.user as { id: string }).id;
    if (!(await canAccessProject(callerId, projectId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const where: Prisma.AuditLogWhereInput = { projectId };
    if (entityType) where.entityType = entityType;
    if (action) where.action = action;
    if (userId) where.userId = userId;
    if (search) {
      where.OR = [
        { changedBy: { contains: search, mode: "insensitive" } },
        { oldValue: { contains: search, mode: "insensitive" } },
        { newValue: { contains: search, mode: "insensitive" } },
        { fieldChanged: { contains: search, mode: "insensitive" } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    console.error("GET /api/audit-logs error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
