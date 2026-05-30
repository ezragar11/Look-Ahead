import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { downloadFile } from "@/lib/storage";
import path from "path";

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

    // Reconstruct the storage object key from the path segments
    const objectKey = params.filePath.join("/");

    // Security: block path traversal
    if (objectKey.includes("..") || objectKey.startsWith("/")) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const data = await downloadFile(objectKey);
    if (!data) {
      return new NextResponse("Not found", { status: 404 });
    }

    const ext  = path.extname(objectKey).toLowerCase();
    const mime = MIME_MAP[ext] ?? "application/octet-stream";

    return new NextResponse(new Uint8Array(data), {
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
