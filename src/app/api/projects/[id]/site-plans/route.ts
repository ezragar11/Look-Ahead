import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import path from "path";
import fs from "fs/promises";

export const dynamic = "force-dynamic";

const DISCIPLINES = [
  "ELECTRICAL", "MECHANICAL", "STRUCTURAL", "CIVIL",
  "PLUMBING", "FIRE_PROTECTION", "ARCHITECTURAL", "GENERAL", "OTHER",
];

const ALLOWED_MIME = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/webp", "image/tiff",
  "application/pdf",
]);

// ── GET — list site plans for a project ─────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const plans = await prisma.projectDocument.findMany({
      where: { projectId: params.id, type: { startsWith: "SITE_PLAN" }, deletedAt: null },
      orderBy: [{ type: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(plans);
  } catch (err) {
    console.error("GET /api/projects/[id]/site-plans error:", err);
    return NextResponse.json({ error: "Failed to fetch site plans" }, { status: 500 });
  }
}

// ── POST — upload a site plan image ─────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData   = await req.formData();
    const file       = formData.get("file") as File | null;
    const discipline = (formData.get("discipline") as string | null) ?? "GENERAL";
    const planName   = (formData.get("name") as string | null) ?? "";

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: "File type not allowed. Upload images (JPEG, PNG, WebP, TIFF) or PDF." }, { status: 400 });
    }
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 50 MB)" }, { status: 400 });
    }

    const normalizedDisc = DISCIPLINES.includes(discipline) ? discipline : "OTHER";

    // Store under uploads/projects/{id}/site-plans/
    const uploadRoot = path.resolve(process.cwd(), "uploads", "projects", params.id, "site-plans");
    await fs.mkdir(uploadRoot, { recursive: true });

    const ext        = path.extname(file.name) || "";
    const storedName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const filePath   = path.join(uploadRoot, storedName);
    const arrayBuf   = await file.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(arrayBuf));

    const doc = await prisma.projectDocument.create({
      data: {
        projectId:    params.id,
        name:         planName || file.name,
        type:         `SITE_PLAN_${normalizedDisc}`,
        originalName: file.name,
        storedName,
        filePath,
        mimeType:     file.type,
        fileSize:     file.size,
        hasImages:    file.type.startsWith("image/"),
        uploadedBy:   (session.user as { id?: string }).id ?? null,
      },
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    console.error("POST /api/projects/[id]/site-plans error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

// ── DELETE — soft-delete a site plan ────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const docId = searchParams.get("docId");
    if (!docId) return NextResponse.json({ error: "docId required" }, { status: 400 });

    await prisma.projectDocument.update({
      where: { id: docId, projectId: params.id },
      data:  { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/projects/[id]/site-plans error:", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
