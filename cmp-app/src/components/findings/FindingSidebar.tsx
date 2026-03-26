"use client";

import { Clock } from "lucide-react";
import Link from "next/link";
import { format, isPast } from "date-fns";

type FindingSidebarProps = {
  finding: {
    status: string;
    severity: string;
    targetDate: string | null;
    closedAt: string | null;
    actionOwner: {
      id: string;
      name: string;
      initials: string;
      avatarColor: string | null;
    };
    raisedBy: {
      id: string;
      name: string;
      initials: string;
      avatarColor: string | null;
    };
    raisedAt: string;
    task?: {
      id: string;
      name: string;
    } | null;
    source: {
      id: string;
      name: string;
    };
  };
};

const STATUS_STEPS = [
  { id: "OPEN", label: "Open" },
  { id: "IN_PROGRESS", label: "In Progress" },
  { id: "IMPLEMENTED", label: "Implemented" },
  { id: "VERIFIED", label: "Verified" },
  { id: "CLOSED", label: "Closed" },
];

const SEVERITY_COLORS: Record<string, { bg: string; color: string }> = {
  CRITICAL: { bg: "var(--red-light)", color: "var(--red)" },
  HIGH: { bg: "#FEF2F2", color: "#DC2626" },
  MEDIUM: { bg: "var(--amber-light)", color: "var(--amber)" },
  LOW: { bg: "var(--green-light)", color: "var(--green)" },
  OBSERVATION: { bg: "var(--blue-light)", color: "var(--blue)" },
};

export function FindingSidebar({ finding }: FindingSidebarProps) {
  const currentStepIndex = STATUS_STEPS.findIndex((step) => step.id === finding.status);
  const isOverdue = finding.targetDate && !finding.closedAt && isPast(new Date(finding.targetDate)) && !["CLOSED", "VERIFIED"].includes(finding.status);
  const severityConfig = SEVERITY_COLORS[finding.severity];

  return (
    <div className="space-y-6">
      {/* Status Stepper */}
      <div className="rounded-lg border p-4" style={{ backgroundColor: "white", borderColor: "var(--border)" }}>
        <h4 className="mb-4 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Status Progression
        </h4>
        
        <div className="space-y-3">
          {STATUS_STEPS.map((step, index) => {
            const isPast = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const isFuture = index > currentStepIndex;

            return (
              <div key={step.id} className="flex items-center gap-3">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
                  style={{
                    backgroundColor: isPast || isCurrent ? "var(--blue)" : "white",
                    color: isPast || isCurrent ? "white" : "var(--text-muted)",
                    border: isFuture ? "2px solid var(--border)" : "none",
                  }}
                >
                  {isPast ? "✓" : index + 1}
                </div>
                <span
                  className="text-sm font-medium"
                  style={{ color: isCurrent ? "var(--blue)" : isPast ? "var(--text-secondary)" : "var(--text-muted)" }}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Metadata */}
      <div className="rounded-lg border p-4" style={{ backgroundColor: "white", borderColor: "var(--border)" }}>
        <h4 className="mb-4 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Finding Details
        </h4>
        
        <div className="space-y-4">
          {/* Severity */}
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              Severity
            </label>
            <span
              className="inline-flex rounded-md px-2.5 py-1 text-xs font-semibold"
              style={{
                backgroundColor: severityConfig.bg,
                color: severityConfig.color,
              }}
            >
              {finding.severity}
            </span>
          </div>

          {/* Action Owner */}
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              Action Owner
            </label>
            <div className="flex items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ background: finding.actionOwner.avatarColor || "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
              >
                {finding.actionOwner.initials}
              </div>
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {finding.actionOwner.name}
              </span>
            </div>
          </div>

          {/* Raised By */}
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              Raised By
            </label>
            <div className="flex items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ background: finding.raisedBy.avatarColor || "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" }}
              >
                {finding.raisedBy.initials}
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {finding.raisedBy.name}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {format(new Date(finding.raisedAt), "MMM d, yyyy")}
                </p>
              </div>
            </div>
          </div>

          {/* Target Date */}
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              Target Closure Date
            </label>
            {finding.targetDate ? (
              <div className="flex items-center gap-2">
                <Clock size={14} style={{ color: isOverdue ? "var(--red)" : "var(--text-muted)" }} />
                <span className="text-sm font-medium" style={{ color: isOverdue ? "var(--red)" : "var(--text-primary)" }}>
                  {format(new Date(finding.targetDate), "MMM d, yyyy")}
                </span>
                {isOverdue && (
                  <span className="text-xs font-medium" style={{ color: "var(--red)" }}>Overdue</span>
                )}
              </div>
            ) : (
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>Not set</span>
            )}
          </div>
        </div>
      </div>

      {/* Linked Items */}
      <div className="rounded-lg border p-4" style={{ backgroundColor: "white", borderColor: "var(--border)" }}>
        <h4 className="mb-4 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Linked Items
        </h4>
        
        <div className="space-y-3">
          {/* Linked Task */}
          {finding.task && (
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Task
              </label>
              <Link
                href={`/tasks/${finding.task.id}`}
                className="text-sm font-medium transition-opacity hover:underline"
                style={{ color: "var(--blue)" }}
              >
                {finding.task.name}
              </Link>
            </div>
          )}

          {/* Linked Source */}
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              Source
            </label>
            <Link
              href={`/sources/${finding.source.id}`}
              className="text-sm font-medium transition-opacity hover:underline"
              style={{ color: "var(--blue)" }}
            >
              {finding.source.name}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
