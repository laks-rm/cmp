"use client";

import { useState, useEffect, useCallback } from "react";
import { useEntity } from "@/contexts/EntityContext";
import { format } from "date-fns";
import { Download, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "@/lib/toast";

type AuditEntry = {
  id: string;
  action: string;
  module: string;
  userId: string;
  targetType: string | null;
  targetId: string | null;
  targetName: string | null;
  changeSummary: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  user: {
    name: string;
    email: string;
  };
};

const MODULE_COLORS: Record<string, string> = {
  AUTH: "var(--purple)",
  TASKS: "var(--blue)",
  SOURCES: "var(--teal)",
  FINDINGS: "var(--red)",
  USERS: "var(--amber)",
  TEAMS: "var(--green)",
  ENTITIES: "var(--purple)",
  AUDIT_LOG: "var(--text-muted)",
};

const ACTION_LABELS: Record<string, string> = {
  task_status_changed: "Status changed",
  task_submitted_for_review: "Submitted for review",
  task_approved: "Approved",
  task_rejected: "Rejected",
  task_created: "Task created",
  task_updated: "Task updated",
  task_deleted: "Task deleted",
  task_pic_assigned: "PIC assigned",
  task_narrative_updated: "Narrative updated",
  task_priority_changed: "Priority changed",
  task_due_date_changed: "Due date changed",
  finding_created: "Finding raised",
  finding_updated: "Finding updated",
  finding_deleted: "Finding deleted",
  finding_status_changed: "Status changed",
  finding_pic_assigned: "PIC assigned",
  finding_narrative_updated: "Narrative updated",
  finding_priority_changed: "Priority changed",
  evidence_uploaded: "Evidence uploaded",
  evidence_deleted: "Evidence deleted",
  source_created: "Source created",
  source_updated: "Source updated",
  source_deleted: "Source deleted",
  user_logged_in: "Logged in",
  user_logged_out: "Logged out",
  user_created: "User created",
  user_updated: "User updated",
  entity_created: "Entity created",
  entity_updated: "Entity updated",
};

const TARGET_TYPE_BADGES: Record<string, { label: string; color: string }> = {
  TASK: { label: "TASK", color: "var(--blue)" },
  FINDING: { label: "FINDING", color: "var(--red)" },
  SOURCE: { label: "SOURCE", color: "var(--teal)" },
  USER: { label: "USER", color: "var(--amber)" },
  ENTITY: { label: "ENTITY", color: "var(--purple)" },
  TEAM: { label: "TEAM", color: "var(--green)" },
};

type SortField = "createdAt" | "user" | "action" | "module";
type SortOrder = "asc" | "desc";

export function AuditLogClient() {
  const router = useRouter();
  const { selectedEntityId } = useEntity();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedModule, setSelectedModule] = useState<string>("all");
  const [selectedUser] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const limit = 50;

  const fetchAuditLog = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", limit.toString());
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      if (selectedModule !== "all") params.set("module", selectedModule);
      if (selectedUser !== "all") params.set("userId", selectedUser);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (selectedEntityId && selectedEntityId !== "GROUP") params.set("entityId", selectedEntityId);

      const res = await fetch(`/api/audit-log?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch audit log");

      const data = await res.json();
      setEntries(data.entries || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error("Failed to fetch audit log:", error);
      toast.error("Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortOrder, selectedModule, selectedUser, dateFrom, dateTo, selectedEntityId]);

  useEffect(() => {
    fetchAuditLog();
  }, [fetchAuditLog]);

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      params.set("export", "csv");
      if (selectedModule !== "all") params.set("module", selectedModule);
      if (selectedUser !== "all") params.set("userId", selectedUser);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (selectedEntityId && selectedEntityId !== "GROUP") params.set("entityId", selectedEntityId);

      const res = await fetch(`/api/audit-log?${params.toString()}`);
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-log-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Audit log exported");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Export failed");
    }
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder(field === "createdAt" ? "desc" : "asc");
    }
    setPage(1);
  };

  const getSortIcon = (field: SortField) => {
    if (sortBy !== field) {
      return <ArrowUpDown size={14} style={{ color: "var(--text-muted)" }} />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp size={14} style={{ color: "var(--blue)" }} />
    ) : (
      <ArrowDown size={14} style={{ color: "var(--blue)" }} />
    );
  };

  const handleTargetClick = (entry: AuditEntry) => {
    if (!entry.targetId || !entry.targetType) return;

    if (entry.targetType === "TASK") {
      router.push(`/tasks/${entry.targetId}`);
    } else if (entry.targetType === "FINDING") {
      router.push(`/findings/${entry.targetId}`);
    } else if (entry.targetType === "SOURCE") {
      router.push(`/sources/${entry.targetId}`);
    }
  };

  const getActionLabel = (action: string): string => {
    return ACTION_LABELS[action] || action.replace(/_/g, " ");
  };

  const modules = ["all", "AUTH", "TASKS", "SOURCES", "FINDINGS", "USERS", "TEAMS", "ENTITIES", "AUDIT_LOG"];

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6 px-6 py-6">
      {/* Filter Bar */}
      <div
        className="flex items-center justify-between rounded-[14px] border bg-white p-4"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex flex-1 items-center gap-3">
          <label className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            Module:
          </label>
          <select
            value={selectedModule}
            onChange={(e) => {
              setSelectedModule(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-lg border bg-white px-3 text-sm outline-none transition-colors focus:border-[var(--blue)]"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            {modules.map((mod) => (
              <option key={mod} value={mod}>
                {mod === "all" ? "All Modules" : mod}
              </option>
            ))}
          </select>

          <span style={{ color: "var(--border)" }}>|</span>

          <label className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            From:
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-lg border bg-white px-3 text-sm outline-none transition-colors focus:border-[var(--blue)]"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          />

          <label className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            To:
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-lg border bg-white px-3 text-sm outline-none transition-colors focus:border-[var(--blue)]"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        <button
          onClick={handleExport}
          className="flex h-9 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "white")}
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-[14px] border bg-white" style={{ borderColor: "var(--border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{ backgroundColor: "var(--bg-subtle)" }}>
              <tr>
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ color: "var(--text-secondary)" }}
                  onClick={() => handleSort("createdAt")}
                >
                  <div className="flex items-center gap-2">
                    WHEN
                    {getSortIcon("createdAt")}
                  </div>
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ color: "var(--text-secondary)" }}
                  onClick={() => handleSort("user")}
                >
                  <div className="flex items-center gap-2">
                    WHO
                    {getSortIcon("user")}
                  </div>
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ color: "var(--text-secondary)" }}
                  onClick={() => handleSort("action")}
                >
                  <div className="flex items-center gap-2">
                    ACTION
                    {getSortIcon("action")}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  TARGET
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  CHANGE
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ color: "var(--text-secondary)" }}
                  onClick={() => handleSort("module")}
                >
                  <div className="flex items-center gap-2">
                    MODULE
                    {getSortIcon("module")}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                    Loading audit log...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                    No audit entries found
                  </td>
                </tr>
              ) : (
                entries.map((entry, index) => (
                  <tr
                    key={entry.id}
                    className="border-t transition-colors hover:bg-[var(--bg-hover)]"
                    style={{
                      borderColor: "var(--border-light)",
                      backgroundColor: index % 2 === 1 ? "var(--bg-subtle)" : "white",
                    }}
                  >
                    {/* WHEN */}
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {format(new Date(entry.createdAt), "MMM d, yyyy h:mm a")}
                    </td>

                    {/* WHO */}
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {entry.user?.name ?? "System"}
                    </td>

                    {/* ACTION */}
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                      {getActionLabel(entry.action)}
                    </td>

                    {/* TARGET */}
                    <td className="px-4 py-3">
                      {entry.targetName && entry.targetType ? (
                        <div className="flex items-center gap-2">
                          {(entry.targetType === "TASK" || entry.targetType === "FINDING" || entry.targetType === "SOURCE") ? (
                            <button
                              onClick={() => handleTargetClick(entry)}
                              className="max-w-xs truncate text-sm font-medium transition-colors hover:underline"
                              style={{ color: "var(--blue)" }}
                            >
                              {entry.targetName}
                            </button>
                          ) : (
                            <span className="max-w-xs truncate text-sm" style={{ color: "var(--text-primary)" }}>
                              {entry.targetName}
                            </span>
                          )}
                          {TARGET_TYPE_BADGES[entry.targetType] && (
                            <span
                              className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                              style={{
                                backgroundColor: `${TARGET_TYPE_BADGES[entry.targetType].color}20`,
                                color: TARGET_TYPE_BADGES[entry.targetType].color,
                              }}
                            >
                              {TARGET_TYPE_BADGES[entry.targetType].label}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          —
                        </span>
                      )}
                    </td>

                    {/* CHANGE */}
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                      {entry.changeSummary || "—"}
                    </td>

                    {/* MODULE */}
                    <td className="px-4 py-3">
                      <span
                        className="inline-block rounded px-2 py-1 text-xs font-medium"
                        style={{
                          backgroundColor: `${MODULE_COLORS[entry.module] || "var(--text-muted)"}20`,
                          color: MODULE_COLORS[entry.module] || "var(--text-muted)",
                        }}
                      >
                        {entry.module}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && entries.length > 0 && (
          <div
            className="flex items-center justify-between border-t px-4 py-3"
            style={{ borderColor: "var(--border-light)" }}
          >
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Showing {(page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total} entries
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:opacity-40"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                <ChevronLeft size={16} />
              </button>

              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Page {page} of {totalPages}
              </span>

              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:opacity-40"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
