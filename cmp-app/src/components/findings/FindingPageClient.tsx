"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ChevronRight, Send, Upload, FileText, Trash2, Download, ExternalLink } from "lucide-react";
import { FindingDetails } from "@/components/findings/FindingDetails";
import { FindingSidebar } from "@/components/findings/FindingSidebar";
import { FindingActionBar } from "@/components/findings/FindingActionBar";
import { format } from "date-fns";
import toast from "@/lib/toast";

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

type Finding = {
  id: string;
  reference: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  rootCause: string | null;
  impact: string | null;
  managementResponse: string | null;
  closureNote: string | null;
  targetDate: string | null;
  closedAt: string | null;
  raisedAt: string;
  actionOwner: User;
  raisedBy: User;
  task: {
    id: string;
    name: string;
  } | null;
  source: {
    id: string;
    name: string;
    code: string;
  };
  entity: {
    id: string;
    code: string;
    name: string;
  };
};

type FindingPageClientProps = {
  findingId: string;
};

const SEVERITY_COLORS: Record<string, { bg: string; color: string }> = {
  CRITICAL: { bg: "var(--red-light)", color: "var(--red)" },
  HIGH: { bg: "#FEF2F2", color: "#DC2626" },
  MEDIUM: { bg: "var(--amber-light)", color: "var(--amber)" },
  LOW: { bg: "var(--green-light)", color: "var(--green)" },
  OBSERVATION: { bg: "var(--blue-light)", color: "var(--blue)" },
};

