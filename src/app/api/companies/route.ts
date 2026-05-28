import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET — list companies the current user belongs to */
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as { id: string }).id;
    const role   = (session.user as { globalRole?: string }).globalRole;

    // Platform admins see all companies
    if (role === "PLATFORM_ADMIN" || role === "ADMIN") {
      const companies = await prisma.company.findMany({
        where:   { status: "ACTIVE" },
        include: { _count: { select: { projects: true, companyUsers: true } } },
        orderBy: { name: "asc" },
      });
      return NextResponse.json(companies);
    }

    // Others see only their companies
    const memberships = await prisma.companyUser.findMany({
      where: { userId, status: "ACTIVE" },
      include: {
        company: {
          include: { _count: { select: { projects: true, companyUsers: true } } },
        },
      },
    });

    const companies = memberships
      .map((m) => m.company)
      .filter((c) => c.status === "ACTIVE");

    return NextResponse.json(companies);
  } catch (err) {
    console.error("GET /api/companies error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

/** POST — create a new company */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as { id: string }).id;
    const body   = await req.json();
    const { name, slug, industry, address, phone, website } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: "Name and slug are required" }, { status: 400 });
    }

    // Validate slug format
    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    if (!cleanSlug) {
      return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
    }

    // Check uniqueness
    const exists = await prisma.company.findUnique({ where: { slug: cleanSlug } });
    if (exists) {
      return NextResponse.json({ error: "Company slug already taken" }, { status: 409 });
    }

    const company = await prisma.company.create({
      data: {
        name,
        slug: cleanSlug,
        industry: industry ?? "CONSTRUCTION",
        address, phone, website,
      },
    });

    // Make creator a Company Admin
    await prisma.companyUser.create({
      data: {
        companyId: company.id,
        userId,
        role: "COMPANY_ADMIN",
        status: "ACTIVE",
      },
    });

    return NextResponse.json(company, { status: 201 });
  } catch (err) {
    console.error("POST /api/companies error:", err);
    return NextResponse.json({ error: "Failed to create company" }, { status: 500 });
  }
}
