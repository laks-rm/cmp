import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { EntityProvider } from "@/contexts/EntityContext";

const NAV_PERMISSION_MAP: Array<{ href: string; module: string; action: string }> = [
  { href: "/", module: "DASHBOARD", action: "VIEW" },
  { href: "/sources", module: "SOURCES", action: "VIEW" },
  { href: "/tasks", module: "TASKS", action: "VIEW" },
  { href: "/reviews", module: "REVIEW_QUEUE", action: "VIEW" },
  { href: "/findings", module: "FINDINGS", action: "VIEW" },
  { href: "/reports", module: "REPORTS", action: "VIEW" },
  { href: "/audit-log", module: "AUDIT_LOG", action: "VIEW" },
  { href: "/admin", module: "USER_MANAGEMENT", action: "VIEW" },
];

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const accessList = await Promise.all(
    NAV_PERMISSION_MAP.map(async (item) => ({
      href: item.href,
      allowed: await hasPermission(session, item.module, item.action),
    })),
  );

  const allowedHrefs = accessList.filter((entry) => entry.allowed).map((entry) => entry.href);

  const entities = await prisma.entity.findMany({
    where: {
      id: { in: session.user.entityIds },
      isActive: true,
    },
    select: {
      id: true,
      code: true,
      name: true,
    },
    orderBy: { code: "asc" },
  });

  const teams = await prisma.team.findMany({
    where: {
      id: { in: session.user.teamIds },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });

  const userData = {
    name: session.user.name ?? "User",
    email: session.user.email ?? "",
    initials: session.user.initials,
    roleName: session.user.roleName,
    avatarColor: "bg-gradient-to-br from-purple-500 to-indigo-600",
    entityIds: session.user.entityIds,
    teamIds: session.user.teamIds,
  };

  return (
    <EntityProvider>
      <div className="flex min-h-screen">
        <Sidebar user={userData} entities={entities} teams={teams} allowedHrefs={allowedHrefs} />
        <div className="flex min-h-screen flex-1 flex-col">
          <Topbar user={userData} />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </EntityProvider>
  );
}
