"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BookOpen, CheckSquare, Calendar, FileText, AlertTriangle, BarChart3, Clock, Settings, ChevronDown, Globe, AlertOctagon, type LucideIcon } from "lucide-react";
import { useEntity } from "@/contexts/EntityContext";

type SidebarProps = {
  user: {
    name: string;
    initials: string;
    roleName: string;
    avatarColor: string;
    entityIds: string[];
    teamIds: string[];
  };
  entities: Array<{ id: string; code: string; name: string }>;
  teams: Array<{ id: string; name: string }>;
  allowedHrefs?: string[];
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  section: string;
  badge?: number;
  superAdminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard, section: "main" },
  { href: "/sources", label: "Sources", icon: BookOpen, section: "manage" },
  { href: "/tasks", label: "Task Tracker", icon: CheckSquare, section: "manage" },
  { href: "/calendar", label: "Calendar", icon: Calendar, section: "manage" },
  { href: "/reviews", label: "Review Queue", icon: FileText, section: "manage", badge: 0 },
  { href: "/findings", label: "Findings", icon: AlertTriangle, section: "manage", badge: 0 },
  { href: "/reports", label: "Reports", icon: BarChart3, section: "insights" },
  { href: "/audit-log", label: "Audit Log", icon: Clock, section: "insights" },
  { href: "/admin/error-logs", label: "Error Logs", icon: AlertOctagon, section: "insights", superAdminOnly: true },
  { href: "/admin", label: "Admin", icon: Settings, section: "settings" },
];

const SECTIONS = [
  { id: "main", label: null },
  { id: "manage", label: "Manage" },
  { id: "insights", label: "Insights" },
  { id: "settings", label: "Settings" },
];

export function Sidebar({ user, entities, teams, allowedHrefs }: SidebarProps) {
  const pathname = usePathname();
  const { selectedEntityId, selectedTeamId, setEntity, setTeam } = useEntity();
  const [isEntityOpen, setIsEntityOpen] = useState(false);
  const [isTeamOpen, setIsTeamOpen] = useState(false);

  const visibleItems = allowedHrefs 
    ? NAV_ITEMS.filter((item) => {
        // Filter by allowed hrefs
        if (!allowedHrefs.includes(item.href)) return false;
        // Filter super admin only items
        if (item.superAdminOnly && user.roleName !== "SUPER_ADMIN") return false;
        return true;
      })
    : NAV_ITEMS.filter((item) => {
        // Filter super admin only items
        if (item.superAdminOnly && user.roleName !== "SUPER_ADMIN") return false;
        return true;
      });

  const selectedEntity = entities.find((e) => e.id === selectedEntityId);
  const selectedTeam = teams.find((t) => t.id === selectedTeamId);
  const canAccessGroup = user.entityIds.length === entities.length;

  return (
    <aside className="flex h-screen flex-col border-r bg-white" style={{ width: "var(--sidebar-width)", borderColor: "var(--border)" }}>
      <div className="border-b p-5" style={{ borderColor: "var(--border-light)" }}>
        <div className="flex items-center gap-3">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-gradient-to-br from-[#FF444F] to-[#3B6CE7] text-sm font-bold text-white">
            CM
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
              CMP
            </div>
            <div className="text-[11px] font-medium leading-tight" style={{ color: "var(--text-muted)" }}>
              Compliance Monitor
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2 p-3">
        <div className="relative">
          <button
            onClick={() => setIsEntityOpen(!isEntityOpen)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-xs font-medium transition-colors hover:bg-[var(--bg-subtle)]"
            style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}
          >
            <div className="flex items-center gap-2">
              {selectedEntityId === "GROUP" ? <Globe size={14} style={{ color: "var(--purple)" }} /> : null}
              <span>{selectedEntityId === "GROUP" ? "Deriv Group" : selectedEntity?.code || "Select Entity"}</span>
            </div>
            <ChevronDown size={14} className={`transition-transform ${isEntityOpen ? "rotate-180" : ""}`} />
          </button>
          {isEntityOpen && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border bg-white p-1.5 shadow-lg" style={{ borderColor: "var(--border)" }}>
              {canAccessGroup && (
                <button
                  onClick={() => {
                    setEntity("GROUP");
                    setIsEntityOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors hover:bg-[var(--bg-subtle)]"
                  style={{ color: selectedEntityId === "GROUP" ? "var(--purple)" : "var(--text-secondary)" }}
                >
                  <Globe size={14} />
                  Deriv Group — Consolidated
                </button>
              )}
              {entities.map((entity) => (
                <button
                  key={entity.id}
                  onClick={() => {
                    setEntity(entity.id);
                    setIsEntityOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-medium transition-colors hover:bg-[var(--bg-subtle)]"
                  style={{ color: selectedEntityId === entity.id ? "var(--blue)" : "var(--text-secondary)" }}
                >
                  <span>{entity.code}</span>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {entity.name.split(" ").slice(0, 2).join(" ")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setIsTeamOpen(!isTeamOpen)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-xs font-medium transition-colors hover:bg-[var(--bg-subtle)]"
            style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}
          >
            <span>Team: {selectedTeamId === "ALL" ? "All Teams" : selectedTeam?.name || "Select Team"}</span>
            <ChevronDown size={14} className={`transition-transform ${isTeamOpen ? "rotate-180" : ""}`} />
          </button>
          {isTeamOpen && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border bg-white p-1.5 shadow-lg" style={{ borderColor: "var(--border)" }}>
              <button
                onClick={() => {
                  setTeam("ALL");
                  setIsTeamOpen(false);
                }}
                className="flex w-full items-center rounded-md px-3 py-2 text-xs font-medium transition-colors hover:bg-[var(--bg-subtle)]"
                style={{ color: selectedTeamId === "ALL" ? "var(--blue)" : "var(--text-secondary)" }}
              >
                All Teams
              </button>
              {teams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => {
                    setTeam(team.id);
                    setIsTeamOpen(false);
                  }}
                  className="flex w-full items-center rounded-md px-3 py-2 text-xs font-medium transition-colors hover:bg-[var(--bg-subtle)]"
                  style={{ color: selectedTeamId === team.id ? "var(--blue)" : "var(--text-secondary)" }}
                >
                  {team.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-3">
        {SECTIONS.map((section) => {
          const sectionItems = visibleItems.filter((item) => item.section === section.id);
          if (!sectionItems.length) {
            return null;
          }
          return (
            <div key={section.id}>
              {section.label && (
                <div className="mb-2 mt-4 px-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  {section.label}
                </div>
              )}
              {sectionItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-all ${
                      isActive ? "bg-[var(--blue-light)] text-[var(--blue)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                    }`}
                  >
                    {isActive && <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--blue)]" />}
                    <Icon size={17} strokeWidth={2} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--red)] px-1.5 text-[10px] font-semibold text-white">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="border-t p-3" style={{ borderColor: "var(--border-light)" }}>
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ backgroundColor: "var(--bg-subtle)" }}>
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white ${user.avatarColor}`}>{user.initials}</div>
          <div className="flex-1 overflow-hidden">
            <div className="truncate text-xs font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
              {user.name}
            </div>
            <div className="truncate text-[10px] font-medium leading-tight" style={{ color: "var(--text-muted)" }}>
              {user.roleName.replace("_", " ")}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
