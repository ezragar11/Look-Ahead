import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import path from "path";
import fs from "fs/promises";

export const dynamic = "force-dynamic";

const MIME_MAP: Record<string, string> = {
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png":  "image/png",
  ".webp": "image/webp",
  ".tiff": "image/tiff",
  ".tif":  "image/tiff",
  ".pdf":  "application/pdf",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { filePath: string[] } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

    // Reconstruct the path and ensure it stays within uploads/
    const relativePath = params.filePath.join("/");

    // Security: block path traversal
    if (relativePath.includes("..") || relativePath.startsWith("/")) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const fullPath = path.resolve(process.cwd(), "uploads", relativePath);

    // Extra guard: must be under uploads dir
    const uploadsRoot = path.resolve(process.cwd(), "uploads");
    if (!fullPath.startsWith(uploadsRoot)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const stat = await fs.stat(fullPath).catch(() => null);
    if (!stat || !stat.isFile()) {
      return new NextResponse("Not found", { status: 404 });
    }

    const ext  = path.extname(fullPath).toLowerCase();
    const mime = MIME_MAP[ext] ?? "application/octet-stream";
    const data = await fs.readFile(fullPath);

    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("GET /api/files error:", err);
    return new NextResponse("Server error", { status: 500 });
  }
}
