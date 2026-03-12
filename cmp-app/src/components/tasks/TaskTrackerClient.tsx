"use client";

import { useEffect, useState, useCallback, memo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Clock,
  Calendar,
  TrendingUp,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
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
  responsibleTeam: { id: string; name: string } | null;
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
    onStatusChange,
    onRowClick,
  }: {
    task: Task;
    isSelected: boolean;
    onToggle: (id: string) => void;
    onStatusChange: (id: string, status: string) => void;
    onRowClick: (id: string) => void;
  }) => {
    const [showStatusMenu, setShowStatusMenu] = useState(false);
    const isOverdue = task.dueDate && !task.completedAt && isPast(new Date(task.dueDate));

    const riskConfig = RISK_COLORS[task.riskRating as keyof typeof RISK_COLORS];

    return (
      <tr 
        className="group border-t transition-colors hover:bg-[var(--bg-hover)] cursor-pointer" 
        style={{ borderColor: "var(--border-light)" }}
        onClick={() => onRowClick(task.id)}
      >
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => onToggle(task.id)} className="flex items-center justify-center">
            {isSelected ? <CheckSquare size={18} style={{ color: "var(--blue)" }} /> : <Square size={18} style={{ color: "var(--text-muted)" }} />}
          </button>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <p className="font-medium leading-tight" style={{ color: "var(--text-primary)" }}>
                {task.name}
              </p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <EntityBadge entityCode={task.entity.code as "DIEL" | "DGL" | "DBVI" | "FINSERV" | "GROUP"} />
        </td>
        <td className="px-4 py-3">
          <div>
            <p className="text-sm font-medium leading-tight" style={{ color: "var(--text-secondary)" }}>
              {task.source.name}
            </p>
            {task.sourceItem && (
              <p className="font-mono text-xs leading-tight" style={{ color: "var(--text-muted)" }}>
                {task.sourceItem.reference}
              </p>
            )}
          </div>
        </td>
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <div className="relative">
            <button onClick={() => setShowStatusMenu(!showStatusMenu)} className="transition-opacity hover:opacity-80">
              <StatusPill status={task.status as "TO_DO" | "IN_PROGRESS" | "PENDING_REVIEW" | "COMPLETED" | "DEFERRED" | "NOT_APPLICABLE"} />
            </button>
            {showStatusMenu && (
              <div className="absolute left-0 top-full z-10 mt-1 w-48 rounded-lg border bg-white p-1.5 shadow-lg" style={{ borderColor: "var(--border)" }}>
                {["TO_DO", "IN_PROGRESS", "PENDING_REVIEW", "COMPLETED", "DEFERRED", "NOT_APPLICABLE"].map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      onStatusChange(task.id, status);
                      setShowStatusMenu(false);
                    }}
                    className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--bg-subtle)]"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <StatusPill status={status as "TO_DO" | "IN_PROGRESS" | "PENDING_REVIEW" | "COMPLETED" | "DEFERRED" | "NOT_APPLICABLE"} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: riskConfig.bg, color: riskConfig.color }}>
            {task.riskRating}
          </span>
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
          <div className="space-y-1">
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium" style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}>
              {task.frequency}
            </span>
            {task.quarter && (
              <span className="ml-1 inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium" style={{ backgroundColor: "var(--blue-light)", color: "var(--blue)" }}>
                {task.quarter}
              </span>
            )}
          </div>
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
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {task.clickupUrl && (
              <a href={task.clickupUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs transition-opacity hover:opacity-60" style={{ color: "var(--blue)" }}>
                <ExternalLink size={14} />
              </a>
            )}
            {task.gdriveUrl && (
              <a href={task.gdriveUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs transition-opacity hover:opacity-60" style={{ color: "var(--green)" }}>
                <ExternalLink size={14} />
              </a>
            )}
          </div>
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
  
  const { selectedEntityId, selectedTeamId } = useEntity();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [modalTaskId, setModalTaskId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<{ id: string; name: string } | null>(null);

  const [filters, setFilters] = useState({
    preset: "all",
    quarter: "",
    frequency: "",
    entity: "",
  });

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
      if (sourceIdParam) {
        params.set("sourceId", sourceIdParam);
      }

      if (filters.preset === "overdue") {
        params.set("status", "IN_PROGRESS");
      } else if (filters.preset === "pending-review") {
        params.set("status", "PENDING_REVIEW");
      } else if (filters.preset === "high-risk") {
        params.set("riskRating", "HIGH");
      }

      const res = await fetch(`/api/tasks?${params.toString()}`);
      const data = await res.json();
      setTasks(data.tasks || []);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [selectedEntityId, selectedTeamId, filters, searchQuery, page, sourceIdParam]);

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
    { id: "overdue", label: "Overdue", active: filters.preset === "overdue", icon: <AlertCircle size={14} /> },
    { id: "pending-review", label: "Pending Review", active: filters.preset === "pending-review", icon: <Clock size={14} /> },
    { id: "due-week", label: "Due This Week", active: filters.preset === "due-week", icon: <Calendar size={14} /> },
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
                  Source & Ref
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Risk
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Team
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Freq / Quarter
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Due Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  Links
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                    Loading tasks...
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
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
                    onStatusChange={handleStatusChange}
                    onRowClick={(id) => setModalTaskId(id)}
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
        />
      )}
    </div>
  );
}
