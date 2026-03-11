"use client";

import { useState, useEffect } from "react";
import { format, isPast } from "date-fns";
import { Plus, AlertTriangle, Download, ChevronDown } from "lucide-react";
import { FindingModal } from "@/components/findings/FindingModal";
import { FindingDetailModal } from "@/components/findings/FindingDetailModal";
import toast from "react-hot-toast";

type Finding = {
  id: string;
  reference: string;
  title: string;
  severity: string;
  status: string;
  targetDate: string | null;
  closedAt: string | null;
  source: {
    name: string;
    code: string;
  };
  entity: {
    code: string;
  };
  actionOwner: {
    id: string;
    name: string;
    initials: string;
    avatarColor: string | null;
  };
  _count?: {
    evidence: number;
    comments: number;
  };
};

const SEVERITY_COLORS = {
  CRITICAL: { bg: "var(--red-light)", color: "var(--red)", border: "var(--red)" },
  HIGH: { bg: "#FEF2F2", color: "#DC2626", border: "#DC2626" },
  MEDIUM: { bg: "var(--amber-light)", color: "var(--amber)", border: "var(--amber)" },
  LOW: { bg: "var(--green-light)", color: "var(--green)", border: "var(--green)" },
  OBSERVATION: { bg: "var(--blue-light)", color: "var(--blue)", border: "var(--blue)" },
};

const STATUS_COLORS = {
  OPEN: { bg: "var(--red-light)", color: "var(--red)" },
  IN_PROGRESS: { bg: "var(--blue-light)", color: "var(--blue)" },
  IMPLEMENTED: { bg: "var(--amber-light)", color: "var(--amber)" },
  VERIFIED: { bg: "var(--purple-light)", color: "var(--purple)" },
  CLOSED: { bg: "var(--green-light)", color: "var(--green)" },
  OVERDUE: { bg: "#FEF2F2", color: "#DC2626" },
};

