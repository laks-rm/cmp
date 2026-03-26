"use client";

import { Play, CheckCircle2, Clock, RotateCcw, AlertTriangle } from "lucide-react";

type TaskActionBarProps = {
  status: string;
  reviewRequired: boolean;
  canActOnTask: boolean;
  isPIC: boolean;
  isReviewer: boolean;
  evidenceRequired: boolean;
  narrativeRequired: boolean;
  evidenceCount: number;
  narrativeText: string;
  reviewerAssigned: boolean;
  onStartTask: () => void;
  onSubmitReview: () => void;
  onMarkComplete: () => void;
  onApprove: () => void;
  onRequestChanges: () => void;
  onRecall: () => void;
  completedAt: string | null;
  reviewerName: string | null;
  onRaiseFinding?: () => void;
  showRaiseFinding?: boolean;
};

export function TaskActionBar({
  status,
  reviewRequired,
  canActOnTask,
  isPIC,
  isReviewer,
  evidenceRequired,
  narrativeRequired,
  evidenceCount,
  narrativeText,
  reviewerAssigned,
  onStartTask,
  onSubmitReview,
  onMarkComplete,
  onApprove,
  onRequestChanges,
  onRecall,
  completedAt,
  reviewerName,
  onRaiseFinding,
  showRaiseFinding = false,
}: TaskActionBarProps) {
  const isToDo = status === "TO_DO";
  const isInProgress = status === "IN_PROGRESS";
  const isPendingReview = status === "PENDING_REVIEW";
  const isCompleted = status === "COMPLETED";
  const isDeferred = status === "DEFERRED";
  const isNotApplicable = status === "NOT_APPLICABLE";

  // Requirement checks
  const evidenceMet = !evidenceRequired || evidenceCount > 0;
  const narrativeMet = !narrativeRequired || narrativeText.trim().length > 0;
  const canSubmit = evidenceMet && narrativeMet && (reviewRequired ? reviewerAssigned : true);

  // Helper message
  let helperMessage = "";
  if (isInProgress && canActOnTask) {
    const missing: string[] = [];
    if (evidenceRequired && evidenceCount === 0) missing.push("Evidence required");
    if (narrativeRequired && !narrativeText.trim()) missing.push("Narrative required");
    if (reviewRequired && !reviewerAssigned) missing.push("Reviewer not assigned");
    
    if (missing.length > 0) {
      helperMessage = missing.join(" · ");
    }
  }

  if (isToDo && canActOnTask) {
    return (
      <div className="space-y-2">
        <button
          onClick={onStartTask}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-semibold text-white transition-opacity"
          style={{ backgroundColor: "var(--blue)" }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <Play size={20} />
          Start Task
        </button>
        {showRaiseFinding && onRaiseFinding && (
          <button
            onClick={onRaiseFinding}
            className="flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "white" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "white")}
          >
            <AlertTriangle size={16} />
            Raise Finding
          </button>
        )}
      </div>
    );
  }

  if (isToDo && !canActOnTask) {
    return (
      <div className="rounded-lg p-3 text-center text-sm" style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-muted)" }}>
        Only the PIC or team members can start this task
      </div>
    );
  }

  if (isInProgress && canActOnTask) {
    return (
      <div className="space-y-2">
        {reviewRequired ? (
          isPIC ? (
            <>
              <button
                onClick={onSubmitReview}
                disabled={!canSubmit}
                className="flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-semibold text-white transition-opacity disabled:opacity-40"
                style={{ backgroundColor: "var(--blue)" }}
                onMouseEnter={(e) => !canSubmit || (e.currentTarget.style.opacity = "0.9")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = canSubmit ? "1" : "0.4")}
              >
                Submit for Review
              </button>
              {helperMessage && (
                <p className="text-center text-xs" style={{ color: "var(--red)" }}>
                  {helperMessage}
                </p>
              )}
              {showRaiseFinding && onRaiseFinding && (
                <button
                  onClick={onRaiseFinding}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "white" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "white")}
                >
                  <AlertTriangle size={16} />
                  Raise Finding
                </button>
              )}
            </>
          ) : (
            <div className="rounded-lg p-3 text-center text-sm" style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-muted)" }}>
              Only the PIC can submit this task for review
            </div>
          )
        ) : (
          <>
            <button
              onClick={onMarkComplete}
              disabled={!canSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-semibold text-white transition-opacity disabled:opacity-40"
              style={{ backgroundColor: "var(--green)" }}
              onMouseEnter={(e) => !canSubmit || (e.currentTarget.style.opacity = "0.9")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = canSubmit ? "1" : "0.4")}
            >
              <CheckCircle2 size={20} />
              Mark as Complete
            </button>
            {helperMessage && (
              <p className="text-center text-xs" style={{ color: "var(--red)" }}>
                {helperMessage}
              </p>
            )}
            {showRaiseFinding && onRaiseFinding && (
              <button
                onClick={onRaiseFinding}
                className="flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "white" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "white")}
              >
                <AlertTriangle size={16} />
                Raise Finding
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  if (isPendingReview && isReviewer) {
    return (
      <div className="space-y-2">
        <div className="flex gap-3">
          <button
            onClick={() => {
              const comment = prompt("Reason for requesting changes (optional):");
              if (comment !== null) onRequestChanges();
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-semibold transition-colors"
            style={{ backgroundColor: "var(--amber-light)", color: "var(--amber)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--amber)";
              e.currentTarget.style.color = "white";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--amber-light)";
              e.currentTarget.style.color = "var(--amber)";
            }}
          >
            <RotateCcw size={20} />
            Return
          </button>
          <button
            onClick={onApprove}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-semibold text-white transition-opacity"
            style={{ backgroundColor: "var(--green)" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            <CheckCircle2 size={20} />
            Approve
          </button>
        </div>
        {isPIC && (
          <button
            onClick={onRecall}
            className="w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-muted)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
          >
            Recall Submission
          </button>
        )}
        {showRaiseFinding && onRaiseFinding && (
          <button
            onClick={onRaiseFinding}
            className="flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "white" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "white")}
          >
            <AlertTriangle size={16} />
            Raise Finding
          </button>
        )}
      </div>
    );
  }

  if (isPendingReview && !isReviewer) {
    return (
      <div className="space-y-2">
        <div className="rounded-lg p-3 text-center text-sm" style={{ backgroundColor: "var(--amber-light)", color: "var(--amber)" }}>
          <Clock size={16} className="mx-auto mb-1" />
          Awaiting review by {reviewerName || "reviewer"}
        </div>
        {isPIC && (
          <button
            onClick={onRecall}
            className="w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-muted)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
          >
            Recall Submission
          </button>
        )}
      </div>
    );
  }

  if (isCompleted && completedAt) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg p-3 text-base font-semibold" style={{ backgroundColor: "var(--green-light)", color: "var(--green)" }}>
        <CheckCircle2 size={20} />
        Completed on {new Date(completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      </div>
    );
  }

  if (isDeferred) {
    return (
      <div className="rounded-lg p-3 text-center text-sm font-medium" style={{ backgroundColor: "var(--purple-light)", color: "var(--purple)" }}>
        Task Deferred
      </div>
    );
  }

  if (isNotApplicable) {
    return (
      <div className="rounded-lg p-3 text-center text-sm font-medium" style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-muted)" }}>
        Task Not Applicable
      </div>
    );
  }

  return null;
}
