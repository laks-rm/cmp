"use client";

import { CheckCircle2, RotateCcw, Play } from "lucide-react";

type FindingActionBarProps = {
  status: string;
  canEdit: boolean;
  onStatusChange: (newStatus: string) => void;
  closedAt: string | null;
};

export function FindingActionBar({ status, canEdit, onStatusChange, closedAt }: FindingActionBarProps) {
  const isOpen = status === "OPEN";
  const isInProgress = status === "IN_PROGRESS";
  const isImplemented = status === "IMPLEMENTED";
  const isVerified = status === "VERIFIED";
  const isClosed = status === "CLOSED";

  if (!canEdit) {
    return (
      <div className="rounded-lg p-3 text-center text-sm" style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-muted)" }}>
        You don&apos;t have permission to change this finding&apos;s status
      </div>
    );
  }

  if (isOpen) {
    return (
      <button
        onClick={() => onStatusChange("IN_PROGRESS")}
        className="flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-semibold text-white transition-opacity"
        style={{ backgroundColor: "var(--blue)" }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
      >
        <Play size={20} />
        Begin Remediation
      </button>
    );
  }

  if (isInProgress) {
    return (
      <button
        onClick={() => onStatusChange("IMPLEMENTED")}
        className="flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-semibold text-white transition-opacity"
        style={{ backgroundColor: "var(--amber)" }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
      >
        <CheckCircle2 size={20} />
        Mark as Implemented
      </button>
    );
  }

  if (isImplemented) {
    return (
      <div className="space-y-2">
        <button
          onClick={() => onStatusChange("VERIFIED")}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-semibold text-white transition-opacity"
          style={{ backgroundColor: "var(--green)" }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <CheckCircle2 size={20} />
          Verify & Close
        </button>
        <button
          onClick={() => onStatusChange("IN_PROGRESS")}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-muted)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
        >
          <RotateCcw size={16} />
          Reopen for Remediation
        </button>
      </div>
    );
  }

  if (isVerified || isClosed) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-center gap-2 rounded-lg p-3 text-base font-semibold" style={{ backgroundColor: "var(--green-light)", color: "var(--green)" }}>
          <CheckCircle2 size={20} />
          Closed {closedAt && `on ${new Date(closedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
        </div>
        <button
          onClick={() => onStatusChange("IN_PROGRESS")}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-muted)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
        >
          <RotateCcw size={16} />
          Reopen Finding
        </button>
      </div>
    );
  }

  return null;
}
