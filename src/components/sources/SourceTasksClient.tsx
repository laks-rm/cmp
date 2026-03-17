"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Edit2,
  Save,
  X,
  Calendar,
  Users,
  UserCheck,
  Shield,
  FileCheck,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Filter,
  Download,
} from "lucide-react";
import { EntityBadge } from "@/components/ui/EntityBadge";
import toast from "@/lib/toast";
import { fetchApi } from "@/lib/api-client";

type Source = {
  id: string;
  code: string;
  name: string;
  sourceType: string;
  team: {
    id: string;
    name: string;
  };
  entities: Array<{
    entity: {
      id: string;
      code: string;
      name: string;
    };
  }>;
};

type SourceItem = {
  id: string;
  reference: string;
  title: string;
  description: string | null;
  sortOrder: number;
};

type Task = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  riskRating: string;
  frequency: string;
  quarter: string | null;
  dueDate: string | null;
  plannedDate: string | null;
  responsibleTeamId: string | null;
  responsibleTeam: { id: string; name: string } | null;
  picId: string | null;
  pic: { id: string; name: string; initials: string } | null;
  reviewerId: string | null;
  reviewer: { id: string; name: string; initials: string } | null;
  assigneeId: string | null;
  assignee: { id: string; name: string; initials: string } | null;
  evidenceRequired: boolean;
  narrativeRequired: boolean;
  reviewRequired: boolean;
  entityId: string;
  entity: { id: string; code: string; name: string };
  sourceItemId: string | null;
  recurrenceGroupId: string | null;
  recurrenceIndex: number | null;
  recurrenceTotalCount: number | null;
  completedAt: string | null;
};

type Team = {
  id: string;
  name: string;
};

type User = {
  id: string;
  name: string;
  initials: string;
  email: string;
};

const STATUS_COLORS = {
  PLANNED: { bg: "var(--bg-muted)", color: "var(--text-muted)", label: "Planned" },
  TO_DO: { bg: "var(--blue-light)", color: "var(--blue)", label: "To Do" },
  IN_PROGRESS: { bg: "var(--amber-light)", color: "var(--amber)", label: "In Progress" },
  PENDING_REVIEW: { bg: "var(--purple-light)", color: "var(--purple)", label: "Pending Review" },
  COMPLETED: { bg: "var(--green-light)", color: "var(--green)", label: "Completed" },
  DEFERRED: { bg: "var(--text-muted)", color: "var(--text-secondary)", label: "Deferred" },
  NOT_APPLICABLE: { bg: "var(--bg-subtle)", color: "var(--text-muted)", label: "N/A" },
};

const RISK_COLORS = {
  HIGH: { bg: "var(--red-light)", color: "var(--red)", label: "High" },
  MEDIUM: { bg: "var(--amber-light)", color: "var(--amber)", label: "Medium" },
  LOW: { bg: "var(--green-light)", color: "var(--green)", label: "Low" },
};

