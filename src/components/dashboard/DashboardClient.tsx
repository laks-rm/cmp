"use client";

import { useEntity } from "@/contexts/EntityContext";
import { KPICard } from "@/components/ui/KPICard";
import { EntityBadge } from "@/components/ui/EntityBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import { CheckCircle, Clock, AlertTriangle, FileText, TrendingUp, Globe, BarChart3 } from "lucide-react";

type DashboardClientProps = {
  firstName: string;
  greeting: string;
};

export function DashboardClient({ firstName, greeting }: DashboardClientProps) {
  const { selectedEntityId, selectedEntity } = useEntity();

  // Display entity name or code
  const entityDisplayName = selectedEntity?.name || selectedEntity?.code || selectedEntityId;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
          {greeting}, {firstName}
        </h1>
        <p className="mt-1 text-[13.5px] font-medium" style={{ color: "var(--text-secondary)" }}>
          {selectedEntityId === "GROUP" ? "Viewing consolidated data across all entities" : `Viewing ${entityDisplayName} entity data`}
        </p>
      </div>

      {selectedEntityId === "GROUP" && (
        <div className="flex items-center gap-3 rounded-[14px] border p-4" style={{ backgroundColor: "var(--purple-light)", borderColor: "var(--purple)" }}>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: "var(--purple)", color: "white" }}>
            <Globe size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--purple)" }}>
              Group-Wide Consolidated View
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Showing aggregated data from all entities you have access to (DIEL, DGL, DBVI, FINSERV)
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-5 gap-4">
        <KPICard label="Total Tasks" value="247" icon={<FileText size={20} style={{ color: "var(--blue)" }} />} accentColor="var(--blue)" iconBg="var(--blue-light)" trend={{ value: "12%", isPositive: true }} />
        <KPICard label="In Progress" value="68" icon={<Clock size={20} style={{ color: "var(--amber)" }} />} accentColor="var(--amber)" iconBg="var(--amber-light)" />
        <KPICard
          label="Pending Review"
          value="15"
          icon={<BarChart3 size={20} style={{ color: "var(--purple)" }} />}
          accentColor="var(--purple)"
          iconBg="var(--purple-light)"
          trend={{ value: "3", isPositive: false }}
        />
        <KPICard label="Completed (Q1)" value="142" icon={<CheckCircle size={20} style={{ color: "var(--green)" }} />} accentColor="var(--green)" iconBg="var(--green-light)" trend={{ value: "8%", isPositive: true }} />
        <KPICard label="Overdue" value="9" icon={<AlertTriangle size={20} style={{ color: "var(--red)" }} />} accentColor="var(--red)" iconBg="var(--red-light)" trend={{ value: "2", isPositive: false }} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-[14px] border bg-white p-6 shadow-sm" style={{ borderColor: "var(--border)" }}>
          <h2 className="mb-4 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Action Items
          </h2>
          <div className="space-y-3">
            {[
              { title: "DORA ICT Risk Management Review", entity: "DIEL" as const, status: "PENDING_REVIEW" as const, dueDate: "Today" },
              { title: "Q1 AML Training Completion Report", entity: "DGL" as const, status: "OVERDUE" as const, dueDate: "2 days ago" },
              { title: "Monthly Board Pack Compliance Section", entity: "FINSERV" as const, status: "IN_PROGRESS" as const, dueDate: "In 3 days" },
              { title: "KYC Process Documentation Update", entity: "DBVI" as const, status: "TO_DO" as const, dueDate: "In 5 days" },
            ].map((item, idx) => (
              <div key={idx} className="flex items-start justify-between rounded-lg border p-3 transition-all hover:border-[var(--blue)] hover:shadow-sm" style={{ borderColor: "var(--border-light)" }}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <EntityBadge entityCode={item.entity} />
                    <StatusPill status={item.status} />
                  </div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                    Due {item.dueDate}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[14px] border bg-white p-6 shadow-sm" style={{ borderColor: "var(--border)" }}>
          <h2 className="mb-4 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Compliance by Source
          </h2>
          <div className="space-y-4">
            {[
              { source: "DORA", total: 48, completed: 42, color: "var(--blue)" },
              { source: "GDPR", total: 32, completed: 32, color: "var(--green)" },
              { source: "MiFID II", total: 56, completed: 48, color: "var(--amber)" },
              { source: "AML/CFT", total: 28, completed: 20, color: "var(--red)" },
            ].map((item, idx) => (
              <div key={idx}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                    {item.source}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {item.completed}/{item.total} ({Math.round((item.completed / item.total) * 100)}%)
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--bg-subtle)" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${(item.completed / item.total) * 100}%`, backgroundColor: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
          Active Sources
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { code: "DORA-2025", name: "Digital Operational Resilience Act", entity: "DIEL" as const, type: "REGULATION", tasks: 48, completionRate: 88 },
            { code: "GDPR-01", name: "General Data Protection Regulation", entity: "GROUP" as const, type: "REGULATION", tasks: 32, completionRate: 100 },
            { code: "MiFID-Q1", name: "Markets in Financial Instruments Directive", entity: "DGL" as const, type: "REGULATION", tasks: 56, completionRate: 86 },
            { code: "AML-2026", name: "Anti-Money Laundering Requirements", entity: "DBVI" as const, type: "REGULATION", tasks: 28, completionRate: 71 },
            { code: "IA-Q1-2026", name: "Q1 Internal Audit Programme", entity: "GROUP" as const, type: "INTERNAL_AUDIT", tasks: 18, completionRate: 55 },
            { code: "BOARD-Q4", name: "Board Compliance Directive Q4 2025", entity: "FINSERV" as const, type: "BOARD_DIRECTIVE", tasks: 12, completionRate: 92 },
          ].map((source, idx) => (
            <div key={idx} className="rounded-[14px] border bg-white p-4 shadow-sm transition-all hover:shadow-md" style={{ borderColor: "var(--border)" }}>
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <EntityBadge entityCode={source.entity} size="sm" />
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase" style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-muted)" }}>
                    {source.type.replace("_", " ")}
                  </span>
                </div>
                <TrendingUp size={14} style={{ color: source.completionRate >= 90 ? "var(--green)" : source.completionRate >= 70 ? "var(--amber)" : "var(--red)" }} />
              </div>
              <p className="mb-1 font-mono text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                {source.code}
              </p>
              <h3 className="mb-3 text-sm font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
                {source.name}
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: "var(--text-secondary)" }}>{source.tasks} tasks</span>
                  <span className="font-semibold" style={{ color: source.completionRate >= 90 ? "var(--green)" : source.completionRate >= 70 ? "var(--amber)" : "var(--red)" }}>
                    {source.completionRate}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--bg-subtle)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${source.completionRate}%`,
                      backgroundColor: source.completionRate >= 90 ? "var(--green)" : source.completionRate >= 70 ? "var(--amber)" : "var(--red)",
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
