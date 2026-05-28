import { NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Role hierarchy (higher = more access)
export const ROLES = {
  ADMIN:           7,
  PROJECT_MANAGER: 6,
  SUPERINTENDENT:  5,
  ENGINEER:        4,
  INTERN:          3,
  SUBCONTRACTOR:   2,
  OWNER_CLIENT:    1,
} as const;

export type UserRole = keyof typeof ROLES;

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN:           "Admin",
  PROJECT_MANAGER: "Project Manager",
  SUPERINTENDENT:  "Superintendent",
  ENGINEER:        "Project Engineer",
  INTERN:          "Intern / Field Assistant",
  SUBCONTRACTOR:   "Subcontractor",
  OWNER_CLIENT:    "Owner / Client Viewer",
};

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages:   { signIn: "/login" },

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });

        if (!user || user.status === "SUSPENDED") return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data:  { lastLoginAt: new Date() },
        });

        return {
          id:         user.id,
          email:      user.email,
          name:       user.name,
          globalRole: user.globalRole,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id         = user.id;
        token.globalRole = (user as unknown as { globalRole: string }).globalRole;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string; globalRole: string }).id         = token.id as string;
        (session.user as { id: string; globalRole: string }).globalRole = token.globalRole as string;
      }
      return session;
    },
  },
};

// ── Server-side helpers ───────────────────────────────────────────────────────

export async function getSession() {
  return getServerSession(authOptions);
}

export async function requireSession() {
  const session = await getSession();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return session;
}

/** Returns the effective role for a user on a project (project role > global role) */
export async function getEffectiveRole(
  userId: string,
  projectId: string
): Promise<UserRole> {
  const pu = await prisma.projectUser.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (pu && pu.status === "ACTIVE") return pu.role as UserRole;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  return (user?.globalRole ?? "INTERN") as UserRole;
}

export function hasRole(role: UserRole, minimum: UserRole): boolean {
  return ROLES[role] >= ROLES[minimum];
}

/** Write an audit log entry */
export async function writeAuditLog(opts: {
  projectId?:    string;
  userId?:       string;
  changedBy?:    string;
  entityType:    string;
  entityId:      string;
  action:        string;
  fieldChanged?: string;
  oldValue?:     string;
  newValue?:     string;
  changeReason?: string;
  ipAddress?:    string;
  userAgent?:    string;
}) {
  await prisma.auditLog.create({ data: opts });
}
