"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { X, FileText, Send } from "lucide-react";
import toast from "react-hot-toast";

type FindingDetailModalProps = {
  isOpen: boolean;
  findingId: string;
  onClose: () => void;
  onFindingUpdated?: () => void;
};

export function FindingDetailModal({ isOpen, findingId, onClose, onFindingUpdated }: FindingDetailModalProps) {
  const [finding, setFinding] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"details" | "evidence" | "comments" | "history">("details");
  const [newComment, setNewComment] = useState("");
  const [closureNote, setClosureNote] = useState("");

  useEffect(() => {
    if (isOpen && findingId) {
      fetchFinding();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, findingId]);

  const fetchFinding = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/findings/${findingId}`);
      if (!res.ok) throw new Error("Failed to fetch finding");
      const data = await res.json();
      setFinding(data);
      setClosureNote(data.closureNote || "");
    } catch (error) {
      console.error("Error fetching finding:", error);
      toast.error("Failed to load finding");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/findings/${findingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, closureNote: newStatus === "CLOSED" ? closureNote : undefined }),
      });

      if (!res.ok) throw new Error("Failed to update status");

      toast.success("Status updated");
      fetchFinding();
      if (onFindingUpdated) onFindingUpdated();
    } catch (error) {
      console.error("Status update error:", error);
      toast.error("Failed to update status");
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

      setNewComment("");
      toast.success("Comment added");
      fetchFinding();
    } catch (error) {
      console.error("Comment error:", error);
      toast.error("Failed to add comment");
    }
  };

  if (!isOpen) return null;

  const SEVERITY_COLORS: Record<string, { bg: string; color: string }> = {
    CRITICAL: { bg: "var(--red-light)", color: "var(--red)" },
    HIGH: { bg: "#FEF2F2", color: "#DC2626" },
    MEDIUM: { bg: "var(--amber-light)", color: "var(--amber)" },
    LOW: { bg: "var(--green-light)", color: "var(--green)" },
    OBSERVATION: { bg: "var(--blue-light)", color: "var(--blue)" },
  };

  const STATUS_OPTIONS = ["OPEN", "IN_PROGRESS", "IMPLEMENTED", "VERIFIED", "CLOSED"];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[88vh] w-full max-w-[760px] flex-col overflow-hidden rounded-[20px] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {loading || !finding ? (
          <div className="flex h-96 items-center justify-center">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading finding...</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="border-b p-6" style={{ borderColor: "var(--border)" }}>
              <div className="mb-3 flex items-start justify-between">
                <h3 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                  {String(finding.title)}
                </h3>
                <button onClick={onClose} className="rounded-md p-1.5" style={{ color: "var(--text-muted)" }}>
                  <X size={20} />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-medium" style={{ color: "var(--blue)" }}>
                  {String(finding.reference)}
                </span>
                <span
                  className="rounded-md px-2 py-1 text-xs font-medium"
                  style={{
                    backgroundColor: SEVERITY_COLORS[String(finding.severity)]?.bg || "var(--bg-muted)",
                    color: SEVERITY_COLORS[String(finding.severity)]?.color || "var(--text-secondary)",
                  }}
                >
                  {String(finding.severity)}
                </span>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {String((finding.source as Record<string, unknown>)?.name)}
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b px-6" style={{ borderColor: "var(--border-light)" }}>
              <div className="flex gap-6">
                {(["details", "evidence", "comments", "history"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="relative pb-3 pt-4 text-sm font-medium capitalize transition-colors"
                    style={{ color: activeTab === tab ? "var(--blue)" : "var(--text-muted)" }}
                  >
                    {tab}
                    {activeTab === tab && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: "var(--blue)" }} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === "details" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                        Action Owner
                      </label>
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                          style={{ background: String((finding.actionOwner as Record<string, unknown>)?.avatarColor) || "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
                        >
                          {String((finding.actionOwner as Record<string, unknown>)?.initials)}
                        </div>
                        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          {String((finding.actionOwner as Record<string, unknown>)?.name)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                        Raised By
                      </label>
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                          style={{ background: String((finding.raisedBy as Record<string, unknown>)?.avatarColor) || "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
                        >
                          {String((finding.raisedBy as Record<string, unknown>)?.initials)}
                        </div>
                        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          {String((finding.raisedBy as Record<string, unknown>)?.name)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {Boolean(finding.description) && (
                    <div>
                      <label className="mb-2 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                        Description
                      </label>
                      <div className="rounded-lg p-4 text-sm" style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}>
                        {String(finding.description)}
                      </div>
                    </div>
                  )}

                  {Boolean(finding.rootCause) && (
                    <div>
                      <label className="mb-2 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                        Root Cause
                      </label>
                      <div className="rounded-lg p-4 text-sm" style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}>
                        {String(finding.rootCause)}
                      </div>
                    </div>
                  )}

                  {Boolean(finding.impact) && (
                    <div>
                      <label className="mb-2 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                        Impact
                      </label>
                      <div className="rounded-lg p-4 text-sm" style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}>
                        {String(finding.impact)}
                      </div>
                    </div>
                  )}

                  {Boolean(finding.managementResponse) && (
                    <div>
                      <label className="mb-2 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                        Management Response
                      </label>
                      <div className="rounded-lg p-4 text-sm" style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}>
                        {String(finding.managementResponse)}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="mb-2 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                      Closure Note
                    </label>
                    <textarea
                      value={closureNote}
                      onChange={(e) => setClosureNote(e.target.value)}
                      placeholder="Add notes before closing..."
                      rows={3}
                      className="w-full rounded-lg border px-4 py-3 text-sm"
                      style={{ borderColor: "var(--border)" }}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                      Status
                    </label>
                    <select
                      value={String(finding.status)}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="w-full rounded-lg border px-4 py-2 text-sm"
                      style={{ borderColor: "var(--border)" }}
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {activeTab === "evidence" && (
                <div className="space-y-4">
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    Upload remediation evidence
                  </p>
                  {Array.isArray(finding.evidence) && finding.evidence.length > 0 ? (
                    <div className="space-y-2">
                      {(finding.evidence as Array<Record<string, unknown>>).map((e) => (
                        <div key={String(e.id)} className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
                          <div className="flex items-center gap-3">
                            <FileText size={20} style={{ color: "var(--blue)" }} />
                            <div>
                              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                {String(e.fileName)}
                              </p>
                              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                {((Number(e.fileSize) || 0) / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>
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
                  {Array.isArray(finding.comments) && finding.comments.length > 0 ? (
                    <div className="space-y-4">
                      {(finding.comments as Array<Record<string, unknown>>).map((comment) => (
                        <div key={String(comment.id)} className="flex gap-3">
                          <div
                            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                            style={{ background: String((comment.author as Record<string, unknown>)?.avatarColor || "linear-gradient(135deg, #667eea 0%, #764ba2 100%)") }}
                          >
                            {String((comment.author as Record<string, unknown>)?.initials)}
                          </div>
                          <div className="flex-1">
                            <div className="mb-1 flex items-baseline gap-2">
                              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                {String((comment.author as Record<string, unknown>)?.name)}
                              </span>
                              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                {format(new Date(String(comment.createdAt)), "MMM d, h:mm a")}
                              </span>
                            </div>
                            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                              {String(comment.content)}
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

                  <div className="flex gap-2 pt-4">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                      placeholder="Add a comment..."
                      className="flex-1 rounded-lg border px-4 py-2 text-sm"
                      style={{ borderColor: "var(--border)" }}
                    />
                    <button
                      onClick={handleAddComment}
                      className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white"
                      style={{ backgroundColor: "var(--blue)" }}
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "history" && (
                <p className="text-center text-sm" style={{ color: "var(--text-muted)" }}>
                  Audit history will appear here
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
