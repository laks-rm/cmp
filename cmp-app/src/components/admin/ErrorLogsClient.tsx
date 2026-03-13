"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Search, Filter, RefreshCw, Eye, CheckCircle, XCircle } from "lucide-react";
import { ErrorType, ErrorSeverity } from "@prisma/client";
import { ErrorDetailModal } from "./ErrorDetailModal";
import { format } from "date-fns";
import toast from "@/lib/toast";

type ErrorLog = {
  id: string;
  errorType: ErrorType;
  errorMessage: string;
  errorStack: string | null;
  errorDigest: string | null;
  url: string;
  userAgent: string | null;
  userId: string | null;
  httpMethod: string | null;
  statusCode: number | null;
  apiEndpoint: string | null;
  requestBody: any;
  environment: string;
  appVersion: string | null;
  severity: ErrorSeverity;
  resolved: boolean;
  resolvedAt: Date | null;
  resolvedById: string | null;
  resolutionNotes: string | null;
  createdAt: Date;
  user?: {
    id: string;
    name: string;
    email: string;
    initials: string;
    avatarColor: string | null;
  } | null;
  resolver?: {
    id: string;
    name: string;
    email: string;
  } | null;
};

const severityColors = {
  INFO: { bg: "var(--blue-light)", text: "var(--blue)" },
  WARNING: { bg: "var(--amber-light)", text: "var(--amber)" },
  ERROR: { bg: "var(--red-light)", text: "var(--red)" },
  CRITICAL: { bg: "#fee2e2", text: "#dc2626" },
};

export function ErrorLogsClient() {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // Filters
  const [search, setSearch] = useState("");
  const [errorTypeFilter, setErrorTypeFilter] = useState<string>("");
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [resolvedFilter, setResolvedFilter] = useState<string>("");
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchErrors = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50",
      });

      if (search) params.set("search", search);
      if (errorTypeFilter) params.set("errorType", errorTypeFilter);
      if (severityFilter) params.set("severity", severityFilter);
      if (resolvedFilter) params.set("resolved", resolvedFilter);

      const response = await fetch(`/api/errors?${params}`);
      if (!response.ok) throw new Error("Failed to fetch errors");

      const data = await response.json();
      setErrors(data.errors);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch (error) {
      toast.error("Failed to load error logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchErrors();
  }, [page, search, errorTypeFilter, severityFilter, resolvedFilter]);

  const handleViewDetails = (error: ErrorLog) => {
    setSelectedError(error);
    setShowDetailModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailModal(false);
    setSelectedError(null);
  };

  const handleUpdate = () => {
    fetchErrors();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
            Error Logs
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {total} total errors
          </p>
        </div>
        <button
          onClick={fetchErrors}
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "white")}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[300px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            placeholder="Search errors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border py-2 pl-10 pr-4 text-sm transition-colors"
            style={{ borderColor: "var(--border)" }}
          />
        </div>

        {/* Error Type Filter */}
        <select
          value={errorTypeFilter}
          onChange={(e) => setErrorTypeFilter(e.target.value)}
          className="rounded-lg border px-4 py-2 text-sm transition-colors"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          <option value="">All Types</option>
          {Object.values(ErrorType).map((type) => (
            <option key={type} value={type}>
              {type.replace(/_/g, " ")}
            </option>
          ))}
        </select>

        {/* Severity Filter */}
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="rounded-lg border px-4 py-2 text-sm transition-colors"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          <option value="">All Severities</option>
          {Object.values(ErrorSeverity).map((severity) => (
            <option key={severity} value={severity}>
              {severity}
            </option>
          ))}
        </select>

        {/* Resolved Filter */}
        <select
          value={resolvedFilter}
          onChange={(e) => setResolvedFilter(e.target.value)}
          className="rounded-lg border px-4 py-2 text-sm transition-colors"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          <option value="">All Status</option>
          <option value="false">Unresolved</option>
          <option value="true">Resolved</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-[14px] border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full">
          <thead style={{ backgroundColor: "var(--bg-subtle)" }}>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Message
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                User
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Severity
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Status
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                  Loading...
                </td>
              </tr>
            ) : errors.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                  No errors found
                </td>
              </tr>
            ) : (
              errors.map((error) => (
                <tr key={error.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                    {format(new Date(error.createdAt), "MMM d, h:mm a")}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {error.errorType.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="max-w-md truncate text-sm" style={{ color: "var(--text-primary)" }}>
                      {error.errorMessage}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {error.user ? (
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white"
                          style={{ background: error.user.avatarColor || "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
                        >
                          {error.user.initials}
                        </div>
                        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                          {error.user.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        Anonymous
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="rounded-full px-2 py-1 text-xs font-medium"
                      style={{
                        backgroundColor: severityColors[error.severity].bg,
                        color: severityColors[error.severity].text,
                      }}
                    >
                      {error.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {error.resolved ? (
                      <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--green)" }}>
                        <CheckCircle size={14} />
                        Resolved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--amber)" }}>
                        <XCircle size={14} />
                        Open
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleViewDetails(error)}
                      className="inline-flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium transition-colors"
                      style={{ backgroundColor: "var(--blue-light)", color: "var(--blue)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                    >
                      <Eye size={14} />
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <ErrorDetailModal
        isOpen={showDetailModal}
        error={selectedError}
        onClose={handleCloseModal}
        onUpdate={handleUpdate}
      />
    </div>
  );
}
