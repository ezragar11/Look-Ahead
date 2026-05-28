import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id:          true,
        name:        true,
        email:       true,
        company:     true,
        phone:       true,
        globalRole:  true,
        status:      true,
        lastLoginAt: true,
        createdAt:   true,
        _count: { select: { projectUsers: true } },
      },
    });

    return NextResponse.json(users);
  } catch (err) {
    console.error("GET /api/users error:", err);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name, email, password, globalRole, company, phone } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 409 });

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email:      email.toLowerCase(),
        passwordHash,
        company:    company ?? null,
        phone:      phone   ?? null,
        globalRole: globalRole ?? "ENGINEER",
        status:     "ACTIVE",
      },
      select: { id: true, name: true, email: true, globalRole: true, status: true },
    });

    return NextResponse.json(user);
  } catch (err) {
    console.error("POST /api/users error:", err);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, ...updates } = await req.json();
    if (!id) return NextResponse.json({ error: "User ID required" }, { status: 400 });

    // Don't allow password update through this endpoint
    delete updates.passwordHash;

    if (updates.password) {
      updates.passwordHash = await bcrypt.hash(updates.password, 12);
      delete updates.password;
    }

    const user = await prisma.user.update({
      where: { id },
      data:  updates,
      select: { id: true, name: true, email: true, globalRole: true, status: true },
    });

    return NextResponse.json(user);
  } catch (err) {
    console.error("PATCH /api/users error:", err);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
