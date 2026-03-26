"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEntity } from "@/contexts/EntityContext";
import { Plus, FileText, SlidersHorizontal, ChevronDown, ChevronUp, X, Search, Trash2 } from "lucide-react";
import { EntityBadge } from "@/components/ui/EntityBadge";
import toast from "@/lib/toast";

type Source = {
  id: string;
  code: string;
  name: string;
  sourceType: string;
  issuingAuthority: {
    id: string;
    name: string;
    abbreviation: string | null;
    country: string | null;
  } | null;
  status: string;
  effectiveDate?: string | null;
  reviewDate?: string | null;
  defaultFrequency: string;
  team: {
    id: string;
    name: string;
    approvalRequired: boolean;
  };
  entities: Array<{
    entity: {
      id: string;
      code: string;
      name: string;
    };
  }>;
  stats: {
    totalTasks: number;
    completedTasks: number;
    totalItems: number;
    totalFindings: number;
    completionPercentage: number;
  };
};

const SOURCE_TYPE_COLORS = {
  REGULATION: { bg: "var(--red-light)", color: "var(--red)", label: "Regulation" },
  INDUSTRY_STANDARD: { bg: "var(--blue-light)", color: "var(--blue)", label: "Industry Standard" },
  INTERNAL_AUDIT: { bg: "var(--purple-light)", color: "var(--purple)", label: "Internal Audit" },
  BOARD_DIRECTIVE: { bg: "var(--amber-light)", color: "var(--amber)", label: "Board Directive" },
  INTERNAL_POLICY: { bg: "var(--green-light)", color: "var(--green)", label: "Internal Policy" },
  CONTRACTUAL_OBLIGATION: { bg: "var(--teal-light)", color: "var(--teal)", label: "Contractual Obligation" },
  REGULATORY_GUIDANCE: { bg: "#FFF3E0", color: "#E65100", label: "Regulatory Guidance" },
};

