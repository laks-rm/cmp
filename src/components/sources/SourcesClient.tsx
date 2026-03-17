"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, CheckSquare, AlertTriangle, TrendingUp, FileText, SlidersHorizontal, ChevronDown, ChevronUp, X, Search } from "lucide-react";
import { EntityBadge } from "@/components/ui/EntityBadge";
import { SourceWizard } from "@/components/sources/SourceWizard";
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
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedSourceForTasks, setSelectedSourceForTasks] = useState<Source | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    sourceType: "",
    entityCode: "",
    teamId: "",
    status: "",
  });

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/sources");
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
    router.push(`/sources/${source.id}/tasks`);
  };

  const handleAddTasks = (source: Source) => {
    setSelectedSourceForTasks(source);
    setWizardOpen(true);
  };

  const handleWizardClose = () => {
    setWizardOpen(false);
    setSelectedSourceForTasks(null);
    fetchSources();
  };

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
          onClick={() => setWizardOpen(true)}
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
      ) : sources.length === 0 ? (
        <div className="flex h-96 flex-col items-center justify-center rounded-[14px] border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-subtle)" }}>
          <FileText size={64} style={{ color: "var(--text-muted)", marginBottom: 16 }} />
          <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
            No sources yet
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Create your first compliance source to get started
          </p>
          <button
            onClick={() => setWizardOpen(true)}
            className="mt-4 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: "var(--blue)" }}
          >
            <Plus size={18} />
            Create Source
          </button>
        </div>
      ) : filteredSources.length === 0 ? (
        <div className="flex h-96 flex-col items-center justify-center rounded-[14px] border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-subtle)" }}>
          <FileText size={64} style={{ color: "var(--text-muted)", marginBottom: 16 }} />
          <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
            No sources match your filters
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Try adjusting your search or filter criteria
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
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {filteredSources.map((source) => {
            const typeStyle = typeConfig(source.sourceType);
            const isLowCompletion = source.stats.completionPercentage < 50;

            return (
              <div
                key={source.id}
                className="group rounded-[14px] border bg-white p-6 shadow-sm transition-all hover:shadow-md"
                style={{ borderColor: "var(--border)" }}
              >
                {/* Header */}
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className="rounded-md px-2 py-1 text-xs font-medium"
                        style={{
                          backgroundColor: typeStyle.bg,
                          color: typeStyle.color,
                        }}
                      >
                        {typeStyle.label}
                      </span>
                      {source.entities.map((se) => (
                        <EntityBadge key={se.entity.id} entityCode={se.entity.code as "DIEL" | "DGL" | "DBVI" | "FINSERV" | "GROUP"} />
                      ))}
                    </div>
                    <h3 className="text-lg font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
                      {source.name}
                    </h3>
                    <p className="mt-1 text-sm font-mono" style={{ color: "var(--text-muted)" }}>
                      {source.code}
                    </p>
                    {source.issuingAuthority && (
                      <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                        {source.issuingAuthority.abbreviation 
                          ? `${source.issuingAuthority.abbreviation} — ${source.issuingAuthority.name}`
                          : source.issuingAuthority.name}
                      </p>
                    )}
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="mb-4 grid grid-cols-3 gap-3">
                  <div className="rounded-lg p-3" style={{ backgroundColor: "var(--bg-subtle)" }}>
                    <div className="flex items-center gap-2">
                      <CheckSquare size={16} style={{ color: "var(--blue)" }} />
                      <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                        Tasks
                      </span>
                    </div>
                    <p className="mt-1 text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                      {source.stats.completedTasks}/{source.stats.totalTasks}
                    </p>
                  </div>
                  <div className="rounded-lg p-3" style={{ backgroundColor: "var(--bg-subtle)" }}>
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={16} style={{ color: "var(--amber)" }} />
                      <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                        Findings
                      </span>
                    </div>
                    <p className="mt-1 text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                      {source.stats.totalFindings}
                    </p>
                  </div>
                  <div className="rounded-lg p-3" style={{ backgroundColor: "var(--bg-subtle)" }}>
                    <div className="flex items-center gap-2">
                      <TrendingUp size={16} style={{ color: isLowCompletion ? "var(--red)" : "var(--green)" }} />
                      <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                        Progress
                      </span>
                    </div>
                    <p className="mt-1 text-lg font-bold" style={{ color: isLowCompletion ? "var(--red)" : "var(--green)" }}>
                      {source.stats.completionPercentage}%
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4 h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: "var(--bg-muted)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${source.stats.completionPercentage}%`,
                      backgroundColor: isLowCompletion ? "var(--amber)" : "var(--green)",
                    }}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleViewTasks(source)}
                    className="flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    View Tasks
                  </button>
                  <button
                    onClick={() => handleAddTasks(source)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white transition-opacity"
                    style={{ backgroundColor: "var(--blue)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                  >
                    <Plus size={16} />
                    Add Tasks
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {wizardOpen && (
        <SourceWizard
          isOpen={wizardOpen}
          onClose={handleWizardClose}
          existingSource={selectedSourceForTasks || undefined}
        />
      )}
    </div>
  );
}
