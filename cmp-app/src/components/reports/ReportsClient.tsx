"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, Download, FileSpreadsheet, FileDown } from "lucide-react";
import { useEntity } from "@/contexts/EntityContext";
import toast from "@/lib/toast";

type Entity = {
  id: string;
  code: string;
  name: string;
};

type Source = {
  id: string;
  name: string;
  code: string;
};

export function ReportsClient() {
  const { selectedEntityId } = useEntity();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState("all");
  const [selectedEntity, setSelectedEntity] = useState<string>("");
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [loading, setLoading] = useState(false);

  const fetchEntities = useCallback(async () => {
    try {
      const res = await fetch("/api/entities");
      if (res.ok) {
        const data = await res.json();
        setEntities(data);
      }
    } catch (error) {
      console.error("Failed to fetch entities:", error);
    }
  }, []);

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch("/api/sources");
      if (res.ok) {
        const data = await res.json();
        setSources(data);
      }
    } catch (error) {
      console.error("Failed to fetch sources:", error);
    }
  }, []);

  useEffect(() => {
    fetchEntities();
    fetchSources();
  }, [fetchEntities, fetchSources]);

  useEffect(() => {
    if (selectedEntityId && selectedEntityId !== "GROUP") {
      setSelectedEntity(selectedEntityId);
    }
  }, [selectedEntityId]);

  const handleExport = async (format: "csv" | "xlsx" | "pdf", reportType: string) => {
    try {
      setLoading(true);

      if (reportType !== "cmp-extract") {
        toast("Coming soon!", { icon: "⏳" });
        return;
      }

      const params = new URLSearchParams();
      params.set("format", format);
      if (selectedEntity && selectedEntity !== "all") params.set("entityId", selectedEntity);
      if (selectedPeriod && selectedPeriod !== "all") params.set("period", selectedPeriod);
      if (selectedSource && selectedSource !== "all") params.set("sourceId", selectedSource);

      const url = `/api/reports/cmp-extract?${params.toString()}`;
      
      const res = await fetch(url);
      
      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Export failed");
        return;
      }

      // Download file
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `cmp-extract-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      toast.success(`${format.toUpperCase()} downloaded successfully`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Export failed");
    } finally {
      setLoading(false);
    }
  };

  const periods = ["all", "Q1-2026", "Q2-2026", "Q3-2026", "Q4-2026", "Q1-2027", "Q2-2027"];

  return (
    <div className="space-y-6 px-6 py-6">
      {/* Filter Bar */}
      <div className="flex items-center gap-4 rounded-[14px] border bg-white p-4" style={{ borderColor: "var(--border)" }}>
        <div className="flex flex-1 items-center gap-3">
          <label className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            Period:
          </label>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="h-9 rounded-lg border bg-white px-3 text-sm outline-none transition-colors focus:border-[var(--blue)]"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            <option value="all">All Periods</option>
            {periods.slice(1).map((period) => (
              <option key={period} value={period}>
                {period.replace("-", " ")}
              </option>
            ))}
          </select>

          <span style={{ color: "var(--border)" }}>|</span>

          <label className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            Entity:
          </label>
          <select
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            className="h-9 rounded-lg border bg-white px-3 text-sm outline-none transition-colors focus:border-[var(--blue)]"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            <option value="all">All Entities</option>
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.code} — {entity.name}
              </option>
            ))}
          </select>

          <span style={{ color: "var(--border)" }}>|</span>

          <label className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            Source:
          </label>
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="h-9 rounded-lg border bg-white px-3 text-sm outline-none transition-colors focus:border-[var(--blue)]"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            <option value="all">All Sources</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-3 gap-6">
        {/* CMP Extract */}
        <div
          className="rounded-[14px] border bg-white p-6 transition-shadow hover:shadow-md"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="mb-4 flex items-start justify-between">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ backgroundColor: "var(--blue-light)" }}
            >
              <FileSpreadsheet size={24} style={{ color: "var(--blue)" }} />
            </div>
          </div>

          <h3 className="mb-2 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            CMP Extract
          </h3>
          <p className="mb-6 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Full CMP download for regulators with all task details, evidence counts, and compliance status
          </p>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => handleExport("csv", "cmp-extract")}
              disabled={loading}
              className="flex h-9 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-40"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-secondary)",
                backgroundColor: "white",
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = "var(--bg-subtle)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "white";
              }}
            >
              <FileText size={16} />
              Export as CSV
            </button>

            <button
              onClick={() => handleExport("xlsx", "cmp-extract")}
              disabled={loading}
              className="flex h-9 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-40"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-secondary)",
                backgroundColor: "white",
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = "var(--bg-subtle)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "white";
              }}
            >
              <FileSpreadsheet size={16} />
              Export as Excel
            </button>

            <button
              onClick={() => handleExport("pdf", "cmp-extract")}
              disabled={loading}
              className="flex h-9 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
              style={{
                backgroundColor: "var(--blue)",
                color: "white",
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.opacity = "0.9";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            >
              <Download size={16} />
              Export as PDF
            </button>
          </div>
        </div>

        {/* Board Pack */}
        <div
          className="rounded-[14px] border bg-white p-6 transition-shadow hover:shadow-md"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="mb-4 flex items-start justify-between">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ backgroundColor: "var(--purple-light)" }}
            >
              <FileDown size={24} style={{ color: "var(--purple)" }} />
            </div>
          </div>

          <h3 className="mb-2 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Board Pack
          </h3>
          <p className="mb-6 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Compliance status summary for audit committee with key metrics and critical findings
          </p>

          <button
            onClick={() => toast("Board Pack generation coming soon!", { icon: "⏳" })}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: "var(--purple)",
              color: "white",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.9";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            Generate Report
          </button>
        </div>

        {/* Findings Register */}
        <div
          className="rounded-[14px] border bg-white p-6 transition-shadow hover:shadow-md"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="mb-4 flex items-start justify-between">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ backgroundColor: "var(--red-light)" }}
            >
              <FileText size={24} style={{ color: "var(--red)" }} />
            </div>
          </div>

          <h3 className="mb-2 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Findings Register
          </h3>
          <p className="mb-6 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Open findings with aging analysis, remediation status, and management responses
          </p>

          <button
            onClick={() => toast("Findings Register generation coming soon!", { icon: "⏳" })}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: "var(--red)",
              color: "white",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.9";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            Generate Report
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div
        className="rounded-[14px] border p-4"
        style={{ borderColor: "var(--blue-mid)", backgroundColor: "var(--blue-light)" }}
      >
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
          <strong>Note:</strong> CMP Extract includes all tasks matching your filter criteria with full details.
          Use entity and period filters to generate targeted exports for specific regulatory submissions.
        </p>
      </div>
    </div>
  );
}
