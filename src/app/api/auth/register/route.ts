import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * Bootstrap registration — open only when 0 users exist.
 * Creates the first admin user AND their company workspace.
 */
export async function POST(req: NextRequest) {
  try {
    const { name, email, password, company, phone } = await req.json();

    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    if (password.length > 128) {
      return NextResponse.json({ error: "Password too long" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }
    if (name.length > 200 || email.length > 254) {
      return NextResponse.json({ error: "Name or email too long" }, { status: 400 });
    }

    const userCount = await prisma.user.count();
    if (userCount > 0) {
      return NextResponse.json(
        { error: "Registration is closed. Contact your admin to be invited.", userCount },
        { status: 403 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email:      email.toLowerCase().trim(),
        passwordHash,
        company:    company ?? null,
        phone:      phone   ?? null,
        globalRole: "PLATFORM_ADMIN",
        status:     "ACTIVE",
      },
      select: { id: true, name: true, email: true, globalRole: true },
    });

    // Auto-create a company for the first user
    const companyName = company || "My Company";
    const companySlug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "my-company";

    const newCompany = await prisma.company.create({
      data: {
        name:   companyName,
        slug:   companySlug,
        status: "ACTIVE",
      },
    });

    // Make user a Company Admin
    await prisma.companyUser.create({
      data: {
        companyId: newCompany.id,
        userId:    user.id,
        role:      "COMPANY_ADMIN",
        status:    "ACTIVE",
      },
    });

    return NextResponse.json({
      success: true,
      user,
      companySlug: newCompany.slug,
    });
  } catch (err) {
    console.error("POST /api/auth/register error:", err);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
