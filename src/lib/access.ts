import { prisma } from "@/lib/prisma";

// ── Role hierarchy ──────────────────────────────────────────────────────────
// Higher number = more access. Used for comparison checks.

export const PROJECT_ROLE_LEVEL: Record<string, number> = {
  PROJECT_ADMIN:   100,
  PROJECT_MANAGER:  80,
  SUPERINTENDENT:   70,
  ENGINEER:         60,
  FIELD_ASSISTANT:  40,
  SUBCONTRACTOR:    20,
  OWNER_VIEWER:     10,
};

// Roles that can manage project work (not roles/deletion)
const WORK_MANAGERS = ["PROJECT_ADMIN", "PROJECT_MANAGER", "SUPERINTENDENT", "ENGINEER"];

// Roles that can assign/reassign alerts
const ALERT_MANAGERS = ["PROJECT_ADMIN", "PROJECT_MANAGER", "SUPERINTENDENT", "ENGINEER"];

// View-only roles (cannot edit project data beyond notes/documents/alerts)
const VIEW_ONLY_ROLES = ["SUBCONTRACTOR", "OWNER_VIEWER"];

// ── Global / company role helpers ─────────────────────────────────────────────

/** PLATFORM_ADMIN is the only globalRole that grants cross-company superuser access. */
export function isPlatformAdmin(globalRole: string | null | undefined): boolean {
  return globalRole === "PLATFORM_ADMIN";
}

/** Company roles allowed to manage company membership (add users, change roles, suspend). */
const COMPANY_USER_MANAGERS = ["COMPANY_ADMIN", "OPERATIONS_MANAGER"];

/** Resolve a user's company role (PLATFORM_ADMIN counts as COMPANY_ADMIN). Null = no access. */
export async function getCompanyRole(
  userId: string,
  companyId: string
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { globalRole: true },
  });
  if (user?.globalRole === "PLATFORM_ADMIN") return "COMPANY_ADMIN";

  const cu = await prisma.companyUser.findUnique({
    where: { companyId_userId: { companyId, userId } },
  });
  if (cu && cu.status === "ACTIVE") return cu.role;
  return null;
}

/** Can manage company membership (add/remove users, change company roles). */
export function canManageCompanyUsers(companyRole: string | null): boolean {
  return !!companyRole && COMPANY_USER_MANAGERS.includes(companyRole);
}

// ── Get user's project role ─────────────────────────────────────────────────

export async function getProjectRole(
  userId: string,
  projectId: string
): Promise<string | null> {
  // PLATFORM_ADMIN gets PROJECT_ADMIN equivalent
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { globalRole: true },
  });
  if (user?.globalRole === "PLATFORM_ADMIN") return "PROJECT_ADMIN";

  const pu = await prisma.projectUser.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (pu && pu.status === "ACTIVE") return pu.role;

  // Fall back to company role mapping
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { companyId: true } });
  if (project?.companyId) {
    const cu = await prisma.companyUser.findUnique({
      where: { companyId_userId: { companyId: project.companyId, userId } },
    });
    if (cu && cu.status === "ACTIVE") {
      if (cu.role === "COMPANY_ADMIN") return "PROJECT_ADMIN";
      if (cu.role === "OPERATIONS_MANAGER") return "PROJECT_MANAGER";
      return "ENGINEER"; // default for other company members
    }
  }

  return null; // no access
}

// ── Permission checks ───────────────────────────────────────────────────────

/** Only PROJECT_ADMIN can manage roles and delete projects */
export function isProjectAdmin(role: string | null): boolean {
  return role === "PROJECT_ADMIN";
}

/** Can manage project work: edit schedules, activities, conflicts, etc. */
export function canManageWork(role: string | null): boolean {
  return !!role && WORK_MANAGERS.includes(role);
}

/** Can assign/reassign alerts */
export function canManageAlerts(role: string | null): boolean {
  return !!role && ALERT_MANAGERS.includes(role);
}

/** Is view-only (subcontractor / viewer) */
export function isViewOnly(role: string | null): boolean {
  return !!role && VIEW_ONLY_ROLES.includes(role);
}

/** Can create alerts (everyone on the project) */
export function canCreateAlerts(role: string | null): boolean {
  return role !== null;
}

/** Can add field notes (everyone) */
export function canAddNotes(role: string | null): boolean {
  return role !== null;
}

/** Can upload documents (everyone except OWNER_VIEWER) */
export function canUploadDocuments(role: string | null): boolean {
  return !!role && role !== "OWNER_VIEWER";
}

// ── Access checks (from previous implementation) ────────────────────────────

export async function canAccessProject(
  userId: string,
  projectId: string
): Promise<boolean> {
  const role = await getProjectRole(userId, projectId);
  return role !== null;
}

export async function canAccessCompany(
  userId: string,
  companyId: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { globalRole: true },
  });
  if (user?.globalRole === "PLATFORM_ADMIN") return true;

  const cu = await prisma.companyUser.findUnique({
    where: { companyId_userId: { companyId, userId } },
  });
  return !!cu && cu.status === "ACTIVE";
}

export async function getAccessibleProjectIds(
  userId: string,
  companyId: string
): Promise<string[] | "all"> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { globalRole: true },
  });
  if (user?.globalRole === "PLATFORM_ADMIN") return "all";

  const cu = await prisma.companyUser.findUnique({
    where: { companyId_userId: { companyId, userId } },
  });
  if (cu && cu.status === "ACTIVE" && ["COMPANY_ADMIN", "EXECUTIVE_VIEWER", "OPERATIONS_MANAGER"].includes(cu.role)) {
    return "all";
  }

  const projectUsers = await prisma.projectUser.findMany({
    where: { userId, status: "ACTIVE", project: { companyId } },
    select: { projectId: true },
  });

  return projectUsers.map(pu => pu.projectId);
}
