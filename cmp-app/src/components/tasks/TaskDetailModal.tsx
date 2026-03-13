"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import {
  X,
  Upload,
  FileText,
  Trash2,
  ExternalLink,
  AlertTriangle,
  Clock,
  Send,
  Info,
  Download,
  CheckCircle2,
  Circle,
  Eye,
  FileEdit,
  Paperclip,
  Play,
  RotateCcw,
} from "lucide-react";
import { StatusPill } from "@/components/ui/StatusPill";
import { EntityBadge } from "@/components/ui/EntityBadge";
import { FindingModal } from "@/components/findings/FindingModal";
import toast from "react-hot-toast";

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
  } | null;
  entity: {
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
};

type TaskDetailModalProps = {
  isOpen: boolean;
  taskId: string;
  onClose: () => void;
  onTaskUpdated?: () => void;
};

export function TaskDetailModal({ isOpen, taskId, onClose, onTaskUpdated }: TaskDetailModalProps) {
  const { data: session } = useSession();
  const [task, setTask] = useState<Task | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [recurrenceTasks, setRecurrenceTasks] = useState<Task[]>([]);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [selectedReviewerId, setSelectedReviewerId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"details" | "evidence" | "comments" | "history">("details");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [narrative, setNarrative] = useState("");
  const [showInfoCallout, setShowInfoCallout] = useState(true);
  const [showFindingModal, setShowFindingModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check localStorage for dismissed info callout
  useEffect(() => {
    const dismissed = localStorage.getItem("task-info-dismissed");
    setShowInfoCallout(!dismissed);
  }, []);

  const dismissInfoCallout = () => {
    localStorage.setItem("task-info-dismissed", "true");
    setShowInfoCallout(false);
  };

  useEffect(() => {
    if (isOpen && taskId) {
      fetchTaskData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, taskId]);

  const fetchTaskData = async () => {
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
      setSelectedReviewerId(taskData.reviewerId || "");

      if (evidenceRes.ok) setEvidence(await evidenceRes.json());
      if (commentsRes.ok) setComments(await commentsRes.json());
      if (auditRes.ok) setAuditLog(await auditRes.json());
      if (reviewersRes.ok) setReviewers(await reviewersRes.json());

      // Fetch recurrence group tasks if this task belongs to a recurrence group
      if (taskData.recurrenceGroupId) {
        const recurrenceRes = await fetch(`/api/tasks?recurrenceGroupId=${taskData.recurrenceGroupId}&limit=100`);
        if (recurrenceRes.ok) {
          const recurrenceData = await recurrenceRes.json();
          setRecurrenceTasks(recurrenceData.tasks || []);
        }
      }
    } catch (error) {
      console.error("Error fetching task data:", error);
      toast.error("Failed to load task details");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("taskId", taskId);

      const res = await fetch("/api/evidence", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const newEvidence = await res.json();
      setEvidence((prev) => [...prev, newEvidence]);
      toast.success("Evidence uploaded");
      if (onTaskUpdated) onTaskUpdated();
    } catch (error) {
      console.error("Upload error:", error);
      const message = error instanceof Error ? error.message : "Failed to upload evidence";
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteEvidence = async (evidenceId: string) => {
    if (!confirm("Delete this evidence file?")) return;

    try {
      const res = await fetch(`/api/evidence?id=${evidenceId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Delete failed");

      setEvidence((prev) => prev.filter((e) => e.id !== evidenceId));
      toast.success("Evidence deleted");
      if (onTaskUpdated) onTaskUpdated();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete evidence");
    }
  };

  const handleDownloadEvidence = (evidenceId: string, fileName: string) => {
    const link = document.createElement("a");
    link.href = `/api/files/${evidenceId}`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenEvidence = (evidenceId: string) => {
    window.open(`/api/files/${evidenceId}`, "_blank");
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

  const handleNarrativeBlur = async () => {
    if (narrative === (task?.narrative || "")) return;

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ narrative }),
      });

      if (!res.ok) throw new Error("Failed to update narrative");

      toast.success("Narrative saved");
      if (onTaskUpdated) onTaskUpdated();
    } catch (error) {
      console.error("Narrative save error:", error);
      toast.error("Failed to save narrative");
    }
  };

  const handleTaskAction = async (action: string, comment?: string) => {
    try {
      // Validation for submit actions
      if (action === "submit-review" || action === "mark-complete") {
        // Check reviewer assignment for submit-review
        if (action === "submit-review" && !task?.reviewerId) {
          toast.error("Please assign a reviewer before submitting");
          return;
        }

        // Check evidence requirement
        if (task?.evidenceRequired && evidence.length === 0) {
          toast.error("Please upload evidence before submitting");
          return;
        }

        // Check narrative requirement
        if (task?.narrativeRequired && !narrative.trim()) {
          toast.error("Please add a narrative before submitting");
          return;
        }
      }

      const res = await fetch(`/api/tasks/${taskId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: comment ? JSON.stringify({ comment }) : undefined,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Action failed");
      }

      // Custom success messages
      if (action === "submit-review") {
        toast.success("Task submitted for review");
      } else if (action === "mark-complete") {
        toast.success("Task marked as complete");
      } else if (action === "approve") {
        toast.success("Task approved");
      } else if (action === "request-changes") {
        toast.success("Changes requested");
      } else if (action === "recall") {
        toast.success("Task recalled");
      } else {
        toast.success(`Task ${action.replace("-", " ")}`);
      }
      
      // Refresh all task data after successful action
      await fetchTaskData();
      if (onTaskUpdated) onTaskUpdated();
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
      
      // Refresh all task data after successful start
      await fetchTaskData();
      if (onTaskUpdated) onTaskUpdated();
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

      setSelectedReviewerId(newReviewerId);
      toast.success("Reviewer updated");
      
      // Refresh task data
      await fetchTaskData();
      if (onTaskUpdated) onTaskUpdated();
    } catch (error) {
      console.error("Update reviewer error:", error);
      toast.error("Failed to update reviewer");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  if (!isOpen) return null;

  const isOverdue = task?.dueDate && new Date(task.dueDate) < new Date() && task.status !== "COMPLETED";
  const isPIC = task?.picId === session?.user.userId;
  const isReviewer = task?.reviewerId === session?.user.userId;
  const isPendingReview = task?.status === "PENDING_REVIEW";
  const isInProgress = task?.status === "IN_PROGRESS";
  const isToDo = task?.status === "TO_DO";
  const isCompleted = task?.status === "COMPLETED";
  const isDeferred = task?.status === "DEFERRED";
  const isNotApplicable = task?.status === "NOT_APPLICABLE";
  const reviewRequired = task?.reviewRequired ?? true;

  // Check if user is a member of the responsible team
  const isTeamMember = task?.responsibleTeamId 
    ? session?.user.teamIds?.includes(task.responsibleTeamId) 
    : false;

  // Check if user is Super Admin
  const isSuperAdmin = session?.user.roleName === "Super Admin";

  // User can act on the task if they are the PIC, a member of the responsible team, or a Super Admin
  const canActOnTask = isPIC || isTeamMember || isSuperAdmin;

  // Requirement checks
  const evidenceMet = !task?.evidenceRequired || evidence.length > 0;
  const narrativeMet = !task?.narrativeRequired || narrative.trim().length > 0;
  
  // Field editability
  const canUploadEvidence = canActOnTask && (isInProgress || isToDo);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}>
      <div
        className="relative flex max-h-[88vh] w-full max-w-[760px] flex-col overflow-hidden rounded-[20px] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="flex h-96 items-center justify-center" style={{ color: "var(--text-muted)" }}>
            Loading task details...
          </div>
        ) : !task ? (
          <div className="flex h-96 items-center justify-center" style={{ color: "var(--text-muted)" }}>
            Task not found
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="border-b p-6" style={{ borderColor: "var(--border)" }}>
              <div className="mb-3 flex items-start justify-between">
                <h3 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                  {task.name}
                </h3>
                <button
                  onClick={onClose}
                  className="rounded-md p-1.5 transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <X size={20} />
                </button>
              </div>
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
                <span className="text-sm font-mono" style={{ color: "var(--text-secondary)" }}>
                  {task.source.code} · {task.sourceItem?.reference || "N/A"}
                </span>
              </div>
            </div>

            {/* Info Callout */}
            {showInfoCallout && (
              <div className="mx-6 mt-4 rounded-lg border p-4" style={{ backgroundColor: "var(--blue-light)", borderColor: "var(--blue-mid)" }}>
                <div className="flex items-start gap-3">
                  <Info size={20} style={{ color: "var(--blue)", flexShrink: 0, marginTop: 2 }} />
                  <div className="flex-1">
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      <strong>Department / Team Responsible</strong> executes the task. <strong>Person in Charge (PIC)</strong> oversees completion and ensures timely delivery.
                    </p>
                  </div>
                  <button
                    onClick={dismissInfoCallout}
                    className="text-xs font-medium"
                    style={{ color: "var(--blue)" }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="border-b px-6" style={{ borderColor: "var(--border-light)" }}>
              <div className="flex gap-6">
                {(["details", "evidence", "comments", "history"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="relative pb-3 pt-4 text-sm font-medium capitalize transition-colors"
                    style={{
                      color: activeTab === tab ? "var(--blue)" : "var(--text-muted)",
                    }}
                  >
                    {tab}
                    {tab === "evidence" && (
                      <>
                        {evidence.length > 0 && (
                          <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-xs" style={{ backgroundColor: "var(--bg-muted)", color: "var(--text-secondary)" }}>
                            {evidence.length}
                          </span>
                        )}
                        {task?.evidenceRequired && evidence.length === 0 && (
                          <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-medium" style={{ backgroundColor: "var(--red-light)", color: "var(--red)" }}>
                            Required
                          </span>
                        )}
                        {task?.evidenceRequired && evidence.length > 0 && (
                          <CheckCircle2 size={14} className="ml-1 inline-block" style={{ color: "var(--green)" }} />
                        )}
                      </>
                    )}
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

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === "details" && (
                <div className="space-y-6">
                  {/* Two-column info grid */}
                  <div className="grid grid-cols-2 gap-4">
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

                    <div>
                      <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                        Person in Charge (PIC)
                      </label>
                      {task.pic ? (
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
                      ) : (
                        <span className="text-sm" style={{ color: "var(--text-muted)" }}>Not assigned</span>
                      )}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                        Reviewer {reviewRequired && <span style={{ color: "var(--red)" }}>*</span>}
                      </label>
                      {(isToDo || isInProgress) && reviewRequired ? (
                        <select
                          value={selectedReviewerId}
                          onChange={(e) => handleReviewerChange(e.target.value)}
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
                      ) : reviewRequired ? (
                        <span className="text-sm" style={{ color: "var(--text-muted)" }}>Not assigned</span>
                      ) : (
                        <span className="text-sm" style={{ color: "var(--text-muted)" }}>Not required</span>
                      )}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                        Frequency / Quarter
                      </label>
                      <div className="flex gap-2">
                        <span className="rounded-md px-2 py-1 text-xs font-medium" style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}>
                          {task.frequency}
                        </span>
                        {task.quarter && (
                          <span className="rounded-md px-2 py-1 text-xs font-medium" style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}>
                            {task.quarter}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
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

                    {task.testingPeriodStart && task.testingPeriodEnd && (
                      <div className="col-span-2">
                        <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                          Testing Period
                        </label>
                        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          {format(new Date(task.testingPeriodStart), "MMM d, yyyy")} – {format(new Date(task.testingPeriodEnd), "MMM d, yyyy")}
                        </span>
                      </div>
                    )}

                    {(task.clickupUrl || task.gdriveUrl) && (
                      <div className="col-span-2">
                        <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                          External Links
                        </label>
                        <div className="flex gap-2">
                          {task.clickupUrl && (
                            <a
                              href={task.clickupUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
                              style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-muted)")}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
                            >
                              ClickUp <ExternalLink size={12} />
                            </a>
                          )}
                          {task.gdriveUrl && (
                            <a
                              href={task.gdriveUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
                              style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-muted)")}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
                            >
                              Google Drive <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Requirements Checklist - Only show for TO_DO or IN_PROGRESS */}
                  {(isToDo || isInProgress) && (
                    <div className="rounded-lg border p-4" style={{ backgroundColor: "var(--bg-subtle)", borderColor: "var(--border)" }}>
                      <h4 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        Task Requirements
                      </h4>
                      <div className="space-y-2.5">
                        {/* Evidence requirement */}
                        <div className="flex items-start gap-3">
                          {task.evidenceRequired ? (
                            evidenceMet ? (
                              <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0" style={{ color: "var(--green)" }} />
                            ) : (
                              <Circle size={18} className="mt-0.5 flex-shrink-0" style={{ color: "var(--red)" }} />
                            )
                          ) : (
                            <Paperclip size={18} className="mt-0.5 flex-shrink-0" style={{ color: "var(--text-faint)" }} />
                          )}
                          <div className="flex-1">
                            <p className="text-sm" style={{ color: task.evidenceRequired ? "var(--text-primary)" : "var(--text-muted)" }}>
                              {task.evidenceRequired ? (
                                <>
                                  <span className="font-medium">Evidence upload required</span>
                                  {evidenceMet && <span className="ml-2 text-xs" style={{ color: "var(--green)" }}>({evidence.length} file{evidence.length !== 1 ? 's' : ''} uploaded)</span>}
                                  {!evidenceMet && <span className="ml-2 text-xs" style={{ color: "var(--red)" }}>(Not yet uploaded)</span>}
                                </>
                              ) : (
                                "Evidence upload — optional"
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Narrative requirement */}
                        <div className="flex items-start gap-3">
                          {task.narrativeRequired ? (
                            narrativeMet ? (
                              <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0" style={{ color: "var(--green)" }} />
                            ) : (
                              <Circle size={18} className="mt-0.5 flex-shrink-0" style={{ color: "var(--red)" }} />
                            )
                          ) : (
                            <FileEdit size={18} className="mt-0.5 flex-shrink-0" style={{ color: "var(--text-faint)" }} />
                          )}
                          <div className="flex-1">
                            <p className="text-sm" style={{ color: task.narrativeRequired ? "var(--text-primary)" : "var(--text-muted)" }}>
                              {task.narrativeRequired ? (
                                <>
                                  <span className="font-medium">Narrative required</span>
                                  {narrativeMet && <span className="ml-2 text-xs" style={{ color: "var(--green)" }}>(Completed)</span>}
                                  {!narrativeMet && <span className="ml-2 text-xs" style={{ color: "var(--red)" }}>(Not yet filled)</span>}
                                </>
                              ) : (
                                "Narrative — optional"
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Review requirement */}
                        <div className="flex items-start gap-3">
                          <Eye size={18} className="mt-0.5 flex-shrink-0" style={{ color: reviewRequired ? "var(--blue)" : "var(--text-faint)" }} />
                          <div className="flex-1">
                            <p className="text-sm" style={{ color: reviewRequired ? "var(--text-primary)" : "var(--text-muted)" }}>
                              {reviewRequired ? (
                                <span className="font-medium">Review required — will be sent to reviewer for approval after submission</span>
                              ) : (
                                "No review needed — task will be marked complete on submission"
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {task.description && (
                    <div>
                      <label className="mb-2 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                        Description
                      </label>
                      <div className="rounded-lg p-4 text-sm leading-relaxed" style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}>
                        {task.description}
                      </div>
                    </div>
                  )}

                  {/* Expected Outcome */}
                  {task.expectedOutcome && (
                    <div>
                      <label className="mb-2 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                        Expected Outcome
                      </label>
                      <div className="rounded-lg p-4 text-sm leading-relaxed" style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}>
                        {task.expectedOutcome}
                      </div>
                    </div>
                  )}

                  {/* Recurrence Information */}
                  {task.recurrenceGroupId && recurrenceTasks.length > 0 && (
                    <div>
                      <label className="mb-2 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                        Recurrence
                      </label>
                      <div className="rounded-lg border p-4" style={{ backgroundColor: "var(--bg-subtle)", borderColor: "var(--border)" }}>
                        <p className="mb-3 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          {task.frequency.replace("_", " ")} task — instance {task.recurrenceIndex} of {task.recurrenceTotalCount} ({task.quarter || format(new Date(task.plannedDate || task.dueDate || ""), "MMM yyyy")})
                        </p>
                        <div className="flex items-center gap-2 overflow-x-auto pb-2">
                          {recurrenceTasks
                            .sort((a, b) => (a.recurrenceIndex || 0) - (b.recurrenceIndex || 0))
                            .map((recTask) => {
                              const isCurrent = recTask.id === task.id;
                              const isCompleted = recTask.status === "COMPLETED";
                              const isPlanned = recTask.status === "PLANNED";
                              
                              return (
                                <div
                                  key={recTask.id}
                                  className="flex flex-col items-center gap-1 rounded-lg border p-2"
                                  style={{
                                    borderColor: isCurrent ? "var(--blue)" : "var(--border)",
                                    backgroundColor: isCurrent ? "var(--blue-light)" : "white",
                                    minWidth: "80px",
                                  }}
                                  title={`${recTask.quarter || ""} - ${recTask.status}`}
                                >
                                  <div
                                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
                                    style={{
                                      backgroundColor: isCompleted
                                        ? "var(--green)"
                                        : isPlanned
                                        ? "#E8EAED"
                                        : isCurrent
                                        ? "var(--blue)"
                                        : "#F1F3F8",
                                      color: isCompleted || isCurrent ? "white" : "#5F6368",
                                    }}
                                  >
                                    {isCompleted ? "✓" : recTask.recurrenceIndex}
                                  </div>
                                  <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                                    {recTask.quarter || format(new Date(recTask.plannedDate || recTask.dueDate || ""), "MMM")}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                        <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                          View other instances in the Calendar
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Narrative */}
                  <div>
                    <label className="mb-2 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                      Narrative {!task.narrativeRequired && <span style={{ color: "var(--text-faint)" }}>(optional)</span>}
                    </label>
                    <textarea
                      value={narrative}
                      onChange={(e) => setNarrative(e.target.value)}
                      placeholder="Add execution notes, context, or observations..."
                      rows={4}
                      disabled={isToDo || isPendingReview || isCompleted || !canActOnTask}
                      className="w-full rounded-lg border px-4 py-3 text-sm transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                      style={{
                        borderColor: "var(--border)",
                        backgroundColor: (isToDo || isPendingReview || isCompleted || !canActOnTask) ? "var(--bg-subtle)" : "white",
                        color: "var(--text-primary)",
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "var(--blue)")}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "var(--border)";
                        handleNarrativeBlur();
                      }}
                    />
                    {isToDo && !canActOnTask && (
                      <p className="mt-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                        Task must be started before editing
                      </p>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "evidence" && (
                <div className="space-y-4">
                  {/* Upload zone */}
                  {canUploadEvidence ? (
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className="cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors"
                      style={{
                        borderColor: isDragging ? "var(--blue)" : "var(--border)",
                        backgroundColor: isDragging ? "var(--blue-light)" : "var(--bg-subtle)",
                      }}
                    >
                      <Upload size={32} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {uploading ? "Uploading..." : "Drop files here or click to browse"}
                      </p>
                      <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                        Max 10MB per file {!task?.evidenceRequired && "(optional)"}
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e.target.files)}
                        disabled={uploading}
                      />
                    </div>
                  ) : (
                    <div className="rounded-lg border-2 border-dashed p-8 text-center" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-subtle)" }}>
                      <Upload size={32} className="mx-auto mb-3" style={{ color: "var(--text-faint)" }} />
                      <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                        {isToDo ? "Start the task to upload evidence" : "Evidence upload is disabled"}
                      </p>
                    </div>
                  )}

                  {/* Evidence list */}
                  {evidence.length > 0 ? (
                    <div className="space-y-2">
                      {evidence.map((e) => {
                        const isViewable = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"].includes(e.mimeType);
                        
                        return (
                          <div
                            key={e.id}
                            className="flex items-center justify-between rounded-lg border p-3"
                            style={{ borderColor: "var(--border)", backgroundColor: "white" }}
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <FileText size={20} style={{ color: "var(--blue)" }} />
                              <div className="flex-1">
                                <button
                                  onClick={() => handleOpenEvidence(e.id)}
                                  className="text-sm font-medium hover:underline text-left"
                                  style={{ color: "var(--blue)" }}
                                >
                                  {e.fileName}
                                </button>
                                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                  {(e.fileSize / 1024).toFixed(1)} KB · Uploaded by {e.uploadedBy?.name ?? "Unknown"} · {format(new Date(e.createdAt), "MMM d, h:mm a")}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isViewable && (
                                <button
                                  onClick={() => handleOpenEvidence(e.id)}
                                  className="rounded-md p-1.5 transition-colors"
                                  style={{ color: "var(--text-muted)" }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = "var(--blue-light)";
                                    e.currentTarget.style.color = "var(--blue)";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = "transparent";
                                    e.currentTarget.style.color = "var(--text-muted)";
                                  }}
                                  title="Open in new tab"
                                >
                                  <ExternalLink size={16} />
                                </button>
                              )}
                              <button
                                onClick={() => handleDownloadEvidence(e.id, e.fileName)}
                                className="rounded-md p-1.5 transition-colors"
                                style={{ color: "var(--text-muted)" }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = "var(--green-light)";
                                  e.currentTarget.style.color = "var(--green)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = "transparent";
                                  e.currentTarget.style.color = "var(--text-muted)";
                                }}
                                title="Download"
                              >
                                <Download size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteEvidence(e.id)}
                                className="rounded-md p-1.5 transition-colors"
                                style={{ color: "var(--text-muted)" }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = "var(--red-light)";
                                  e.currentTarget.style.color = "var(--red)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = "transparent";
                                  e.currentTarget.style.color = "var(--text-muted)";
                                }}
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-center text-sm" style={{ color: "var(--text-muted)" }}>
                      No evidence uploaded yet
                    </p>
                  )}
                </div>
              )}

              {activeTab === "comments" && (
                <div className="space-y-4">
                  {/* Comments list */}
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
                    <p className="text-center text-sm" style={{ color: "var(--text-muted)" }}>
                      No comments yet
                    </p>
                  )}

                  {/* Add comment */}
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
                      onMouseEnter={(e) => !newComment.trim() || (e.currentTarget.style.opacity = "0.9")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                    >
                      <Send size={16} />
                      Send
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "history" && (
                <div className="space-y-3">
                  {auditLog.length > 0 ? (
                    auditLog.map((entry) => (
                      <div key={entry.id} className="flex gap-3">
                        <div className="relative pt-1.5">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--blue)" }} />
                          {entry.id !== auditLog[auditLog.length - 1].id && (
                            <div className="absolute left-1 top-3 h-full w-px" style={{ backgroundColor: "var(--border-light)" }} />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                            <strong>{entry.user?.name ?? "System"}</strong> {entry.action.toLowerCase().replace(/_/g, " ")}
                            {entry.details && typeof entry.details === "object" && "oldStatus" in entry.details && "newStatus" in entry.details && (
                              <> from <strong>{String(entry.details.oldStatus).replace(/_/g, " ")}</strong> to <strong>{String(entry.details.newStatus).replace(/_/g, " ")}</strong></>
                            )}
                          </p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {format(new Date(entry.createdAt), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-sm" style={{ color: "var(--text-muted)" }}>
                      No history available
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="border-t" style={{ borderColor: "var(--border)" }}>
              {/* Primary Action Bar - Status-based actions */}
              <div className="border-b p-4" style={{ borderColor: "var(--border-light)" }}>
                {/* TO_DO: Start Task */}
                {isToDo && canActOnTask && (
                  <button
                    onClick={handleStartTask}
                    className="flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-semibold text-white transition-opacity"
                    style={{ backgroundColor: "var(--blue)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                  >
                    <Play size={20} />
                    Start Task
                  </button>
                )}

                {/* TO_DO: No access message */}
                {isToDo && !canActOnTask && (
                  <div className="rounded-lg p-3 text-center text-sm" style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-muted)" }}>
                    Only the person in charge (PIC) can start this task
                  </div>
                )}

                {/* IN_PROGRESS: Submit buttons (PIC only) */}
                {isInProgress && canActOnTask && (
                  <div className="flex gap-3">
                    {reviewRequired ? (
                      isPIC ? (
                        <button
                          onClick={() => handleTaskAction("submit-review")}
                          className="flex flex-1 items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-semibold text-white transition-opacity"
                          style={{ backgroundColor: "var(--blue)" }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                        >
                          Submit for Review
                        </button>
                      ) : (
                        <div className="rounded-lg p-3 text-center text-sm" style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-muted)" }}>
                          Only the person in charge (PIC) can submit this task for review
                        </div>
                      )
                    ) : (
                      <button
                        onClick={() => handleTaskAction("mark-complete")}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-semibold text-white transition-opacity"
                        style={{ backgroundColor: "var(--green)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                      >
                        <CheckCircle2 size={20} />
                        Mark as Complete
                      </button>
                    )}
                  </div>
                )}

                {/* PENDING_REVIEW: Reviewer actions */}
                {isPendingReview && isReviewer && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        const comment = prompt("Reason for requesting changes (optional):");
                        if (comment !== null) handleTaskAction("request-changes", comment);
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
                      Request Changes
                    </button>
                    <button
                      onClick={() => handleTaskAction("approve")}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-semibold text-white transition-opacity"
                      style={{ backgroundColor: "var(--green)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                    >
                      <CheckCircle2 size={20} />
                      Approve
                    </button>
                  </div>
                )}

                {/* PENDING_REVIEW: Non-reviewer message */}
                {isPendingReview && !isReviewer && (
                  <div className="rounded-lg p-3 text-center text-sm" style={{ backgroundColor: "var(--amber-light)", color: "var(--amber)" }}>
                    <Clock size={16} className="mx-auto mb-1" />
                    Awaiting review by {task.reviewer?.name || "reviewer"}
                  </div>
                )}

                {/* PENDING_REVIEW: Recall option for PIC */}
                {isPendingReview && isPIC && (
                  <button
                    onClick={() => handleTaskAction("recall")}
                    className="mt-2 w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                    style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-muted)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
                  >
                    Recall Submission
                  </button>
                )}

                {/* COMPLETED: Success message */}
                {isCompleted && (
                  <div className="flex items-center justify-center gap-2 rounded-lg p-3 text-base font-semibold" style={{ backgroundColor: "var(--green-light)", color: "var(--green)" }}>
                    <CheckCircle2 size={20} />
                    Completed {task.completedAt && `on ${format(new Date(task.completedAt), "MMM d, yyyy")}`}
                  </div>
                )}

                {/* DEFERRED: Status message */}
                {isDeferred && (
                  <div className="rounded-lg p-3 text-center text-sm font-medium" style={{ backgroundColor: "var(--purple-light)", color: "var(--purple)" }}>
                    Task Deferred
                  </div>
                )}

                {/* NOT_APPLICABLE: Status message */}
                {isNotApplicable && (
                  <div className="rounded-lg p-3 text-center text-sm font-medium" style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-muted)" }}>
                    Task Not Applicable
                  </div>
                )}
              </div>

              {/* Secondary Actions - Raise Finding */}
              {(isInProgress || isCompleted) && (
                <div className="p-4">
                  <button
                    onClick={() => setShowFindingModal(true)}
                    className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                    style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-muted)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
                  >
                    <AlertTriangle size={16} />
                    Raise Finding
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Finding Modal */}
      {showFindingModal && task && (
        <FindingModal
          isOpen={showFindingModal}
          onClose={() => setShowFindingModal(false)}
          onSuccess={() => {
            setShowFindingModal(false);
            toast.success("Finding raised successfully");
            // Refresh task data to show the linked finding
            fetchTaskData();
          }}
          linkedTaskId={task.id}
        />
      )}
    </div>
  );
}
