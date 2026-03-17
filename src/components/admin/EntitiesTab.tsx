"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, CheckCircle, XCircle, X } from "lucide-react";
import { EntityBadge } from "@/components/ui/EntityBadge";
import toast from "@/lib/toast";

type Entity = {
  id: string;
  code: string;
  name: string;
  shortName: string;
  jurisdiction: string;
  regulator: string;
  isActive: boolean;
  _count?: {
    userAccess: number;
    sourceLinks: number;
  };
};

type EntityFormData = {
  code: string;
  name: string;
  shortName: string;
  jurisdiction: string;
  regulator: string;
  isActive?: boolean;
};

export function EntitiesTab() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [formData, setFormData] = useState<EntityFormData>({
    code: "",
    name: "",
    shortName: "",
    jurisdiction: "",
    regulator: "",
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof EntityFormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchEntities();
  }, []);

  const fetchEntities = async () => {
    try {
      setLoading(true);
      // #region agent log
      fetch('http://127.0.0.1:7712/ingest/07d2e8ff-a49f-4678-98e7-a4ff4c518e7d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'782931'},body:JSON.stringify({sessionId:'782931',location:'EntitiesTab.tsx:53',message:'Fetching entities - using regular endpoint',data:{endpoint:'/api/entities'},timestamp:Date.now(),hypothesisId:'C',runId:'post-fix'})}).catch(()=>{});
      // #endregion
      const res = await fetch("/api/entities");
      // #region agent log
      fetch('http://127.0.0.1:7712/ingest/07d2e8ff-a49f-4678-98e7-a4ff4c518e7d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'782931'},body:JSON.stringify({sessionId:'782931',location:'EntitiesTab.tsx:54',message:'Fetch response received',data:{ok:res.ok,status:res.status},timestamp:Date.now(),hypothesisId:'C',runId:'post-fix'})}).catch(()=>{});
      // #endregion
      if (!res.ok) throw new Error("Failed to fetch entities");
      const data = await res.json();
      setEntities(data);
    } catch (error) {
      console.error("Failed to fetch entities:", error);
      // #region agent log
      fetch('http://127.0.0.1:7712/ingest/07d2e8ff-a49f-4678-98e7-a4ff4c518e7d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'782931'},body:JSON.stringify({sessionId:'782931',location:'EntitiesTab.tsx:58',message:'Fetch entities error',data:{error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),hypothesisId:'C',runId:'post-fix'})}).catch(()=>{});
      // #endregion
      toast.error("Failed to load entities");
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingEntity(null);
    setFormData({
      code: "",
      name: "",
      shortName: "",
      jurisdiction: "",
      regulator: "",
    });
    setFormErrors({});
    setShowModal(true);
  };

  const openEditModal = (entity: Entity) => {
    setEditingEntity(entity);
    setFormData({
      code: entity.code,
      name: entity.name,
      shortName: entity.shortName,
      jurisdiction: entity.jurisdiction,
      regulator: entity.regulator,
      isActive: entity.isActive,
    });
    setFormErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingEntity(null);
    setFormData({
      code: "",
      name: "",
      shortName: "",
      jurisdiction: "",
      regulator: "",
    });
    setFormErrors({});
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof EntityFormData, string>> = {};

    if (!formData.code.trim()) {
      errors.code = "Code is required";
    } else if (!/^[A-Z0-9_]+$/.test(formData.code)) {
      errors.code = "Code must contain only uppercase letters, numbers, and underscores";
    }

    if (!formData.name.trim()) {
      errors.name = "Name is required";
    }

    if (!formData.shortName.trim()) {
      errors.shortName = "Short name is required";
    }

    if (!formData.jurisdiction.trim()) {
      errors.jurisdiction = "Jurisdiction is required";
    }

    if (!formData.regulator.trim()) {
      errors.regulator = "Regulator is required";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);

      if (editingEntity) {
        const res = await fetch(`/api/admin/entities/${editingEntity.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Failed to update entity");
        }

        toast.success("Entity updated successfully");
      } else {
        const res = await fetch("/api/admin/entities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Failed to create entity");
        }

        toast.success("Entity created successfully");
      }

      closeModal();
      fetchEntities();
    } catch (error) {
      console.error("Error saving entity:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save entity");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (entity: Entity) => {
    const newStatus = !entity.isActive;
    const action = newStatus ? "activate" : "deactivate";

    if (!newStatus && !confirm(`Are you sure you want to deactivate ${entity.name}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/entities/${entity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newStatus }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || `Failed to ${action} entity`);
      }

      toast.success(`Entity ${action}d successfully`);
      fetchEntities();
    } catch (error) {
      console.error(`Error ${action} entity:`, error);
      toast.error(error instanceof Error ? error.message : `Failed to ${action} entity`);
    }
  };

  if (loading) {
    return (
      <div className="rounded-[14px] border bg-white p-12 text-center" style={{ borderColor: "var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Loading entities...
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header with Add button */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Entity Configuration
            </h3>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              Manage legal entities and their regulatory details
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity"
            style={{ backgroundColor: "var(--blue)" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            <Plus size={16} />
            Add Entity
          </button>
        </div>

        {/* Entities Table */}
        <div className="rounded-[14px] border bg-white" style={{ borderColor: "var(--border)" }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    Full Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    Jurisdiction
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    Regulator
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    Users
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    Sources
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
                {entities.map((entity) => (
                  <tr
                    key={entity.id}
                    className="transition-colors hover:bg-[var(--bg-hover)]"
                    style={{ borderBottom: "1px solid var(--border-light)" }}
                  >
                    <td className="px-4 py-3">
                      <EntityBadge entityCode={entity.code as "DIEL" | "DGL" | "DBVI" | "FINSERV" | "GROUP"} />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          {entity.name}
                        </div>
                        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {entity.shortName}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                        {entity.jurisdiction}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                        {entity.regulator}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}
                      >
                        {entity._count?.userAccess || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}
                      >
                        {entity._count?.sourceLinks || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleActive(entity)}
                        className="mx-auto flex items-center transition-opacity"
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                      >
                        {entity.isActive ? (
                          <CheckCircle size={18} style={{ color: "var(--green)" }} />
                        ) : (
                          <XCircle size={18} style={{ color: "var(--text-muted)" }} />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openEditModal(entity)}
                        className="rounded-lg p-2 transition-colors hover:bg-[var(--bg-subtle)]"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <Edit2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {entities.length === 0 && (
            <div className="p-12 text-center">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No entities found
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Entity Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-lg rounded-[14px] bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                {editingEntity ? "Edit Entity" : "Add Entity"}
              </h3>
              <button
                onClick={closeModal}
                className="rounded-lg p-1 transition-colors hover:bg-[var(--bg-subtle)]"
                style={{ color: "var(--text-secondary)" }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  Code *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: formErrors.code ? "var(--red)" : "var(--border)" }}
                  placeholder="e.g., DIEL"
                  disabled={!!editingEntity}
                />
                {formErrors.code && (
                  <p className="mt-1 text-xs" style={{ color: "var(--red)" }}>
                    {formErrors.code}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: formErrors.name ? "var(--red)" : "var(--border)" }}
                  placeholder="e.g., D&G Insurance Everest Limited"
                />
                {formErrors.name && (
                  <p className="mt-1 text-xs" style={{ color: "var(--red)" }}>
                    {formErrors.name}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  Short Name *
                </label>
                <input
                  type="text"
                  value={formData.shortName}
                  onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: formErrors.shortName ? "var(--red)" : "var(--border)" }}
                  placeholder="e.g., DIEL"
                />
                {formErrors.shortName && (
                  <p className="mt-1 text-xs" style={{ color: "var(--red)" }}>
                    {formErrors.shortName}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  Jurisdiction *
                </label>
                <input
                  type="text"
                  value={formData.jurisdiction}
                  onChange={(e) => setFormData({ ...formData, jurisdiction: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: formErrors.jurisdiction ? "var(--red)" : "var(--border)" }}
                  placeholder="e.g., Bermuda"
                />
                {formErrors.jurisdiction && (
                  <p className="mt-1 text-xs" style={{ color: "var(--red)" }}>
                    {formErrors.jurisdiction}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  Regulator *
                </label>
                <input
                  type="text"
                  value={formData.regulator}
                  onChange={(e) => setFormData({ ...formData, regulator: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: formErrors.regulator ? "var(--red)" : "var(--border)" }}
                  placeholder="e.g., BMA"
                />
                {formErrors.regulator && (
                  <p className="mt-1 text-xs" style={{ color: "var(--red)" }}>
                    {formErrors.regulator}
                  </p>
                )}
              </div>

              {editingEntity && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="h-4 w-4 rounded"
                  />
                  <label htmlFor="isActive" className="text-sm" style={{ color: "var(--text-primary)" }}>
                    Active
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity"
                  style={{ backgroundColor: "var(--blue)" }}
                  disabled={submitting}
                  onMouseEnter={(e) => !submitting && (e.currentTarget.style.opacity = "0.9")}
                  onMouseLeave={(e) => !submitting && (e.currentTarget.style.opacity = "1")}
                >
                  {submitting ? "Saving..." : editingEntity ? "Update Entity" : "Create Entity"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
