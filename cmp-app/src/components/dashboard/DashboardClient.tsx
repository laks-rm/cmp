"use client";

import { useEntity } from "@/contexts/EntityContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { fetchApi } from "@/lib/api-client";
import { EntityBadge } from "@/components/ui/EntityBadge";
import { 
  ArrowRight, 
  Clock, 
  FileCheck, 
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Timer,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Chart, registerables } from "chart.js";

// Register Chart.js components
if (typeof window !== "undefined") {
  Chart.register(...registerables);
}

type DashboardClientProps = {
  firstName: string;
  greeting: string;
};

type DashboardStats = {
  kpis: {
    dueThisWeek: number;
    overdue: number;
    pendingReview: number;
    pendingReviewOldestDays: number;
    unassigned: number;
    quarterCompletion: number;
    quarterCompletionPrevWeek: number;
    openFindings: number;
    criticalHighFindings: number;
    slaAdherence: number;
    avgCompletionDays: number | null;
    activeSources: number;
    totalClauses: number;
    entitiesCount: number;
  };
  actionItems: Array<{
    id: string;
    name: string;
    entityCode: string;
    status: string;
    dueDate: string;
    sourceName: string;
    isOverdue: boolean;
    recurrenceGroupId: string | null;
  }>;
  completionTrend: Array<{
    month: string;
    completed: number;
    active: number;
    overdue: number;
  }>;
  entityComparison: Array<{
    entityId: string;
    entityCode: string;
    entityName: string;
    total: number;
    completed: number;
    completionPct: number;
  }> | null;
  teamWorkload: Array<{
    teamId: string;
    teamName: string;
    completed: number;
    active: number;
    overdue: number;
  }> | null;
  sourcesNeedingAttention: Array<{
    sourceId: string;
    sourceName: string;
    entityCode: string;
    total: number;
    completed: number;
    overdue: number;
  }>;
  statusByRiskRating: Array<{
    riskRating: string;
    completed: number;
    inProgress: number;
    pendingReview: number;
    toDo: number;
    overdue: number;
  }>;
  findingsOverview: Array<{
    id: string;
    reference: string;
    title: string;
    severity: string;
    entityCode: string;
    actionOwner: string;
    targetDate: string | null;
    daysOpen: number;
  }>;
  compliancePosture: Array<{
    sourceId: string;
    sourceName: string;
    sourceType: string;
    entityCodes: string[];
    total: number;
    completed: number;
    overdue: number;
    openFindings: number;
    highFindings: number;
  }>;
  upcomingDeadlines: Array<{
    id: string;
    name: string;
    entityCode: string;
    dueDate: string;
    picName: string;
    daysUntilDue: number | null;
  }>;
};

