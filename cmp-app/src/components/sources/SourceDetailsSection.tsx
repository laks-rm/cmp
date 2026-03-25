"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { EntityBadge } from "@/components/ui/EntityBadge";
import type { Team, Entity, IssuingAuthority } from "@/types/source-management";
import { SOURCE_TYPE_LABELS, SOURCE_TYPE_COLORS, generateSourceCode } from "@/types/source-management";

type SourceDetailsProps = {
  mode: "edit" | "collapsed";
  sourceType: string;
  sourceName: string;
  sourceCode: string;
  selectedEntityIds: string[];
  teamId: string;
  issuingAuthorityId: string;
  effectiveDate: string;
  reviewDate: string;
  teams: Team[];
  entities: Entity[];
  issuingAuthorities: IssuingAuthority[];
  onSave: () => void;
  onCancel?: () => void;
  onChange: (field: string, value: string | string[]) => void;
};

export function SourceDetailsSection({
  mode,
  sourceType,
  sourceName,
  sourceCode,
  selectedEntityIds,
  teamId,
  issuingAuthorityId,
  effectiveDate,
  reviewDate,
  teams,
  entities,
  issuingAuthorities,
  onSave,
  onCancel,
  onChange,
}: SourceDetailsProps) {
  const [entityDropdownOpen, setEntityDropdownOpen] = useState(false);
  const [authorityDropdownOpen, setAuthorityDropdownOpen] = useState(false);
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);
  const [entitySearchQuery, setEntitySearchQuery] = useState("");
  const [authoritySearchQuery, setAuthoritySearchQuery] = useState("");
  const [teamSearchQuery, setTeamSearchQuery] = useState("");

  useEffect(() => {
    if (sourceName && !sourceCode) {
      onChange("sourceCode", generateSourceCode(sourceName));
    }
  }, [sourceName, sourceCode, onChange]);

  if (mode === "collapsed") {
    const typeConfig = SOURCE_TYPE_COLORS[sourceType as keyof typeof SOURCE_TYPE_COLORS];
    const selectedTeam = teams.find((t) => t.id === teamId);
    const selectedAuthority = issuingAuthorities.find((a) => a.id === issuingAuthorityId);
    const selectedEntities = entities.filter((e) => selectedEntityIds.includes(e.id));

    return (
      <div
        className="rounded-[14px] border bg-white p-6"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-3">
              <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                {sourceName}
              </h2>
              <span
                className="rounded-md px-2 py-0.5 font-mono text-xs font-medium"
                style={{ backgroundColor: "var(--bg-muted)", color: "var(--text-secondary)" }}
              >
                {sourceCode}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              <span
                className="inline-block rounded-md px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: typeConfig.bg, color: typeConfig.color }}
              >
                {typeConfig.label}
              </span>
              <span>·</span>
                <div className="flex gap-1">
                  {selectedEntities.map((entity) => (
                    <EntityBadge key={entity.id} entityCode={entity.code as "DIEL" | "DGL" | "DBVI" | "FINSERV" | "GROUP"} />
                  ))}
                </div>
              {selectedAuthority && (
                <>
                  <span>·</span>
                  <span>{selectedAuthority.abbreviation || selectedAuthority.name}</span>
                </>
              )}
              {selectedTeam && (
                <>
                  <span>·</span>
                  <span>{selectedTeam.name}</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-sm font-medium transition-colors"
            style={{ color: "var(--blue)" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Edit details
          </button>
        </div>
      </div>
    );
  }

  const filteredEntities = entities.filter((e) =>
    `${e.code} ${e.name}`.toLowerCase().includes(entitySearchQuery.toLowerCase())
  );

  const filteredAuthorities = issuingAuthorities.filter((a) =>
    `${a.name} ${a.abbreviation || ""}`.toLowerCase().includes(authoritySearchQuery.toLowerCase())
  );

  const filteredTeams = teams.filter((t) =>
    t.name.toLowerCase().includes(teamSearchQuery.toLowerCase())
  );

  const canSave = sourceName.trim() && selectedEntityIds.length > 0 && teamId;

  return (
    <div className="rounded-[14px] border bg-white p-6" style={{ borderColor: "var(--border)" }}>
      <h3 className="mb-4 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        Source Details
      </h3>

      <div className="grid grid-cols-3 gap-4">
        {/* Source Type */}
        <div>
          <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Source Type <span style={{ color: "var(--red)" }}>*</span>
          </label>
          <select
            value={sourceType}
            onChange={(e) => onChange("sourceType", e.target.value)}
            className="h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue-light)]"
            style={{ borderColor: "var(--border)" }}
          >
            {Object.entries(SOURCE_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Determines item labels (e.g. clauses, findings, directives)
          </p>
        </div>

        {/* Applicable Entities */}
        <div className="relative">
          <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Applicable Entities <span style={{ color: "var(--red)" }}>*</span>
          </label>
          <button
            onClick={() => setEntityDropdownOpen(!entityDropdownOpen)}
            className="flex h-10 w-full items-center justify-between rounded-lg border px-3 text-sm transition-colors"
            style={{ borderColor: entityDropdownOpen ? "var(--blue)" : "var(--border)" }}
          >
            <span style={{ color: selectedEntityIds.length > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>
              {selectedEntityIds.length > 0 ? `${selectedEntityIds.length} selected` : "Select entities"}
            </span>
            <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />
          </button>
          {selectedEntityIds.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {entities.filter((e) => selectedEntityIds.includes(e.id)).map((entity) => (
                <EntityBadge key={entity.id} entityCode={entity.code as "DIEL" | "DGL" | "DBVI" | "FINSERV" | "GROUP"} />
              ))}
            </div>
          )}
          {entityDropdownOpen && (
            <div
              className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border bg-white shadow-lg"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="sticky top-0 bg-white p-2">
                <input
                  type="text"
                  placeholder="Search entities..."
                  value={entitySearchQuery}
                  onChange={(e) => setEntitySearchQuery(e.target.value)}
                  className="h-8 w-full rounded-lg border px-2 text-sm outline-none"
                  style={{ borderColor: "var(--border)" }}
                />
              </div>
              <div className="p-1">
                {filteredEntities.map((entity) => (
                  <label
                    key={entity.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-hover)]"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEntityIds.includes(entity.id)}
                      onChange={(e) => {
                        const newIds = e.target.checked
                          ? [...selectedEntityIds, entity.id]
                          : selectedEntityIds.filter((id) => id !== entity.id);
                        onChange("selectedEntityIds", newIds);
                      }}
                      className="rounded"
                    />
                    <EntityBadge entityCode={entity.code as "DIEL" | "DGL" | "DBVI" | "FINSERV" | "GROUP"} />
                    <span style={{ color: "var(--text-primary)" }}>{entity.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Applicable Team */}
        <div className="relative">
          <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Applicable Team <span style={{ color: "var(--red)" }}>*</span>
          </label>
          <button
            onClick={() => setTeamDropdownOpen(!teamDropdownOpen)}
            className="flex h-10 w-full items-center justify-between rounded-lg border px-3 text-sm transition-colors"
            style={{ borderColor: teamDropdownOpen ? "var(--blue)" : "var(--border)" }}
          >
            <span style={{ color: teamId ? "var(--text-primary)" : "var(--text-muted)" }}>
              {teamId ? teams.find((t) => t.id === teamId)?.name : "Select team"}
            </span>
            <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />
          </button>
          {teamDropdownOpen && (
            <div
              className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border bg-white shadow-lg"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="sticky top-0 bg-white p-2">
                <input
                  type="text"
                  placeholder="Search teams..."
                  value={teamSearchQuery}
                  onChange={(e) => setTeamSearchQuery(e.target.value)}
                  className="h-8 w-full rounded-lg border px-2 text-sm outline-none"
                  style={{ borderColor: "var(--border)" }}
                />
              </div>
              <div className="p-1">
                {filteredTeams.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => {
                      onChange("teamId", team.id);
                      setTeamDropdownOpen(false);
                      setTeamSearchQuery("");
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--bg-hover)]"
                  >
                    <span style={{ color: "var(--text-primary)" }}>{team.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <a
            href="/admin/teams"
            target="_blank"
            className="mt-1 flex items-center gap-1 text-xs transition-colors"
            style={{ color: "var(--blue)" }}
          >
            Manage in admin <ExternalLink size={10} />
          </a>
        </div>
      </div>

      {/* Source Name (Full Width) */}
      <div className="mt-4">
        <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Source Name <span style={{ color: "var(--red)" }}>*</span>
        </label>
        <input
          type="text"
          value={sourceName}
          onChange={(e) => onChange("sourceName", e.target.value)}
          placeholder="e.g. MAS Guidelines on Fit and Proper Criteria"
          className="h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue-light)]"
          style={{ borderColor: "var(--border)" }}
        />
      </div>

      {/* Auto-generated Source Code (Read-only Display) */}
      {sourceCode && (
        <div className="mt-4 rounded-lg border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-subtle)" }}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              Auto-generated code:
            </span>
            <span
              className="rounded-md px-2 py-0.5 font-mono text-sm font-medium"
              style={{ backgroundColor: "white", color: "var(--text-primary)", border: "1px solid var(--border)" }}
            >
              {sourceCode}
            </span>
          </div>
        </div>
      )}

      {/* Issuing Authority, Effective Date, Review Date */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        {/* Issuing Authority */}
        <div className="relative">
          <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Issuing Authority
          </label>
          <button
            onClick={() => setAuthorityDropdownOpen(!authorityDropdownOpen)}
            className="flex h-10 w-full items-center justify-between rounded-lg border px-3 text-sm transition-colors"
            style={{ borderColor: authorityDropdownOpen ? "var(--blue)" : "var(--border)" }}
          >
            <span style={{ color: issuingAuthorityId ? "var(--text-primary)" : "var(--text-muted)" }}>
              {issuingAuthorityId
                ? issuingAuthorities.find((a) => a.id === issuingAuthorityId)?.abbreviation ||
                  issuingAuthorities.find((a) => a.id === issuingAuthorityId)?.name
                : "Select authority"}
            </span>
            <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />
          </button>
          {authorityDropdownOpen && (
            <div
              className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border bg-white shadow-lg"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="sticky top-0 bg-white p-2">
                <input
                  type="text"
                  placeholder="Search authorities..."
                  value={authoritySearchQuery}
                  onChange={(e) => setAuthoritySearchQuery(e.target.value)}
                  className="h-8 w-full rounded-lg border px-2 text-sm outline-none"
                  style={{ borderColor: "var(--border)" }}
                />
              </div>
              <div className="p-1">
                {filteredAuthorities.map((authority) => (
                  <button
                    key={authority.id}
                    onClick={() => {
                      onChange("issuingAuthorityId", authority.id);
                      setAuthorityDropdownOpen(false);
                      setAuthoritySearchQuery("");
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--bg-hover)]"
                  >
                    <span style={{ color: "var(--text-primary)" }}>
                      {authority.abbreviation || authority.name}
                    </span>
                    {authority.abbreviation && authority.name !== authority.abbreviation && (
                      <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>({authority.name})</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
          <a
            href="/admin/authorities"
            target="_blank"
            className="mt-1 flex items-center gap-1 text-xs transition-colors"
            style={{ color: "var(--blue)" }}
          >
            Manage in admin <ExternalLink size={10} />
          </a>
        </div>

        {/* Effective Date */}
        <div>
          <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Effective Date
          </label>
          <input
            type="date"
            value={effectiveDate}
            onChange={(e) => onChange("effectiveDate", e.target.value)}
            className="h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue-light)]"
            style={{ borderColor: "var(--border)" }}
          />
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            When this source becomes active
          </p>
        </div>

        {/* Review Date */}
        <div>
          <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Review Date
          </label>
          <input
            type="date"
            value={reviewDate}
            onChange={(e) => onChange("reviewDate", e.target.value)}
            className="h-10 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue-light)]"
            style={{ borderColor: "var(--border)" }}
          />
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Next periodic review date
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={!canSave}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
          style={{ backgroundColor: "var(--blue)" }}
        >
          Save details
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