export function FindingsClient() {
  const [criticalFindings, setCriticalFindings] = useState<Finding[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    fetchCriticalFindings();
    fetchFindings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter]);

  const fetchCriticalFindings = async () => {
    try {
      const res = await fetch("/api/findings?critical=true");
      if (res.ok) setCriticalFindings(await res.json());
    } catch (error) {
      console.error("Error fetching critical findings:", error);
    }
  };

  const fetchFindings = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (activeFilter !== "all") {
        if (activeFilter === "overdue") {
          params.set("status", "OVERDUE");
        } else {
          params.set("status", activeFilter.toUpperCase());
        }
      }

      const res = await fetch(`/api/findings?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch findings");

      setFindings(await res.json());
    } catch (error) {
      console.error("Error fetching findings:", error);
      toast.error("Failed to load findings");
    } finally {
      setLoading(false);
    }
  };

  const isOverdue = (finding: Finding) =>
    finding.targetDate &&
    !finding.closedAt &&
    isPast(new Date(finding.targetDate)) &&
    !["CLOSED", "VERIFIED"].includes(finding.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            Findings
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            Track and manage compliance findings
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity"
          style={{ backgroundColor: "var(--blue)" }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <Plus size={18} />
          New Finding
        </button>
      </div>

      {/* Critical Findings Cards */}
      {criticalFindings.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {criticalFindings.map((finding) => {
            const severityConfig = SEVERITY_COLORS[finding.severity as keyof typeof SEVERITY_COLORS];
            const overdueStatus = isOverdue(finding);

            return (
              <div
                key={finding.id}
                onClick={() => setSelectedFindingId(finding.id)}
                className="group cursor-pointer rounded-[14px] border-l-4 bg-white p-4 shadow-sm transition-all hover:shadow-md"
                style={{ borderLeftColor: severityConfig.border }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="font-mono text-xs font-medium" style={{ color: "var(--blue)" }}>
                        {finding.reference}
                      </span>
                      <span
                        className="rounded-md px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: severityConfig.bg,
                          color: severityConfig.color,
                        }}
                      >
                        {finding.severity}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
                      {finding.title}
                    </h3>
                    <div className="mt-2 flex items-center gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                      <div className="flex items-center gap-1.5">
                        <div
                          className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white"
                          style={{ background: finding.actionOwner.avatarColor || "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
                        >
                          {finding.actionOwner.initials}
                        </div>
                        <span>{finding.actionOwner.name}</span>
                      </div>
                      {finding.targetDate && (
                        <>
                          <span>•</span>
                          <span style={{ color: overdueStatus ? "var(--red)" : "var(--text-secondary)" }}>
                            Due {format(new Date(finding.targetDate), "MMM d, yyyy")}
                            {overdueStatus && " (Overdue)"}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <AlertTriangle size={20} style={{ color: severityConfig.color }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filter Chips */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {["all", "open", "in_progress", "closed", "overdue"].map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className="rounded-full px-4 py-2 text-sm font-medium transition-colors"
              style={{
                backgroundColor: activeFilter === filter ? "var(--blue-light)" : "white",
                color: activeFilter === filter ? "var(--blue)" : "var(--text-secondary)",
                border: `1px solid ${activeFilter === filter ? "var(--blue)" : "var(--border)"}`,
              }}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1).replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <Download size={16} />
            Export
            <ChevronDown size={14} />
          </button>
          {showExportMenu && (
            <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border bg-white p-1.5 shadow-lg" style={{ borderColor: "var(--border)" }}>
              {["CSV", "Excel", "PDF"].map((format) => (
                <button
                  key={format}
                  onClick={() => {
                    toast.success(`Exporting as ${format}...`);
                    setShowExportMenu(false);
                  }}
                  className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  Export as {format}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Findings Table */}
      {loading ? (
        <div className="flex h-96 items-center justify-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Loading findings...
          </p>
        </div>
      ) : findings.length === 0 ? (
        <div className="flex h-96 flex-col items-center justify-center rounded-[14px] border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-subtle)" }}>
          <AlertTriangle size={64} style={{ color: "var(--text-muted)", marginBottom: 16 }} />
          <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
            No findings found
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            {activeFilter === "all" ? "Create your first finding to get started" : "No findings match the selected filter"}
          </p>
        </div>
      ) : (
        <div className="rounded-[14px] border bg-white shadow-sm" style={{ borderColor: "var(--border)" }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ backgroundColor: "var(--bg-subtle)", borderColor: "var(--border)" }}>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Finding
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Source
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Severity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Action Owner
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Target Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {findings.map((finding) => {
                  const severityConfig = SEVERITY_COLORS[finding.severity as keyof typeof SEVERITY_COLORS];
                  const statusConfig = STATUS_COLORS[finding.status as keyof typeof STATUS_COLORS];
                  const overdueStatus = isOverdue(finding);

                  return (
                    <tr
                      key={finding.id}
                      onClick={() => setSelectedFindingId(finding.id)}
                      className="cursor-pointer border-t transition-colors hover:bg-[var(--bg-hover)]"
                      style={{ borderColor: "var(--border-light)" }}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-medium" style={{ color: "var(--blue)" }}>
                          {finding.reference}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium leading-tight" style={{ color: "var(--text-primary)" }}>
                          {finding.title}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                          {finding.source.name}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="rounded-md px-2 py-1 text-xs font-medium"
                          style={{
                            backgroundColor: severityConfig.bg,
                            color: severityConfig.color,
                          }}
                        >
                          {finding.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white"
                            style={{ background: finding.actionOwner.avatarColor || "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
                          >
                            {finding.actionOwner.initials}
                          </div>
                          <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                            {finding.actionOwner.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {finding.targetDate ? (
                          <span
                            className="text-sm"
                            style={{ color: overdueStatus ? "var(--red)" : "var(--text-secondary)" }}
                          >
                            {format(new Date(finding.targetDate), "MMM d, yyyy")}
                          </span>
                        ) : (
                          <span className="text-sm" style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="rounded-md px-2 py-1 text-xs font-medium"
                          style={{
                            backgroundColor: statusConfig.bg,
                            color: statusConfig.color,
                          }}
                        >
                          {finding.status.replace("_", " ")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreateModal && (
        <FindingModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            fetchCriticalFindings();
            fetchFindings();
          }}
        />
      )}

      {selectedFindingId && (
        <FindingDetailModal
          isOpen={!!selectedFindingId}
          findingId={selectedFindingId}
          onClose={() => setSelectedFindingId(null)}
          onFindingUpdated={() => {
            fetchCriticalFindings();
            fetchFindings();
          }}
        />
      )}
    </div>
  );
}
