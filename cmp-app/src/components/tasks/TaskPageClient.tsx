"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Send, AlertTriangle } from "lucide-react";
import { StatusPill } from "@/components/ui/StatusPill";
import { EntityBadge } from "@/components/ui/EntityBadge";
import { TaskStatusStepper } from "@/components/tasks/TaskStatusStepper";
import { TaskWorkArea } from "@/components/tasks/TaskWorkArea";
import { TaskSidebar } from "@/components/tasks/TaskSidebar";
import { TaskActionBar } from "@/components/tasks/TaskActionBar";
import { RaiseFindingPanel } from "@/components/tasks/RaiseFindingPanel";
import { format } from "date-fns";
import toast from "@/lib/toast";

type User = {
  id: string;
  name: string;
  initials: string;
  avatarColor: string | null;
};

type Reviewer = User & {
  role?: {
    displayName: string;
  } | null;
};

type Evidence = {
  id: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  mimeType: string;
  uploadedBy: User;
  createdAt: string;
};

type Comment = {
  id: string;
  content: string;
  author: User;
  createdAt: string;
};

type AuditLogEntry = {
  id: string;
  action: string;
  userId: string;
  details: Record<string, unknown> | null;
  createdAt: string;
  user: User;
};

type Task = {
  id: string;
  name: string;
  description: string | null;
  expectedOutcome: string | null;
  status: string;
  riskRating: string;
  frequency: string;
  quarter: string | null;
  dueDate: string | null;
  startDate: string | null;
  testingPeriodStart: string | null;
  testingPeriodEnd: string | null;
  narrative: string | null;
  evidenceRequired: boolean;
  narrativeRequired: boolean;
  reviewRequired: boolean;
  clickupUrl: string | null;
  gdriveUrl: string | null;
  completedAt: string | null;
  recurrenceGroupId: string | null;
  recurrenceIndex: number | null;
  recurrenceTotalCount: number | null;
  plannedDate: string | null;
  source: {
    id: string;
    name: string;
    code: string;
    team: {
      approvalRequired: boolean;
    };
  };
  sourceItem: {
    reference: string;
    title: string;
    description: string | null;
  } | null;
  entity: {
    id: string;
    code: string;
    name: string;
  };
  assignee: User | null;
  responsibleTeam: { id: string; name: string } | null;
  pic: User | null;
  reviewer: User | null;
  assigneeId: string | null;
  responsibleTeamId: string | null;
  picId: string | null;
  reviewerId: string | null;
  entityId: string | null;
  sourceId: string | null;
  _count?: {
    evidence: number;
  };
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

type TaskPageClientProps = {
  taskId: string;
};

export function TaskPageClient({ taskId }: TaskPageClientProps) {
  const { data: session } = useSession();
  const router = useRouter();
  
  const [task, setTask] = useState<Task | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [recurrenceTasks, setRecurrenceTasks] = useState<RecurrenceTask[]>([]);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [executionHistory, setExecutionHistory] = useState<ExecutionHistoryItem[]>([]);
  // const [selectedReviewerId, setSelectedReviewerId] = useState<string>(""); // Not used in page version
  const [activeTab, setActiveTab] = useState<"work" | "comments" | "history">("work");
  const [loading, setLoading] = useState(true);
  const [narrative, setNarrative] = useState("");
  const [newComment, setNewComment] = useState("");
  const [showFindingPanel, setShowFindingPanel] = useState(false);
  const [showSourceExpanded, setShowSourceExpanded] = useState(false);

  const fetchTaskData = useCallback(async () => {
    try {
      setLoading(true);
      const [taskRes, evidenceRes, commentsRes, auditRes, reviewersRes] = await Promise.all([
        fetch(`/api/tasks/${taskId}`),
        fetch(`/api/evidence?taskId=${taskId}`),
        fetch(`/api/comments?taskId=${taskId}`),
        fetch(`/api/audit-log?targetType=Task&targetId=${taskId}`),
        fetch(`/api/users/reviewers`),
      ]);

      if (!taskRes.ok) throw new Error("Failed to fetch task");

      const taskData = await taskRes.json();
      setTask(taskData);
      setNarrative(taskData.narrative || "");
      // setSelectedReviewerId(taskData.reviewerId || ""); // Not used in page version

      if (evidenceRes.ok) setEvidence(await evidenceRes.json());
      if (commentsRes.ok) setComments(await commentsRes.json());
      
      if (auditRes.ok) {
        const auditData = await auditRes.json();
        setAuditLog(Array.isArray(auditData) ? auditData : auditData.entries || []);
      }
      
      if (reviewersRes.ok) setReviewers(await reviewersRes.json());

      // Fetch recurrence group tasks
      if (taskData.recurrenceGroupId) {
        const recurrenceRes = await fetch(`/api/tasks?recurrenceGroupId=${taskData.recurrenceGroupId}&limit=100`);
        if (recurrenceRes.ok) {
          const recurrenceData = await recurrenceRes.json();
          setRecurrenceTasks(recurrenceData.tasks || []);
          
          // Build execution history from completed previous instances
          const completedInstances = (recurrenceData.tasks || [])
            .filter((t: RecurrenceTask) => t.status === "COMPLETED" && t.recurrenceIndex! < taskData.recurrenceIndex!)
            .sort((a: RecurrenceTask, b: RecurrenceTask) => (b.recurrenceIndex || 0) - (a.recurrenceIndex || 0));
          
          // For now, create placeholder execution history
          // In a real implementation, you'd fetch full details for each completed instance
          const history: ExecutionHistoryItem[] = completedInstances.slice(0, 4).map((t: RecurrenceTask) => ({
            id: t.id,
            completedAt: t.completedAt || "",
            completedBy: { name: "Previous User" },
            narrative: null,
            evidenceCount: t._count?.evidence || 0,
            findingsCount: 0,
          }));
          
          setExecutionHistory(history);
        }
      }
    } catch (error) {
      console.error("Error fetching task data:", error);
      toast.error("Failed to load task details");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchTaskData();
  }, [fetchTaskData]);

  const handleNarrativeSave = async () => {
    if (narrative === (task?.narrative || "")) return;

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ narrative }),
      });

      if (!res.ok) throw new Error("Failed to update narrative");

      toast.success("Narrative saved");
      fetchTaskData();
    } catch (error) {
      console.error("Narrative save error:", error);
      toast.error("Failed to save narrative");
    }
  };

  const handleTaskAction = async (action: string, comment?: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: comment ? JSON.stringify({ comment }) : undefined,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Action failed");
      }

      const successMessages: Record<string, string> = {
        "submit-review": "Task submitted for review",
        "mark-complete": "Task marked as complete",
        "approve": "Task approved",
        "request-changes": "Changes requested",
        "recall": "Task recalled",
      };
      
      toast.success(successMessages[action] || `Task ${action.replace("-", " ")}`);
      await fetchTaskData();
    } catch (error) {
      console.error(`Action ${action} error:`, error);
      toast.error(error instanceof Error ? error.message : "Action failed");
    }
  };

  const handleStartTask = async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_PROGRESS" }),
      });

      if (!res.ok) throw new Error("Failed to start task");

      toast.success("Task started");
      await fetchTaskData();
    } catch (error) {
      console.error("Start task error:", error);
      toast.error("Failed to start task");
    }
  };

  const handleReviewerChange = async (newReviewerId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewerId: newReviewerId || null }),
      });

      if (!res.ok) throw new Error("Failed to update reviewer");

      // setSelectedReviewerId(newReviewerId); // Not used in page version
      toast.success("Reviewer updated");
      await fetchTaskData();
    } catch (error) {
      console.error("Update reviewer error:", error);
      toast.error("Failed to update reviewer");
    }
  };

  const handleAssignPIC = async (userId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ picId: userId }),
      });

      if (!res.ok) throw new Error("Failed to assign PIC");

      toast.success("PIC assigned");
      await fetchTaskData();
    } catch (error) {
      console.error("Assign PIC error:", error);
      toast.error("Failed to assign PIC");
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment, taskId }),
      });

      if (!res.ok) throw new Error("Failed to post comment");

      const comment = await res.json();
      setComments((prev) => [...prev, comment]);
      setNewComment("");
      toast.success("Comment added");
    } catch (error) {
      console.error("Comment error:", error);
      toast.error("Failed to add comment");
    }
  };

  if (loading || !task) {
    return (
      <div className="flex h-96 items-center justify-center" style={{ color: "var(--text-muted)" }}>
        Loading task details...
      </div>
    );
  }

  const isPIC = task.picId === session?.user.userId;
  const isReviewer = task.reviewerId === session?.user.userId;
  const isTeamMember = task.responsibleTeamId ? (session?.user.teamIds?.includes(task.responsibleTeamId) ?? false) : false;
  const isSuperAdmin = session?.user.roleName === "Super Admin";
  const canActOnTask = isPIC || isTeamMember || isSuperAdmin;

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
        <Link href="/tasks" className="transition-colors hover:underline" style={{ color: "var(--blue)" }}>
          Task Tracker
        </Link>
        <ChevronRight size={16} />
        <Link href={`/sources/${task.source.id}`} className="transition-colors hover:underline" style={{ color: "var(--blue)" }}>
          {task.source.name}
        </Link>
        <ChevronRight size={16} />
        <span className="font-mono text-xs">{task.sourceItem?.reference || "N/A"}</span>
        <ChevronRight size={16} />
        <span style={{ color: "var(--text-secondary)" }}>{task.name}</span>
      </div>

      {/* Title Area */}
      <div>
        <h1 className="mb-3 text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
          {task.name}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={task.status as "TO_DO" | "IN_PROGRESS" | "PENDING_REVIEW" | "COMPLETED" | "DEFERRED" | "NOT_APPLICABLE"} />
          <span
            className="rounded-md px-2 py-1 text-xs font-medium"
            style={{
              backgroundColor: task.riskRating === "HIGH" ? "var(--red-light)" : task.riskRating === "MEDIUM" ? "var(--amber-light)" : "var(--green-light)",
              color: task.riskRating === "HIGH" ? "var(--red)" : task.riskRating === "MEDIUM" ? "var(--amber)" : "var(--green)",
            }}
          >
            {task.riskRating} Risk
          </span>
          <EntityBadge entityCode={task.entity.code as "DIEL" | "DGL" | "DBVI" | "FINSERV" | "GROUP"} />
          <button
            onClick={() => router.push(`/sources/${task.source.id}`)}
            className="text-sm font-mono transition-opacity hover:underline"
            style={{ color: "var(--text-secondary)" }}
          >
            {task.source.code} · {task.sourceItem?.reference || "N/A"}
          </button>
          <span className="rounded-md px-2 py-1 text-xs font-medium" style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}>
            {task.frequency}
          </span>
        </div>
      </div>

      {/* Source Context Card */}
      <div className="rounded-lg border p-4" style={{ backgroundColor: "var(--bg-subtle)", borderColor: "var(--border)" }}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
              Source
            </p>
            <Link
              href={`/sources/${task.source.id}`}
              className="text-sm font-medium transition-opacity hover:underline"
              style={{ color: "var(--blue)" }}
            >
              {task.source.name}
            </Link>
            {task.sourceItem && (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <span className="rounded px-1.5 py-0.5 text-xs font-mono font-medium" style={{ backgroundColor: "var(--blue-light)", color: "var(--blue)" }}>
                    {task.sourceItem.reference}
                  </span>
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {task.sourceItem.title}
                  </span>
                </div>
                {task.sourceItem.description && (
                  <div className="mt-2">
                    <button
                      onClick={() => setShowSourceExpanded(!showSourceExpanded)}
                      className="text-xs font-medium transition-opacity hover:underline"
                      style={{ color: "var(--blue)" }}
                    >
                      {showSourceExpanded ? "Hide" : "Show"} full requirement
                    </button>
                    {showSourceExpanded && (
                      <div className="mt-2 rounded-lg p-3 text-sm leading-relaxed" style={{ backgroundColor: "white", color: "var(--text-secondary)", border: "1px solid var(--border-light)" }}>
                        {task.sourceItem.description}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Stepper */}
      <TaskStatusStepper currentStatus={task.status} />

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs */}
          <div className="border-b" style={{ borderColor: "var(--border-light)" }}>
            <div className="flex gap-6">
              {(["work", "comments", "history"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="relative pb-3 text-sm font-medium capitalize transition-colors"
                  style={{
                    color: activeTab === tab ? "var(--blue)" : "var(--text-muted)",
                  }}
                >
                  {tab}
                  {tab === "comments" && comments.length > 0 && (
                    <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-xs" style={{ backgroundColor: "var(--bg-muted)", color: "var(--text-secondary)" }}>
                      {comments.length}
                    </span>
                  )}
                  {activeTab === tab && (
                    <div
                      className="absolute bottom-0 left-0 right-0 h-0.5"
                      style={{ backgroundColor: "var(--blue)" }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div>
            {activeTab === "work" && (
              <TaskWorkArea
                taskId={taskId}
                narrative={narrative}
                evidence={evidence}
                canEdit={canActOnTask && (task.status === "IN_PROGRESS" || task.status === "TO_DO")}
                onNarrativeChange={setNarrative}
                onNarrativeSave={handleNarrativeSave}
                onEvidenceUploaded={(newEvidence) => setEvidence((prev) => [...prev, newEvidence])}
                onEvidenceDeleted={(evidenceId) => setEvidence((prev) => prev.filter((e) => e.id !== evidenceId))}
              />
            )}

            {activeTab === "comments" && (
              <div className="space-y-4">
                {comments.length > 0 ? (
                  <div className="space-y-4">
                    {comments.map((comment) => (
                      <div key={comment.id} className="flex gap-3">
                        <div
                          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                          style={{ background: comment.author?.avatarColor || "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
                        >
                          {comment.author?.initials ?? "?"}
                        </div>
                        <div className="flex-1">
                          <div className="mb-1 flex items-baseline gap-2">
                            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                              {comment.author?.name ?? "Unknown"}
                            </span>
                            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                              {format(new Date(comment.createdAt), "MMM d, h:mm a")}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                            {comment.content}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-sm py-8" style={{ color: "var(--text-muted)" }}>
                    No comments yet
                  </p>
                )}

                <div className="flex gap-2 pt-4">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                    placeholder="Add a comment..."
                    className="flex-1 rounded-lg border px-4 py-2 text-sm transition-colors focus:outline-none"
                    style={{
                      borderColor: "var(--border)",
                      backgroundColor: "white",
                      color: "var(--text-primary)",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "var(--blue)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                    className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40"
                    style={{
                      backgroundColor: "var(--blue)",
                      color: "white",
                    }}
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            )}

            {activeTab === "history" && (
              <div className="space-y-3">
                {auditLog.length > 0 ? (
                  auditLog.map((entry, index) => {
                    let actionLabel = entry.action.toLowerCase().replace(/_/g, " ");
                    let dotColor = "var(--blue)";
                    
                    switch (entry.action) {
                      case "TASK_STATUS_CHANGED":
                        actionLabel = "changed status";
                        dotColor = "var(--blue)";
                        break;
                      case "EVIDENCE_UPLOADED":
                        actionLabel = "uploaded evidence";
                        dotColor = "var(--green)";
                        break;
                      case "EVIDENCE_DELETED":
                        actionLabel = "deleted evidence";
                        dotColor = "var(--red)";
                        break;
                      case "COMMENT_ADDED":
                        actionLabel = "added comment";
                        dotColor = "var(--purple)";
                        break;
                      case "TASK_PIC_CHANGED":
                        actionLabel = "changed person in charge";
                        dotColor = "var(--blue)";
                        break;
                      case "TASK_REVIEWER_CHANGED":
                        actionLabel = "changed reviewer";
                        dotColor = "var(--blue)";
                        break;
                      case "TASK_NARRATIVE_UPDATED":
                        actionLabel = "updated narrative";
                        dotColor = "var(--amber)";
                        break;
                    }

                    const details = entry.details as Record<string, unknown> | null;
                    const oldStatus = details?.oldStatus as string | undefined;
                    const newStatus = details?.newStatus as string | undefined;

                    return (
                      <div key={entry.id} className="flex gap-3">
                        <div className="relative pt-1.5">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: dotColor }} />
                          {index !== auditLog.length - 1 && (
                            <div className="absolute left-1 top-3 h-full w-px" style={{ backgroundColor: "var(--border-light)" }} />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                            <strong>{entry.user?.name ?? "System"}</strong> {actionLabel}
                            {oldStatus && newStatus && (
                              <>
                                {" from "}
                                <strong style={{ color: "var(--text-secondary)" }}>
                                  {oldStatus.replace(/_/g, " ")}
                                </strong>
                                {" to "}
                                <strong style={{ color: dotColor }}>
                                  {newStatus.replace(/_/g, " ")}
                                </strong>
                              </>
                            )}
                          </p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {format(new Date(entry.createdAt), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-center text-sm py-8" style={{ color: "var(--text-muted)" }}>
                    No history available
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Action Bar */}
          <TaskActionBar
            status={task.status}
            reviewRequired={task.reviewRequired}
            canActOnTask={canActOnTask}
            isPIC={isPIC}
            isReviewer={isReviewer}
            evidenceRequired={task.evidenceRequired}
            narrativeRequired={task.narrativeRequired}
            evidenceCount={evidence.length}
            narrativeText={narrative}
            reviewerAssigned={!!task.reviewerId}
            onStartTask={handleStartTask}
            onSubmitReview={() => handleTaskAction("submit-review")}
            onMarkComplete={() => handleTaskAction("mark-complete")}
            onApprove={() => handleTaskAction("approve")}
            onRequestChanges={() => handleTaskAction("request-changes")}
            onRecall={() => handleTaskAction("recall")}
            completedAt={task.completedAt}
            reviewerName={task.reviewer?.name || null}
          />

          {/* Raise Finding Button */}
          {(task.status === "IN_PROGRESS" || task.status === "COMPLETED") && (
            <div className="pt-2">
              <button
                onClick={() => setShowFindingPanel(true)}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                style={{ backgroundColor: "var(--amber-light)", color: "var(--amber)" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--amber)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--amber-light)")}
              >
                <AlertTriangle size={16} />
                Raise Finding
              </button>
            </div>
          )}
        </div>

        {/* Right Column - Sidebar */}
        <div>
          <TaskSidebar
            task={task}
            reviewers={reviewers}
            recurrenceTasks={recurrenceTasks}
            executionHistory={executionHistory}
            evidenceCount={evidence.length}
            narrativeText={narrative}
            canActOnTask={canActOnTask}
            isPIC={isPIC}
            isTeamMember={isTeamMember}
            isSuperAdmin={isSuperAdmin}
            onReviewerChange={handleReviewerChange}
            onAssignPIC={handleAssignPIC}
            onNavigateToTask={(id) => router.push(`/tasks/${id}`)}
          />
        </div>
      </div>

      {/* Raise Finding Panel */}
      <RaiseFindingPanel
        isOpen={showFindingPanel}
        onClose={() => setShowFindingPanel(false)}
        linkedTaskId={taskId}
        prefilledData={{
          sourceId: task.sourceId || undefined,
          entityId: task.entityId || undefined,
        }}
      />
    </div>
  );
}
