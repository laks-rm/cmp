"use client";

import { useState, useEffect } from "react";
import {
  X,
  Save,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Info,
  ChevronRight,
  Loader,
} from "lucide-react";
import { EntityBadge } from "@/components/ui/EntityBadge";
import toast from "@/lib/toast";
import { fetchApi } from "@/lib/api-client";

type Entity = {
  id: string;
  code: string;
  name: string;
};

type Team = {
  id: string;
  name: string;
};

type IssuingAuthority = {
  id: string;
  name: string;
  abbreviation: string | null;
};

type Source = {
  id: string;
  code: string;
  name: string;
  sourceType: string;
  issuingAuthority: IssuingAuthority | null;
  effectiveDate: string | null;
  reviewDate: string | null;
  team: Team;
  entities: Array<{
    entity: Entity;
  }>;
  status: string;
};

type ImpactSummary = {
  addedEntities: Entity[];
  sourceItemCount: number;
  estimatedTaskTemplates: number;
  estimatedTotalTasks: number;
  message: string;
};

type RemovalWarning = {
  removedEntities: Entity[];
  existingTaskCount: number;
  warning: string;
};

type SourceEditModalProps = {
  isOpen: boolean;
  onClose: () => void;
  source: Source;
  onSaved: () => void;
};

const SOURCE_TYPES = [
  { value: "REGULATION", label: "Regulation" },
  { value: "INDUSTRY_STANDARD", label: "Industry Standard" },
  { value: "INTERNAL_AUDIT", label: "Internal Audit" },
  { value: "BOARD_DIRECTIVE", label: "Board Directive" },
  { value: "INTERNAL_POLICY", label: "Internal Policy" },
  { value: "CONTRACTUAL_OBLIGATION", label: "Contractual Obligation" },
  { value: "REGULATORY_GUIDANCE", label: "Regulatory Guidance" },
];