export function DashboardClient({ firstName, greeting }: DashboardClientProps) {
  const { selectedEntityId, setEntity } = useEntity();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // Collapsible sections state
  const [showAllSources, setShowAllSources] = useState(false);
  const [teamWorkloadExpanded, setTeamWorkloadExpanded] = useState(false);
  const [riskRatingExpanded, setRiskRatingExpanded] = useState(false);

  // Chart refs
  const completionTrendChartRef = useRef<HTMLCanvasElement>(null);
  const entityComparisonChartRef = useRef<HTMLCanvasElement>(null);
  const teamWorkloadChartRef = useRef<HTMLCanvasElement>(null);
  const riskRatingChartRef = useRef<HTMLCanvasElement>(null);
  
  // Chart instance refs
  const completionTrendInstanceRef = useRef<Chart | null>(null);
  const entityComparisonInstanceRef = useRef<Chart | null>(null);
  const teamWorkloadInstanceRef = useRef<Chart | null>(null);
  const riskRatingInstanceRef = useRef<Chart | null>(null);

  // Detect dark mode
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDarkMode(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const fetchDashboardStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await fetchApi<DashboardStats>(
        `/api/dashboard/stats?entityId=${selectedEntityId}`
      );
      
      setStats(data);
      setRetryCount(0);
    } catch (err) {
      console.error("Failed to fetch dashboard stats:", err);
      setError("Failed to load dashboard data. Retrying...");
      
      // Auto-retry after 5 seconds
      if (retryCount < 3) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
        }, 5000);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedEntityId, retryCount]);

  useEffect(() => {
    fetchDashboardStats();
  }, [selectedEntityId, retryCount, fetchDashboardStats]);

  // Chart colors - memoized to avoid recreating on every render
  const colors = useMemo(() => ({
    completed: "#639922",
    active: "#378ADD",
    inProgress: "#378ADD",
    pendingReview: "#7F77DD",
    toDo: "#EF9F27",
    overdue: "#E24B4A",
    grid: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
    text: isDarkMode ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)",
  }), [isDarkMode]);

  // Render completion trend chart
  useEffect(() => {
    if (!stats?.completionTrend || !completionTrendChartRef.current) return;

    // Destroy previous instance
    if (completionTrendInstanceRef.current) {
      completionTrendInstanceRef.current.destroy();
    }

    const ctx = completionTrendChartRef.current.getContext("2d");
    if (!ctx) return;

    completionTrendInstanceRef.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: stats.completionTrend.map(d => d.month),
        datasets: [
          {
            label: "Completed",
            data: stats.completionTrend.map(d => d.completed),
            backgroundColor: colors.completed,
          },
          {
            label: "Active",
            data: stats.completionTrend.map(d => d.active),
            backgroundColor: colors.active,
          },
          {
            label: "Overdue",
            data: stats.completionTrend.map(d => d.overdue),
            backgroundColor: colors.overdue,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: colors.text },
          },
          y: {
            stacked: true,
            grid: { color: colors.grid },
            ticks: { color: colors.text },
          },
        },
      },
    });

    return () => {
      if (completionTrendInstanceRef.current) {
        completionTrendInstanceRef.current.destroy();
      }
    };
  }, [stats?.completionTrend, colors]);

  // Render entity comparison chart
  useEffect(() => {
    if (!stats?.entityComparison || !entityComparisonChartRef.current) return;

    if (entityComparisonInstanceRef.current) {
      entityComparisonInstanceRef.current.destroy();
    }

    const ctx = entityComparisonChartRef.current.getContext("2d");
    if (!ctx) return;

    const data = stats.entityComparison;

    entityComparisonInstanceRef.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: data.map(e => e.entityCode),
        datasets: [
          {
            label: "Completed",
            data: data.map(e => e.completed),
            backgroundColor: colors.completed,
          },
          {
            label: "Remaining",
            data: data.map(e => e.total - e.completed),
            backgroundColor: isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        onClick: (event, elements) => {
          if (elements.length > 0) {
            const index = elements[0].index;
            const entity = data[index];
            setEntity(entity.entityId);
          }
        },
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            stacked: true,
            grid: { color: colors.grid },
            ticks: { color: colors.text },
          },
          y: {
            stacked: true,
            grid: { display: false },
            ticks: { color: colors.text },
          },
        },
      },
    });

    return () => {
      if (entityComparisonInstanceRef.current) {
        entityComparisonInstanceRef.current.destroy();
      }
    };
  }, [stats?.entityComparison, colors, setEntity, isDarkMode]);

  // Render team workload chart
  useEffect(() => {
    if (!stats?.teamWorkload || !teamWorkloadChartRef.current) return;

    if (teamWorkloadInstanceRef.current) {
      teamWorkloadInstanceRef.current.destroy();
    }

    const ctx = teamWorkloadChartRef.current.getContext("2d");
    if (!ctx) return;

    const data = stats.teamWorkload;

    teamWorkloadInstanceRef.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: data.map(t => t.teamName),
        datasets: [
          {
            label: "Completed",
            data: data.map(t => t.completed),
            backgroundColor: colors.completed,
          },
          {
            label: "Active",
            data: data.map(t => t.active),
            backgroundColor: colors.active,
          },
          {
            label: "Overdue",
            data: data.map(t => t.overdue),
            backgroundColor: colors.overdue,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        onClick: (event, elements) => {
          if (elements.length > 0) {
            const index = elements[0].index;
            const team = data[index];
            router.push(`/tasks?responsibleTeamId=${team.teamId}`);
          }
        },
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            stacked: true,
            grid: { color: colors.grid },
            ticks: { color: colors.text },
          },
          y: {
            stacked: true,
            grid: { display: false },
            ticks: { color: colors.text },
          },
        },
      },
    });

    return () => {
      if (teamWorkloadInstanceRef.current) {
        teamWorkloadInstanceRef.current.destroy();
      }
    };
  }, [stats?.teamWorkload, colors, router]);

  // Render risk rating chart
  useEffect(() => {
    if (!stats?.statusByRiskRating || !riskRatingChartRef.current) return;

    if (riskRatingInstanceRef.current) {
      riskRatingInstanceRef.current.destroy();
    }

    const ctx = riskRatingChartRef.current.getContext("2d");
    if (!ctx) return;

    const data = stats.statusByRiskRating.sort((a, b) => {
      const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return order[a.riskRating as keyof typeof order] - order[b.riskRating as keyof typeof order];
    });

    riskRatingInstanceRef.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: data.map(d => d.riskRating),
        datasets: [
          {
            label: "Completed",
            data: data.map(d => d.completed),
            backgroundColor: colors.completed,
          },
          {
            label: "In Progress",
            data: data.map(d => d.inProgress),
            backgroundColor: colors.inProgress,
          },
          {
            label: "Pending Review",
            data: data.map(d => d.pendingReview),
            backgroundColor: colors.pendingReview,
          },
          {
            label: "To Do",
            data: data.map(d => d.toDo),
            backgroundColor: colors.toDo,
          },
          {
            label: "Overdue",
            data: data.map(d => d.overdue),
            backgroundColor: colors.overdue,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: colors.text },
          },
          y: {
            stacked: true,
            grid: { color: colors.grid },
            ticks: { color: colors.text },
          },
        },
      },
    });

    return () => {
      if (riskRatingInstanceRef.current) {
        riskRatingInstanceRef.current.destroy();
      }
    };
  }, [stats?.statusByRiskRating, colors]);

  const entityDisplayName = selectedEntityId === "GROUP" ? "All Entities" : selectedEntityId;

  const formatDueDate = (dateString: string, isOverdue: boolean) => {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(date);
    dueDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (isOverdue) {
      return `${Math.abs(diffDays)}d overdue`;
    } else if (diffDays === 0) {
      return "Due today";
    } else if (diffDays === 1) {
      return "Due tomorrow";
    } else if (diffDays < 7) {
      return `Due in ${diffDays}d`;
    } else {
      return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    }
  };

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) return <TrendingUp size={14} style={{ color: colors.completed }} />;
    if (current < previous) return <TrendingDown size={14} style={{ color: colors.overdue }} />;
    return <Minus size={14} style={{ color: colors.text }} />;
  };

  if (loading && !stats) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 text-[13.5px] font-medium" style={{ color: "var(--text-secondary)" }}>
            Loading dashboard...
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="animate-pulse rounded-[14px] border bg-white p-4" style={{ borderColor: "var(--border)" }}>
              <div className="h-4 w-24 rounded bg-gray-200 mb-2"></div>
              <div className="h-8 w-16 rounded bg-gray-200 mb-1"></div>
              <div className="h-3 w-20 rounded bg-gray-200"></div>
            </div>
          ))}
        </div>
        
        <div className="animate-pulse rounded-[14px] border bg-white p-6" style={{ borderColor: "var(--border)" }}>
          <div className="h-6 w-32 rounded bg-gray-200 mb-4"></div>
          <div className="h-64 rounded bg-gray-200"></div>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="space-y-6">
        <div className="rounded-[14px] border bg-red-50 p-4 text-red-700" style={{ borderColor: "var(--red)" }}>
          {error}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-4">
      {/* Greeting + Context */}
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
          {greeting}, {firstName}
        </h1>
        <p className="mt-1 text-[13.5px] font-medium" style={{ color: "var(--text-secondary)" }}>
          {selectedEntityId === "GROUP" 
            ? "Viewing consolidated data across all entities" 
            : `Viewing ${entityDisplayName}`
          }
        </p>
      </div>

      {/* KPI Cards - 6 cards in 3x2 grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* Due This Week */}
        <div 
          className="cursor-pointer rounded-[14px] border bg-white p-4 shadow-sm transition-all hover:border-[var(--blue)] hover:shadow-md"
          style={{ borderColor: "var(--border)" }}
          onClick={() => router.push("/tasks?preset=due-week")}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              DUE THIS WEEK
            </p>
            <Clock size={16} style={{ color: "var(--blue)" }} />
          </div>
          <p className="text-3xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            {stats.kpis.dueThisWeek}
          </p>
          <p className="text-xs" style={{ color: stats.kpis.overdue > 0 ? "var(--red)" : "var(--text-muted)" }}>
            {stats.kpis.overdue} overdue
          </p>
        </div>

        {/* Pending Review */}
        <div 
          className="cursor-pointer rounded-[14px] border bg-white p-4 shadow-sm transition-all hover:border-[var(--purple)] hover:shadow-md"
          style={{ borderColor: "var(--border)" }}
          onClick={() => router.push("/tasks?status=PENDING_REVIEW")}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              PENDING REVIEW
            </p>
            <FileCheck size={16} style={{ color: "var(--purple)" }} />
          </div>
          <p className="text-3xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            {stats.kpis.pendingReview}
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Oldest: {stats.kpis.pendingReviewOldestDays}d
          </p>
        </div>

        {/* Quarter Completion */}
        <div 
          className="rounded-[14px] border bg-white p-4 shadow-sm"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              Q1 COMPLETION
            </p>
            {getTrendIcon(stats.kpis.quarterCompletion, stats.kpis.quarterCompletionPrevWeek)}
          </div>
          <p className="text-3xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            {stats.kpis.quarterCompletion}%
          </p>
          <p className="text-xs" style={{ 
            color: stats.kpis.quarterCompletion > stats.kpis.quarterCompletionPrevWeek 
              ? "var(--green)" 
              : stats.kpis.quarterCompletion < stats.kpis.quarterCompletionPrevWeek
                ? "var(--red)"
                : "var(--text-muted)"
          }}>
            {stats.kpis.quarterCompletion > stats.kpis.quarterCompletionPrevWeek && "+"}
            {stats.kpis.quarterCompletion - stats.kpis.quarterCompletionPrevWeek}% vs last week
          </p>
        </div>

        {/* Open Findings */}
        <div 
          className="cursor-pointer rounded-[14px] border bg-white p-4 shadow-sm transition-all hover:border-[var(--red)] hover:shadow-md"
          style={{ borderColor: "var(--border)" }}
          onClick={() => router.push("/findings?status=OPEN")}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              OPEN FINDINGS
            </p>
            <AlertTriangle size={16} style={{ color: "var(--red)" }} />
          </div>
          <p className="text-3xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            {stats.kpis.openFindings}
          </p>
          <p className="text-xs" style={{ color: stats.kpis.criticalHighFindings > 0 ? "var(--red)" : "var(--text-muted)" }}>
            {stats.kpis.criticalHighFindings > 0 
              ? `${stats.kpis.criticalHighFindings} critical/high` 
              : "No critical findings"}
          </p>
        </div>

        {/* SLA Adherence */}
        <div 
          className="rounded-[14px] border bg-white p-4 shadow-sm"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              SLA ADHERENCE
            </p>
            <CheckCircle2 size={16} style={{ 
              color: stats.kpis.slaAdherence >= 90 ? "var(--green)" : stats.kpis.slaAdherence >= 75 ? "var(--amber)" : "var(--red)" 
            }} />
          </div>
          <p className="text-3xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            {stats.kpis.slaAdherence}%
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            This quarter
          </p>
        </div>

        {/* Average Completion Time */}
        <div 
          className="rounded-[14px] border bg-white p-4 shadow-sm"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              AVG COMPLETION
            </p>
            <Timer size={16} style={{ color: "var(--blue)" }} />
          </div>
          <p className="text-3xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            {stats.kpis.avgCompletionDays !== null ? stats.kpis.avgCompletionDays : "—"}
            {stats.kpis.avgCompletionDays !== null && <span className="text-base"> days</span>}
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            This quarter
          </p>
        </div>
      </div>

      {/* Two-column: Completion Trend + Action Items */}
      <div className="grid grid-cols-3 gap-4">
        {/* Completion Trend - 2 columns */}
        <div className="col-span-2 rounded-[14px] border bg-white p-6 shadow-sm" style={{ borderColor: "var(--border)" }}>
          <div className="mb-4">
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              Completion trend
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Last 6 months
            </p>
          </div>
          
          {/* Custom legend */}
          <div className="flex gap-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded" style={{ backgroundColor: colors.completed }}></div>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded" style={{ backgroundColor: colors.active }}></div>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Active</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded" style={{ backgroundColor: colors.overdue }}></div>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Overdue</span>
            </div>
          </div>
          
          <div style={{ height: "160px" }}>
            <canvas ref={completionTrendChartRef}></canvas>
          </div>
        </div>

        {/* Action Items - 1 column - Deduplicated and capped at 4 */}
        <div className="rounded-[14px] border bg-white p-6 shadow-sm" style={{ borderColor: "var(--border)" }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              Your action items
            </h2>
            {stats.actionItems.length > 4 && (
              <button 
                className="flex items-center gap-1 text-xs font-medium transition-colors hover:text-[var(--blue)]"
                style={{ color: "var(--text-secondary)" }}
                onClick={() => router.push("/tasks")}
              >
                View all <ArrowRight size={12} />
              </button>
            )}
          </div>
          
          <div className="space-y-2">
            {(() => {
              // Deduplicate by recurrenceGroupId - only show one per task definition
              const seen = new Set<string>();
              const deduped = stats.actionItems.filter(item => {
                // If no recurrenceGroupId, always include (one-time tasks)
                if (!item.recurrenceGroupId) return true;
                
                // If we've seen this recurrenceGroupId, skip
                if (seen.has(item.recurrenceGroupId)) return false;
                
                // First time seeing this recurrenceGroupId
                seen.add(item.recurrenceGroupId);
                return true;
              });
              
              return deduped.slice(0, 4).map((item) => (
                <div 
                  key={item.id}
                  className="cursor-pointer rounded-lg border p-3 transition-all hover:border-[var(--blue)] hover:shadow-sm"
                  style={{ borderColor: "var(--border-light)" }}
                  onClick={() => router.push(`/tasks?id=${item.id}`)}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <div 
                      className="h-2 w-2 rounded-full" 
                      style={{ 
                        backgroundColor: item.isOverdue 
                          ? colors.overdue 
                          : item.status === "PENDING_REVIEW" 
                            ? colors.pendingReview 
                            : colors.active 
                      }}
                    ></div>
                    <EntityBadge entityCode={item.entityCode as "DIEL" | "DGL" | "DBVI" | "FINSERV" | "GROUP"} size="sm" />
                  </div>
                  <p className="text-sm font-medium leading-tight" style={{ color: "var(--text-primary)" }}>
                    {item.name}
                  </p>
                  <p className="mt-1 text-xs" style={{ 
                    color: item.isOverdue ? "var(--red)" : "var(--text-muted)" 
                  }}>
                    {formatDueDate(item.dueDate, item.isOverdue)}
                  </p>
                </div>
              ));
            })()}
            
            {stats.actionItems.length === 0 && (
              <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
                No urgent action items
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Two-column: Compliance Posture + Upcoming Deadlines */}
      <div className="grid grid-cols-3 gap-4">
        {/* Compliance Posture by Source - 2 columns - Top 5 with toggle */}
        <div className="col-span-2 rounded-[14px] border bg-white p-6 shadow-sm" style={{ borderColor: "var(--border)" }}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                Compliance posture by source
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Top {Math.min(5, stats.compliancePosture.length)} sources needing attention
              </p>
            </div>
            <button 
              className="flex items-center gap-1 text-xs font-medium transition-colors hover:text-[var(--blue)]"
              style={{ color: "var(--text-secondary)" }}
              onClick={() => router.push("/sources")}
            >
              All sources <ArrowRight size={12} />
            </button>
          </div>
          
          <div className="space-y-2">
            {stats.compliancePosture.slice(0, showAllSources ? undefined : 5).map((source) => {
              const completionPct = source.total > 0 ? Math.round((source.completed / source.total) * 100) : 0;
              const posture = 
                completionPct >= 80 && source.overdue === 0 && source.highFindings === 0 ? "good" :
                completionPct >= 50 && source.highFindings === 0 ? "medium" : "poor";
              const postureColor = 
                posture === "good" ? "var(--green)" :
                posture === "medium" ? "var(--amber)" : "var(--red)";
              
              return (
                <div 
                  key={source.sourceId}
                  className="cursor-pointer rounded-lg border p-3 transition-all hover:border-[var(--blue)] hover:shadow-sm"
                  style={{ borderColor: "var(--border-light)" }}
                  onClick={() => router.push(`/tasks?sourceId=${source.sourceId}`)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium leading-tight mb-1" style={{ color: "var(--text-primary)" }}>
                        {source.sourceName}
                      </p>
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ 
                          backgroundColor: isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                          color: "var(--text-secondary)" 
                        }}>
                          {source.sourceType.replace(/_/g, " ")}
                        </span>
                        {source.entityCodes.slice(0, 2).map(code => (
                          <EntityBadge key={code} entityCode={code as "DIEL" | "DGL" | "DBVI" | "FINSERV" | "GROUP"} size="sm" />
                        ))}
                        {source.entityCodes.length > 2 && (
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                            +{source.entityCodes.length - 2}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-2">
                      {source.overdue > 0 && (
                        <p className="text-xs font-semibold mb-1" style={{ color: "var(--red)" }}>
                          {source.overdue} overdue
                        </p>
                      )}
                      {source.highFindings > 0 && (
                        <p className="text-xs font-semibold" style={{ color: "var(--red)" }}>
                          {source.highFindings} critical
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {source.completed}/{source.total} done
                      </span>
                      <span className="text-xs font-semibold" style={{ color: postureColor }}>
                        {completionPct}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }}>
                      <div 
                        className="h-full transition-all duration-500 rounded-full"
                        style={{ 
                          width: `${completionPct}%`,
                          backgroundColor: postureColor
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {stats.compliancePosture.length === 0 && (
              <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
                No active sources
              </p>
            )}
            
            {stats.compliancePosture.length > 5 && (
              <button
                className="w-full mt-2 py-2 text-xs font-medium rounded-lg transition-colors hover:bg-gray-50"
                style={{ color: "var(--text-secondary)" }}
                onClick={() => setShowAllSources(!showAllSources)}
              >
                {showAllSources ? "Show less" : `Show all ${stats.compliancePosture.length} sources`}
              </button>
            )}
          </div>
        </div>

        {/* Upcoming Deadlines - 1 column - Capped at 5 */}
        <div className="rounded-[14px] border bg-white p-6 shadow-sm" style={{ borderColor: "var(--border)" }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              Upcoming deadlines
            </h2>
            {stats.upcomingDeadlines.length > 5 && (
              <button 
                className="flex items-center gap-1 text-xs font-medium transition-colors hover:text-[var(--blue)]"
                style={{ color: "var(--text-secondary)" }}
                onClick={() => router.push("/tasks")}
              >
                View all <ArrowRight size={12} />
              </button>
            )}
          </div>
          
          <div className="space-y-2">
            {stats.upcomingDeadlines.slice(0, 5).map((task) => (
              <div 
                key={task.id}
                className="cursor-pointer rounded-lg border p-2 transition-all hover:border-[var(--blue)] hover:shadow-sm"
                style={{ borderColor: "var(--border-light)" }}
                onClick={() => router.push(`/tasks?id=${task.id}`)}
              >
                <div className="mb-1 flex items-center gap-2">
                  <EntityBadge entityCode={task.entityCode as "DIEL" | "DGL" | "DBVI" | "FINSERV" | "GROUP"} size="sm" />
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {task.daysUntilDue !== null && (
                      task.daysUntilDue === 0 ? "Today" :
                      task.daysUntilDue === 1 ? "Tomorrow" :
                      `${task.daysUntilDue}d`
                    )}
                  </span>
                </div>
                <p className="text-sm font-medium leading-tight mb-0.5" style={{ color: "var(--text-primary)" }}>
                  {task.name}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {task.picName}
                </p>
              </div>
            ))}
            
            {stats.upcomingDeadlines.length === 0 && (
              <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
                No upcoming deadlines
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Entity Compliance Cards OR Team Workload (Collapsible) + Findings Overview */}
      <div className="grid grid-cols-3 gap-4">
        {/* Entity Cards OR Team Workload - 2 columns */}
        <div className="col-span-2 rounded-[14px] border bg-white p-6 shadow-sm" style={{ borderColor: "var(--border)" }}>
          {selectedEntityId === "GROUP" && stats.entityComparison ? (
            <>
              <div className="mb-4">
                <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                  Entity compliance
                </h2>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Current quarter completion. Click to switch entity.
                </p>
              </div>
              
              {/* Entity Cards Grid */}
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
                {stats.entityComparison.map((entity) => {
                  const color = 
                    entity.completionPct >= 80 ? "var(--green)" :
                    entity.completionPct >= 50 ? "var(--amber)" : "var(--red)";
                  
                  return (
                    <div
                      key={entity.entityId}
                      className="cursor-pointer rounded-lg border p-3 transition-all hover:border-[var(--blue)] hover:shadow-md"
                      style={{ borderColor: "var(--border-light)" }}
                      onClick={() => setEntity(entity.entityId)}
                    >
                      <div className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
                        {entity.entityCode}
                      </div>
                      <div className="text-3xl font-bold mb-2" style={{ color }}>
                        {entity.completionPct}%
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ backgroundColor: isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }}>
                        <div
                          className="h-full transition-all duration-500"
                          style={{ width: `${entity.completionPct}%`, backgroundColor: color }}
                        ></div>
                      </div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {entity.completed}/{entity.total} done
                        {entity.total - entity.completed > 0 && ` — ${entity.total - entity.completed} remaining`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : stats.teamWorkload ? (
            <>
              <div
                className="mb-4 flex items-center justify-between cursor-pointer"
                onClick={() => setTeamWorkloadExpanded(!teamWorkloadExpanded)}
              >
                <div>
                  <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                    Team workload
                  </h2>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Task distribution by team
                  </p>
                </div>
                {teamWorkloadExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>
              
              {teamWorkloadExpanded && (
                <>
                  <div className="flex gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded" style={{ backgroundColor: colors.completed }}></div>
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Completed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded" style={{ backgroundColor: colors.active }}></div>
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Active</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded" style={{ backgroundColor: colors.overdue }}></div>
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Overdue</span>
                    </div>
                  </div>
                  
                  <div style={{ height: `${Math.min((stats.teamWorkload.length * 40) + 80, 300)}px` }}>
                    <canvas ref={teamWorkloadChartRef}></canvas>
                  </div>
                </>
              )}
            </>
          ) : (
            <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>
              No data available
            </p>
          )}
        </div>

        {/* Findings Overview - 1 column - Capped at 3 */}
        <div className="rounded-[14px] border bg-white p-6 shadow-sm" style={{ borderColor: "var(--border)" }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              Open findings
            </h2>
            {stats.findingsOverview.length > 3 && (
              <button 
                className="flex items-center gap-1 text-xs font-medium transition-colors hover:text-[var(--blue)]"
                style={{ color: "var(--text-secondary)" }}
                onClick={() => router.push("/findings?status=OPEN")}
              >
                View all <ArrowRight size={12} />
              </button>
            )}
          </div>
          
          <div className="space-y-2">
            {stats.findingsOverview.slice(0, 3).map((finding) => {
              const severityColor = 
                finding.severity === "CRITICAL" ? "var(--red)" :
                finding.severity === "HIGH" ? "var(--red)" :
                finding.severity === "MEDIUM" ? "var(--amber)" :
                "var(--blue)";
              
              return (
                <div 
                  key={finding.id}
                  className="cursor-pointer rounded-lg border p-2 transition-all hover:border-[var(--red)] hover:shadow-sm"
                  style={{ borderColor: "var(--border-light)" }}
                  onClick={() => router.push(`/findings?id=${finding.id}`)}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <EntityBadge entityCode={finding.entityCode as "DIEL" | "DGL" | "DBVI" | "FINSERV" | "GROUP"} size="sm" />
                      <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ 
                        backgroundColor: severityColor + "20",
                        color: severityColor
                      }}>
                        {finding.severity}
                      </span>
                    </div>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {finding.daysOpen}d
                    </span>
                  </div>
                  <p className="text-sm font-medium leading-tight mb-0.5" style={{ color: "var(--text-primary)" }}>
                    {finding.title}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {finding.actionOwner}
                  </p>
                </div>
              );
            })}
            
            {stats.findingsOverview.length === 0 && (
              <div className="text-center py-8">
                <CheckCircle2 size={32} style={{ color: "var(--green)", margin: "0 auto 8px" }} />
                <p className="text-sm font-medium" style={{ color: "var(--green)" }}>
                  No open findings
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status by Risk Rating - Collapsible */}
      <div className="rounded-[14px] border bg-white shadow-sm" style={{ borderColor: "var(--border)" }}>
        <div
          className="p-6 flex items-center justify-between cursor-pointer"
          onClick={() => setRiskRatingExpanded(!riskRatingExpanded)}
        >
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              Status distribution by risk rating
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Current quarter
            </p>
          </div>
          {riskRatingExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
        
        {riskRatingExpanded && (
          <div className="px-6 pb-6">
            <div className="flex gap-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded" style={{ backgroundColor: colors.completed }}></div>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Completed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded" style={{ backgroundColor: colors.inProgress }}></div>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>In progress</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded" style={{ backgroundColor: colors.pendingReview }}></div>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Pending review</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded" style={{ backgroundColor: colors.toDo }}></div>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>To do</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded" style={{ backgroundColor: colors.overdue }}></div>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Overdue</span>
              </div>
            </div>
            
            <div style={{ height: "160px" }}>
              <canvas ref={riskRatingChartRef}></canvas>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
