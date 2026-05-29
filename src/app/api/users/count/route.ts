import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Public endpoint — lets the login page detect bootstrap mode
export async function GET() {
  try {
    const count = await prisma.user.count();
    return NextResponse.json({ count });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("users/count error:", message);
    return NextResponse.json({ error: "DB error", detail: message }, { status: 500 });
  }
}
