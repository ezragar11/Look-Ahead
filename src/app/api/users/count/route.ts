import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public endpoint — lets the login page detect bootstrap mode
export async function GET() {
  const count = await prisma.user.count();
  return NextResponse.json({ count });
}