export function SourceEditModal({
  isOpen,
  onClose,
  source,
  onSaved,
}: SourceEditModalProps) {
  const [loading, setLoading] = useState(false);
  const [allEntities, setAllEntities] = useState<Entity[]>([]);
  const [allAuthorities, setAllAuthorities] = useState<IssuingAuthority[]>([]);
  
  // Form state
  const [name, setName] = useState(source.name);
  const [code, setCode] = useState(source.code);
  const [sourceType, setSourceType] = useState(source.sourceType);
  const [issuingAuthorityId, setIssuingAuthorityId] = useState(
    source.issuingAuthority?.id || ""
  );
  const [effectiveDate, setEffectiveDate] = useState(
    source.effectiveDate ? source.effectiveDate.split("T")[0] : ""
  );
  const [reviewDate, setReviewDate] = useState(
    source.reviewDate ? source.reviewDate.split("T")[0] : ""
  );
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>(
    source.entities.map((e) => e.entity.id)
  );

  // Impact state
  const [showImpactPreview, setShowImpactPreview] = useState(false);
  const [impactSummary, setImpactSummary] = useState<ImpactSummary | null>(null);
  const [removalWarning, setRemovalWarning] = useState<RemovalWarning | null>(null);
  const [updatedSource, setUpdatedSource] = useState<Source | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchReferenceData();
    }
  }, [isOpen]);

  const fetchReferenceData = async () => {
    try {
      const [entitiesData, authoritiesResponse] = await Promise.all([
        fetchApi<Entity[]>("/api/entities"),
        fetchApi<{ authorities: IssuingAuthority[] }>("/api/issuing-authorities"),
      ]);
      setAllEntities(Array.isArray(entitiesData) ? entitiesData : []);
      setAllAuthorities(Array.isArray(authoritiesResponse?.authorities) ? authoritiesResponse.authorities : []);
    } catch (error) {
      console.error("Failed to fetch reference data:", error);
      toast.error("Failed to load reference data");
      // Ensure arrays even on error
      setAllEntities([]);
      setAllAuthorities([]);
    }
  };

  const toggleEntity = (entityId: string) => {
    setSelectedEntityIds((prev) =>
      prev.includes(entityId)
        ? prev.filter((id) => id !== entityId)
        : [...prev, entityId]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Source name is required");
      return;
    }

    if (!code.trim()) {
      toast.error("Source code is required");
      return;
    }

    if (selectedEntityIds.length === 0) {
      toast.error("At least one entity must be selected");
      return;
    }

    setLoading(true);

    try {
      const payload: any = {
        name: name.trim(),
        code: code.trim(),
        sourceType,
        issuingAuthorityId: issuingAuthorityId || null,
        effectiveDate: effectiveDate ? new Date(effectiveDate).toISOString() : null,
        reviewDate: reviewDate ? new Date(reviewDate).toISOString() : null,
        entityIds: selectedEntityIds,
      };

      const response = await fetchApi<{
        source: Source;
        impactSummary?: ImpactSummary;
        removedEntityWarnings?: RemovalWarning;
        message: string;
      }>(`/api/sources/${source.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      // Check if there's an impact summary (entity additions)
      if (response.impactSummary) {
        setImpactSummary(response.impactSummary);
        setUpdatedSource(response.source);
        setShowImpactPreview(true);
      } else if (response.removedEntityWarnings) {
        // Show removal warnings but complete the save
        setRemovalWarning(response.removedEntityWarnings);
        toast.success("Source updated successfully");
        toast(response.removedEntityWarnings.warning, { icon: "⚠️" });
        onSaved();
        onClose();
      } else {
        // Simple metadata update
        toast.success("Source updated successfully");
        onSaved();
        onClose();
      }
    } catch (error: any) {
      console.error("Failed to save source:", error);
      toast.error(error.message || "Failed to update source");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTasks = async () => {
    if (!impactSummary || !updatedSource) return;

    setGenerating(true);

    try {
      const newEntityIds = impactSummary.addedEntities.map((e) => e.id);

      const response = await fetchApi<{
        success: boolean;
        message: string;
        tasksCreated: number;
        warnings?: string[];
      }>(`/api/sources/${source.id}/generate-for-entities`, {
        method: "POST",
        body: JSON.stringify({ entityIds: newEntityIds }),
      });

      toast.success(response.message);
      
      if (response.warnings) {
        response.warnings.forEach((warning) => {
          toast(warning, { icon: "⚠️" });
        });
      }

      onSaved();
      onClose();
      setShowImpactPreview(false);
    } catch (error: any) {
      console.error("Failed to generate tasks:", error);
      toast.error(error.message || "Failed to generate tasks for new entities");
    } finally {
      setGenerating(false);
    }
  };

  const handleSkipGeneration = () => {
    toast.success("Source updated successfully. Tasks not generated.");
    onSaved();
    onClose();
    setShowImpactPreview(false);
  };

  const originalEntityIds = new Set(source.entities.map((e) => e.entity.id));
  const addedEntityIds = selectedEntityIds.filter((id) => !originalEntityIds.has(id));
  const removedEntityIds = Array.from(originalEntityIds).filter(
    (id) => !selectedEntityIds.includes(id)
  );

  if (!isOpen) return null;

  // Impact preview screen
  if (showImpactPreview && impactSummary) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div
          className="relative w-full max-w-2xl rounded-lg shadow-xl"
          style={{ backgroundColor: "white" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b p-6" style={{ borderColor: "var(--border)" }}>
            <div>
              <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                Entity Addition Impact
              </h2>
              <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                Review the impact before generating tasks
              </p>
            </div>
            <button
              onClick={() => setShowImpactPreview(false)}
              className="rounded-lg p-2 transition-colors hover:bg-[var(--bg-subtle)]"
              style={{ color: "var(--text-secondary)" }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Summary */}
            <div
              className="rounded-lg border p-4"
              style={{ borderColor: "var(--blue)", backgroundColor: "var(--blue-light)" }}
            >
              <div className="flex items-start gap-3">
                <Info size={20} style={{ color: "var(--blue)", marginTop: "2px" }} />
                <div className="flex-1">
                  <p className="font-medium" style={{ color: "var(--blue)" }}>
                    Source Updated
                  </p>
                  <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                    {impactSummary.message}
                  </p>
                </div>
              </div>
            </div>

            {/* Added Entities */}
            <div>
              <h3 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Newly Added Entities
              </h3>
              <div className="flex flex-wrap gap-2">
                {impactSummary.addedEntities.map((entity) => (
                  <EntityBadge
                    key={entity.id}
                    entityCode={entity.code as "DIEL" | "DGL" | "DBVI" | "FINSERV" | "GROUP"}
                  />
                ))}
              </div>
            </div>

            {/* Impact Estimate */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)" }}>
                <div className="text-2xl font-bold" style={{ color: "var(--blue)" }}>
                  {impactSummary.sourceItemCount}
                </div>
                <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  Source Items
                </div>
              </div>
              <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)" }}>
                <div className="text-2xl font-bold" style={{ color: "var(--amber)" }}>
                  {impactSummary.estimatedTaskTemplates}
                </div>
                <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  Task Templates
                </div>
              </div>
              <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)" }}>
                <div className="text-2xl font-bold" style={{ color: "var(--green)" }}>
                  ~{impactSummary.estimatedTotalTasks}
                </div>
                <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  Total Tasks
                </div>
              </div>
            </div>

            {/* Important Note */}
            <div
              className="rounded-lg border p-4"
              style={{ borderColor: "var(--amber)", backgroundColor: "var(--amber-light)" }}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} style={{ color: "var(--amber)", marginTop: "2px" }} />
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    Important
                  </p>
                  <ul className="mt-2 space-y-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                    <li>• Existing entity task history will NOT be changed</li>
                    <li>• Tasks will be generated only for newly added entities</li>
                    <li>• Task generation starts from current/future dates (no backfill)</li>
                    <li>• You can skip generation and add tasks later</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t p-6" style={{ borderColor: "var(--border)" }}>
            <button
              onClick={handleSkipGeneration}
              disabled={generating}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--bg-subtle)]"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              Skip Task Generation
            </button>
            <button
              onClick={handleGenerateTasks}
              disabled={generating}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              style={{ backgroundColor: "var(--blue)", color: "white" }}
            >
              {generating ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  Generating Tasks...
                </>
              ) : (
                <>
                  <CheckCircle size={16} />
                  Generate Tasks Now
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main edit form
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg shadow-xl"
        style={{ backgroundColor: "white" }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b p-6" style={{ borderColor: "var(--border)", backgroundColor: "white" }}>
          <div>
            <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              Edit Source
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              Update source metadata and applicable entities
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-2 transition-colors hover:bg-[var(--bg-subtle)]"
            style={{ color: "var(--text-secondary)" }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-6">
          {/* Source Metadata Section */}
          <div>
            <h3 className="mb-4 text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              Source Metadata
              <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>
                (Safe to edit)
              </span>
            </h3>
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
                  Source Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  placeholder="e.g., GDPR Data Protection Regulation"
                />
              </div>

              {/* Code and Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
                    Source Code *
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full rounded-lg border px-3 py-2 text-sm font-mono outline-none transition-colors focus:border-[var(--blue)]"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                    placeholder="e.g., GDPR-2024"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
                    Source Type *
                  </label>
                  <select
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  >
                    {SOURCE_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Authority */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
                  Issuing Authority
                </label>
                <select
                  value={issuingAuthorityId}
                  onChange={(e) => setIssuingAuthorityId(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                >
                  <option value="">No authority</option>
                  {allAuthorities.map((authority) => (
                    <option key={authority.id} value={authority.id}>
                      {authority.name} {authority.abbreviation ? `(${authority.abbreviation})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
                    Effective Date
                  </label>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
                    Review Date
                  </label>
                  <input
                    type="date"
                    value={reviewDate}
                    onChange={(e) => setReviewDate(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t" style={{ borderColor: "var(--border)" }} />

          {/* Entity Applicability Section */}
          <div>
            <div className="mb-4">
              <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                Applicable Entities *
                {(addedEntityIds.length > 0 || removedEntityIds.length > 0) && (
                  <span
                    className="text-xs font-normal px-2 py-0.5 rounded"
                    style={{ backgroundColor: "var(--amber-light)", color: "var(--amber)" }}
                  >
                    Changes detected
                  </span>
                )}
              </h3>
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                Select entities this source applies to. Adding entities will trigger impact preview.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {allEntities.map((entity) => {
                const isSelected = selectedEntityIds.includes(entity.id);
                const wasOriginal = originalEntityIds.has(entity.id);
                const isAdded = isSelected && !wasOriginal;
                const isRemoved = !isSelected && wasOriginal;

                return (
                  <button
                    key={entity.id}
                    onClick={() => toggleEntity(entity.id)}
                    className={`relative flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                      isSelected ? "border-[var(--blue)] bg-[var(--blue-light)]" : "border-[var(--border)] hover:bg-[var(--bg-subtle)]"
                    }`}
                  >
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded border ${
                        isSelected ? "border-[var(--blue)] bg-[var(--blue)]" : "border-[var(--border)]"
                      }`}
                    >
                      {isSelected && <CheckCircle size={14} color="white" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <EntityBadge
                          entityCode={entity.code as "DIEL" | "DGL" | "DBVI" | "FINSERV" | "GROUP"}
                          size="sm"
                        />
                        {isAdded && (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={{ backgroundColor: "var(--green-light)", color: "var(--green)" }}
                          >
                            NEW
                          </span>
                        )}
                        {isRemoved && (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={{ backgroundColor: "var(--red-light)", color: "var(--red)" }}
                          >
                            REMOVE
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                        {entity.name}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Change Summary */}
            {(addedEntityIds.length > 0 || removedEntityIds.length > 0) && (
              <div className="mt-4 rounded-lg border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-subtle)" }}>
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} style={{ color: "var(--text-muted)", marginTop: "2px" }} />
                  <div className="flex-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                    {addedEntityIds.length > 0 && (
                      <p>
                        <strong>{addedEntityIds.length}</strong> entity/entities will be added. You'll see an impact preview before task generation.
                      </p>
                    )}
                    {removedEntityIds.length > 0 && (
                      <p className="mt-1">
                        <strong>{removedEntityIds.length}</strong> entity/entities will be removed. Existing tasks will be preserved.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex justify-end gap-3 border-t p-6" style={{ borderColor: "var(--border)", backgroundColor: "white" }}>
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--bg-subtle)]"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            style={{ backgroundColor: "var(--blue)", color: "white" }}
          >
            {loading ? (
              <>
                <Loader size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
