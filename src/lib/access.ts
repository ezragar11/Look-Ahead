import { prisma } from "@/lib/prisma";

/**
 * Check if a user has access to a project.
 * Returns true if:
 *  - User is PLATFORM_ADMIN (global role)
 *  - User is a member of the company that owns the project
 *  - User is directly assigned to the project via ProjectUser
 */
export async function canAccessProject(
  userId: string,
  projectId: string
): Promise<boolean> {
  // Check global role first
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { globalRole: true },
  });
  if (user?.globalRole === "PLATFORM_ADMIN") return true;

  // Check direct project assignment
  const pu = await prisma.projectUser.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (pu && pu.status === "ACTIVE") return true;

  // Check company membership (company members can see all company projects)
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { companyId: true },
  });
  if (project?.companyId) {
    const cu = await prisma.companyUser.findUnique({
      where: { companyId_userId: { companyId: project.companyId, userId } },
    });
    if (cu && cu.status === "ACTIVE") return true;
  }

  return false;
}

/**
 * Check if a user has access to a company.
 * Returns true if:
 *  - User is PLATFORM_ADMIN
 *  - User is a member of the company via CompanyUser
 */
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

/**
 * Get projects a user can access within a company.
 * PLATFORM_ADMIN and company members see all. Others see only assigned projects.
 */
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
  // Company admins/managers see all projects
  if (cu && cu.status === "ACTIVE" && ["COMPANY_ADMIN", "EXECUTIVE_VIEWER", "OPERATIONS_MANAGER"].includes(cu.role)) {
    return "all";
  }

  // Others see only their assigned projects
  const projectUsers = await prisma.projectUser.findMany({
    where: { userId, status: "ACTIVE", project: { companyId } },
    select: { projectId: true },
  });

  return projectUsers.map(pu => pu.projectId);
}
