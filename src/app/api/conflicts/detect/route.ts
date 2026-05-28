import { NextRequest, NextResponse } from "next/server";
import { runConflictDetection } from "@/lib/conflicts";

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json();
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    const count = await runConflictDetection(projectId);

    return NextResponse.json({
      success: true,
      conflictsFound: count,
      message: count > 0
        ? `Detected ${count} potential conflict${count === 1 ? "" : "s"}.`
        : "No new conflicts detected.",
    });
  } catch (err) {
    console.error("POST /api/conflicts/detect error:", err);
    return NextResponse.json({ error: "Conflict detection failed" }, { status: 500 });
  }
}
