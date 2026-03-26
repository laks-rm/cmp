"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, FileText, Trash2, Download, ExternalLink } from "lucide-react";
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

type TaskWorkAreaProps = {
  taskId: string;
  narrative: string;
  evidence: Evidence[];
  canEdit: boolean;
  onNarrativeChange: (narrative: string) => void;
  onNarrativeSave: () => void;
  onEvidenceUploaded: (evidence: Evidence) => void;
  onEvidenceDeleted: (evidenceId: string) => void;
  onAutoStart?: () => void;
};

export function TaskWorkArea({
  taskId,
  narrative,
  evidence,
  canEdit,
  onNarrativeChange,
  onNarrativeSave,
  onEvidenceUploaded,
  onEvidenceDeleted,
  onAutoStart,
}: TaskWorkAreaProps) {
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [initialNarrative, setInitialNarrative] = useState(narrative);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track if narrative has changed from initial state
  useEffect(() => {
    setIsDirty(narrative !== initialNarrative);
  }, [narrative, initialNarrative]);

  // Update initial narrative when task changes
  useEffect(() => {
    setInitialNarrative(narrative);
    setIsDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]); // Only reset when task ID changes

  const handleSaveDraft = async () => {
    if (!isDirty) return;
    
    setIsSaving(true);
    try {
      await onNarrativeSave();
      setInitialNarrative(narrative);
      setIsDirty(false);
      setSavedAt(new Date());
      
      // Clear saved indicator after 2 seconds
      setTimeout(() => setSavedAt(null), 2000);
    } catch (error) {
      console.error("Save draft error:", error);
    } finally {
      setIsSaving(false);
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
      
      // Auto-start if this is the first action
      if (onAutoStart) {
        onAutoStart();
      }
      
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
      onEvidenceUploaded(newEvidence);
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

      onEvidenceDeleted(evidenceId);
      toast.success("Evidence deleted");
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

  return (
    <div className="space-y-6">
      {/* Execution Narrative */}
      <div>
        <label className="mb-2 block text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Execution Narrative
        </label>
        <textarea
          value={narrative}
          onChange={(e) => onNarrativeChange(e.target.value)}
          onBlur={onNarrativeSave}
          placeholder="Add execution notes, context, findings, or observations..."
          rows={6}
          disabled={!canEdit}
          className="w-full rounded-lg border px-4 py-3 text-sm transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            borderColor: "var(--border)",
            backgroundColor: canEdit ? "white" : "var(--bg-subtle)",
            color: "var(--text-primary)",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--blue)")}
        />
        
        {/* Save Draft Button */}
        {canEdit && isDirty && (
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={handleSaveDraft}
              disabled={isSaving || !isDirty}
              className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
              style={{ 
                backgroundColor: "var(--blue)", 
                color: "white",
              }}
            >
              {isSaving ? "Saving..." : "Save draft"}
            </button>
            {savedAt && (
              <span className="text-xs font-medium" style={{ color: "var(--green)" }}>
                Draft saved
              </span>
            )}
          </div>
        )}
      </div>

      {/* Evidence Section */}
      <div>
        <label className="mb-2 block text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Evidence Files
        </label>

        {canEdit && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="mb-4 cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors"
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
        )}

        {/* Evidence List */}
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
                    {canEdit && (
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
    </div>
  );
}
