/**
 * Permission matrix for LookAhead Pro.
 * All checks happen server-side — never rely solely on client-side guards.
 */

import { UserRole, ROLES, hasRole } from "@/lib/auth";

// ── Permission definitions ────────────────────────────────────────────────────

export const PERMISSIONS = {
  // Activities
  VIEW_ACTIVITIES:      ["ADMIN", "PROJECT_MANAGER", "SUPERINTENDENT", "ENGINEER", "INTERN", "SUBCONTRACTOR", "OWNER_CLIENT"] as UserRole[],
  EDIT_ACTIVITY:        ["ADMIN", "PROJECT_MANAGER", "SUPERINTENDENT", "ENGINEER"] as UserRole[],
  DELETE_ACTIVITY:      ["ADMIN", "PROJECT_MANAGER"] as UserRole[],
  RESTORE_ACTIVITY:     ["ADMIN"] as UserRole[],

  // Lookaheads
  UPLOAD_LOOKAHEAD:     ["ADMIN", "PROJECT_MANAGER", "ENGINEER"] as UserRole[],
  DELETE_LOOKAHEAD:     ["ADMIN"] as UserRole[],

  // Conflicts
  VIEW_CONFLICTS:       ["ADMIN", "PROJECT_MANAGER", "SUPERINTENDENT", "ENGINEER", "INTERN"] as UserRole[],
  MANAGE_CONFLICTS:     ["ADMIN", "PROJECT_MANAGER", "SUPERINTENDENT", "ENGINEER"] as UserRole[],
  CLOSE_CONFLICT:       ["ADMIN", "PROJECT_MANAGER"] as UserRole[],

  // Constraints
  VIEW_CONSTRAINTS:     ["ADMIN", "PROJECT_MANAGER", "SUPERINTENDENT", "ENGINEER", "INTERN"] as UserRole[],
  MANAGE_CONSTRAINTS:   ["ADMIN", "PROJECT_MANAGER", "SUPERINTENDENT", "ENGINEER"] as UserRole[],

  // Delays
  VIEW_DELAYS:          ["ADMIN", "PROJECT_MANAGER", "SUPERINTENDENT", "ENGINEER", "INTERN"] as UserRole[],
  MANAGE_DELAYS:        ["ADMIN", "PROJECT_MANAGER", "SUPERINTENDENT", "ENGINEER"] as UserRole[],

  // Notes
  ADD_NOTE:             ["ADMIN", "PROJECT_MANAGER", "SUPERINTENDENT", "ENGINEER", "INTERN", "SUBCONTRACTOR"] as UserRole[],
  DELETE_NOTE:          ["ADMIN", "PROJECT_MANAGER"] as UserRole[],

  // Attachments
  UPLOAD_FILE:          ["ADMIN", "PROJECT_MANAGER", "SUPERINTENDENT", "ENGINEER", "INTERN", "SUBCONTRACTOR"] as UserRole[],
  DELETE_FILE:          ["ADMIN", "PROJECT_MANAGER"] as UserRole[],

  // Reports & Exports
  VIEW_REPORTS:         ["ADMIN", "PROJECT_MANAGER", "SUPERINTENDENT", "ENGINEER", "INTERN", "OWNER_CLIENT"] as UserRole[],
  EXPORT_DATA:          ["ADMIN", "PROJECT_MANAGER", "SUPERINTENDENT", "ENGINEER"] as UserRole[],
  EXPORT_FULL_PROJECT:  ["ADMIN"] as UserRole[],

  // Audit Logs
  VIEW_AUDIT_LOG:       ["ADMIN", "PROJECT_MANAGER", "SUPERINTENDENT", "ENGINEER"] as UserRole[],
  VIEW_FULL_AUDIT_LOG:  ["ADMIN", "PROJECT_MANAGER"] as UserRole[],

  // Users / Project Members
  VIEW_USERS:           ["ADMIN", "PROJECT_MANAGER"] as UserRole[],
  INVITE_USER:          ["ADMIN", "PROJECT_MANAGER"] as UserRole[],
  MANAGE_USERS:         ["ADMIN"] as UserRole[],
  ASSIGN_ROLES:         ["ADMIN"] as UserRole[],

  // Project Settings
  EDIT_PROJECT:         ["ADMIN", "PROJECT_MANAGER"] as UserRole[],
  DELETE_PROJECT:       ["ADMIN"] as UserRole[],

  // Approval Workflows
  REQUEST_APPROVAL:     ["ADMIN", "PROJECT_MANAGER", "SUPERINTENDENT", "ENGINEER"] as UserRole[],
  APPROVE_REJECT:       ["ADMIN", "PROJECT_MANAGER"] as UserRole[],

  // Daily Work Plan
  VIEW_DAILY_PLAN:      ["ADMIN", "PROJECT_MANAGER", "SUPERINTENDENT", "ENGINEER", "INTERN", "SUBCONTRACTOR"] as UserRole[],
  MANAGE_DAILY_REPORT:  ["ADMIN", "PROJECT_MANAGER", "SUPERINTENDENT"] as UserRole[],

  // Security Dashboard
  VIEW_SECURITY_DASH:   ["ADMIN"] as UserRole[],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: UserRole, permission: Permission): boolean {
  const allowed = PERMISSIONS[permission] as UserRole[];
  return allowed.includes(role);
}

/** Check if a role meets the minimum required role level */
export function atLeast(role: UserRole, minimum: UserRole): boolean {
  return hasRole(role, minimum);
}

/** Guard used in API routes — throws 403 if not allowed */
export function requirePermission(role: UserRole, permission: Permission) {
  if (!can(role, permission)) {
    throw new Error(`Forbidden: ${permission} requires one of [${PERMISSIONS[permission].join(", ")}]`);
  }
}

/** Description of what each role can do — used for UI display */
export const ROLE_CAPABILITIES: Record<UserRole, string[]> = {
  ADMIN: [
    "Full access to all features",
    "Manage users and roles",
    "View security dashboard",
    "Delete and restore records",
    "Export full project data",
  ],
  PROJECT_MANAGER: [
    "View and edit all project data",
    "Manage conflicts and delays",
    "Approve major changes",
    "Export reports",
    "View audit logs",
    "Invite team members",
  ],
  SUPERINTENDENT: [
    "Update actual work and progress",
    "Add field notes and conflicts",
    "Use daily work plan",
    "View change history",
    "Mark work complete",
  ],
  ENGINEER: [
    "Upload lookahead files",
    "Edit activities and add notes",
    "Manage conflicts and constraints",
    "Generate reports",
    "View change history",
  ],
  INTERN: [
    "View schedule and activities",
    "Add notes and progress updates",
    "Flag conflicts",
    "Upload photos",
    "Read-only audit access",
  ],
  SUBCONTRACTOR: [
    "View assigned work only",
    "Add progress updates",
    "Add notes to assigned activities",
    "Upload photos for assigned work",
  ],
  OWNER_CLIENT: [
    "View approved reports",
    "View high-level project progress",
    "View selected schedule items",
    "Read-only access",
  ],
};
