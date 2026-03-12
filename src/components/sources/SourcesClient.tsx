"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, CheckSquare, AlertTriangle, TrendingUp, FileText } from "lucide-react";
import { EntityBadge } from "@/components/ui/EntityBadge";
import { SourceWizard } from "@/components/sources/SourceWizard";
import toast from "react-hot-toast";

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
    router.push(`/tasks?sourceId=${source.id}`);
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
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {sources.map((source) => {
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
