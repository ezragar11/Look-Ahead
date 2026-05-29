import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        _count: { select: { activities: true, lookaheads: true, documents: true } },
        documents: {
          where:   { deletedAt: null },
          orderBy: { createdAt: "desc" },
        },
        analyses: {
          orderBy: { createdAt: "desc" },
          take:    10,
          select: {
            id: true, title: true, analysisType: true, status: true,
            createdAt: true, completedAt: true, model: true,
            inputTokens: true, outputTokens: true, errorMessage: true,
            resultJson: true,
          },
        },
      },
    });

    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(project);
  } catch (err) {
    console.error("GET /api/projects/[id] error:", err);
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { projectName, description, mapSitePlanId } = body;

    const project = await prisma.project.update({
      where: { id: params.id },
      data: {
        ...(projectName  ? { projectName }  : {}),
        ...(description !== undefined ? { description } : {}),
        ...(mapSitePlanId !== undefined ? { mapSitePlanId } : {}),
      },
    });

    return NextResponse.json(project);
  } catch (err) {
    console.error("PATCH /api/projects/[id] error:", err);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}
