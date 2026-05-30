import { NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

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

        const { allowed } = rateLimit(`login:${credentials.email.toLowerCase()}`, 5, 15 * 60 * 1000);
        if (!allowed) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });

        if (!user || user.status === "SUSPENDED") return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) {
          await prisma.auditLog.create({
            data: { userId: user.id, changedBy: user.id, entityType: "USER", entityId: user.id, action: "LOGIN_FAILED" },
          }).catch(() => {});
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data:  { lastLoginAt: new Date() },
        });

        await prisma.auditLog.create({
          data: { userId: user.id, changedBy: user.id, entityType: "USER", entityId: user.id, action: "LOGIN_SUCCESS" },
        }).catch(() => {});

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

/**
 * Write an audit log entry. Audit logging is best-effort: it must never break or
 * roll back the primary mutation it accompanies, so failures are logged, not thrown.
 */
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
  try {
    await prisma.auditLog.create({ data: opts });
  } catch (err) {
    console.error("writeAuditLog failed:", err);
  }
}
