"use client";

import { useState } from "react";
import { Play, CheckCircle2, Clock, RotateCcw, AlertTriangle, Upload, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

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
  onRequestChanges: (reason: string, files?: File[]) => void;
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
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  
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

  const handleReturnClick = () => {
    setShowReturnModal(true);
  };

  const handleReturnSubmit = () => {
    onRequestChanges(returnReason, selectedFiles);
    setShowReturnModal(false);
    setReturnReason("");
    setSelectedFiles([]);
  };

  const handleReturnCancel = () => {
    setShowReturnModal(false);
    setReturnReason("");
    setSelectedFiles([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

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
      <>
        <div className="space-y-2">
          <div className="flex gap-3">
            <button
              onClick={handleReturnClick}
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

        <Modal isOpen={showReturnModal} title="Return Task" onClose={handleReturnCancel}>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Return Reason
              </label>
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Explain what needs to be changed or corrected..."
                rows={4}
                className="w-full resize-y rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Attach Files (Optional)
              </label>
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600 transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600">
                  <Upload size={16} />
                  <span>Choose images or PDFs</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>

                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2"
                      >
                        <span className="text-sm text-slate-700">{file.name}</span>
                        <button
                          onClick={() => handleRemoveFile(index)}
                          className="rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleReturnCancel}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReturnSubmit}
                className="flex-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600"
              >
                Return Task
              </button>
            </div>
          </div>
        </Modal>
      </>
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
