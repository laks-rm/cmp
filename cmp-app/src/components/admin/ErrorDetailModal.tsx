"use client";

import { useState } from "react";
import { X, Check, User, Globe, Code, Clock, AlertTriangle } from "lucide-react";
import { ErrorLog, ErrorType, ErrorSeverity } from "@prisma/client";
import toast from "@/lib/toast";
import { format } from "date-fns";

type ErrorLogWithUser = ErrorLog & {
  user?: {
    id: string;
    name: string;
    email: string;
    initials: string;
    avatarColor: string | null;
    role?: {
      displayName: string;
    };
  } | null;
  resolver?: {
    id: string;
    name: string;
    email: string;
  } | null;
};

type ErrorDetailModalProps = {
  isOpen: boolean;
  error: ErrorLogWithUser | null;
  onClose: () => void;
  onUpdate: () => void;
};

const severityColors = {
  INFO: { bg: "var(--blue-light)", text: "var(--blue)" },
  WARNING: { bg: "var(--amber-light)", text: "var(--amber)" },
  ERROR: { bg: "var(--red-light)", text: "var(--red)" },
  CRITICAL: { bg: "#fee2e2", text: "#dc2626" },
};

export function ErrorDetailModal({ isOpen, error, onClose, onUpdate }: ErrorDetailModalProps) {
  const [resolving, setResolving] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");

  if (!isOpen || !error) return null;

  const handleResolve = async () => {
    try {
      setResolving(true);
      const response = await fetch(`/api/errors/${error.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolved: !error.resolved,
          resolutionNotes: resolutionNotes || undefined,
        }),
      });

      if (!response.ok) throw new Error("Failed to update error");

      toast.success(error.resolved ? "Error marked as unresolved" : "Error marked as resolved");
      setResolutionNotes("");
      onUpdate();
      onClose();
    } catch (err) {
      toast.error("Failed to update error status");
    } finally {
      setResolving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-[20px] bg-white shadow-2xl"
        style={{ borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b p-6" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: severityColors[error.severity].bg }}
            >
              <AlertTriangle size={20} style={{ color: severityColors[error.severity].text }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                Error Details
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {error.errorDigest || error.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6" style={{ maxHeight: "calc(90vh - 200px)" }}>
          {/* Status Badge */}
          <div className="mb-6 flex items-center gap-2">
            <span
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={{
                backgroundColor: severityColors[error.severity].bg,
                color: severityColors[error.severity].text,
              }}
            >
              {error.severity}
            </span>
            <span
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={{
                backgroundColor: error.resolved ? "var(--green-light)" : "var(--amber-light)",
                color: error.resolved ? "var(--green)" : "var(--amber)",
              }}
            >
              {error.resolved ? "Resolved" : "Unresolved"}
            </span>
            <span
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}
            >
              {error.errorType.replace(/_/g, " ")}
            </span>
          </div>

          {/* Error Message */}
          <div className="mb-6">
            <h3 className="mb-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Error Message
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {error.errorMessage}
            </p>
          </div>

          {/* Context Grid */}
          <div className="mb-6 grid grid-cols-2 gap-4">
            {/* User */}
            {error.user && (
              <div>
                <div className="mb-1 flex items-center gap-2 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                  <User size={14} />
                  User
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{ background: error.user.avatarColor || "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
                  >
                    {error.user.initials}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {error.user.name}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {error.user.email}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Timestamp */}
            <div>
              <div className="mb-1 flex items-center gap-2 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                <Clock size={14} />
                Occurred At
              </div>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {format(new Date(error.createdAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>

            {/* URL */}
            <div className="col-span-2">
              <div className="mb-1 flex items-center gap-2 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                <Globe size={14} />
                URL
              </div>
              <p className="truncate text-sm font-mono" style={{ color: "var(--text-secondary)" }}>
                {error.url}
              </p>
            </div>

            {/* API Endpoint */}
            {error.apiEndpoint && (
              <div className="col-span-2">
                <div className="mb-1 flex items-center gap-2 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                  <Code size={14} />
                  API Endpoint
                </div>
                <p className="text-sm font-mono" style={{ color: "var(--text-secondary)" }}>
                  {error.httpMethod} {error.apiEndpoint}
                  {error.statusCode && <span className="ml-2 text-xs">({error.statusCode})</span>}
                </p>
              </div>
            )}
          </div>

          {/* Stack Trace */}
          {error.errorStack && (
            <div className="mb-6">
              <h3 className="mb-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Stack Trace
              </h3>
              <pre
                className="max-h-60 overflow-auto rounded-lg p-4 text-xs font-mono"
                style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-muted)" }}
              >
                {error.errorStack}
              </pre>
            </div>
          )}

          {/* Resolution Section */}
          {error.resolved && error.resolutionNotes && (
            <div className="mb-6 rounded-lg border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--green-light)" }}>
              <h3 className="mb-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Resolution Notes
              </h3>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {error.resolutionNotes}
              </p>
              {error.resolver && (
                <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  Resolved by {error.resolver.name} on {format(new Date(error.resolvedAt!), "MMM d, yyyy")}
                </p>
              )}
            </div>
          )}

          {/* Resolution Form */}
          {!error.resolved && (
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Resolution Notes (Optional)
              </label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Add notes about how this error was resolved..."
                className="w-full rounded-lg border p-3 text-sm transition-colors"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                rows={3}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t p-6" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "white")}
          >
            Close
          </button>
          <button
            onClick={handleResolve}
            disabled={resolving}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: error.resolved ? "var(--amber)" : "var(--green)" }}
            onMouseEnter={(e) => !resolving && (e.currentTarget.style.opacity = "0.9")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            <Check size={16} />
            {error.resolved ? "Mark as Unresolved" : "Mark as Resolved"}
          </button>
        </div>
      </div>
    </div>
  );
}
