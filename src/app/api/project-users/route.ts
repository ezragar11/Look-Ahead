import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getProjectRole, isProjectAdmin } from "@/lib/access";

export const dynamic = "force-dynamic";

// ── GET — list project members ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const projectId = req.nextUrl.searchParams.get("projectId");
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

    const showRemoved = req.nextUrl.searchParams.get("showRemoved") === "true";

    const members = await prisma.projectUser.findMany({
      where: {
        projectId,
        ...(showRemoved ? {} : { status: { not: "REMOVED" } }),
      },
      include: {
        user: {
          select: {
            id: true, name: true, email: true,
            globalRole: true, lastLoginAt: true, phone: true,
          },
        },
      },
      orderBy: [{ status: "asc" }, { role: "asc" }, { joinedAt: "asc" }],
    });

    return NextResponse.json(members);
  } catch (err) {
    console.error("GET /api/project-users error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// ── POST — add user to project ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { projectId, userId, email, role } = await req.json();
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

    // Only project admins can add members
    const sessionUserId = (session.user as { id: string }).id;
    const callerRole = await getProjectRole(sessionUserId, projectId);
    if (!isProjectAdmin(callerRole)) {
      return NextResponse.json({ error: "Only project admins can add members" }, { status: 403 });
    }

    // Find user by ID or email
    let targetUser;
    if (userId) {
      targetUser = await prisma.user.findUnique({ where: { id: userId } });
    } else if (email) {
      targetUser = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    }

    if (!targetUser) {
      return NextResponse.json({ error: "User not found. They must have an account first." }, { status: 404 });
    }

    // Check if already on project
    const existing = await prisma.projectUser.findUnique({
      where: { projectId_userId: { projectId, userId: targetUser.id } },
    });

    if (existing) {
      if (existing.status === "REMOVED") {
        // Re-activate
        const restored = await prisma.projectUser.update({
          where: { id: existing.id },
          data: { status: "ACTIVE", role: role || existing.role, removedAt: null, joinedAt: new Date() },
          include: { user: { select: { id: true, name: true, email: true, globalRole: true, lastLoginAt: true, phone: true } } },
        });
        return NextResponse.json(restored, { status: 201 });
      }
      return NextResponse.json({ error: "User is already on this project" }, { status: 409 });
    }

    const member = await prisma.projectUser.create({
      data: {
        projectId,
        userId: targetUser.id,
        role: role || "ENGINEER",
        status: "ACTIVE",
        invitedBy: sessionUserId,
        invitedAt: new Date(),
      },
      include: { user: { select: { id: true, name: true, email: true, globalRole: true, lastLoginAt: true, phone: true } } },
    });

    return NextResponse.json(member, { status: 201 });
  } catch (err) {
    console.error("POST /api/project-users error:", err);
    return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
  }
}

// ── PATCH — update role or status ──────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, role, status } = await req.json();
    if (!id) return NextResponse.json({ error: "ProjectUser id required" }, { status: 400 });

    // Look up the target projectUser to get projectId for role check
    const target = await prisma.projectUser.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const sessionUserId = (session.user as { id: string }).id;
    const callerRole = await getProjectRole(sessionUserId, target.projectId);
    if (!isProjectAdmin(callerRole)) {
      return NextResponse.json({ error: "Only project admins can change member roles" }, { status: 403 });
    }

    const data: Record<string, unknown> = {};
    if (role) data.role = role;
    if (status) {
      data.status = status;
      if (status === "REMOVED") data.removedAt = new Date();
      if (status === "ACTIVE") data.removedAt = null;
    }

    const updated = await prisma.projectUser.update({
      where: { id },
      data,
      include: { user: { select: { id: true, name: true, email: true, globalRole: true, lastLoginAt: true, phone: true } } },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/project-users error:", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

// ── DELETE — remove user from project ──────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ProjectUser id required" }, { status: 400 });

    // Look up the target projectUser to get projectId for role check
    const target = await prisma.projectUser.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const sessionUserId = (session.user as { id: string }).id;
    const callerRole = await getProjectRole(sessionUserId, target.projectId);
    if (!isProjectAdmin(callerRole)) {
      return NextResponse.json({ error: "Only project admins can remove members" }, { status: 403 });
    }

    await prisma.projectUser.update({
      where: { id },
      data: { status: "REMOVED", removedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/project-users error:", err);
    return NextResponse.json({ error: "Failed to remove" }, { status: 500 });
  }
}