export function FindingPageClient({ findingId }: FindingPageClientProps) {
  // const router = useRouter(); // Not used, commenting out for now
  
  const [finding, setFinding] = useState<Finding | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activeTab, setActiveTab] = useState<"details" | "evidence" | "comments" | "history">("details");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [newComment, setNewComment] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local state for editable fields
  const [editableFields, setEditableFields] = useState({
    description: "",
    rootCause: "",
    impact: "",
    managementResponse: "",
    closureNote: "",
  });

  const fetchFindingData = useCallback(async () => {
    try {
      setLoading(true);
      const [findingRes, evidenceRes, commentsRes] = await Promise.all([
        fetch(`/api/findings/${findingId}`),
        fetch(`/api/evidence?findingId=${findingId}`),
        fetch(`/api/comments?findingId=${findingId}`),
      ]);

      if (!findingRes.ok) throw new Error("Failed to fetch finding");

      const findingData = await findingRes.json();
      setFinding(findingData);
      setEditableFields({
        description: findingData.description || "",
        rootCause: findingData.rootCause || "",
        impact: findingData.impact || "",
        managementResponse: findingData.managementResponse || "",
        closureNote: findingData.closureNote || "",
      });

      if (evidenceRes.ok) {
        const evidenceData = await evidenceRes.json();
        setEvidence(evidenceData);
      }
      
      if (commentsRes.ok) {
        const commentsData = await commentsRes.json();
        setComments(commentsData);
      }
    } catch (error) {
      console.error("Error fetching finding data:", error);
      toast.error("Failed to load finding details");
    } finally {
      setLoading(false);
    }
  }, [findingId]);

  useEffect(() => {
    fetchFindingData();
  }, [fetchFindingData]);

  const handleFieldChange = (field: string, value: string) => {
    setEditableFields((prev) => ({ ...prev, [field]: value }));
  };

  const handleFieldSave = async (field: string) => {
    const originalValue = finding?.[field as keyof Finding] || "";
    const newValue = editableFields[field as keyof typeof editableFields];
    
    if (newValue === originalValue) return;

    try {
      const res = await fetch(`/api/findings/${findingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: newValue }),
      });

      if (!res.ok) throw new Error(`Failed to update ${field}`);

      toast.success("Field updated");
      await fetchFindingData();
    } catch (error) {
      console.error(`${field} save error:`, error);
      toast.error(`Failed to update ${field}`);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/findings/${findingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error("Failed to update status");

      toast.success("Status updated");
      await fetchFindingData();
    } catch (error) {
      console.error("Status update error:", error);
      toast.error("Failed to update status");
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
      formData.append("findingId", findingId);

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
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete evidence");
    }
  };

  const handleDownloadEvidence = async (evidenceId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/evidence/${evidenceId}/download`);
      if (!response.ok) {
        throw new Error("Failed to get download URL");
      }
      const data = await response.json();
      
      const link = document.createElement("a");
      link.href = data.url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download evidence");
    }
  };

  const handleOpenEvidence = async (evidenceId: string) => {
    try {
      const response = await fetch(`/api/evidence/${evidenceId}/download`);
      if (!response.ok) {
        throw new Error("Failed to get download URL");
      }
      const data = await response.json();
      window.open(data.url, "_blank");
    } catch (error) {
      console.error("Open evidence error:", error);
      toast.error("Failed to open evidence");
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment, findingId }),
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

  if (loading || !finding) {
    return (
      <div className="flex h-96 items-center justify-center" style={{ color: "var(--text-muted)" }}>
        Loading finding details...
      </div>
    );
  }

  const severityConfig = SEVERITY_COLORS[finding.severity];
  const isClosedStatus = finding.status === "CLOSED" || finding.status === "VERIFIED";
  const canUploadEvidence = !isClosedStatus;
  const canEdit = finding.status === "OPEN" || finding.status === "IN_PROGRESS";

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
        <Link href="/findings" className="transition-colors hover:underline" style={{ color: "var(--blue)" }}>
          Findings
        </Link>
        <ChevronRight size={16} />
        <span className="font-mono" style={{ color: "var(--text-secondary)" }}>
          {finding.reference}
        </span>
      </div>

      {/* Title Area */}
      <div>
        <h1 className="mb-3 text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
          {finding.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-medium" style={{ color: "var(--blue)" }}>
            {finding.reference}
          </span>
          <span
            className="rounded-md px-2 py-1 text-xs font-medium"
            style={{
              backgroundColor: severityConfig.bg,
              color: severityConfig.color,
            }}
          >
            {finding.severity}
          </span>
          <span className="rounded-md px-2 py-1 text-xs font-medium" style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}>
            {finding.entity.code}
          </span>
        </div>
      </div>

      {/* Origin Card */}
      {finding.task && (
        <div className="rounded-lg border p-4" style={{ backgroundColor: "var(--bg-subtle)", borderColor: "var(--border)" }}>
          <p className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>
            Raised from Task
          </p>
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <Link
                href={`/tasks/${finding.task.id}`}
                className="text-sm font-medium transition-opacity hover:underline"
                style={{ color: "var(--blue)" }}
              >
                {finding.task.name}
              </Link>
              <div className="mt-1 flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                <span>{finding.source.name}</span>
                <span>•</span>
                <span className="font-mono">{finding.source.code}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs */}
          <div className="border-b" style={{ borderColor: "var(--border-light)" }}>
            <div className="flex gap-6">
              {(["details", "evidence", "comments", "history"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="relative pb-3 text-sm font-medium capitalize transition-colors"
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

          {/* Tab Content */}
          <div>
            {activeTab === "details" && (
              <FindingDetails
                finding={editableFields}
                canEdit={canEdit}
                onFieldChange={handleFieldChange}
                onFieldSave={handleFieldSave}
              />
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
                      Max 10MB per file
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
                      Finding is closed — evidence upload disabled
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
                            {canUploadEvidence && (
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
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-sm py-8" style={{ color: "var(--text-muted)" }}>
                    No evidence uploaded yet
                  </p>
                )}
              </div>
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
              <p className="text-center text-sm py-8" style={{ color: "var(--text-muted)" }}>
                Audit history will appear here
              </p>
            )}
          </div>

          {/* Action Bar */}
          <FindingActionBar
            status={finding.status}
            canEdit={true}
            onStatusChange={handleStatusChange}
            closedAt={finding.closedAt}
          />
        </div>

        {/* Right Column - Sidebar */}
        <div>
          <FindingSidebar finding={finding} />
        </div>
      </div>
    </div>
  );
}
