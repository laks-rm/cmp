"use client";

import { useEffect, useState, useCallback, memo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEntity } from "@/contexts/EntityContext";
import { EntityBadge } from "@/components/ui/EntityBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import { TaskDetailModal } from "@/components/tasks/TaskDetailModal";
import {
  Filter,
  Search,
  Download,
  ChevronDown,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Clock,
  Calendar as CalendarIcon,
  TrendingUp,
  X,
  Info,
  ArrowRight,
  User,
  UserCheck,
  ChevronUp,
  SlidersHorizontal,
} from "lucide-react";
import toast from "@/lib/toast";
import { format, isPast } from "date-fns";

type Task = {
  id: string;
  name: string;
  status: string;
  riskRating: string;
  frequency: string;
  quarter: string | null;
  dueDate: string | null;
  completedAt: string | null;
  clickupUrl: string | null;
  gdriveUrl: string | null;
  entity: { id: string; code: string; name: string };
  source: { id: string; name: string; code: string };
  sourceItem: { reference: string } | null;
  assignee: { id: string; name: string; initials: string; avatarColor: string | null } | null;
  pic: { id: string; name: string; initials: string; avatarColor: string | null } | null;
  responsibleTeam: { id: string; name: string } | null;
  monitoringArea: { id: string; name: string } | null;
  taskType: { id: string; name: string } | null;
};

type TaskStats = {
  active: number;
  overdue: number;
  dueThisWeek: number;
  pendingReview: number;
};

type FilterChip = {
  id: string;
  label: string;
  active: boolean;
  icon?: React.ReactNode;
};

const RISK_COLORS = {
  HIGH: { bg: "var(--red-light)", color: "var(--red)" },
  MEDIUM: { bg: "var(--amber-light)", color: "var(--amber)" },
  LOW: { bg: "var(--green-light)", color: "var(--green)" },
};

const TaskRow = memo(
  ({
    task,
    isSelected,
    onToggle,
    onQuickAction,
    onRowClick,
  }: {
    task: Task;
    isSelected: boolean;
    onToggle: (id: string) => void;
    onQuickAction: (id: string, status: string) => void;
    onRowClick: (id: string) => void;
  }) => {
    const isOverdue = task.dueDate && !task.completedAt && isPast(new Date(task.dueDate));
    const riskConfig = RISK_COLORS[task.riskRating as keyof typeof RISK_COLORS];

    const getQuickAction = () => {
      const status = task.status;
      if (status === "TO_DO") {
        return { label: "Start", action: "IN_PROGRESS", color: "var(--blue)" };
      } else if (status === "IN_PROGRESS") {
        return { label: "Submit", navigate: true };
      } else if (status === "PENDING_REVIEW") {
        return { label: "Review", navigate: true };
      }
      return null;
    };

    const quickAction = getQuickAction();

    return (
      <tr 
        className="group border-t transition-colors hover:bg-[var(--bg-hover)] cursor-pointer" 
        style={{ 
          borderColor: "var(--border-light)",
          borderLeft: isOverdue ? "3px solid var(--red)" : undefined
        }}
        onClick={() => onRowClick(task.id)}
      >
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => onToggle(task.id)} className="flex items-center justify-center">
            {isSelected ? <CheckSquare size={18} style={{ color: "var(--blue)" }} /> : <Square size={18} style={{ color: "var(--text-muted)" }} />}
          </button>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-col gap-1">
            <p className="font-medium leading-tight" style={{ color: "var(--text-primary)" }}>
              {task.name}
            </p>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
              <span className="font-medium">{task.source.code}</span>
              {task.sourceItem && (
                <>
                  <span>•</span>
                  <span className="font-mono">{task.sourceItem.reference}</span>
                </>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <EntityBadge entityCode={task.entity.code as "DIEL" | "DGL" | "DBVI" | "FINSERV" | "GROUP"} />
        </td>
        <td className="px-4 py-3">
          <StatusPill status={task.status as "TO_DO" | "IN_PROGRESS" | "PENDING_REVIEW" | "COMPLETED" | "DEFERRED" | "NOT_APPLICABLE"} />
        </td>
        <td className="px-4 py-3">
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: riskConfig.bg, color: riskConfig.color }}>
            {task.riskRating}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {task.monitoringArea?.name || "—"}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {task.taskType?.name || "—"}
          </span>
        </td>
        <td className="px-4 py-3">
          {task.pic ? (
            <div className="flex items-center gap-2">
              <div
                className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ background: task.pic.avatarColor || "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" }}
              >
                {task.pic.initials}
              </div>
              <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                {task.pic.name}
              </span>
            </div>
          ) : (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Unassigned
            </span>
          )}
        </td>
        <td className="px-4 py-3">
          {task.responsibleTeam ? (
            <span 
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium" 
              style={{ backgroundColor: "var(--blue-light)", color: "var(--blue)" }}
            >
              {task.responsibleTeam.name}
            </span>
          ) : (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Not assigned
            </span>
          )}
        </td>
        <td className="px-4 py-3">
          {task.dueDate ? (
            <div className="flex items-center gap-2">
              {task.completedAt ? (
                <span className="text-sm font-medium" style={{ color: "var(--green)" }}>
                  ✓ {format(new Date(task.dueDate), "MMM d")}
                </span>
              ) : isOverdue ? (
                <span className="text-sm font-semibold" style={{ color: "var(--red)" }}>
                  {format(new Date(task.dueDate), "MMM d")}
                </span>
              ) : (
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {format(new Date(task.dueDate), "MMM d")}
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              No due date
            </span>
          )}
        </td>
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          {quickAction && (
            <button
              onClick={() => {
                if (quickAction.navigate) {
                  onRowClick(task.id);
                } else if (quickAction.action) {
                  onQuickAction(task.id, quickAction.action);
                }
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: quickAction.color || "var(--blue)" }}
            >
              {quickAction.label}
            </button>
          )}
        </td>
      </tr>
    );
  },
);

