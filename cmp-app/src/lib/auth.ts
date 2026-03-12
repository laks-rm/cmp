import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { clearFailedLogin, isLoginLocked, recordFailedLogin } from "@/lib/rate-limit";
import { logAuditEvent } from "@/lib/audit";

const credentialSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
});

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

type AuthUser = {
  id: string;
  email: string;
  name: string;
  initials: string;
  roleId: string;
  roleName: string;
  entityIds: string[];
  teamIds: string[];
};

function getProviders() {
  if (process.env.AUTH_PROVIDER === "okta") {
    // TODO: Wire OktaProvider once OIDC values are available.
    throw new Error("Okta provider not yet configured — set AUTH_PROVIDER=credentials for local dev");
  }

  return [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialSchema.safeParse(credentials);
        if (!parsed.success) {
          await logAuditEvent({
            action: "INVALID_INPUT",
            module: "AUTH",
            details: { route: "nextauth/credentials" },
          });
          return null;
        }

        const { email, password } = parsed.data;

        if (isLoginLocked(email)) {
          await logAuditEvent({
            action: "AUTH_ACCOUNT_LOCKED",
            module: "AUTH",
            details: { email },
          });
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          include: {
            role: true,
            entityAccess: true,
            teamMemberships: true,
          },
        });

        if (!user || !user.isActive) {
          const lockState = recordFailedLogin(email);
          await logAuditEvent({
            action: lockState.isLocked ? "AUTH_ACCOUNT_LOCKED" : "AUTH_LOGIN_FAILED",
            module: "AUTH",
            userId: user?.id,
            details: { email },
          });
          return null;
        }

        const isMatch = await compare(password, user.passwordHash);
        if (!isMatch) {
          const lockState = recordFailedLogin(email);
          await logAuditEvent({
            action: lockState.isLocked ? "AUTH_ACCOUNT_LOCKED" : "AUTH_LOGIN_FAILED",
            module: "AUTH",
            userId: user.id,
            details: { email },
          });
          return null;
        }

        clearFailedLogin(email);
        await logAuditEvent({
          action: "AUTH_LOGIN_SUCCESS",
          module: "AUTH",
          userId: user.id,
          details: { email: user.email },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          initials: user.initials,
          roleId: user.roleId,
          roleName: user.role.name,
          entityIds: user.entityAccess.map((access) => access.entityId),
          teamIds: user.teamMemberships.map((membership) => membership.teamId),
        };
      },
    }),
  ];
}

export const authOptions: NextAuthOptions = {
  providers: getProviders(),
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 28_800,
  },
  jwt: {
    maxAge: 28_800,
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        const authUser = user as unknown as AuthUser;
        token.userId = user.id;
        token.email = user.email ?? "";
        token.name = user.name ?? "";
        token.initials = authUser.initials;
        token.roleId = authUser.roleId;
        token.roleName = authUser.roleName;
        token.entityIds = authUser.entityIds;
        token.teamIds = authUser.teamIds;
        token.lastRefreshAt = Date.now();
      }

      if (token.userId && (trigger === "update" || !token.lastRefreshAt || Date.now() - token.lastRefreshAt > REFRESH_INTERVAL_MS)) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.userId },
          include: {
            role: true,
            entityAccess: true,
            teamMemberships: true,
          },
        });

        if (!dbUser || !dbUser.isActive) {
          await logAuditEvent({
            action: "AUTH_SESSION_EXPIRED",
            module: "AUTH",
            userId: token.userId,
          });
          token.userId = "";
          token.email = "";
          token.name = "";
          token.initials = "";
          token.roleId = "";
          token.roleName = "";
          token.entityIds = [];
          token.teamIds = [];
          return token;
        }

        token.email = dbUser.email;
        token.name = dbUser.name;
        token.initials = dbUser.initials;
        token.roleId = dbUser.roleId;
        token.roleName = dbUser.role.name;
        token.entityIds = dbUser.entityAccess.map((access) => access.entityId);
        token.teamIds = dbUser.teamMemberships.map((membership) => membership.teamId);
        token.lastRefreshAt = Date.now();
      }

      return token;
    },
    async session({ session, token }) {
      if (!token?.userId) {
        return session;
      }

      session.user = {
        ...session.user,
        userId: token.userId,
        email: token.email,
        name: token.name,
        initials: token.initials,
        roleId: token.roleId,
        roleName: token.roleName,
        entityIds: token.entityIds ?? [],
        teamIds: token.teamIds ?? [],
      };
      return session;
    },
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  events: {
    async signOut({ token }) {
      await logAuditEvent({
        action: "AUTH_LOGOUT",
        module: "AUTH",
        userId: token?.userId,
      });
    },
  },
};
