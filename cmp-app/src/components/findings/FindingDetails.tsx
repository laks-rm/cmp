"use client";

type FindingDetailsProps = {
  finding: {
    description: string | null;
    rootCause: string | null;
    impact: string | null;
    managementResponse: string | null;
    closureNote: string | null;
  };
  canEdit: boolean;
  onFieldChange: (field: string, value: string) => void;
  onFieldSave: (field: string) => void;
};

export function FindingDetails({ finding, canEdit, onFieldChange, onFieldSave }: FindingDetailsProps) {
  return (
    <div className="space-y-6">
      {/* Description */}
      <div>
        <label className="mb-2 block text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Finding Description
        </label>
        <textarea
          value={finding.description || ""}
          onChange={(e) => onFieldChange("description", e.target.value)}
          onBlur={() => onFieldSave("description")}
          placeholder="Detailed description of the finding..."
          rows={4}
          disabled={!canEdit}
          className="w-full rounded-lg border px-4 py-3 text-sm transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            borderColor: "var(--border)",
            backgroundColor: canEdit ? "white" : "var(--bg-subtle)",
            color: "var(--text-primary)",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--blue)")}
        />
      </div>

      {/* Root Cause */}
      <div>
        <label className="mb-2 block text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Root Cause
        </label>
        <textarea
          value={finding.rootCause || ""}
          onChange={(e) => onFieldChange("rootCause", e.target.value)}
          onBlur={() => onFieldSave("rootCause")}
          placeholder="Underlying cause of the issue..."
          rows={3}
          disabled={!canEdit}
          className="w-full rounded-lg border px-4 py-3 text-sm transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            borderColor: "var(--border)",
            backgroundColor: canEdit ? "white" : "var(--bg-subtle)",
            color: "var(--text-primary)",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--blue)")}
        />
      </div>

      {/* Impact Assessment */}
      <div>
        <label className="mb-2 block text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Impact Assessment
        </label>
        <textarea
          value={finding.impact || ""}
          onChange={(e) => onFieldChange("impact", e.target.value)}
          onBlur={() => onFieldSave("impact")}
          placeholder="Potential or actual impact..."
          rows={3}
          disabled={!canEdit}
          className="w-full rounded-lg border px-4 py-3 text-sm transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            borderColor: "var(--border)",
            backgroundColor: canEdit ? "white" : "var(--bg-subtle)",
            color: "var(--text-primary)",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--blue)")}
        />
      </div>

      {/* Management Response / Remediation Plan */}
      <div>
        <label className="mb-2 block text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Remediation Plan / Management Response
        </label>
        <textarea
          value={finding.managementResponse || ""}
          onChange={(e) => onFieldChange("managementResponse", e.target.value)}
          onBlur={() => onFieldSave("managementResponse")}
          placeholder="Planned remediation actions..."
          rows={4}
          disabled={!canEdit}
          className="w-full rounded-lg border px-4 py-3 text-sm transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            borderColor: "var(--border)",
            backgroundColor: canEdit ? "white" : "var(--bg-subtle)",
            color: "var(--text-primary)",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--blue)")}
        />
      </div>

      {/* Closure Note (read-only or shown when closed) */}
      {finding.closureNote && (
        <div>
          <label className="mb-2 block text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Closure Note
          </label>
          <div className="rounded-lg border p-4 text-sm" style={{ backgroundColor: "var(--bg-subtle)", borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            {finding.closureNote}
          </div>
        </div>
      )}
    </div>
  );
}
