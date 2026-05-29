import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getProjectRole, canManageWork } from "@/lib/access";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const updates = await req.json();

    const conflict = await prisma.conflict.findUnique({ where: { id: params.id } });
    if (!conflict) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const userId = (session.user as { id: string }).id;
    const role = await getProjectRole(userId, conflict.projectId);
    if (!canManageWork(role)) {
      return NextResponse.json({ error: "View-only users cannot edit conflicts" }, { status: 403 });
    }

    // If resolving, set resolvedAt
    if (updates.status === "RESOLVED" || updates.status === "CLOSED") {
      updates.resolvedAt = new Date();
    }

    const updated = await prisma.conflict.update({
      where: { id: params.id },
      data: updates,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/conflicts/[id] error:", err);
    return NextResponse.json({ error: "Failed to update conflict" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const conflict = await prisma.conflict.findUnique({ where: { id: params.id } });
    if (!conflict) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const userId = (session.user as { id: string }).id;
    const role = await getProjectRole(userId, conflict.projectId);
    if (!canManageWork(role)) {
      return NextResponse.json({ error: "View-only users cannot delete conflicts" }, { status: 403 });
    }

    await prisma.conflict.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/conflicts/[id] error:", err);
    return NextResponse.json({ error: "Failed to delete conflict" }, { status: 500 });
  }
}
