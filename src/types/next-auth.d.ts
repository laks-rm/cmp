import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      userId: string;
      initials: string;
      roleId: string;
      roleName: string;
      entityIds: string[];
      teamIds: string[];
      timezone: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    name: string;
    email: string;
    initials: string;
    roleId: string;
    roleName: string;
    entityIds: string[];
    teamIds: string[];
    timezone: string;
    lastRefreshAt?: number;
  }
}
