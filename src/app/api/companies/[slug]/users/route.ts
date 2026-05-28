import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

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
      include: { user: { select: { id: true, name: true, email: true, globalRole: true } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(members);
  } catch (err) {
    console.error("GET /api/companies/[slug]/users error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
