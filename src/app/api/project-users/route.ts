import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const projectId = req.nextUrl.searchParams.get("projectId");
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

    const members = await prisma.projectUser.findMany({
      where: { projectId, status: "ACTIVE" },
      include: { user: { select: { id: true, name: true, email: true, globalRole: true } } },
      orderBy: { joinedAt: "asc" },
    });

    return NextResponse.json(members);
  } catch (err) {
    console.error("GET /api/project-users error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
