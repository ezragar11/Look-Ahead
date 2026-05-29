import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Both current and new password are required" }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
    }
    if (newPassword.length > 128) {
      return NextResponse.json({ error: "Password too long" }, { status: 400 });
    }

    const userId = (session.user as { id: string }).id;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/auth/change-password error:", err);
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 });
  }
}
