import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Search users by name or email — for invite pickers
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const q = req.nextUrl.searchParams.get("q")?.trim();
    if (!q || q.length < 2) return NextResponse.json([]);

    const users = await prisma.user.findMany({
      where: {
        status: { not: "SUSPENDED" },
        OR: [
          { name:  { contains: q } },
          { email: { contains: q } },
        ],
      },
      select: { id: true, name: true, email: true, globalRole: true },
      take: 10,
      orderBy: { name: "asc" },
    });

    return NextResponse.json(users);
  } catch (err) {
    console.error("GET /api/users/search error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
