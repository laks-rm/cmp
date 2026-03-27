"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, CheckCircle, XCircle, X } from "lucide-react";
import toast from "@/lib/toast";

type TaskType = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  _count?: {
    tasks: number;
  };
};

export function TaskTypesTab() {
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTaskTypes();
  }, []);

  const fetchTaskTypes = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/task-types");
      if (!res.ok) throw new Error("Failed to fetch task types");
      const data = await res.json();
      setTaskTypes(data.taskTypes);
    } catch (error) {
      console.error("Failed to fetch task types:", error);
      toast.error("Failed to load task types");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setCreating(true);
    setFormData({ name: "", description: "" });
  };

  const handleEdit = (taskType: TaskType) => {
    setEditingId(taskType.id);
    setFormData({ name: taskType.name, description: taskType.description || "" });
  };

  const handleCancel = () => {
    setCreating(false);
    setEditingId(null);
    setFormData({ name: "", description: "" });
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    try {
      setSubmitting(true);
      if (creating) {
        const res = await fetch("/api/task-types", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create task type");
        }

        toast.success("Task type created successfully");
      } else if (editingId) {
        const res = await fetch(`/api/task-types/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to update task type");
        }

        toast.success("Task type updated successfully");
      }

      await fetchTaskTypes();
      handleCancel();
    } catch (error) {
      console.error("Failed to save task type:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save task type");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/task-types/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentActive }),
      });

      if (!res.ok) throw new Error("Failed to update task type");

      toast.success(currentActive ? "Task type deactivated" : "Task type activated");
      await fetchTaskTypes();
    } catch (error) {
      console.error("Failed to toggle task type status:", error);
      toast.error("Failed to update task type status");
    }
  };

  if (loading) {
    return (
      <div className="rounded-[14px] border bg-white p-12 text-center" style={{ borderColor: "var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Loading task types...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Task Types
          </h3>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            Categorize tasks by the type of work they represent
          </p>
        </div>
        {!creating && (
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity"
            style={{ backgroundColor: "var(--blue)" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            <Plus size={16} />
            Add Task Type
          </button>
        )}
      </div>

      <div className="rounded-[14px] border bg-white" style={{ borderColor: "var(--border)" }}>
        {creating && (
          <div className="border-b p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-subtle)" }}>
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                New Task Type
              </h4>
              <button onClick={handleCancel} className="rounded p-1 hover:bg-[var(--bg-hover)]">
                <X size={16} style={{ color: "var(--text-muted)" }} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Name <span style={{ color: "var(--red)" }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  placeholder="e.g., Policy Review"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  rows={2}
                  placeholder="Optional description"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !formData.name.trim()}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                  style={{
                    backgroundColor: "var(--blue)",
                    opacity: submitting || !formData.name.trim() ? 0.5 : 1,
                    cursor: submitting || !formData.name.trim() ? "not-allowed" : "pointer",
                  }}
                >
                  {submitting ? "Creating..." : "Create"}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={submitting}
                  className="rounded-lg border px-4 py-2 text-sm font-medium"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Description
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Tasks
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {taskTypes.map((taskType) => (
                <tr
                  key={taskType.id}
                  className="transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ borderBottom: "1px solid var(--border-light)" }}
                >
                  {editingId === taskType.id ? (
                    <td colSpan={5} className="p-4" style={{ backgroundColor: "var(--bg-subtle)" }}>
                      <div className="space-y-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                            Name <span style={{ color: "var(--red)" }}>*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full rounded-lg border px-3 py-2 text-sm"
                            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                            autoFocus
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                            Description
                          </label>
                          <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full rounded-lg border px-3 py-2 text-sm"
                            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                            rows={2}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleSubmit}
                            disabled={submitting || !formData.name.trim()}
                            className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                            style={{
                              backgroundColor: "var(--blue)",
                              opacity: submitting || !formData.name.trim() ? 0.5 : 1,
                              cursor: submitting || !formData.name.trim() ? "not-allowed" : "pointer",
                            }}
                          >
                            {submitting ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={handleCancel}
                            disabled={submitting}
                            className="rounded-lg border px-4 py-2 text-sm font-medium"
                            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          {taskType.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                          {taskType.description || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}
                        >
                          {taskType._count?.tasks || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {taskType.isActive ? (
                          <CheckCircle size={18} style={{ color: "var(--green)", margin: "0 auto" }} />
                        ) : (
                          <XCircle size={18} style={{ color: "var(--text-muted)", margin: "0 auto" }} />
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEdit(taskType)}
                            className="rounded-lg p-2 transition-colors hover:bg-[var(--bg-subtle)]"
                            style={{ color: "var(--text-secondary)" }}
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleToggleActive(taskType.id, taskType.isActive)}
                            className="rounded-lg p-2 text-xs font-medium transition-colors hover:bg-[var(--bg-subtle)]"
                            style={{ color: taskType.isActive ? "var(--orange)" : "var(--green)" }}
                            title={taskType.isActive ? "Deactivate" : "Activate"}
                          >
                            {taskType.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {taskTypes.length === 0 && !creating && (
          <div className="p-12 text-center">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No task types found. Click &quot;Add Task Type&quot; to create one.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
