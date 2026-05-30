import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getCompanyRole, canManageCompanyUsers } from "@/lib/access";

export const dynamic = "force-dynamic";

// ── GET — list company members + their project assignments ─────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const company = await prisma.company.findUnique({ where: { slug: params.slug } });
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    const members = await prisma.companyUser.findMany({
      where: { companyId: company.id },
      include: {
        user: {
          select: {
            id: true, name: true, email: true, globalRole: true,
            lastLoginAt: true, phone: true, status: true,
            projectUsers: {
              where: { status: { not: "REMOVED" } },
              select: {
                role: true,
                project: { select: { id: true, projectName: true, slug: true, status: true } },
              },
            },
          },
        },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(members);
  } catch (err) {
    console.error("GET /api/companies/[slug]/users error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// ── POST — add user to company ─────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const company = await prisma.company.findUnique({ where: { slug: params.slug } });
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    const callerId = (session.user as { id: string }).id;
    const callerRole = await getCompanyRole(callerId, company.id);
    if (!canManageCompanyUsers(callerRole)) {
      return NextResponse.json({ error: "Only company admins can add users" }, { status: 403 });
    }

    const { userId, email, role } = await req.json();

    let targetUser;
    if (userId) {
      targetUser = await prisma.user.findUnique({ where: { id: userId } });
    } else if (email) {
      targetUser = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    }

    if (!targetUser) {
      return NextResponse.json({ error: "User not found. They must register an account first." }, { status: 404 });
    }

    // Check existing
    const existing = await prisma.companyUser.findUnique({
      where: { companyId_userId: { companyId: company.id, userId: targetUser.id } },
    });

    if (existing) {
      if (existing.status === "REMOVED") {
        const restored = await prisma.companyUser.update({
          where: { id: existing.id },
          data: { status: "ACTIVE", role: role || existing.role, removedAt: null },
          include: { user: { select: { id: true, name: true, email: true, globalRole: true, lastLoginAt: true, phone: true, status: true } } },
        });
        return NextResponse.json(restored, { status: 201 });
      }
      return NextResponse.json({ error: "User is already in this company" }, { status: 409 });
    }

    const sessionUserId = (session.user as { id: string }).id;

    const member = await prisma.companyUser.create({
      data: {
        companyId: company.id,
        userId: targetUser.id,
        role: role || "ENGINEER",
        status: "ACTIVE",
        invitedBy: sessionUserId,
        invitedAt: new Date(),
      },
      include: { user: { select: { id: true, name: true, email: true, globalRole: true, lastLoginAt: true, phone: true, status: true } } },
    });

    return NextResponse.json(member, { status: 201 });
  } catch (err) {
    console.error("POST /api/companies/[slug]/users error:", err);
    return NextResponse.json({ error: "Failed to add user" }, { status: 500 });
  }
}

// ── PATCH — update company role or status ──────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const company = await prisma.company.findUnique({ where: { slug: params.slug } });
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    const callerId = (session.user as { id: string }).id;
    const callerRole = await getCompanyRole(callerId, company.id);
    if (!canManageCompanyUsers(callerRole)) {
      return NextResponse.json({ error: "Only company admins can change membership" }, { status: 403 });
    }

    const { id, role, status } = await req.json();
    if (!id) return NextResponse.json({ error: "CompanyUser id required" }, { status: 400 });

    // Ensure the target membership belongs to this company (prevent cross-company edits).
    const target = await prisma.companyUser.findUnique({ where: { id }, select: { companyId: true } });
    if (!target || target.companyId !== company.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (role) data.role = role;
    if (status) {
      data.status = status;
      if (status === "REMOVED") data.removedAt = new Date();
      if (status === "ACTIVE") data.removedAt = null;
    }

    const updated = await prisma.companyUser.update({
      where: { id },
      data,
      include: { user: { select: { id: true, name: true, email: true, globalRole: true, lastLoginAt: true, phone: true, status: true } } },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/companies/[slug]/users error:", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
