import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET — single project by slug within a company */
export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string; projectSlug: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const company = await prisma.company.findUnique({ where: { slug: params.slug } });
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    // Try slug first, then id
    let project = await prisma.project.findFirst({
      where: { companyId: company.id, slug: params.projectSlug, deletedAt: null },
      select: {
        id: true, projectName: true, slug: true, status: true,
        location: true, client: true, projectNumber: true, description: true,
        startDate: true, endDate: true, companyId: true,
        _count: { select: { activities: true, lookaheads: true, documents: true, conflicts: true, delays: true, constraints: true } },
      },
    });

    if (!project) {
      project = await prisma.project.findFirst({
        where: { companyId: company.id, id: params.projectSlug, deletedAt: null },
        select: {
          id: true, projectName: true, slug: true, status: true,
          location: true, client: true, projectNumber: true, description: true,
          startDate: true, endDate: true, companyId: true,
          _count: { select: { activities: true, lookaheads: true, documents: true, conflicts: true, delays: true, constraints: true } },
        },
      });
    }

    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json(project);
  } catch (err) {
    console.error("GET /api/companies/[slug]/projects/[projectSlug] error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
