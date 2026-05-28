import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const updates = await req.json();

    // If resolving, set resolvedAt
    if (updates.status === "RESOLVED" || updates.status === "CLOSED") {
      updates.resolvedAt = new Date();
    }

    const conflict = await prisma.conflict.update({
      where: { id: params.id },
      data: updates,
    });

    return NextResponse.json(conflict);
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
