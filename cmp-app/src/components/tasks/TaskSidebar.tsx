"use client";

import { Clock, CheckCircle2, Circle, Paperclip, FileEdit, Eye } from "lucide-react";
import { format, isPast } from "date-fns";
import { useSession } from "next-auth/react";

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
}: TaskSidebarProps) {
  const { data: session } = useSession();

  const isOverdue = task.dueDate && !task.completedAt && isPast(new Date(task.dueDate));
  const isToDo = task.status === "TO_DO";
  const isInProgress = task.status === "IN_PROGRESS";
  const evidenceMet = !task.evidenceRequired || evidenceCount > 0;
  const narrativeMet = !task.narrativeRequired || narrativeText.trim().length > 0;

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

      {/* Task Metadata */}
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

      {/* Recurrence Section */}
      {task.recurrenceGroupId && recurrenceTasks.length > 0 && (
        <div className="rounded-lg border p-4" style={{ backgroundColor: "white", borderColor: "var(--border)" }}>
          <h4 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Recurrence
          </h4>
          
          <p className="mb-3 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            {task.frequency.replace("_", " ")} — instance {task.recurrenceIndex} of {task.recurrenceTotalCount}
          </p>

          <div className="mb-3 flex flex-wrap gap-2">
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
                    className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold transition-all hover:scale-110"
                    style={{
                      backgroundColor: bgColor,
                      color: textColor,
                      border: `2px solid ${borderColor}`,
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
    </div>
  );
}
