"use client";

import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Search, Plus, LogOut } from "lucide-react";
import { NotificationBell } from "@/components/layout/NotificationBell";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type TopbarProps = {
  user: {
    name: string;
    email: string;
  };
};

const ROUTE_TITLES: Record<string, { title: string; breadcrumb?: string }> = {
  "/": { title: "Overview" },
  "/sources": { title: "Sources", breadcrumb: "Manage" },
  "/tasks": { title: "Task Tracker", breadcrumb: "Manage" },
  "/reviews": { title: "Review Queue", breadcrumb: "Manage" },
  "/findings": { title: "Findings", breadcrumb: "Manage" },
  "/reports": { title: "Reports", breadcrumb: "Insights" },
  "/audit-log": { title: "Audit Log", breadcrumb: "Insights" },
  "/admin": { title: "Admin", breadcrumb: "Settings" },
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Topbar(_props: TopbarProps) {
  const pathname = usePathname();
  const routeInfo = ROUTE_TITLES[pathname] || { title: "CMP" };

  return (
    <header className="flex items-center justify-between border-b bg-white px-6" style={{ height: "var(--topbar-height)", borderColor: "var(--border)" }}>
      <div className="flex items-center gap-3">
        {routeInfo.breadcrumb && (
          <>
            <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
              {routeInfo.breadcrumb}
            </span>
            <span style={{ color: "var(--text-muted)" }}>/</span>
          </>
        )}
        <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          {routeInfo.title}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            placeholder="Search tasks, sources, findings... (⌘K)"
            className="h-9 w-80 rounded-lg border bg-white pl-9 pr-3 text-sm outline-none transition-all focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue-light)]"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        <NotificationBell />

        <button className="flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-[var(--bg-subtle)]" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
          <Plus size={16} />
          <span>Quick Add</span>
        </button>

        <button
          onClick={() =>
            signOut({
              callbackUrl: "/login",
            })
          }
          className="flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:bg-[var(--red-light)] hover:border-[var(--red)] hover:text-[var(--red)]"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
