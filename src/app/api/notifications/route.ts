import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const projectId = req.nextUrl.searchParams.get("projectId");
    const userId = (session.user as { id?: string }).id;
    if (!userId) return NextResponse.json({ error: "User not found" }, { status: 401 });

    const where: Record<string, unknown> = { userId };
    if (projectId) where.projectId = projectId;

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(notifications);
  } catch (err) {
    console.error("GET /api/notifications error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
