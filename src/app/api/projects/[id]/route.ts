import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getProjectRole, canManageWork } from "@/lib/access";

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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as { id: string }).id;
    const role = await getProjectRole(userId, params.id);
    if (!canManageWork(role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    await prisma.project.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/projects/[id] error:", err);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as { id: string }).id;
    const role = await getProjectRole(userId, params.id);
    if (!canManageWork(role)) {
      return NextResponse.json({ error: "View-only users cannot edit project settings" }, { status: 403 });
    }

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
