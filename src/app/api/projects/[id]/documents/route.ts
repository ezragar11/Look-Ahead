import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getProjectRole, canUploadDocuments, canManageWork } from "@/lib/access";
import { uploadFile } from "@/lib/storage";
import path from "path";

export const dynamic = "force-dynamic";

// Allowed MIME types
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg", "image/jpg", "image/png", "image/webp", "image/tiff",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
]);

const DOC_TYPES = ["SCOPE_OF_WORK", "BLUEPRINT", "SPECIFICATION", "SUBMITTAL", "CONTRACT", "RFI_LOG", "SCHEDULE", "OTHER"];

async function extractPdfText(buf: Buffer): Promise<{ text: string; pages: number }> {
  try {
    // Dynamic import so the server bundle isn't broken if pdf-parse has issues
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(buf);
    return { text: data.text ?? "", pages: data.numpages ?? 0 };
  } catch {
    return { text: "", pages: 0 };
  }
}

// ── GET — list documents for a project ──────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const docs = await prisma.projectDocument.findMany({
      where:   { projectId: params.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(docs);
  } catch (err) {
    console.error("GET /api/projects/[id]/documents error:", err);
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
  }
}

// ── POST — upload a document ─────────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as { id: string }).id;
    const role = await getProjectRole(userId, params.id);
    if (!canUploadDocuments(role)) {
      return NextResponse.json({ error: "You do not have permission to upload documents" }, { status: 403 });
    }

    const formData = await req.formData();
    const file     = formData.get("file") as File | null;
    const docType  = (formData.get("type") as string | null) ?? "OTHER";
    const docName  = (formData.get("name") as string | null) ?? "";

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: "File type not allowed. Upload PDF, images, Word documents, or plain text." }, { status: 400 });
    }
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 50 MB)" }, { status: 400 });
    }

    const normalizedType = DOC_TYPES.includes(docType) ? docType : "OTHER";

    // Read into memory, store in durable object storage under projects/{id}/documents/
    const ext        = path.extname(file.name) || "";
    const storedName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const objectKey  = `projects/${params.id}/documents/${storedName}`;
    const buffer     = Buffer.from(await file.arrayBuffer());

    // Extract text for PDFs (from the in-memory buffer)
    let extractedText: string | undefined;
    let pageCount: number | undefined;
    if (file.type === "application/pdf") {
      const result = await extractPdfText(buffer);
      extractedText = result.text.trim() || undefined;
      pageCount     = result.pages || undefined;
    }

    await uploadFile(objectKey, buffer, file.type);

    const doc = await prisma.projectDocument.create({
      data: {
        projectId:     params.id,
        name:          docName || file.name,
        type:          normalizedType,
        originalName:  file.name,
        storedName,
        filePath:      objectKey,
        mimeType:      file.type,
        fileSize:      file.size,
        pageCount,
        extractedText,
        hasImages:     file.type.startsWith("image/"),
        uploadedBy:    (session.user as { id?: string }).id ?? null,
      },
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    console.error("POST /api/projects/[id]/documents error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

// ── DELETE — soft-delete a document ──────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as { id: string }).id;
    const role = await getProjectRole(userId, params.id);
    if (!canManageWork(role)) {
      return NextResponse.json({ error: "View-only users cannot delete documents" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const docId = searchParams.get("docId");
    if (!docId) return NextResponse.json({ error: "docId required" }, { status: 400 });

    await prisma.projectDocument.update({
      where: { id: docId, projectId: params.id },
      data:  { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/projects/[id]/documents error:", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
