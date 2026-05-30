import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getProjectRole, canManageWork, canAccessProject } from "@/lib/access";

export const dynamic = "force-dynamic";

// ── GET — list locations for a project ──────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as { id: string }).id;
    if (!(await canAccessProject(userId, params.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const deleted = req.nextUrl.searchParams.get("deleted");
    const deletedFilter = deleted === "only" ? { not: null } : null;

    const locations = await prisma.projectLocation.findMany({
      where: { projectId: params.id, deletedAt: deletedFilter },
      include: {
        _count: { select: { activities: true, conflicts: true } },
      },
      orderBy: [{ zone: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });

    return NextResponse.json(locations);
  } catch (err) {
    console.error("GET /api/projects/[id]/locations error:", err);
    return NextResponse.json({ error: "Failed to fetch locations" }, { status: 500 });
  }
}

// ── POST — create a location ────────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as { id: string }).id;
    const role = await getProjectRole(userId, params.id);
    if (!canManageWork(role)) {
      return NextResponse.json({ error: "View-only users cannot create locations" }, { status: 403 });
    }

    const body = await req.json();
    const { name, zone, floor, description, color } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Check for duplicate name within project
    const existing = await prisma.projectLocation.findUnique({
      where: { projectId_name: { projectId: params.id, name: name.trim() } },
    });
    if (existing && !existing.deletedAt) {
      return NextResponse.json({ error: "A location with this name already exists" }, { status: 409 });
    }

    // If there was a soft-deleted location with same name, restore it with new data
    if (existing && existing.deletedAt) {
      const restored = await prisma.projectLocation.update({
        where: { id: existing.id },
        data: {
          zone: zone?.trim() || null,
          floor: floor?.trim() || null,
          description: description?.trim() || null,
          color: color || null,
          deletedAt: null,
        },
      });
      return NextResponse.json(restored, { status: 201 });
    }

    const location = await prisma.projectLocation.create({
      data: {
        projectId: params.id,
        name: name.trim(),
        zone: zone?.trim() || null,
        floor: floor?.trim() || null,
        description: description?.trim() || null,
        color: color || null,
      },
    });

    return NextResponse.json(location, { status: 201 });
  } catch (err) {
    console.error("POST /api/projects/[id]/locations error:", err);
    return NextResponse.json({ error: "Failed to create location" }, { status: 500 });
  }
}

// ── PATCH — update a location ───────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as { id: string }).id;
    const role = await getProjectRole(userId, params.id);
    if (!canManageWork(role)) {
      return NextResponse.json({ error: "View-only users cannot edit locations" }, { status: 403 });
    }

    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: "Location ID required" }, { status: 400 });

    // Whitelist editable fields — never let the client move a location to another
    // project or overwrite system fields by spreading raw input.
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string")        data.name = body.name.trim();
    if (typeof body.zone === "string")        data.zone = body.zone.trim() || null;
    if (typeof body.floor === "string")       data.floor = body.floor.trim() || null;
    if (typeof body.description === "string") data.description = body.description.trim() || null;
    if (typeof body.color === "string")       data.color = body.color || null;
    if (typeof body.sortOrder === "number")   data.sortOrder = body.sortOrder;

    const location = await prisma.projectLocation.update({
      where: { id, projectId: params.id },
      data,
    });

    return NextResponse.json(location);
  } catch (err) {
    console.error("PATCH /api/projects/[id]/locations error:", err);
    return NextResponse.json({ error: "Failed to update location" }, { status: 500 });
  }
}

// ── DELETE — soft-delete a location ─────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as { id: string }).id;
    const role = await getProjectRole(userId, params.id);
    if (!canManageWork(role)) {
      return NextResponse.json({ error: "View-only users cannot delete locations" }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Location ID required" }, { status: 400 });

    await prisma.projectLocation.update({
      where: { id, projectId: params.id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/projects/[id]/locations error:", err);
    return NextResponse.json({ error: "Failed to delete location" }, { status: 500 });
  }
}
