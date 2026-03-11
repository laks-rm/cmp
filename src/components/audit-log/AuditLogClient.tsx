"use client";

import { useState, useEffect, useCallback } from "react";
import { useEntity } from "@/contexts/EntityContext";
import { format } from "date-fns";
import { Download, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import toast from "react-hot-toast";

type AuditEntry = {
  id: string;
  action: string;
  module: string;
  userId: string;
  targetType: string | null;
  targetId: string | null;
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
};

export function AuditLogClient() {
  const { selectedEntityId } = useEntity();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedModule, setSelectedModule] = useState<string>("all");
  const [selectedUser] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const limit = 50;

  const fetchAuditLog = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", limit.toString());

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
  }, [page, selectedModule, selectedUser, dateFrom, dateTo, selectedEntityId]);

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

  const formatActionMessage = (entry: AuditEntry): string => {
    const action = entry.action.toLowerCase().replace(/_/g, " ");
    const targetName = entry.details?.targetName ? String(entry.details.targetName) : entry.targetId;

    if (targetName) {
      return `${action} ${entry.targetType?.toLowerCase() || "item"} "${targetName}"`;
    }
    return action;
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

      {/* Audit Log Timeline */}
      <div className="rounded-[14px] border bg-white" style={{ borderColor: "var(--border)" }}>
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="text-center">
              <Clock size={48} style={{ color: "var(--text-muted)", marginBottom: 12 }} className="mx-auto animate-pulse" />
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Loading audit log...
              </p>
            </div>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex items-center justify-center p-12">
            <div className="text-center">
              <Clock size={48} style={{ color: "var(--text-muted)", marginBottom: 12 }} className="mx-auto" />
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                No audit entries found
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border-light)" }}>
            {entries.map((entry) => (
              <div key={entry.id} className="flex gap-4 p-4 transition-colors hover:bg-[var(--bg-hover)]">
                <div className="flex flex-col items-center">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: MODULE_COLORS[entry.module] || "var(--text-muted)" }}
                  />
                  <div className="h-full w-px" style={{ backgroundColor: "var(--border-light)" }} />
                </div>

                <div className="flex-1 pb-4">
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
                    <strong>{entry.user.name}</strong> {formatActionMessage(entry)}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                    <span>{format(new Date(entry.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
                    <span>•</span>
                    <span className="rounded px-2 py-0.5" style={{ backgroundColor: "var(--bg-subtle)" }}>
                      {entry.module}
                    </span>
                    {entry.ipAddress && (
                      <>
                        <span>•</span>
                        <span>{entry.ipAddress}</span>
                      </>
                    )}
                  </div>

                  {entry.details && Object.keys(entry.details).length > 0 && (
                    <details className="mt-2">
                      <summary
                        className="cursor-pointer text-xs font-medium"
                        style={{ color: "var(--blue)" }}
                      >
                        View details
                      </summary>
                      <pre
                        className="mt-2 overflow-x-auto rounded-lg p-3 text-xs"
                        style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}
                      >
                        {JSON.stringify(entry.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

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