export function SourceTasksClient({ sourceId }: { sourceId: string }) {
  const router = useRouter();
  const [source, setSource] = useState<Source | null>(null);
  const [items, setItems] = useState<SourceItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Task>>({});
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [entityFilter, setEntityFilter] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, [sourceId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch source with all related data
      let sourceData: any;
      try {
        sourceData = await fetchApi<any>(`/api/sources/${sourceId}`);
      } catch (error: any) {
        console.error("Failed to fetch source:", error);
        toast.error(`Failed to load source: ${error.message || "Unknown error"}`);
        return;
      }
      
      // Extract source metadata
      const source: Source = {
        id: sourceData.id,
        code: sourceData.code,
        name: sourceData.name,
        sourceType: sourceData.sourceType,
        team: sourceData.team,
        entities: sourceData.entities,
      };
      setSource(source);
      
      // Extract items from source response
      const itemsData: SourceItem[] = sourceData.items || [];
      setItems(itemsData);
      
      // Fetch tasks separately
      let tasksData: Task[] = [];
      try {
        const tasksResponse = await fetchApi<{ tasks: Task[] }>(`/api/tasks?sourceId=${sourceId}`);
        tasksData = tasksResponse.tasks || [];
        setTasks(tasksData);
      } catch (error: any) {
        console.error("Failed to fetch tasks:", error);
        toast.error(`Failed to load tasks: ${error.message || "Unknown error"}`);
        // Continue anyway - show source without tasks
      }
      
      // Fetch teams and users in parallel (for dropdowns)
      try {
        const [teamsData, usersData] = await Promise.all([
          fetchApi<Team[]>("/api/teams"),
          fetchApi<User[]>("/api/users/reviewers"),
        ]);
        setTeams(teamsData || []);
        setUsers(usersData || []);
      } catch (error: any) {
        console.error("Failed to fetch teams/users:", error);
        // Non-critical - editing will be limited but view still works
      }

      // Expand all items by default for validation view
      if (itemsData.length > 0) {
        setExpandedItems(new Set(itemsData.map((item) => item.id)));
      }
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load source task management view");
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const startEdit = (task: Task) => {
    setEditingTask(task.id);
    setEditForm({
      responsibleTeamId: task.responsibleTeamId,
      picId: task.picId,
      reviewerId: task.reviewerId,
      dueDate: task.dueDate,
      plannedDate: task.plannedDate,
      status: task.status,
      riskRating: task.riskRating,
    });
  };

  const cancelEdit = () => {
    setEditingTask(null);
    setEditForm({});
  };

  const saveEdit = async (taskId: string) => {
    try {
      setSaving(true);
      await fetchApi(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(editForm),
      });
      
      // Update local state
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...editForm } : t))
      );
      
      toast.success("Task updated successfully");
      setEditingTask(null);
      setEditForm({});
    } catch (error) {
      console.error("Error saving task:", error);
      toast.error("Failed to update task");
    } finally {
      setSaving(false);
    }
  };

  // Group tasks by item
  const tasksByItem = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    const orphanTasks: Task[] = [];

    tasks.forEach((task) => {
      if (task.sourceItemId) {
        if (!grouped.has(task.sourceItemId)) {
          grouped.set(task.sourceItemId, []);
        }
        grouped.get(task.sourceItemId)!.push(task);
      } else {
        orphanTasks.push(task);
      }
    });

    return { grouped, orphanTasks };
  }, [tasks]);

  // Apply filters
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const itemTasks = tasksByItem.grouped.get(item.id) || [];
      
      // If no tasks, don't show item
      if (itemTasks.length === 0) return false;

      // Apply status filter
      if (statusFilter) {
        const hasMatchingStatus = itemTasks.some((t) => t.status === statusFilter);
        if (!hasMatchingStatus) return false;
      }

      // Apply entity filter
      if (entityFilter) {
        const hasMatchingEntity = itemTasks.some((t) => t.entity.code === entityFilter);
        if (!hasMatchingEntity) return false;
      }

      return true;
    });
  }, [items, tasksByItem, statusFilter, entityFilter]);

  const getStatusStyle = (status: string) => STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.TO_DO;
  const getRiskStyle = (risk: string) => RISK_COLORS[risk as keyof typeof RISK_COLORS] || RISK_COLORS.MEDIUM;

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <RefreshCw size={24} className="animate-spin" style={{ color: "var(--blue)" }} />
        <p className="ml-3 text-sm" style={{ color: "var(--text-muted)" }}>
          Loading source tasks...
        </p>
      </div>
    );
  }

  if (!source) {
    return (
      <div className="flex h-96 flex-col items-center justify-center">
        <AlertCircle size={64} style={{ color: "var(--red)" }} />
        <p className="mt-4 text-lg font-medium" style={{ color: "var(--text-primary)" }}>
          Source not found
        </p>
        <button
          onClick={() => router.push("/sources")}
          className="mt-4 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
          style={{ backgroundColor: "var(--blue)", color: "white" }}
        >
          <ArrowLeft size={16} />
          Back to Sources
        </button>
      </div>
    );
  }

  const uniqueEntities = Array.from(new Set(tasks.map((t) => t.entity.code)));
  const uniqueStatuses = Array.from(new Set(tasks.map((t) => t.status)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <button
            onClick={() => router.push("/sources")}
            className="mt-1 rounded-lg p-2 transition-colors hover:bg-[var(--bg-subtle)]"
            style={{ color: "var(--text-secondary)" }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                {source.name}
              </h1>
              <span className="text-sm font-mono px-2 py-1 rounded" style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-muted)" }}>
                {source.code}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {source.entities.map((se) => (
                <EntityBadge
                  key={se.entity.id}
                  entityCode={se.entity.code as "DIEL" | "DGL" | "DBVI" | "FINSERV" | "GROUP"}
                />
              ))}
            </div>
            <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              Task validation and metadata management
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/tasks?sourceId=${sourceId}`)}
            className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--bg-subtle)]"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            <CheckCircle size={16} />
            Task Tracker View
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)", backgroundColor: "white" }}>
          <div className="flex items-center gap-2">
            <CheckCircle size={20} style={{ color: "var(--blue)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
              Total Tasks
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            {tasks.length}
          </p>
        </div>
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)", backgroundColor: "white" }}>
          <div className="flex items-center gap-2">
            <FileCheck size={20} style={{ color: "var(--green)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
              Completed
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold" style={{ color: "var(--green)" }}>
            {tasks.filter((t) => t.status === "COMPLETED").length}
          </p>
        </div>
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)", backgroundColor: "white" }}>
          <div className="flex items-center gap-2">
            <Clock size={20} style={{ color: "var(--amber)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
              In Progress
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold" style={{ color: "var(--amber)" }}>
            {tasks.filter((t) => ["TO_DO", "IN_PROGRESS", "PENDING_REVIEW"].includes(t.status)).length}
          </p>
        </div>
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)", backgroundColor: "white" }}>
          <div className="flex items-center gap-2">
            <AlertCircle size={20} style={{ color: "var(--red)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
              High Risk
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold" style={{ color: "var(--red)" }}>
            {tasks.filter((t) => t.riskRating === "HIGH").length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border bg-white p-4" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} style={{ color: "var(--text-muted)" }} />
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Filters
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              <option value="">All Statuses</option>
              {uniqueStatuses.map((status) => (
                <option key={status} value={status}>
                  {getStatusStyle(status).label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
              Entity
            </label>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              <option value="">All Entities</option>
              {uniqueEntities.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setStatusFilter("");
                setEntityFilter("");
              }}
              className="flex h-[42px] items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors hover:bg-[var(--bg-subtle)]"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              <X size={14} />
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Tasks grouped by clause/item */}
      <div className="space-y-4">
        {filteredItems.length === 0 ? (
          <div className="rounded-lg border bg-white p-8 text-center" style={{ borderColor: "var(--border)" }}>
            <AlertCircle size={48} style={{ color: "var(--text-muted)", margin: "0 auto 16px" }} />
            <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
              No tasks found
            </p>
            <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
              {statusFilter || entityFilter
                ? "Try adjusting your filters"
                : "This source has no generated tasks yet"}
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const itemTasks = (tasksByItem.grouped.get(item.id) || [])
              .filter((task) => {
                if (statusFilter && task.status !== statusFilter) return false;
                if (entityFilter && task.entity.code !== entityFilter) return false;
                return true;
              })
              .sort((a, b) => {
                // Sort by recurrence index if available
                if (a.recurrenceIndex !== null && b.recurrenceIndex !== null) {
                  return a.recurrenceIndex - b.recurrenceIndex;
                }
                // Then by due date
                if (a.dueDate && b.dueDate) {
                  return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                }
                return 0;
              });

            const isExpanded = expandedItems.has(item.id);
            const completedCount = itemTasks.filter((t) => t.status === "COMPLETED").length;
            const missingTeam = itemTasks.filter((t) => !t.responsibleTeamId).length;
            const missingPIC = itemTasks.filter((t) => !t.picId).length;

            return (
              <div
                key={item.id}
                className="rounded-lg border bg-white"
                style={{ borderColor: "var(--border)" }}
              >
                {/* Item Header */}
                <button
                  onClick={() => toggleItem(item.id)}
                  className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-[var(--bg-subtle)]"
                >
                  <div className="mt-1">
                    {isExpanded ? (
                      <ChevronDown size={20} style={{ color: "var(--text-muted)" }} />
                    ) : (
                      <ChevronRight size={20} style={{ color: "var(--text-muted)" }} />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                          {item.reference} — {item.title}
                        </h3>
                        {item.description && (
                          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                            {item.description}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-3 text-sm">
                        <div className="flex items-center gap-1">
                          <CheckCircle size={14} style={{ color: "var(--green)" }} />
                          <span style={{ color: "var(--text-muted)" }}>
                            {completedCount}/{itemTasks.length}
                          </span>
                        </div>
                        {missingTeam > 0 && (
                          <div className="flex items-center gap-1">
                            <Users size={14} style={{ color: "var(--red)" }} />
                            <span style={{ color: "var(--red)" }}>{missingTeam} no team</span>
                          </div>
                        )}
                        {missingPIC > 0 && (
                          <div className="flex items-center gap-1">
                            <UserCheck size={14} style={{ color: "var(--amber)" }} />
                            <span style={{ color: "var(--amber)" }}>{missingPIC} no PIC</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </button>

                {/* Tasks */}
                {isExpanded && (
                  <div className="border-t" style={{ borderColor: "var(--border)" }}>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-[var(--bg-subtle)]">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                              Task Name
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                              Status
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                              Risk
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                              Frequency
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                              Entity
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                              Due Date
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                              Team
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                              PIC
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                              Reviewer
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                              Flags
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                          {itemTasks.map((task) => {
                            const isEditing = editingTask === task.id;
                            const statusStyle = getStatusStyle(task.status);
                            const riskStyle = getRiskStyle(task.riskRating);

                            return (
                              <tr key={task.id} className="hover:bg-[var(--bg-subtle)]">
                                <td className="px-4 py-3">
                                  <div>
                                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                      {task.name}
                                    </p>
                                    {task.recurrenceIndex !== null && (
                                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                        Instance {task.recurrenceIndex}/{task.recurrenceTotalCount || "∞"}
                                      </p>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  {isEditing ? (
                                    <select
                                      value={editForm.status || task.status}
                                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                      className="w-full rounded border px-2 py-1 text-xs"
                                      style={{ borderColor: "var(--border)" }}
                                    >
                                      {Object.entries(STATUS_COLORS).map(([key, value]) => (
                                        <option key={key} value={key}>
                                          {value.label}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span
                                      className="inline-block rounded-md px-2 py-1 text-xs font-medium"
                                      style={{
                                        backgroundColor: statusStyle.bg,
                                        color: statusStyle.color,
                                      }}
                                    >
                                      {statusStyle.label}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {isEditing ? (
                                    <select
                                      value={editForm.riskRating || task.riskRating}
                                      onChange={(e) => setEditForm({ ...editForm, riskRating: e.target.value })}
                                      className="w-full rounded border px-2 py-1 text-xs"
                                      style={{ borderColor: "var(--border)" }}
                                    >
                                      {Object.entries(RISK_COLORS).map(([key, value]) => (
                                        <option key={key} value={key}>
                                          {value.label}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span
                                      className="inline-block rounded-md px-2 py-1 text-xs font-medium"
                                      style={{
                                        backgroundColor: riskStyle.bg,
                                        color: riskStyle.color,
                                      }}
                                    >
                                      {riskStyle.label}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                                    <p>{task.frequency.replace(/_/g, " ")}</p>
                                    {task.quarter && (
                                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                        {task.quarter}
                                      </p>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <EntityBadge
                                    entityCode={task.entity.code as "DIEL" | "DGL" | "DBVI" | "FINSERV" | "GROUP"}
                                    size="sm"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  {task.dueDate ? (
                                    <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                                      {new Date(task.dueDate).toLocaleDateString()}
                                    </div>
                                  ) : (
                                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                      No due date
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {isEditing ? (
                                    <select
                                      value={editForm.responsibleTeamId || task.responsibleTeamId || ""}
                                      onChange={(e) =>
                                        setEditForm({ ...editForm, responsibleTeamId: e.target.value || null })
                                      }
                                      className="w-full rounded border px-2 py-1 text-xs"
                                      style={{ borderColor: "var(--border)" }}
                                    >
                                      <option value="">No team</option>
                                      {teams.map((team) => (
                                        <option key={team.id} value={team.id}>
                                          {team.name}
                                        </option>
                                      ))}
                                    </select>
                                  ) : task.responsibleTeam ? (
                                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                                      {task.responsibleTeam.name}
                                    </span>
                                  ) : (
                                    <span className="text-xs" style={{ color: "var(--red)" }}>
                                      No team
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {isEditing ? (
                                    <select
                                      value={editForm.picId || task.picId || ""}
                                      onChange={(e) => setEditForm({ ...editForm, picId: e.target.value || null })}
                                      className="w-full rounded border px-2 py-1 text-xs"
                                      style={{ borderColor: "var(--border)" }}
                                    >
                                      <option value="">No PIC</option>
                                      {users.map((user) => (
                                        <option key={user.id} value={user.id}>
                                          {user.name}
                                        </option>
                                      ))}
                                    </select>
                                  ) : task.pic ? (
                                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                                      {task.pic.initials}
                                    </span>
                                  ) : (
                                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                      —
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {isEditing ? (
                                    <select
                                      value={editForm.reviewerId || task.reviewerId || ""}
                                      onChange={(e) => setEditForm({ ...editForm, reviewerId: e.target.value || null })}
                                      className="w-full rounded border px-2 py-1 text-xs"
                                      style={{ borderColor: "var(--border)" }}
                                    >
                                      <option value="">No reviewer</option>
                                      {users.map((user) => (
                                        <option key={user.id} value={user.id}>
                                          {user.name}
                                        </option>
                                      ))}
                                    </select>
                                  ) : task.reviewer ? (
                                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                                      {task.reviewer.initials}
                                    </span>
                                  ) : (
                                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                      —
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-1">
                                    {task.evidenceRequired && (
                                      <div
                                        className="rounded px-1 py-0.5 text-xs"
                                        style={{ backgroundColor: "var(--blue-light)", color: "var(--blue)" }}
                                        title="Evidence Required"
                                      >
                                        E
                                      </div>
                                    )}
                                    {task.reviewRequired && (
                                      <div
                                        className="rounded px-1 py-0.5 text-xs"
                                        style={{ backgroundColor: "var(--purple-light)", color: "var(--purple)" }}
                                        title="Review Required"
                                      >
                                        R
                                      </div>
                                    )}
                                    {task.narrativeRequired && (
                                      <div
                                        className="rounded px-1 py-0.5 text-xs"
                                        style={{ backgroundColor: "var(--green-light)", color: "var(--green)" }}
                                        title="Narrative Required"
                                      >
                                        N
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  {isEditing ? (
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => saveEdit(task.id)}
                                        disabled={saving}
                                        className="rounded p-1 transition-colors hover:bg-[var(--green-light)]"
                                        style={{ color: "var(--green)" }}
                                        title="Save"
                                      >
                                        <Save size={14} />
                                      </button>
                                      <button
                                        onClick={cancelEdit}
                                        disabled={saving}
                                        className="rounded p-1 transition-colors hover:bg-[var(--red-light)]"
                                        style={{ color: "var(--red)" }}
                                        title="Cancel"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => startEdit(task)}
                                      className="rounded p-1 transition-colors hover:bg-[var(--blue-light)]"
                                      style={{ color: "var(--blue)" }}
                                      title="Edit"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
