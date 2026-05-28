import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      include: {
        _count: {
          select: { activities: true, lookaheads: true },
        },
        lookaheads: {
          orderBy: { uploadDate: "desc" },
          take: 1,
          select: { uploadDate: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(projects);
  } catch (err) {
    console.error("GET /api/projects error:", err);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}
