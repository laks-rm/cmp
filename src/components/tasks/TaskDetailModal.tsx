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
} from "lucide-react";
import { StatusPill } from "@/components/ui/StatusPill";
import { EntityBadge } from "@/components/ui/EntityBadge";
import toast from "react-hot-toast";

type User = {
  id: string;
  name: string;
  initials: string;
  avatarColor: string | null;
};

type Evidence = {
  id: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
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
  clickupUrl: string | null;
  gdriveUrl: string | null;
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
  pic: User | null;
  reviewer: User | null;
  assigneeId: string | null;
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
  const [activeTab, setActiveTab] = useState<"details" | "evidence" | "comments" | "history">("details");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [narrative, setNarrative] = useState("");
  const [showInfoCallout, setShowInfoCallout] = useState(true);
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
      const [taskRes, evidenceRes, commentsRes, auditRes] = await Promise.all([
        fetch(`/api/tasks/${taskId}`),
        fetch(`/api/evidence?taskId=${taskId}`),
        fetch(`/api/comments?taskId=${taskId}`),
        fetch(`/api/audit-log?targetType=Task&targetId=${taskId}`),
      ]);

      if (!taskRes.ok) throw new Error("Failed to fetch task");

      const taskData = await taskRes.json();
      setTask(taskData);
      setNarrative(taskData.narrative || "");

      if (evidenceRes.ok) setEvidence(await evidenceRes.json());
      if (commentsRes.ok) setComments(await commentsRes.json());
      if (auditRes.ok) setAuditLog(await auditRes.json());
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

      if (!res.ok) throw new Error("Upload failed");

      const newEvidence = await res.json();
      setEvidence((prev) => [...prev, newEvidence]);
      toast.success("Evidence uploaded");
      if (onTaskUpdated) onTaskUpdated();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload evidence");
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
      const res = await fetch(`/api/tasks/${taskId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: comment ? JSON.stringify({ comment }) : undefined,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Action failed");
      }

      const updatedTask = await res.json();
      setTask(updatedTask);
      toast.success(`Task ${action.replace("-", " ")}`);
      if (onTaskUpdated) onTaskUpdated();
      fetchTaskData(); // Refresh all data
    } catch (error) {
      console.error(`Action ${action} error:`, error);
      toast.error(error instanceof Error ? error.message : "Action failed");
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
  const isAssignee = task?.assigneeId === session?.user.userId;
  const isReviewer = task?.reviewerId === session?.user.userId;
  const isPendingReview = task?.status === "PENDING_REVIEW";
  const isInProgress = task?.status === "IN_PROGRESS";
  const requiresApproval = task?.source?.team?.approvalRequired ?? true;

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
                      <strong>Assignee</strong> executes the task. <strong>Person in Charge (PIC)</strong> monitors progress and ensures completion.
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
                    {tab === "evidence" && evidence.length > 0 && (
                      <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-xs" style={{ backgroundColor: "var(--bg-muted)", color: "var(--text-secondary)" }}>
                        {evidence.length}
                      </span>
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
                        Assignee
                      </label>
                      {task.assignee ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                            style={{ background: task.assignee.avatarColor || "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
                          >
                            {task.assignee.initials}
                          </div>
                          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            {task.assignee.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm" style={{ color: "var(--text-muted)" }}>Unassigned</span>
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
                      className="w-full rounded-lg border px-4 py-3 text-sm transition-colors focus:outline-none"
                      style={{
                        borderColor: "var(--border)",
                        backgroundColor: "white",
                        color: "var(--text-primary)",
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "var(--blue)")}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "var(--border)";
                        handleNarrativeBlur();
                      }}
                    />
                  </div>
                </div>
              )}

              {activeTab === "evidence" && (
                <div className="space-y-4">
                  {/* Upload zone */}
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

                  {/* Evidence list */}
                  {evidence.length > 0 ? (
                    <div className="space-y-2">
                      {evidence.map((e) => (
                        <div
                          key={e.id}
                          className="flex items-center justify-between rounded-lg border p-3"
                          style={{ borderColor: "var(--border)", backgroundColor: "white" }}
                        >
                          <div className="flex items-center gap-3">
                            <FileText size={20} style={{ color: "var(--blue)" }} />
                            <div>
                              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                {e.fileName}
                              </p>
                              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                {(e.fileSize / 1024).toFixed(1)} KB · Uploaded by {e.uploadedBy.name} · {format(new Date(e.createdAt), "MMM d, h:mm a")}
                              </p>
                            </div>
                          </div>
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
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
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
                            style={{ background: comment.author.avatarColor || "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
                          >
                            {comment.author.initials}
                          </div>
                          <div className="flex-1">
                            <div className="mb-1 flex items-baseline gap-2">
                              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                {comment.author.name}
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
                            <strong>{entry.user.name}</strong> {entry.action.toLowerCase().replace(/_/g, " ")}
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
            <div className="border-t p-4" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                    style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-muted)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
                  >
                    <AlertTriangle size={16} />
                    Raise Finding
                  </button>
                </div>

                <div className="flex gap-2">
                  {/* Recall button (assignee, pending review) */}
                  {isAssignee && isPendingReview && (
                    <button
                      onClick={() => handleTaskAction("recall")}
                      className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                      style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-muted)")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
                    >
                      Recall
                    </button>
                  )}

                  {/* Submit for review (assignee, in progress, requires approval) */}
                  {isAssignee && isInProgress && requiresApproval && (
                    <button
                      onClick={() => handleTaskAction("submit-review")}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity"
                      style={{ backgroundColor: "var(--blue)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                    >
                      Submit for Review
                    </button>
                  )}

                  {/* Mark complete (assignee/pic, in progress, no approval required) */}
                  {(isAssignee || task?.pic?.id === session?.user.userId) && isInProgress && !requiresApproval && (
                    <button
                      onClick={() => handleTaskAction("mark-complete")}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity"
                      style={{ backgroundColor: "var(--green)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                    >
                      Mark Complete
                    </button>
                  )}

                  {/* Request changes & Approve (reviewer, pending review) */}
                  {isReviewer && isPendingReview && (
                    <>
                      <button
                        onClick={() => {
                          const comment = prompt("Reason for requesting changes (optional):");
                          if (comment !== null) handleTaskAction("request-changes", comment);
                        }}
                        className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
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
                        Request Changes
                      </button>
                      <button
                        onClick={() => handleTaskAction("approve")}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity"
                        style={{ backgroundColor: "var(--green)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                      >
                        Approve
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