export function SourcesClient() {
  const router = useRouter();
  const { data: session } = useSession();
  const { selectedEntityId, selectedTeamId } = useEntity();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [sourceToDelete, setSourceToDelete] = useState<Source | null>(null);
  const [deleteConfirmCode, setDeleteConfirmCode] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [filters, setFilters] = useState({
    sourceType: "",
    entityCode: "",
    teamId: "",
    status: "",
  });

  useEffect(() => {
    fetchSources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEntityId, selectedTeamId]);

  const fetchSources = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      // Apply entity filter from context
      if (selectedEntityId !== "GROUP") {
        params.set("entityId", selectedEntityId);
      }
      
      // Apply team filter from context
      if (selectedTeamId !== "ALL") {
        params.set("teamId", selectedTeamId);
      }
      
      const res = await fetch(`/api/sources?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch sources");
      const data = await res.json();
      setSources(data);
    } catch (error) {
      console.error("Error fetching sources:", error);
      toast.error("Failed to load sources");
    } finally {
      setLoading(false);
    }
  };

  const handleViewTasks = (source: Source) => {
    router.push(`/sources/${source.id}`);
  };

  const handleDeleteClick = (source: Source) => {
    setSourceToDelete(source);
    setDeleteConfirmCode("");
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!sourceToDelete || deleteConfirmCode !== sourceToDelete.code) {
      toast.error("Source code does not match");
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/sources/${sourceToDelete.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        let errorMessage = "Failed to delete source";
        try {
          const data = await res.json();
          errorMessage = data.error || errorMessage;
        } catch {
          errorMessage = `Failed to delete source (${res.status})`;
        }
        throw new Error(errorMessage);
      }

      setSources(sources.filter(s => s.id !== sourceToDelete.id));
      toast.success("Source deleted successfully");
      setDeleteConfirmOpen(false);
      setSourceToDelete(null);
      setDeleteConfirmCode("");
    } catch (error) {
      console.error("Error deleting source:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete source");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setSourceToDelete(null);
    setDeleteConfirmCode("");
  };

  const isSuperAdmin = session?.user?.roleName === "SUPER_ADMIN";

  const typeConfig = (type: string) => SOURCE_TYPE_COLORS[type as keyof typeof SOURCE_TYPE_COLORS] || SOURCE_TYPE_COLORS.REGULATION;

  // Get unique teams from sources for filter
  const uniqueTeams = useMemo(() => {
    const teams = sources.map(s => s.team);
    return Array.from(new Map(teams.map(t => [t.id, t])).values());
  }, [sources]);

  // Get unique entities from sources for filter
  const uniqueEntities = useMemo(() => {
    const entities = sources.flatMap(s => s.entities.map(e => e.entity));
    return Array.from(new Map(entities.map(e => [e.code, e])).values());
  }, [sources]);

  // Filter and search sources
  const filteredSources = useMemo(() => {
    return sources.filter(source => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          source.name.toLowerCase().includes(query) ||
          source.code.toLowerCase().includes(query) ||
          (source.issuingAuthority?.name.toLowerCase().includes(query) || false) ||
          (source.issuingAuthority?.abbreviation?.toLowerCase().includes(query) || false);
        if (!matchesSearch) return false;
      }

      // Source type filter
      if (filters.sourceType && source.sourceType !== filters.sourceType) {
        return false;
      }

      // Entity filter
      if (filters.entityCode) {
        const hasEntity = source.entities.some(e => e.entity.code === filters.entityCode);
        if (!hasEntity) return false;
      }

      // Team filter
      if (filters.teamId && source.team.id !== filters.teamId) {
        return false;
      }

      // Status filter (based on completion percentage)
      if (filters.status) {
        if (filters.status === "completed" && source.stats.completionPercentage < 100) return false;
        if (filters.status === "in-progress" && (source.stats.completionPercentage === 0 || source.stats.completionPercentage === 100)) return false;
        if (filters.status === "not-started" && source.stats.completionPercentage > 0) return false;
      }

      return true;
    });
  }, [sources, searchQuery, filters]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            Sources
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            Manage compliance sources and generate tasks
          </p>
        </div>
        <button
          onClick={() => router.push("/sources/new")}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity"
          style={{ backgroundColor: "var(--blue)" }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <Plus size={18} />
          New Source
        </button>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Search sources by name, code, or authority..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-lg border bg-white pl-9 pr-3 text-sm outline-none transition-all focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue-light)]"
              style={{ borderColor: "var(--border)" }}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-all ${
              showFilters ? "border-[var(--blue)] bg-[var(--blue-light)] text-[var(--blue)]" : "border-[var(--border)] bg-white text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            <SlidersHorizontal size={16} />
            Filters
            {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Advanced Filters Panel */}
        {showFilters && (
          <div className="rounded-lg border bg-white p-4 space-y-4" style={{ borderColor: "var(--border)" }}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Source Type Filter */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
                  Source Type
                </label>
                <select
                  value={filters.sourceType}
                  onChange={(e) => setFilters({ ...filters, sourceType: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                >
                  <option value="">All Types</option>
                  {Object.entries(SOURCE_TYPE_COLORS).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Entity Filter */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
                  Entity
                </label>
                <select
                  value={filters.entityCode}
                  onChange={(e) => setFilters({ ...filters, entityCode: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                >
                  <option value="">All Entities</option>
                  {uniqueEntities.map(entity => (
                    <option key={entity.code} value={entity.code}>
                      {entity.code} - {entity.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Team Filter */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
                  Team
                </label>
                <select
                  value={filters.teamId}
                  onChange={(e) => setFilters({ ...filters, teamId: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                >
                  <option value="">All Teams</option>
                  {uniqueTeams.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
                  Progress Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                >
                  <option value="">All Status</option>
                  <option value="not-started">Not Started (0%)</option>
                  <option value="in-progress">In Progress (1-99%)</option>
                  <option value="completed">Completed (100%)</option>
                </select>
              </div>
            </div>

            {/* Clear Filters Button */}
            <div className="flex justify-between items-center">
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Showing {filteredSources.length} of {sources.length} sources
              </p>
              <button
                onClick={() => {
                  setFilters({ sourceType: "", entityCode: "", teamId: "", status: "" });
                  setSearchQuery("");
                }}
                className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--bg-subtle)]"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                <X size={14} />
                Clear All Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex h-96 items-center justify-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Loading sources...
          </p>
        </div>
      ) : filteredSources.length === 0 ? (
        <div className="flex h-96 flex-col items-center justify-center rounded-[14px] border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-subtle)" }}>
          <FileText size={64} style={{ color: "var(--text-muted)", marginBottom: 16 }} />
          <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
            No sources match your filters
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            {selectedEntityId !== "GROUP" || selectedTeamId !== "ALL"
              ? "Try adjusting your entity/team filter or search criteria"
              : "Try adjusting your search or filter criteria"}
          </p>
          <button
            onClick={() => {
              setFilters({ sourceType: "", entityCode: "", teamId: "", status: "" });
              setSearchQuery("");
            }}
            className="mt-4 flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            <X size={18} />
            Clear Filters
          </button>
        </div>
      ) : sources.length === 0 ? (
        <div className="flex h-96 flex-col items-center justify-center rounded-[14px] border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-subtle)" }}>
          <FileText size={64} style={{ color: "var(--text-muted)", marginBottom: 16 }} />
          <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
            No sources found
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            {selectedEntityId !== "GROUP" 
              ? "No sources available for the selected entity"
              : "Create your first compliance source to get started"}
          </p>
          {selectedEntityId === "GROUP" && (
            <button
              onClick={() => router.push("/sources/new")}
              className="mt-4 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: "var(--blue)" }}
            >
              <Plus size={18} />
              Create Source
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-[14px] border bg-white overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: "var(--bg-subtle)", borderBottom: "1px solid var(--border)" }}>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                    Source
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                    Entities
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                    Issuing Authority
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                    Team
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                    Tasks
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                    Progress
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSources.map((source) => {
                  const typeStyle = typeConfig(source.sourceType);
                  const isLowCompletion = source.stats.completionPercentage < 50;
                  const progressColor = isLowCompletion ? "var(--amber)" : "var(--green)";

                  return (
                    <tr
                      key={source.id}
                      className="cursor-pointer transition-colors"
                      style={{ borderBottom: "1px solid var(--border-light)" }}
                      onClick={() => router.push(`/sources/${source.id}`)}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      {/* Source Name & Code */}
                      <td className="px-4 py-4">
                        <div>
                          <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
                            {source.name}
                          </div>
                          <div className="text-xs font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>
                            {source.code}
                          </div>
                        </div>
                      </td>

                      {/* Source Type */}
                      <td className="px-4 py-4">
                        <span
                          className="inline-block rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap"
                          style={{
                            backgroundColor: typeStyle.bg,
                            color: typeStyle.color,
                          }}
                        >
                          {typeStyle.label}
                        </span>
                      </td>

                      {/* Entities */}
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1">
                          {source.entities.map((se) => (
                            <EntityBadge key={se.entity.id} entityCode={se.entity.code as "DIEL" | "DGL" | "DBVI" | "FINSERV" | "GROUP"} />
                          ))}
                        </div>
                      </td>

                      {/* Issuing Authority */}
                      <td className="px-4 py-4">
                        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                          {source.issuingAuthority
                            ? source.issuingAuthority.abbreviation || source.issuingAuthority.name
                            : "—"}
                        </span>
                      </td>

                      {/* Team */}
                      <td className="px-4 py-4">
                        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                          {source.team.name}
                        </span>
                      </td>

                      {/* Tasks */}
                      <td className="px-4 py-4">
                        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          {source.stats.completedTasks}/{source.stats.totalTasks}
                        </span>
                      </td>

                      {/* Progress */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold min-w-[3ch]" style={{ color: progressColor }}>
                            {source.stats.completionPercentage}%
                          </span>
                          <div className="h-2 w-20 overflow-hidden rounded-full" style={{ backgroundColor: "var(--bg-muted)" }}>
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${source.stats.completionPercentage}%`,
                                backgroundColor: progressColor,
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleViewTasks(source)}
                            className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
                            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                          >
                            View Details
                          </button>
                          {isSuperAdmin && (
                            <button
                              onClick={() => handleDeleteClick(source)}
                              className="rounded-lg border px-2 py-1.5 transition-colors"
                              style={{ borderColor: "var(--border)", color: "var(--red)" }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = "var(--red-light)";
                                e.currentTarget.style.borderColor = "var(--red)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = "transparent";
                                e.currentTarget.style.borderColor = "var(--border)";
                              }}
                              title="Delete Source"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmOpen && sourceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-[14px] bg-white p-6 shadow-lg" style={{ borderColor: "var(--border)" }}>
            <div className="mb-4">
              <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                Delete Source
              </h3>
              <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                Are you sure you want to delete <span className="font-semibold">{sourceToDelete.name}</span>?
              </p>
              <p className="mt-2 text-sm" style={{ color: "var(--red)" }}>
                This will permanently delete the source and all its items, tasks, findings, and evidence. This action cannot be undone.
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
                Type <span className="font-mono font-semibold">{sourceToDelete.code}</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmCode}
                onChange={(e) => setDeleteConfirmCode(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm font-mono outline-none transition-colors focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue-light)]"
                style={{ borderColor: "var(--border)" }}
                placeholder={sourceToDelete.code}
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleDeleteCancel}
                disabled={isDeleting}
                className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                onMouseEnter={(e) => !isDeleting && (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting || deleteConfirmCode !== sourceToDelete.code}
                className="flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
                style={{ backgroundColor: "var(--red)" }}
                onMouseEnter={(e) => !isDeleting && deleteConfirmCode === sourceToDelete.code && (e.currentTarget.style.opacity = "0.9")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                {isDeleting ? "Deleting..." : "Delete Source"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
