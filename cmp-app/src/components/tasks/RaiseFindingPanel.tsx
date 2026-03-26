"use client";

import { useState, useEffect } from "react";
import { X, AlertTriangle } from "lucide-react";
import toast from "@/lib/toast";
import { useRouter } from "next/navigation";

type Source = {
  id: string;
  name: string;
  code: string;
};

type User = {
  id: string;
  name: string;
};

type Entity = {
  id: string;
  code: string;
  name: string;
};

type RaiseFindingPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  linkedTaskId: string;
  prefilledData?: {
    sourceId?: string;
    entityId?: string;
  };
};

export function RaiseFindingPanel({ isOpen, onClose, linkedTaskId, prefilledData }: RaiseFindingPanelProps) {
  const router = useRouter();
  const [sources, setSources] = useState<Source[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    severity: "MEDIUM",
    title: "",
    description: "",
    rootCause: "",
    impact: "",
    sourceId: prefilledData?.sourceId || "",
    taskId: linkedTaskId,
    entityId: prefilledData?.entityId || "",
    actionOwnerId: "",
    targetDate: "",
  });

  useEffect(() => {
    if (isOpen) {
      fetchSources();
      fetchUsers();
      fetchEntities();
    }
  }, [isOpen]);

  const fetchSources = async () => {
    try {
      const res = await fetch("/api/sources");
      if (res.ok) setSources(await res.json());
    } catch (error) {
      console.error("Failed to fetch sources:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) setUsers(await res.json());
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  const fetchEntities = async () => {
    try {
      const res = await fetch("/api/entities");
      if (res.ok) setEntities(await res.json());
    } catch (error) {
      console.error("Failed to fetch entities:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.sourceId || !formData.entityId || !formData.actionOwnerId) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch("/api/findings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error("Failed to create finding");

      const finding = await res.json();
      toast.success(
        <div className="flex items-center gap-2">
          <span>Finding {finding.reference} created</span>
          <button
            onClick={() => router.push(`/findings/${finding.id}`)}
            className="text-xs underline"
            style={{ color: "var(--blue)" }}
          >
            View finding
          </button>
        </div>
      );
      onClose();
    } catch (error) {
      console.error("Finding creation error:", error);
      toast.error("Failed to create finding");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-[600px] flex-col overflow-hidden rounded-[20px] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b p-6" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={20} style={{ color: "var(--amber)" }} />
              <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                Raise Finding
              </h2>
            </div>
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
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  Severity <span style={{ color: "var(--red)" }}>*</span>
                </label>
                <select
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--border)" }}
                >
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                  <option value="OBSERVATION">Observation</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  Entity <span style={{ color: "var(--red)" }}>*</span>
                </label>
                <select
                  value={formData.entityId}
                  onChange={(e) => setFormData({ ...formData, entityId: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--border)" }}
                >
                  <option value="">Select entity...</option>
                  {entities.map((entity) => (
                    <option key={entity.id} value={entity.id}>
                      {entity.code} - {entity.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Finding Title <span style={{ color: "var(--red)" }}>*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Brief summary of the finding"
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)" }}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed description of the finding"
                rows={3}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)" }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  Root Cause
                </label>
                <textarea
                  value={formData.rootCause}
                  onChange={(e) => setFormData({ ...formData, rootCause: e.target.value })}
                  placeholder="Underlying cause"
                  rows={2}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--border)" }}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  Impact
                </label>
                <textarea
                  value={formData.impact}
                  onChange={(e) => setFormData({ ...formData, impact: e.target.value })}
                  placeholder="Potential impact"
                  rows={2}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--border)" }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  Linked Source <span style={{ color: "var(--red)" }}>*</span>
                </label>
                <select
                  value={formData.sourceId}
                  onChange={(e) => setFormData({ ...formData, sourceId: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--border)" }}
                >
                  <option value="">Select source...</option>
                  {sources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.code} - {source.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  Action Owner <span style={{ color: "var(--red)" }}>*</span>
                </label>
                <select
                  value={formData.actionOwnerId}
                  onChange={(e) => setFormData({ ...formData, actionOwnerId: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--border)" }}
                >
                  <option value="">Select owner...</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Target Closure Date
              </label>
              <input
                type="date"
                value={formData.targetDate}
                onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
          </div>
        </form>

        <div className="border-t p-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 text-sm font-medium"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              style={{ backgroundColor: "var(--amber)" }}
            >
              {submitting ? "Creating..." : "Create Finding"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
