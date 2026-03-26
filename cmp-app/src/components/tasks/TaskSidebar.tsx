"use client";

import { Clock, CheckCircle2, Circle, Paperclip, FileEdit, Eye, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { format, isPast } from "date-fns";
import { useSession } from "next-auth/react";
import { useState } from "react";

type Task = {
  id: string;
  frequency: string;
  dueDate: string | null;
  evidenceRequired: boolean;
  narrativeRequired: boolean;
  reviewRequired: boolean;
  status: string;
  completedAt: string | null;
  recurrenceGroupId: string | null;
  recurrenceIndex: number | null;
  recurrenceTotalCount: number | null;
  plannedDate: string | null;
  quarter: string | null;
  description: string | null;
  expectedOutcome: string | null;
  clickupUrl: string | null;
  gdriveUrl: string | null;
  responsibleTeam: { id: string; name: string } | null;
  pic: { id: string; name: string; initials: string; avatarColor: string | null } | null;
  reviewer: { id: string; name: string; initials: string; avatarColor: string | null } | null;
  reviewerId: string | null;
  picId: string | null;
  responsibleTeamId: string | null;
};

type Reviewer = {
  id: string;
  name: string;
  role?: { displayName: string } | null;
};

type RecurrenceTask = {
  id: string;
  status: string;
  dueDate: string | null;
  plannedDate: string | null;
  quarter: string | null;
  recurrenceIndex: number | null;
  completedAt: string | null;
  _count?: { evidence: number };
};

type ExecutionHistoryItem = {
  id: string;
  completedAt: string;
  completedBy: { name: string };
  narrative: string | null;
  evidenceCount: number;
  findingsCount: number;
};

type TaskSidebarProps = {
  task: Task;
  reviewers: Reviewer[];
  recurrenceTasks: RecurrenceTask[];
  executionHistory: ExecutionHistoryItem[];
  evidenceCount: number;
  narrativeText: string;
  canActOnTask: boolean;
  isPIC: boolean;
  isTeamMember: boolean;
  isSuperAdmin: boolean;
  onReviewerChange: (reviewerId: string) => void;
  onAssignPIC: (userId: string) => void;
  onNavigateToTask: (taskId: string) => void;
  onTaskUpdate?: () => void;
};

export function TaskSidebar({
  task,
  reviewers,
  recurrenceTasks,
  executionHistory,
  evidenceCount,
  narrativeText,
  // canActOnTask, // Not used directly in this component
  isPIC,
  isTeamMember,
  isSuperAdmin,
  onReviewerChange,
  onAssignPIC,
  onNavigateToTask,
  onTaskUpdate,
}: TaskSidebarProps) {
  const { data: session } = useSession();
  const [showLinksMetadata, setShowLinksMetadata] = useState(false);
  const [isEditingLinks, setIsEditingLinks] = useState(false);
  const [editForm, setEditForm] = useState({
    clickupUrl: task.clickupUrl || "",
    gdriveUrl: task.gdriveUrl || "",
    description: task.description || "",
    expectedOutcome: task.expectedOutcome || "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const isOverdue = task.dueDate && !task.completedAt && isPast(new Date(task.dueDate));
  const isToDo = task.status === "TO_DO";
  const isInProgress = task.status === "IN_PROGRESS";
  const evidenceMet = !task.evidenceRequired || evidenceCount > 0;
  const narrativeMet = !task.narrativeRequired || narrativeText.trim().length > 0;

  const canActOnTask = isPIC || isTeamMember || isSuperAdmin;
  
  // Count populated fields
  const populatedFieldsCount = [
    task.clickupUrl,
    task.gdriveUrl,
    task.description,
    task.expectedOutcome,
  ].filter(Boolean).length;

  const handleSaveLinks = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      if (!res.ok) throw new Error("Failed to update task");

      if (onTaskUpdate) onTaskUpdate();
      setIsEditingLinks(false);
    } catch (error) {
      console.error("Error updating task:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Assignment Section */}
      <div className="rounded-lg border p-4" style={{ backgroundColor: "white", borderColor: "var(--border)" }}>
        <h4 className="mb-4 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Assignment
        </h4>
        
        <div className="space-y-4">
          {/* Responsible Team */}
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              Responsible Team
            </label>
            {task.responsibleTeam ? (
              <span 
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium" 
                style={{ backgroundColor: "var(--blue-light)", color: "var(--blue)" }}
              >
                {task.responsibleTeam.name}
              </span>
            ) : (
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>Not assigned</span>
            )}
          </div>

          {/* PIC */}
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              Person in Charge (PIC)
            </label>
            {task.pic ? (
              <div>
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{ background: task.pic.avatarColor || "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" }}
                  >
                    {task.pic.initials}
                  </div>
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {task.pic.name}
                  </span>
                </div>
                {!isPIC && (isTeamMember || isSuperAdmin) && session?.user.userId && (
                  <button
                    onClick={() => onAssignPIC(session.user.userId)}
                    className="mt-1.5 text-xs font-medium transition-opacity hover:underline"
                    style={{ color: "var(--blue)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                  >
                    Reassign to me
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>Not assigned</span>
                {session?.user.userId && (
                  <button
                    onClick={() => onAssignPIC(session.user.userId)}
                    className="text-xs font-medium transition-opacity hover:underline"
                    style={{ color: "var(--blue)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                  >
                    Assign to me
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Reviewer */}
          {task.reviewRequired && (
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Reviewer <span style={{ color: "var(--red)" }}>*</span>
              </label>
              {(isToDo || isInProgress) ? (
                <select
                  value={task.reviewerId || ""}
                  onChange={(e) => onReviewerChange(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none"
                  style={{
                    borderColor: "var(--border)",
                    backgroundColor: "white",
                    color: "var(--text-primary)",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--blue)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                >
                  <option value="">Select reviewer...</option>
                  {reviewers.map((reviewer) => (
                    <option key={reviewer.id} value={reviewer.id}>
                      {reviewer.name} ({reviewer.role?.displayName || "Unknown Role"})
                    </option>
                  ))}
                </select>
              ) : task.reviewer ? (
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{ background: task.reviewer.avatarColor || "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
                  >
                    {task.reviewer.initials}
                  </div>
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {task.reviewer.name}
                  </span>
                </div>
              ) : (
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>Not assigned</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Task Details (with Recurrence) */}
      <div className="rounded-lg border p-4" style={{ backgroundColor: "white", borderColor: "var(--border)" }}>
        <h4 className="mb-4 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Task Details
        </h4>
        
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              Frequency
            </label>
            <span className="rounded-md px-2 py-1 text-xs font-medium" style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}>
              {task.frequency}
            </span>
            {task.quarter && (
              <span className="ml-2 rounded-md px-2 py-1 text-xs font-medium" style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}>
                {task.quarter}
              </span>
            )}
          </div>

          {/* Recurrence Info - Compact */}
          {task.recurrenceGroupId && recurrenceTasks.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Recurrence
              </label>
              <p className="mb-2 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Instance {task.recurrenceIndex} of {task.recurrenceTotalCount}{task.quarter ? ` (${task.quarter})` : ''}
              </p>
              <div className="mb-2 flex flex-wrap gap-1">
                {recurrenceTasks
                  .sort((a, b) => (a.recurrenceIndex || 0) - (b.recurrenceIndex || 0))
                  .map((recTask) => {
                    const isCurrent = recTask.id === task.id;
                    const isCompleted = recTask.status === "COMPLETED";
                    const isActive = recTask.status === "IN_PROGRESS" || recTask.status === "TO_DO";
                    const taskDate = recTask.dueDate ? new Date(recTask.dueDate) : null;
                    const isTaskOverdue = taskDate && taskDate < new Date() && recTask.status !== "COMPLETED";

                    let bgColor = "var(--bg-muted)";
                    let borderColor = "var(--border)";
                    let textColor = "var(--text-muted)";

                    if (isCompleted) {
                      bgColor = "var(--green)";
                      borderColor = "var(--green)";
                      textColor = "white";
                    } else if (isTaskOverdue) {
                      bgColor = "var(--red-light)";
                      borderColor = "var(--red)";
                      textColor = "var(--red)";
                    } else if (isActive) {
                      bgColor = "var(--blue-light)";
                      borderColor = "var(--blue)";
                      textColor = "var(--blue)";
                    }

                    if (isCurrent) {
                      borderColor = "var(--blue)";
                    }

                    return (
                      <button
                        key={recTask.id}
                        onClick={() => recTask.id !== task.id && onNavigateToTask(recTask.id)}
                        className="flex h-[18px] w-[18px] items-center justify-center rounded text-[10px] font-semibold transition-all hover:scale-110"
                        style={{
                          backgroundColor: bgColor,
                          color: textColor,
                          border: `1px solid ${borderColor}`,
                          cursor: recTask.id !== task.id ? "pointer" : "default",
                        }}
                        title={`Instance ${recTask.recurrenceIndex} - ${recTask.status}`}
                      >
                        {isCompleted ? "✓" : recTask.recurrenceIndex}
                      </button>
                    );
                  })}
              </div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {recurrenceTasks.filter(t => t.status === "COMPLETED").length} completed · {recurrenceTasks.filter(t => t.status === "IN_PROGRESS").length} in progress
              </p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              Due Date
            </label>
            {task.dueDate ? (
              <div className="flex items-center gap-2">
                <Clock size={14} style={{ color: isOverdue ? "var(--red)" : "var(--text-muted)" }} />
                <span className="text-sm font-medium" style={{ color: isOverdue ? "var(--red)" : "var(--text-primary)" }}>
                  {format(new Date(task.dueDate), "MMM d, yyyy")}
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

      {/* Execution History */}
      {executionHistory.length > 0 && (
        <div className="rounded-lg border p-4" style={{ backgroundColor: "white", borderColor: "var(--border)" }}>
          <h4 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Previous Executions
          </h4>
          
          <div className="space-y-3">
            {executionHistory.slice(0, 4).map((item) => (
              <div key={item.id} className="border-l-2 pl-3" style={{ borderColor: "var(--green)" }}>
                <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  {format(new Date(item.completedAt), "MMM d, yyyy")} by {item.completedBy.name}
                </p>
                {item.narrative && (
                  <p className="mt-1 text-xs line-clamp-2" style={{ color: "var(--text-muted)" }}>
                    {item.narrative}
                  </p>
                )}
                <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  {item.evidenceCount} file{item.evidenceCount !== 1 ? 's' : ''} · {item.findingsCount} finding{item.findingsCount !== 1 ? 's' : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Requirements Checklist */}
      {(isToDo || isInProgress) && (
        <div className="rounded-lg border p-4" style={{ backgroundColor: "white", borderColor: "var(--border)" }}>
          <h4 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Requirements
          </h4>
          
          <div className="space-y-2.5">
            {/* Evidence requirement */}
            <div className="flex items-start gap-2">
              {task.evidenceRequired ? (
                evidenceMet ? (
                  <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" style={{ color: "var(--green)" }} />
                ) : (
                  <Circle size={16} className="mt-0.5 flex-shrink-0" style={{ color: "var(--red)" }} />
                )
              ) : (
                <Paperclip size={16} className="mt-0.5 flex-shrink-0" style={{ color: "var(--text-faint)" }} />
              )}
              <div className="flex-1">
                <p className="text-xs" style={{ color: task.evidenceRequired ? "var(--text-primary)" : "var(--text-muted)" }}>
                  {task.evidenceRequired ? (
                    <>
                      <span className="font-medium">Evidence required</span>
                      {evidenceMet ? (
                        <span className="ml-1" style={{ color: "var(--green)" }}>({evidenceCount} uploaded)</span>
                      ) : (
                        <span className="ml-1" style={{ color: "var(--red)" }}>(Required)</span>
                      )}
                    </>
                  ) : (
                    "Evidence optional"
                  )}
                </p>
              </div>
            </div>

            {/* Narrative requirement */}
            <div className="flex items-start gap-2">
              {task.narrativeRequired ? (
                narrativeMet ? (
                  <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" style={{ color: "var(--green)" }} />
                ) : (
                  <Circle size={16} className="mt-0.5 flex-shrink-0" style={{ color: "var(--red)" }} />
                )
              ) : (
                <FileEdit size={16} className="mt-0.5 flex-shrink-0" style={{ color: "var(--text-faint)" }} />
              )}
              <div className="flex-1">
                <p className="text-xs" style={{ color: task.narrativeRequired ? "var(--text-primary)" : "var(--text-muted)" }}>
                  {task.narrativeRequired ? (
                    <>
                      <span className="font-medium">Narrative required</span>
                      {narrativeMet ? (
                        <span className="ml-1" style={{ color: "var(--green)" }}>(Written)</span>
                      ) : (
                        <span className="ml-1" style={{ color: "var(--red)" }}>(Required)</span>
                      )}
                    </>
                  ) : (
                    "Narrative optional"
                  )}
                </p>
              </div>
            </div>

            {/* Review requirement */}
            <div className="flex items-start gap-2">
              <Eye size={16} className="mt-0.5 flex-shrink-0" style={{ color: task.reviewRequired ? "var(--blue)" : "var(--text-faint)" }} />
              <div className="flex-1">
                <p className="text-xs" style={{ color: task.reviewRequired ? "var(--text-primary)" : "var(--text-muted)" }}>
                  {task.reviewRequired ? (
                    <>
                      <span className="font-medium">Review required</span>
                      {task.reviewerId ? (
                        <span className="ml-1" style={{ color: "var(--green)" }}>(Assigned)</span>
                      ) : (
                        <span className="ml-1" style={{ color: "var(--red)" }}>(Select above)</span>
                      )}
                    </>
                  ) : (
                    "No review needed"
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Links & Metadata - Collapsible */}
      <div className="rounded-lg border" style={{ backgroundColor: "white", borderColor: "var(--border)" }}>
        <button
          onClick={() => setShowLinksMetadata(!showLinksMetadata)}
          className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-[var(--bg-hover)]"
        >
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Links & Metadata
            </h4>
            {populatedFieldsCount > 0 && (
              <span className="text-xs font-medium rounded-full px-2 py-0.5" style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-muted)" }}>
                {populatedFieldsCount}
              </span>
            )}
          </div>
          {showLinksMetadata ? <ChevronUp size={16} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />}
        </button>
        
        {showLinksMetadata && (
          <div className="border-t px-4 pb-4 pt-3 space-y-3" style={{ borderColor: "var(--border-light)" }}>
            {!isEditingLinks ? (
              <>
                {/* ClickUp URL */}
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                    ClickUp
                  </label>
                  {task.clickupUrl ? (
                    <a
                      href={task.clickupUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm transition-opacity hover:underline"
                      style={{ color: "var(--blue)" }}
                    >
                      <ExternalLink size={12} />
                      Open in ClickUp
                    </a>
                  ) : (
                    <span className="text-sm" style={{ color: "var(--text-muted)" }}>Not set</span>
                  )}
                </div>

                {/* Google Drive URL */}
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                    Google Drive
                  </label>
                  {task.gdriveUrl ? (
                    <a
                      href={task.gdriveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm transition-opacity hover:underline"
                      style={{ color: "var(--blue)" }}
                    >
                      <ExternalLink size={12} />
                      Open in Drive
                    </a>
                  ) : (
                    <span className="text-sm" style={{ color: "var(--text-muted)" }}>Not set</span>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                    Description
                  </label>
                  {task.description ? (
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {task.description}
                    </p>
                  ) : (
                    <span className="text-sm" style={{ color: "var(--text-muted)" }}>Not set</span>
                  )}
                </div>

                {/* Expected Outcome */}
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                    Expected Outcome
                  </label>
                  {task.expectedOutcome ? (
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {task.expectedOutcome}
                    </p>
                  ) : (
                    <span className="text-sm" style={{ color: "var(--text-muted)" }}>Not set</span>
                  )}
                </div>

                {canActOnTask && (
                  <button
                    onClick={() => {
                      setEditForm({
                        clickupUrl: task.clickupUrl || "",
                        gdriveUrl: task.gdriveUrl || "",
                        description: task.description || "",
                        expectedOutcome: task.expectedOutcome || "",
                      });
                      setIsEditingLinks(true);
                    }}
                    className="text-xs font-medium transition-opacity hover:underline"
                    style={{ color: "var(--blue)" }}
                  >
                    Edit
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                      ClickUp URL
                    </label>
                    <input
                      type="url"
                      value={editForm.clickupUrl}
                      onChange={(e) => setEditForm({ ...editForm, clickupUrl: e.target.value })}
                      placeholder="https://app.clickup.com/..."
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                      style={{ borderColor: "var(--border)", backgroundColor: "white" }}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                      Google Drive URL
                    </label>
                    <input
                      type="url"
                      value={editForm.gdriveUrl}
                      onChange={(e) => setEditForm({ ...editForm, gdriveUrl: e.target.value })}
                      placeholder="https://drive.google.com/..."
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                      style={{ borderColor: "var(--border)", backgroundColor: "white" }}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                      Description
                    </label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      placeholder="Task description..."
                      rows={3}
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                      style={{ borderColor: "var(--border)", backgroundColor: "white" }}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                      Expected Outcome
                    </label>
                    <textarea
                      value={editForm.expectedOutcome}
                      onChange={(e) => setEditForm({ ...editForm, expectedOutcome: e.target.value })}
                      placeholder="Expected outcome..."
                      rows={3}
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                      style={{ borderColor: "var(--border)", backgroundColor: "white" }}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveLinks}
                    disabled={isSaving}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity disabled:opacity-50"
                    style={{ backgroundColor: "var(--blue)" }}
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => setIsEditingLinks(false)}
                    disabled={isSaving}
                    className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
