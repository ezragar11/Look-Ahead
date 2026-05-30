import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/access";

const VALID_GLOBAL_ROLES = ["PLATFORM_ADMIN", "USER"];

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isPlatformAdmin((session.user as { globalRole?: string }).globalRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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

    // Only platform admins may set globalRole; everyone else creates a standard USER.
    // This prevents any logged-in user from minting a PLATFORM_ADMIN account.
    const callerIsPlatformAdmin = isPlatformAdmin((session.user as { globalRole?: string }).globalRole);
    let resolvedGlobalRole = "USER";
    if (callerIsPlatformAdmin && globalRole) {
      if (!VALID_GLOBAL_ROLES.includes(globalRole)) {
        return NextResponse.json({ error: "Invalid globalRole" }, { status: 400 });
      }
      resolvedGlobalRole = globalRole;
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
        globalRole: resolvedGlobalRole,
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
    if (!isPlatformAdmin((session.user as { globalRole?: string }).globalRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: "User ID required" }, { status: 400 });

    // Whitelist updatable fields — never spread arbitrary client input into the DB.
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string")    data.name = body.name;
    if (typeof body.email === "string")   data.email = body.email.toLowerCase();
    if (typeof body.phone === "string")   data.phone = body.phone;
    if (typeof body.company === "string") data.company = body.company;
    if (typeof body.status === "string")  data.status = body.status;
    if (typeof body.globalRole === "string") {
      if (!VALID_GLOBAL_ROLES.includes(body.globalRole)) {
        return NextResponse.json({ error: "Invalid globalRole" }, { status: 400 });
      }
      data.globalRole = body.globalRole;
    }
    if (typeof body.password === "string" && body.password) {
      data.passwordHash = await bcrypt.hash(body.password, 12);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, globalRole: true, status: true },
    });

    return NextResponse.json(user);
  } catch (err) {
    console.error("PATCH /api/users error:", err);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
