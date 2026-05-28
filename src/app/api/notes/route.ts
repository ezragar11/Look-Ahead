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

    const notes = await prisma.note.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(notes);
  } catch (err) {
    console.error("GET /api/notes error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { activityId, conflictId, projectId, noteText, author } = await req.json();

    if (!noteText?.trim()) {
      return NextResponse.json({ error: "Note text is required" }, { status: 400 });
    }

    const note = await prisma.note.create({
      data: {
        activityId: activityId ?? null,
        conflictId: conflictId ?? null,
        projectId:  projectId ?? null,
        noteText:   noteText.trim(),
        author:     author ?? "Field User",
      },
    });

    return NextResponse.json(note);
  } catch (err) {
    console.error("POST /api/notes error:", err);
    return NextResponse.json({ error: "Failed to save note" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Note ID required" }, { status: 400 });

    await prisma.note.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/notes error:", err);
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}
