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

    const deleted = req.nextUrl.searchParams.get("deleted");
    const deletedFilter = deleted === "only"
      ? { not: null }
      : null;

    const lookaheads = await prisma.lookahead.findMany({
      where: { projectId, deletedAt: deletedFilter },
      include: { _count: { select: { activities: true } } },
      orderBy: { uploadDate: "desc" },
    });

    return NextResponse.json(lookaheads);
  } catch (err) {
    console.error("GET /api/lookaheads error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
