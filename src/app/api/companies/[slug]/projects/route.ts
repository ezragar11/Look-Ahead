import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET — list projects for a company */
export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const company = await prisma.company.findUnique({ where: { slug: params.slug } });
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    const projects = await prisma.project.findMany({
      where:   { companyId: company.id, deletedAt: null },
      select:  { id: true, projectName: true, slug: true, status: true, location: true, companyId: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(projects);
  } catch (err) {
    console.error("GET /api/companies/[slug]/projects error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

/** POST — create a new project in this company */
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const company = await prisma.company.findUnique({ where: { slug: params.slug } });
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    const body = await req.json();
    const { projectName, projectSlug, projectNumber, client, location, description, startDate, endDate } = body;

    if (!projectName) return NextResponse.json({ error: "Project name is required" }, { status: 400 });

    const cleanSlug = (projectSlug || projectName)
      .toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

    // Check slug uniqueness within company
    const exists = await prisma.project.findFirst({
      where: { companyId: company.id, slug: cleanSlug, deletedAt: null },
    });
    if (exists) return NextResponse.json({ error: "Project slug already exists in this company" }, { status: 409 });

    const userId = (session.user as { id: string }).id;

    const project = await prisma.project.create({
      data: {
        companyId:     company.id,
        projectName,
        slug:          cleanSlug,
        projectNumber: projectNumber ?? null,
        client:        client ?? null,
        location:      location ?? null,
        description:   description ?? null,
        status:        "ACTIVE",
        startDate:     startDate ? new Date(startDate) : null,
        endDate:       endDate   ? new Date(endDate)   : null,
        createdBy:     userId,
      },
    });

    // Add creator as Project Admin
    await prisma.projectUser.create({
      data: { projectId: project.id, userId, role: "PROJECT_ADMIN", status: "ACTIVE" },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (err) {
    console.error("POST /api/companies/[slug]/projects error:", err);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