TaskRow.displayName = "TaskRow";

export function TaskTrackerClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sourceIdParam = searchParams.get("sourceId");
  const { data: session } = useSession();
  
  const { selectedEntityId, selectedTeamId } = useEntity();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats>({ active: 0, overdue: 0, dueThisWeek: 0, pendingReview: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [modalTaskId, setModalTaskId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<{ id: string; name: string } | null>(null);
  const [monitoringAreas, setMonitoringAreas] = useState<Array<{ id: string; name: string }>>([]);
  const [taskTypes, setTaskTypes] = useState<Array<{ id: string; name: string }>>([]);

  const [filters, setFilters] = useState({
    preset: "all",
    quarter: "",
    frequency: "",
    entity: "",
    status: "",
    riskRating: "",
    dueDateFrom: "",
    dueDateTo: "",
    monitoringAreaId: "",
    taskTypeId: "",
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "25",
      });

      if (selectedEntityId !== "GROUP") {
        params.set("entityId", selectedEntityId);
      }
      if (selectedTeamId !== "ALL") {
        params.set("teamId", selectedTeamId);
      }
      if (searchQuery) {
        params.set("search", searchQuery);
      }
      if (filters.quarter) {
        params.set("quarter", filters.quarter);
      }
      if (filters.frequency) {
        params.set("frequency", filters.frequency);
      }
      if (filters.entity) {
        params.set("entityId", filters.entity);
      }
      if (filters.status) {
        params.set("status", filters.status);
      }
      if (filters.riskRating) {
        params.set("riskRating", filters.riskRating);
      }
      if (filters.monitoringAreaId) {
        params.set("monitoringAreaId", filters.monitoringAreaId);
      }
      if (filters.taskTypeId) {
        params.set("taskTypeId", filters.taskTypeId);
      }
      if (sourceIdParam) {
        params.set("sourceId", sourceIdParam);
      }

      if (filters.preset === "overdue") {
        params.set("overdue", "true");
      } else if (filters.preset === "pending-review") {
        params.set("status", "PENDING_REVIEW");
      } else if (filters.preset === "high-risk") {
        params.set("riskRating", "HIGH");
      } else if (filters.preset === "my-tasks" && session?.user?.userId) {
        params.set("picId", session.user.userId);
      } else if (filters.preset === "my-team" && session?.user?.teamIds) {
        params.set("responsibleTeamId", session.user.teamIds.join(","));
      }

      const res = await fetch(`/api/tasks?${params.toString()}`);
      const data = await res.json();
      
      let filteredTasks = data.tasks || [];
      
      // Client-side date range filtering
      if (filters.dueDateFrom || filters.dueDateTo) {
        filteredTasks = filteredTasks.filter((task: Task) => {
          if (!task.dueDate) return false;
          const taskDate = new Date(task.dueDate);
          if (filters.dueDateFrom && taskDate < new Date(filters.dueDateFrom)) return false;
          if (filters.dueDateTo && taskDate > new Date(filters.dueDateTo)) return false;
          return true;
        });
      }
      
      setTasks(filteredTasks);
      setTotal(filters.dueDateFrom || filters.dueDateTo ? filteredTasks.length : data.pagination?.total || 0);

      // Calculate stats from the current result set
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      const calculatedStats: TaskStats = {
        active: filteredTasks.length,
        overdue: filteredTasks.filter((t: Task) => 
          t.dueDate && !t.completedAt && isPast(new Date(t.dueDate))
        ).length,
        dueThisWeek: filteredTasks.filter((t: Task) => 
          t.dueDate && !t.completedAt && new Date(t.dueDate) <= weekFromNow
        ).length,
        pendingReview: filteredTasks.filter((t: Task) => t.status === "PENDING_REVIEW").length,
      };
      
      setStats(calculatedStats);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [selectedEntityId, selectedTeamId, filters, searchQuery, page, sourceIdParam, session]);

  // Load source information when sourceId parameter is present
  useEffect(() => {
    const loadSourceInfo = async () => {
      if (sourceIdParam && !sourceFilter) {
        try {
          const res = await fetch(`/api/sources/${sourceIdParam}`);
          if (res.ok) {
            const source = await res.json();
            setSourceFilter({ id: source.id, name: source.name });
          }
        } catch (error) {
          console.error("Failed to load source info:", error);
        }
      }
    };
    loadSourceInfo();
  }, [sourceIdParam, sourceFilter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [areasRes, typesRes] = await Promise.all([
          fetch("/api/monitoring-areas"),
          fetch("/api/task-types"),
        ]);
        
        if (areasRes.ok) {
          const data = await areasRes.json();
          setMonitoringAreas(data.monitoringAreas);
        }
        
        if (typesRes.ok) {
          const data = await typesRes.json();
          setTaskTypes(data.taskTypes);
        }
      } catch (error) {
        console.error("Failed to fetch metadata:", error);
      }
    };
    
    fetchMetadata();
  }, []);

  async function handleStatusChange(taskId: string, status: string) {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        toast.success("Status updated");
        fetchTasks();
      } else {
        toast.error("Failed to update status");
      }
    } catch (error) {
      console.error("Failed to update status:", error);
      toast.error("Failed to update status");
    }
  }

  function handleQuickAction(taskId: string, status: string) {
    handleStatusChange(taskId, status);
  }

  function toggleSelection(id: string) {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  }

  function toggleAll() {
    if (selectedIds.size === tasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tasks.map((t) => t.id)));
    }
  }

  function clearSourceFilter() {
    setSourceFilter(null);
    router.push("/tasks");
  }

  const presetFilters: FilterChip[] = [
    { id: "all", label: "All", active: filters.preset === "all" },
    { id: "my-tasks", label: "My Tasks", active: filters.preset === "my-tasks", icon: <User size={14} /> },
    { id: "my-team", label: "My Team", active: filters.preset === "my-team", icon: <UserCheck size={14} /> },
    { id: "overdue", label: "Overdue", active: filters.preset === "overdue", icon: <AlertCircle size={14} /> },
    { id: "pending-review", label: "Pending Review", active: filters.preset === "pending-review", icon: <Clock size={14} /> },
    { id: "due-week", label: "Due This Week", active: filters.preset === "due-week", icon: <CalendarIcon size={14} /> },
    { id: "high-risk", label: "High Risk", active: filters.preset === "high-risk", icon: <TrendingUp size={14} /> },
  ];

  const quarterFilters: FilterChip[] = [
    { id: "Q1", label: "Q1", active: filters.quarter === "Q1" },
    { id: "Q2", label: "Q2", active: filters.quarter === "Q2" },
    { id: "Q3", label: "Q3", active: filters.quarter === "Q3" },
    { id: "Q4", label: "Q4", active: filters.quarter === "Q4" },
  ];

  const frequencyFilters: FilterChip[] = [
    { id: "DAILY", label: "Daily", active: filters.frequency === "DAILY" },
    { id: "WEEKLY", label: "Weekly", active: filters.frequency === "WEEKLY" },
    { id: "MONTHLY", label: "Monthly", active: filters.frequency === "MONTHLY" },
    { id: "QUARTERLY", label: "Quarterly", active: filters.frequency === "QUARTERLY" },
    { id: "ANNUAL", label: "Annual", active: filters.frequency === "ANNUAL" },
  ];

  const totalPages = Math.ceil(total / 25);

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border bg-white p-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Active Tasks
              </p>
              <p className="mt-1 text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                {stats.active}
              </p>
            </div>
            <div className="rounded-full p-3" style={{ backgroundColor: "var(--blue-light)" }}>
              <TrendingUp size={20} style={{ color: "var(--blue)" }} />
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Overdue
              </p>
              <p className="mt-1 text-2xl font-bold" style={{ color: "var(--red)" }}>
                {stats.overdue}
              </p>
            </div>
            <div className="rounded-full p-3" style={{ backgroundColor: "var(--red-light)" }}>
              <AlertCircle size={20} style={{ color: "var(--red)" }} />
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Due This Week
              </p>
              <p className="mt-1 text-2xl font-bold" style={{ color: "var(--amber)" }}>
                {stats.dueThisWeek}
              </p>
            </div>
            <div className="rounded-full p-3" style={{ backgroundColor: "var(--amber-light)" }}>
              <CalendarIcon size={20} style={{ color: "var(--amber)" }} />
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Pending Review
              </p>
              <p className="mt-1 text-2xl font-bold" style={{ color: "var(--purple)" }}>
                {stats.pendingReview}
              </p>
            </div>
            <div className="rounded-full p-3" style={{ backgroundColor: "var(--purple-light)" }}>
              <Clock size={20} style={{ color: "var(--purple)" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Info Chip */}
      <div className="flex items-center justify-between rounded-lg border p-3" style={{ backgroundColor: "var(--bg-subtle)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <Info size={16} style={{ color: "var(--blue)" }} />
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Showing active tasks. View all planned tasks in
          </span>
        </div>
        <Link
          href="/calendar"
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
          style={{ backgroundColor: "var(--blue)", color: "white" }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <CalendarIcon size={14} />
          Calendar
          <ArrowRight size={14} />
        </Link>
      </div>

      {/* Source Filter Indicator */}
      {sourceFilter && (
        <div className="flex items-center justify-between rounded-lg border p-3" style={{ backgroundColor: "var(--blue-light)", borderColor: "var(--blue)" }}>
          <div className="flex items-center gap-2">
            <Filter size={16} style={{ color: "var(--blue)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--blue)" }}>
              Showing tasks for: <strong>{sourceFilter.name}</strong>
            </span>
          </div>
          <button
            onClick={clearSourceFilter}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white"
            style={{ color: "var(--blue)", borderColor: "var(--blue)", borderWidth: "1px" }}
          >
            <X size={14} />
            Clear filter
          </button>
        </div>
      )}
      
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {presetFilters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setFilters({ ...filters, preset: filter.id })}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                filter.active ? "border-[var(--blue)] bg-[var(--blue-light)] text-[var(--blue)]" : "border-[var(--border)] bg-white text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
              }`}
              style={{ borderWidth: "1px" }}
            >
              {filter.icon}
              {filter.label}
            </button>
          ))}

          <div className="mx-2 h-4 w-px" style={{ backgroundColor: "var(--border)" }} />

          {quarterFilters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setFilters({ ...filters, quarter: filter.active ? "" : filter.id })}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                filter.active ? "border-[var(--blue)] bg-[var(--blue-light)] text-[var(--blue)]" : "border-[var(--border)] bg-white text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
              }`}
              style={{ borderWidth: "1px" }}
            >
              {filter.label}
            </button>
          ))}

          <div className="mx-2 h-4 w-px" style={{ backgroundColor: "var(--border)" }} />

          {frequencyFilters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setFilters({ ...filters, frequency: filter.active ? "" : filter.id })}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                filter.active ? "border-[var(--blue)] bg-[var(--blue-light)] text-[var(--blue)]" : "border-[var(--border)] bg-white text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
              }`}
              style={{ borderWidth: "1px" }}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-all ${
              showAdvancedFilters ? "border-[var(--blue)] bg-[var(--blue-light)] text-[var(--blue)]" : "border-[var(--border)] bg-white text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            <SlidersHorizontal size={16} />
            Filters
            {showAdvancedFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-64 rounded-lg border bg-white pl-9 pr-3 text-sm outline-none transition-all focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue-light)]"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-[var(--bg-subtle)]"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              <Download size={16} />
              Export
              <ChevronDown size={14} />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border bg-white p-1.5 shadow-lg" style={{ borderColor: "var(--border)" }}>
                {["CSV", "Excel", "PDF"].map((format) => (
                  <button
                    key={format}
                    onClick={() => {
                      toast.success(`Exporting as ${format}...`);
                      setShowExportMenu(false);
                    }}
                    className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--bg-subtle)]"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Export as {format}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div className="rounded-lg border bg-white p-4 space-y-4" style={{ borderColor: "var(--border)" }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                <option value="">All Statuses</option>
                <option value="TO_DO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="PENDING_REVIEW">Pending Review</option>
                <option value="COMPLETED">Completed</option>
                <option value="DEFERRED">Deferred</option>
                <option value="NOT_APPLICABLE">Not Applicable</option>
              </select>
            </div>

            {/* Risk Rating Filter */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
                Risk Rating
              </label>
              <select
                value={filters.riskRating}
                onChange={(e) => setFilters({ ...filters, riskRating: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                <option value="">All Risk Levels</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            {/* Due Date From */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
                Due Date From
              </label>
              <input
                type="date"
                value={filters.dueDateFrom}
                onChange={(e) => setFilters({ ...filters, dueDateFrom: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </div>

            {/* Due Date To */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
                Due Date To
              </label>
              <input
                type="date"
                value={filters.dueDateTo}
                onChange={(e) => setFilters({ ...filters, dueDateTo: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </div>

            {/* Monitoring Area Filter */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
                Monitoring Area
              </label>
              <select
                value={filters.monitoringAreaId}
                onChange={(e) => setFilters({ ...filters, monitoringAreaId: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                <option value="">All Areas</option>
                {monitoringAreas.map((area) => (
                  <option key={area.id} value={area.id}>{area.name}</option>
                ))}
              </select>
            </div>

            {/* Task Type Filter */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
                Task Type
              </label>
              <select
                value={filters.taskTypeId}
                onChange={(e) => setFilters({ ...filters, taskTypeId: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                <option value="">All Types</option>
                {taskTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Clear Filters Button */}
          <div className="flex justify-end">
            <button
              onClick={() => setFilters({ 
                preset: "all", 
                quarter: "", 
                frequency: "", 
                entity: "", 
                status: "", 
                riskRating: "", 
                dueDateFrom: "", 
                dueDateTo: "",
                monitoringAreaId: "",
                taskTypeId: "",
              })}
              className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--bg-subtle)]"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              <X size={14} />
              Clear All Filters
            </button>
          </div>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border p-3" style={{ backgroundColor: "var(--blue-light)", borderColor: "var(--blue)" }}>
          <span className="text-sm font-medium" style={{ color: "var(--blue)" }}>
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white"
              style={{ borderColor: "var(--blue)", color: "var(--blue)", backgroundColor: "transparent" }}
            >
              Set Team...
            </button>
            <button
              className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white"
              style={{ borderColor: "var(--blue)", color: "var(--blue)", backgroundColor: "transparent" }}
            >
              Change Status
            </button>
            <button
              className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white"
              style={{ borderColor: "var(--blue)", color: "var(--blue)", backgroundColor: "transparent" }}
            >
              Set Due Date
            </button>
          </div>
        </div>
      )}

      <div className="rounded-[14px] border bg-white shadow-sm" style={{ borderColor: "var(--border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full">
              <thead>
                <tr className="border-b" style={{ backgroundColor: "var(--bg-subtle)", borderColor: "var(--border)" }}>
                  <th className="px-4 py-3 text-left">
                    <button onClick={toggleAll} className="flex items-center justify-center">
                      {selectedIds.size === tasks.length && tasks.length > 0 ? (
                        <CheckSquare size={18} style={{ color: "var(--blue)" }} />
                      ) : (
                        <Square size={18} style={{ color: "var(--text-muted)" }} />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Task Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Entity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Risk
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Area
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    PIC
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Team
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Due Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                      Loading tasks...
                    </td>
                  </tr>
                ) : tasks.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center">
                      <Filter size={48} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                      <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                        No tasks found
                      </p>
                      <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                        Try adjusting your filters
                      </p>
                    </td>
                  </tr>
                ) : (
                  tasks.map((task) => (
                    <TaskRow 
                      key={task.id} 
                      task={task} 
                      isSelected={selectedIds.has(task.id)} 
                      onToggle={toggleSelection} 
                      onQuickAction={handleQuickAction}
                      onRowClick={(id) => router.push(`/tasks/${id}`)}
                    />
                  ))
                )}
              </tbody>
          </table>
        </div>

        {!loading && tasks.length > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-3" style={{ borderColor: "var(--border-light)" }}>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Showing {(page - 1) * 25 + 1}-{Math.min(page * 25, total)} of {total} tasks
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-30 hover:bg-[var(--bg-subtle)]"
                style={{ borderColor: "var(--border)" }}
              >
                <ChevronLeft size={16} style={{ color: "var(--text-secondary)" }} />
              </button>
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-30 hover:bg-[var(--bg-subtle)]"
                style={{ borderColor: "var(--border)" }}
              >
                <ChevronRight size={16} style={{ color: "var(--text-secondary)" }} />
              </button>
            </div>
          </div>
        )}
      </div>

      {modalTaskId && (
        <TaskDetailModal
          isOpen={!!modalTaskId}
          taskId={modalTaskId}
          onClose={() => setModalTaskId(null)}
          onTaskUpdated={fetchTasks}
          onNavigateToTask={(taskId) => setModalTaskId(taskId)}
        />
      )}
    </div>
  );
}
