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
  Eye,
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

// Template represents the editable recurring task definition
type TaskTemplate = {
  recurrenceGroupId: string;
  name: string;
  description: string | null;
  frequency: string;
  riskRating: string;
  responsibleTeamId: string | null;
  responsibleTeam: { id: string; name: string } | null;
  picId: string | null;
  pic: { id: string; name: string; initials: string } | null;
  reviewerId: string | null;
  reviewer: { id: string; name: string; initials: string } | null;
  evidenceRequired: boolean;
  narrativeRequired: boolean;
  reviewRequired: boolean;
  entityId: string;
  entity: { id: string; code: string; name: string };
  firstDueDate: string | null;
  instanceCount: number;
  instances: Task[];
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

const FREQUENCIES = [
  { value: "ADHOC", label: "Ad-hoc" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "SEMI_ANNUAL", label: "Semi-Annual" },
  { value: "ANNUAL", label: "Annual" },
  { value: "BIENNIAL", label: "Biennial" },
  { value: "ONE_TIME", label: "One-Time" },
];

export function SourceTasksClient({ sourceId }: { sourceId: string }) {
  const router = useRouter();
  const [source, setSource] = useState<Source | null>(null);
  const [items, setItems] = useState<SourceItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [entityFilter, setEntityFilter] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, [sourceId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      let sourceData: any;
      try {
        sourceData = await fetchApi<any>(`/api/sources/${sourceId}`);
      } catch (error: any) {
        console.error("Failed to fetch source:", error);
        toast.error(`Failed to load source: ${error.message || "Unknown error"}`);
        return;
      }
      
      const source: Source = {
        id: sourceData.id,
        code: sourceData.code,
        name: sourceData.name,
        sourceType: sourceData.sourceType,
        team: sourceData.team,
        entities: sourceData.entities,
      };
      setSource(source);
      
      const itemsData: SourceItem[] = sourceData.items || [];
      setItems(itemsData);
      
      let tasksData: Task[] = [];
      try {
        const tasksResponse = await fetchApi<{ tasks: Task[] }>(`/api/tasks?sourceId=${sourceId}`);
        tasksData = tasksResponse.tasks || [];
        setTasks(tasksData);
      } catch (error: any) {
        console.error("Failed to fetch tasks:", error);
        toast.error(`Failed to load tasks: ${error.message || "Unknown error"}`);
      }
      
      try {
        const [teamsData, usersData] = await Promise.all([
          fetchApi<Team[]>("/api/teams"),
          fetchApi<User[]>("/api/users/reviewers"),
        ]);
        setTeams(teamsData || []);
        setUsers(usersData || []);
      } catch (error: any) {
        console.error("Failed to fetch teams/users:", error);
      }

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

  const toggleTemplate = (templateId: string) => {
    const newExpanded = new Set(expandedTemplates);
    if (newExpanded.has(templateId)) {
      newExpanded.delete(templateId);
    } else {
      newExpanded.add(templateId);
    }
    setExpandedTemplates(newExpanded);
  };

  const startEditTemplate = (template: TaskTemplate) => {
    setEditingTemplateId(template.recurrenceGroupId);
    setEditForm({
      name: template.name,
      description: template.description,
      frequency: template.frequency,
      riskRating: template.riskRating,
      responsibleTeamId: template.responsibleTeamId,
      picId: template.picId,
      reviewerId: template.reviewerId,
      evidenceRequired: template.evidenceRequired,
      reviewRequired: template.reviewRequired,
      narrativeRequired: template.narrativeRequired,
      firstDueDate: template.firstDueDate,
    });
  };

  const cancelEdit = () => {
    setEditingTemplateId(null);
    setEditForm({});
  };

  const saveTemplate = async (recurrenceGroupId: string) => {
    if (!recurrenceGroupId) {
      toast.error("Cannot edit: This is not a recurring task template");
      return;
    }

    try {
      setSaving(true);
      
      const updates: any = {};
      if (editForm.name !== undefined) updates.name = editForm.name;
      if (editForm.description !== undefined) updates.description = editForm.description;
      if (editForm.frequency !== undefined) updates.frequency = editForm.frequency;
      if (editForm.riskRating !== undefined) updates.riskRating = editForm.riskRating;
      if (editForm.responsibleTeamId !== undefined) updates.responsibleTeamId = editForm.responsibleTeamId;
      if (editForm.picId !== undefined) updates.picId = editForm.picId;
      if (editForm.reviewerId !== undefined) updates.reviewerId = editForm.reviewerId;
      if (editForm.evidenceRequired !== undefined) updates.evidenceRequired = editForm.evidenceRequired;
      if (editForm.reviewRequired !== undefined) updates.reviewRequired = editForm.reviewRequired;
      if (editForm.narrativeRequired !== undefined) updates.narrativeRequired = editForm.narrativeRequired;
      if (editForm.firstDueDate !== undefined) updates.firstDueDate = editForm.firstDueDate;

      console.log('[CLIENT] Saving template:', {
        recurrenceGroupId,
        updateKeys: Object.keys(updates),
        updates,
      });

      await fetchApi("/api/tasks/recurrence-group", {
        method: "PATCH",
        body: JSON.stringify({
          recurrenceGroupId,
          updates,
        }),
      });
      
      toast.success("Recurring task template updated successfully");
      setEditingTemplateId(null);
      setEditForm({});
      
      await fetchData();
    } catch (error: any) {
      console.error("Error saving template:", error);
      const errorMessage = error?.message || "Failed to update recurring task template";
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // Group tasks by item and recurrence group
  const tasksByItem = useMemo(() => {
    const grouped = new Map<string, (Task | TaskTemplate)[]>();
    const orphanTasks: (Task | TaskTemplate)[] = [];

    // Group tasks by recurrence group
    const recurrenceGroups = new Map<string, Task[]>();
    const standaloneTasks: Task[] = [];

    tasks.forEach((task) => {
      // Only create template if task has a recurrenceGroupId
      // Tasks with frequency but no recurrenceGroupId (legacy/edge case) are treated as standalone
      if (task.recurrenceGroupId) {
        if (!recurrenceGroups.has(task.recurrenceGroupId)) {
          recurrenceGroups.set(task.recurrenceGroupId, []);
        }
        recurrenceGroups.get(task.recurrenceGroupId)!.push(task);
      } else {
        standaloneTasks.push(task);
      }
    });

    // Create templates from recurrence groups
    const templates: TaskTemplate[] = [];
    recurrenceGroups.forEach((instances, recurrenceGroupId) => {
      if (instances.length === 0) return;
      
      instances.sort((a, b) => {
        if (a.recurrenceIndex !== null && b.recurrenceIndex !== null) {
          return a.recurrenceIndex - b.recurrenceIndex;
        }
        return 0;
      });

      const firstInstance = instances[0];
      const template: TaskTemplate = {
        recurrenceGroupId,
        name: firstInstance.name,
        description: firstInstance.description,
        frequency: firstInstance.frequency,
        riskRating: firstInstance.riskRating,
        responsibleTeamId: firstInstance.responsibleTeamId,
        responsibleTeam: firstInstance.responsibleTeam,
        picId: firstInstance.picId,
        pic: firstInstance.pic,
        reviewerId: firstInstance.reviewerId,
        reviewer: firstInstance.reviewer,
        evidenceRequired: firstInstance.evidenceRequired,
        narrativeRequired: firstInstance.narrativeRequired,
        reviewRequired: firstInstance.reviewRequired,
        entityId: firstInstance.entityId,
        entity: firstInstance.entity,
        firstDueDate: instances.find((i) => i.dueDate)?.dueDate || null,
        instanceCount: instances.length,
        instances,
      };
      templates.push(template);
    });

    // Group by source item
    [...templates, ...standaloneTasks].forEach((item) => {
      const sourceItemId = "instances" in item ? item.instances[0].sourceItemId : item.sourceItemId;
      if (sourceItemId) {
        if (!grouped.has(sourceItemId)) {
          grouped.set(sourceItemId, []);
        }
        grouped.get(sourceItemId)!.push(item);
      } else {
        orphanTasks.push(item);
      }
    });

    return { grouped, orphanTasks };
  }, [tasks]);

  // Apply filters
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const itemTasks = tasksByItem.grouped.get(item.id) || [];
      
      if (itemTasks.length === 0) return false;

      if (statusFilter || entityFilter) {
        const hasMatch = itemTasks.some((taskOrTemplate) => {
          if ("instances" in taskOrTemplate) {
            return taskOrTemplate.instances.some((t) => {
              if (statusFilter && t.status !== statusFilter) return false;
              if (entityFilter && t.entity.code !== entityFilter) return false;
              return true;
            });
          } else {
            if (statusFilter && taskOrTemplate.status !== statusFilter) return false;
            if (entityFilter && taskOrTemplate.entity.code !== entityFilter) return false;
            return true;
          }
        });
        if (!hasMatch) return false;
      }

      return true;
    });
  }, [items, tasksByItem, statusFilter, entityFilter]);

  const getStatusStyle = (status: string) => STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.TO_DO;
  const getRiskStyle = (risk: string) => RISK_COLORS[risk as keyof typeof RISK_COLORS] || RISK_COLORS.MEDIUM;
  const getFrequencyLabel = (freq: string) => FREQUENCIES.find((f) => f.value === freq)?.label || freq;

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
              Task template management and metadata editing
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
            const itemTasksOrTemplates = tasksByItem.grouped.get(item.id) || [];
            const isExpanded = expandedItems.has(item.id);

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
                        <span style={{ color: "var(--text-muted)" }}>
                          {itemTasksOrTemplates.length} task{itemTasksOrTemplates.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Task Templates / Tasks */}
                {isExpanded && (
                  <div className="border-t" style={{ borderColor: "var(--border)" }}>
                    <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                      {itemTasksOrTemplates.map((taskOrTemplate) => {
                        if ("instances" in taskOrTemplate) {
                          return (
                            <TemplateRow
                              key={taskOrTemplate.recurrenceGroupId}
                              template={taskOrTemplate}
                              isEditing={editingTemplateId === taskOrTemplate.recurrenceGroupId}
                              editForm={editForm}
                              setEditForm={setEditForm}
                              onEdit={() => startEditTemplate(taskOrTemplate)}
                              onSave={() => saveTemplate(taskOrTemplate.recurrenceGroupId)}
                              onCancel={cancelEdit}
                              saving={saving}
                              teams={teams}
                              users={users}
                              expanded={expandedTemplates.has(taskOrTemplate.recurrenceGroupId)}
                              onToggle={() => toggleTemplate(taskOrTemplate.recurrenceGroupId)}
                              getRiskStyle={getRiskStyle}
                              getStatusStyle={getStatusStyle}
                              getFrequencyLabel={getFrequencyLabel}
                            />
                          );
                        } else {
                          return (
                            <StandaloneTaskRow
                              key={taskOrTemplate.id}
                              task={taskOrTemplate}
                              getRiskStyle={getRiskStyle}
                              getStatusStyle={getStatusStyle}
                              getFrequencyLabel={getFrequencyLabel}
                            />
                          );
                        }
                      })}
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

// Template row component for recurring tasks
function TemplateRow({
  template,
  isEditing,
  editForm,
  setEditForm,
  onEdit,
  onSave,
  onCancel,
  saving,
  teams,
  users,
  expanded,
  onToggle,
  getRiskStyle,
  getStatusStyle,
  getFrequencyLabel,
}: {
  template: TaskTemplate;
  isEditing: boolean;
  editForm: any;
  setEditForm: (form: any) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  teams: Team[];
  users: User[];
  expanded: boolean;
  onToggle: () => void;
  getRiskStyle: (risk: string) => any;
  getStatusStyle: (status: string) => any;
  getFrequencyLabel: (freq: string) => string;
}) {
  const riskStyle = getRiskStyle(template.riskRating);

  return (
    <div className="bg-[var(--bg-subtle)]">
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto_auto_auto] gap-4 p-4 items-center">
        {/* Task Name & Description */}
        <div>
          {isEditing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editForm.name || ""}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full rounded border px-2 py-1 text-sm font-medium"
                style={{ borderColor: "var(--border)" }}
                placeholder="Task name"
              />
              <textarea
                value={editForm.description || ""}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full rounded border px-2 py-1 text-xs"
                style={{ borderColor: "var(--border)" }}
                placeholder="Description"
                rows={2}
              />
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                <RefreshCw size={14} style={{ color: "var(--blue)" }} />
                {template.name}
              </p>
              {template.description && (
                <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                  {template.description}
                </p>
              )}
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                {template.instanceCount} generated instance{template.instanceCount !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </div>

        {/* Risk */}
        <div>
          {isEditing ? (
            <select
              value={editForm.riskRating || template.riskRating}
              onChange={(e) => setEditForm({ ...editForm, riskRating: e.target.value })}
              className="rounded border px-2 py-1 text-xs"
              style={{ borderColor: "var(--border)" }}
            >
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          ) : (
            <span
              className="inline-block rounded-md px-2 py-1 text-xs font-medium"
              style={{ backgroundColor: riskStyle.bg, color: riskStyle.color }}
            >
              {riskStyle.label}
            </span>
          )}
        </div>

        {/* Frequency */}
        <div>
          {isEditing ? (
            <select
              value={editForm.frequency || template.frequency}
              onChange={(e) => setEditForm({ ...editForm, frequency: e.target.value })}
              className="rounded border px-2 py-1 text-xs"
              style={{ borderColor: "var(--border)" }}
            >
              <option value="ADHOC">Ad-hoc</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="SEMI_ANNUAL">Semi-Annual</option>
              <option value="ANNUAL">Annual</option>
              <option value="BIENNIAL">Biennial</option>
              <option value="ONE_TIME">One-Time</option>
            </select>
          ) : (
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {getFrequencyLabel(template.frequency)}
            </span>
          )}
        </div>

        {/* Entity */}
        <div>
          <EntityBadge
            entityCode={template.entity.code as "DIEL" | "DGL" | "DBVI" | "FINSERV" | "GROUP"}
            size="sm"
          />
        </div>

        {/* First Due Date */}
        <div>
          {isEditing ? (
            <input
              type="date"
              value={editForm.firstDueDate ? editForm.firstDueDate.split("T")[0] : ""}
              onChange={(e) => setEditForm({ ...editForm, firstDueDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
              className="rounded border px-2 py-1 text-xs"
              style={{ borderColor: "var(--border)" }}
            />
          ) : template.firstDueDate ? (
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {new Date(template.firstDueDate).toLocaleDateString()}
            </div>
          ) : (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              No date
            </span>
          )}
        </div>

        {/* Team */}
        <div>
          {isEditing ? (
            <select
              value={editForm.responsibleTeamId || template.responsibleTeamId || ""}
              onChange={(e) => setEditForm({ ...editForm, responsibleTeamId: e.target.value || null })}
              className="rounded border px-2 py-1 text-xs"
              style={{ borderColor: "var(--border)" }}
            >
              <option value="">No team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          ) : template.responsibleTeam ? (
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {template.responsibleTeam.name}
            </span>
          ) : (
            <span className="text-xs" style={{ color: "var(--red)" }}>
              No team
            </span>
          )}
        </div>

        {/* PIC */}
        <div>
          {isEditing ? (
            <select
              value={editForm.picId || template.picId || ""}
              onChange={(e) => setEditForm({ ...editForm, picId: e.target.value || null })}
              className="rounded border px-2 py-1 text-xs"
              style={{ borderColor: "var(--border)" }}
            >
              <option value="">No PIC</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          ) : template.pic ? (
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {template.pic.initials}
            </span>
          ) : (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              —
            </span>
          )}
        </div>

        {/* Flags */}
        <div>
          <div className="flex gap-1">
            {template.evidenceRequired && (
              <div
                className="rounded px-1 py-0.5 text-xs"
                style={{ backgroundColor: "var(--blue-light)", color: "var(--blue)" }}
                title="Evidence Required"
              >
                E
              </div>
            )}
            {template.reviewRequired && (
              <div
                className="rounded px-1 py-0.5 text-xs"
                style={{ backgroundColor: "var(--purple-light)", color: "var(--purple)" }}
                title="Review Required"
              >
                R
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-1">
          {isEditing ? (
            <>
              <button
                onClick={onSave}
                disabled={saving}
                className="rounded p-1 transition-colors hover:bg-[var(--green-light)]"
                style={{ color: "var(--green)" }}
                title="Save"
              >
                <Save size={14} />
              </button>
              <button
                onClick={onCancel}
                disabled={saving}
                className="rounded p-1 transition-colors hover:bg-[var(--red-light)]"
                style={{ color: "var(--red)" }}
                title="Cancel"
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onEdit}
                className="rounded p-1 transition-colors hover:bg-[var(--blue-light)]"
                style={{ color: "var(--blue)" }}
                title="Edit Template"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={onToggle}
                className="rounded p-1 transition-colors hover:bg-[var(--bg-muted)]"
                style={{ color: "var(--text-muted)" }}
                title="View Instances"
              >
                <Eye size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded instances */}
      {expanded && !isEditing && (
        <div className="border-t px-4 py-2" style={{ borderColor: "var(--border)", backgroundColor: "white" }}>
          <p className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>
            Generated Instances:
          </p>
          <div className="space-y-1">
            {template.instances.map((instance) => {
              const statusStyle = getStatusStyle(instance.status);
              return (
                <div
                  key={instance.id}
                  className="flex items-center gap-4 text-xs p-2 rounded"
                  style={{ backgroundColor: "var(--bg-subtle)" }}
                >
                  <span style={{ color: "var(--text-muted)" }}>
                    #{instance.recurrenceIndex}
                  </span>
                  <span
                    className="inline-block rounded px-2 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
                  >
                    {statusStyle.label}
                  </span>
                  {instance.dueDate && (
                    <span style={{ color: "var(--text-secondary)" }}>
                      Due: {new Date(instance.dueDate).toLocaleDateString()}
                    </span>
                  )}
                  {instance.quarter && (
                    <span style={{ color: "var(--text-muted)" }}>
                      {instance.quarter}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Standalone task row for non-recurring tasks
function StandaloneTaskRow({
  task,
  getRiskStyle,
  getStatusStyle,
  getFrequencyLabel,
}: {
  task: Task;
  getRiskStyle: (risk: string) => any;
  getStatusStyle: (status: string) => any;
  getFrequencyLabel: (freq: string) => string;
}) {
  const riskStyle = getRiskStyle(task.riskRating);
  const statusStyle = getStatusStyle(task.status);

  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto_auto_auto] gap-4 p-4 items-center">
      <div>
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {task.name}
        </p>
        {task.description && (
          <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            {task.description}
          </p>
        )}
      </div>
      <span
        className="inline-block rounded-md px-2 py-1 text-xs font-medium"
        style={{ backgroundColor: riskStyle.bg, color: riskStyle.color }}
      >
        {riskStyle.label}
      </span>
      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
        {getFrequencyLabel(task.frequency)}
      </span>
      <EntityBadge
        entityCode={task.entity.code as "DIEL" | "DGL" | "DBVI" | "FINSERV" | "GROUP"}
        size="sm"
      />
      {task.dueDate ? (
        <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {new Date(task.dueDate).toLocaleDateString()}
        </div>
      ) : (
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          No date
        </span>
      )}
      {task.responsibleTeam ? (
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {task.responsibleTeam.name}
        </span>
      ) : (
        <span className="text-xs" style={{ color: "var(--red)" }}>
          No team
        </span>
      )}
      {task.pic ? (
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {task.pic.initials}
        </span>
      ) : (
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          —
        </span>
      )}
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
      </div>
      <span
        className="inline-block rounded-md px-2 py-1 text-xs font-medium"
        style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
      >
        {statusStyle.label}
      </span>
    </div>
  );
}
