"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronDown, ChevronUp, Edit, Plus, CheckCircle, Clock, AlertTriangle, Circle, Trash2 } from "lucide-react";
import { EntityBadge } from "@/components/ui/EntityBadge";
import { SOURCE_TYPE_COLORS, ITEM_LABEL_MAP, FREQUENCY_LABELS, RISK_COLORS } from "@/types/source-management";
import type { TaskDefinition } from "@/types/source-management";
import toast from "@/lib/toast";

type PendingTaskDefinition = TaskDefinition & {
  isPending?: boolean;
};

type Task = {
  id: string;
  name: string;
  description: string | null;
  expectedOutcome: string | null;
  status: string;
  frequency: string;
  riskRating: string;
  quarter: string | null;
  recurrenceGroupId: string | null;
  recurrenceIndex: number | null;
  recurrenceTotalCount: number | null;
  dueDate: string | null;
  narrative: string | null;
  entity: {
    id: string;
    code: string;
    name: string;
  };
  assignee: {
    id: string;
    name: string;
  } | null;
  pic: {
    id: string;
    name: string;
  } | null;
  reviewer: {
    id: string;
    name: string;
  } | null;
  responsibleTeam: {
    id: string;
    name: string;
  } | null;
};

type SourceItem = {
  id: string;
  reference: string;
  title: string;
  description: string | null;
  isInformational: boolean;
  sortOrder: number;
  metadata: {
    pendingTasks?: PendingTaskDefinition[];
  } | null;
  tasks: Task[];
};

type Source = {
  id: string;
  code: string;
  name: string;
  sourceType: string;
  status: string;
  effectiveDate: string | null;
  reviewDate: string | null;
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
  items: SourceItem[];
  issuingAuthority: {
    id: string;
    name: string;
    abbreviation: string | null;
  } | null;
};

type SourceDetailClientProps = {
  sourceId: string;
};

type ViewMode = "by-clause" | "by-task";
type Tab = "clauses-tasks" | "evidence" | "findings" | "activity";

type DeletePreview = {
  taskId: string;
  taskName: string;
  recurrenceGroupId: string | null;
  preservedCount: number;
  deletableCount: number;
  preservedInstances: Array<{ id: string; quarter: string | null; status: string }>;
  deletableInstances: Array<{ id: string; quarter: string | null; status: string }>;
};

export function SourceDetailClient({ sourceId }: SourceDetailClientProps) {
  const router = useRouter();
  const [source, setSource] = useState<Source | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("clauses-tasks");
  const [viewMode, setViewMode] = useState<ViewMode>("by-clause");
  const [expandAll, setExpandAll] = useState(false);
  const [expandedClauses, setExpandedClauses] = useState<Set<string>>(new Set());
  const [isEditingSource, setIsEditingSource] = useState(false);
  const [isAddingClause, setIsAddingClause] = useState(false);
  const [editingClauseId, setEditingClauseId] = useState<string | null>(null);
  const [addingTaskToClauseId, setAddingTaskToClauseId] = useState<string | null>(null);
  
  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePreview, setDeletePreview] = useState<DeletePreview | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form states
  const [newClauseForm, setNewClauseForm] = useState({
    reference: "",
    title: "",
    description: "",
  });
  const [editClauseForm, setEditClauseForm] = useState({
    reference: "",
    title: "",
    description: "",
  });
  const [newTaskForm, setNewTaskForm] = useState({
    name: "",
    frequency: "MONTHLY",
    riskRating: "MEDIUM",
  });

  useEffect(() => {
    fetchSource();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId]);

  const fetchSource = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/sources/${sourceId}`);
      if (!res.ok) throw new Error("Failed to fetch source");
      const data = await res.json();
      setSource(data);
    } catch (error) {
      console.error("Error fetching source:", error);
      toast.error("Failed to load source");
    } finally {
      setLoading(false);
    }
  };

  const toggleClauseExpanded = (clauseId: string) => {
    const newExpanded = new Set(expandedClauses);
    if (newExpanded.has(clauseId)) {
      newExpanded.delete(clauseId);
    } else {
      newExpanded.add(clauseId);
    }
    setExpandedClauses(newExpanded);
  };

  const handleExpandAll = () => {
    if (expandAll) {
      setExpandedClauses(new Set());
    } else {
      const allIds = source?.items.map((item) => item.id) || [];
      setExpandedClauses(new Set(allIds));
    }
    setExpandAll(!expandAll);
  };

  const handleAddClause = async () => {
    if (!newClauseForm.reference.trim() || !newClauseForm.title.trim()) {
      toast.error("Reference and title are required");
      return;
    }

    try {
      const res = await fetch("/api/sources/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId,
          reference: newClauseForm.reference,
          title: newClauseForm.title,
          description: newClauseForm.description || "",
          sortOrder: source?.items.length || 0,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create clause");
      }

      toast.success("Clause added successfully");
      setNewClauseForm({ reference: "", title: "", description: "" });
      setIsAddingClause(false);
      fetchSource();
    } catch (error) {
      console.error("Error adding clause:", error);
      toast.error(error instanceof Error ? error.message : "Failed to add clause");
    }
  };

  const handleEditClause = (item: SourceItem) => {
    setEditingClauseId(item.id);
    setEditClauseForm({
      reference: item.reference,
      title: item.title,
      description: item.description || "",
    });
  };

  const handleSaveClauseEdit = async (clauseId: string) => {
    if (!editClauseForm.reference.trim() || !editClauseForm.title.trim()) {
      toast.error("Reference and title are required");
      return;
    }

    try {
      const res = await fetch(`/api/sources/${sourceId}/items/${clauseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editClauseForm),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update clause");
      }

      toast.success("Clause updated successfully");
      setEditingClauseId(null);
      fetchSource();
    } catch (error) {
      console.error("Error updating clause:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update clause");
    }
  };

  const handleAddTaskToClause = (clauseId: string) => {
    setAddingTaskToClauseId(clauseId);
    setNewTaskForm({ name: "", frequency: "MONTHLY", riskRating: "MEDIUM" });
  };

  const handleSaveNewTask = async (clauseId: string) => {
    if (!newTaskForm.name.trim()) {
      toast.error("Task name is required");
      return;
    }

    try {
      const item = source?.items.find((i) => i.id === clauseId);
      if (!item) return;

      const existingPendingTasks = (item.metadata?.pendingTasks || []) as PendingTaskDefinition[];
      const newPendingTask: PendingTaskDefinition = {
        tempId: `temp-${Date.now()}`,
        name: newTaskForm.name,
        frequency: newTaskForm.frequency,
        riskRating: newTaskForm.riskRating,
        isPending: true,
        description: "",
        expectedOutcome: "",
        responsibleTeamId: "",
        picId: "",
        reviewerId: "",
        quarter: "",
        startDate: "",
        dueDate: "",
        evidenceRequired: false,
        reviewRequired: true,
        clickupUrl: "",
        gdriveUrl: "",
      };

      const res = await fetch(`/api/sources/${sourceId}/items/${clauseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metadata: {
            pendingTasks: [...existingPendingTasks, newPendingTask],
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save task");
      }

      toast.success("Task added to pending tasks");
      setAddingTaskToClauseId(null);
      setNewTaskForm({ name: "", frequency: "MONTHLY", riskRating: "MEDIUM" });
      fetchSource();
    } catch (error) {
      console.error("Error adding task:", error);
      toast.error(error instanceof Error ? error.message : "Failed to add task");
    }
  };

  const handleCancelAddTask = () => {
    setAddingTaskToClauseId(null);
    setNewTaskForm({ name: "", frequency: "MONTHLY", riskRating: "MEDIUM" });
  };

  const handleDeleteTaskClick = async (task: Task) => {
    try {
      // Get delete preview
      const res = await fetch(`/api/tasks/${task.id}?preview=true&scope=recurrence`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to get delete preview");
      }

      const preview = await res.json();
      setDeletePreview(preview);
      setShowDeleteModal(true);
    } catch (error) {
      console.error("Error getting delete preview:", error);
      toast.error(error instanceof Error ? error.message : "Failed to preview delete");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletePreview) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/tasks/${deletePreview.taskId}?scope=recurrence`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete task");
      }

      const result = await res.json();
      toast.success(result.message || "Task deleted successfully");
      setShowDeleteModal(false);
      setDeletePreview(null);
      fetchSource();
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete task");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGeneratePendingTasks = async () => {
    if (!source) return;

    // Get all pending tasks from all items
    const itemsWithPendingTasks = source.items.filter(
      (item) => item.metadata?.pendingTasks && item.metadata.pendingTasks.length > 0
    );

    if (itemsWithPendingTasks.length === 0) {
      toast.error("No pending tasks to generate");
      return;
    }

    try {
      const generatePayload = {
        items: itemsWithPendingTasks.map((item) => ({
          item: {
            reference: item.reference,
            title: item.title,
            description: item.description || "",
            parentId: undefined,
            sortOrder: item.sortOrder,
          },
          tasks: (item.metadata!.pendingTasks || []).flatMap((task) =>
            source.entities.map((se) => ({
              name: task.name,
              description: task.description || "",
              expectedOutcome: task.expectedOutcome || "",
              entityId: se.entity.id,
              frequency: task.frequency,
              quarter: task.quarter || undefined,
              riskRating: task.riskRating,
              assigneeId: "",
              responsibleTeamId: task.responsibleTeamId || "",
              picId: task.picId || "",
              reviewerId: task.reviewerId || "",
              startDate: task.startDate || "",
              dueDate: task.dueDate || "",
              testingPeriodStart: "",
              testingPeriodEnd: "",
              evidenceRequired: task.evidenceRequired,
              narrativeRequired: false,
              reviewRequired: task.reviewRequired,
              clickupUrl: task.clickupUrl || "",
              gdriveUrl: task.gdriveUrl || "",
            }))
          ),
        })),
      };

      const res = await fetch(`/api/sources/${sourceId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(generatePayload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate tasks");
      }

      const result = await res.json();

      // Clear pendingTasks from all items that had them
      for (const item of itemsWithPendingTasks) {
        await fetch(`/api/sources/${sourceId}/items/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            metadata: {
              pendingTasks: [],
            },
          }),
        });
      }

      toast.success(`Generated ${result.tasksCreated} tasks successfully`);
      fetchSource();
    } catch (error) {
      console.error("Error generating tasks:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate tasks");
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Loading source...
        </p>
      </div>
    );
  }

  if (!source) {
    return (
      <div className="flex h-96 flex-col items-center justify-center">
        <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
          Source not found
        </p>
        <button
          onClick={() => router.push("/sources")}
          className="mt-4 rounded-lg border px-4 py-2 text-sm font-medium"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          Back to sources
        </button>
      </div>
    );
  }

  const typeConfig = SOURCE_TYPE_COLORS[source.sourceType as keyof typeof SOURCE_TYPE_COLORS];
  const itemLabel = ITEM_LABEL_MAP[source.sourceType] || { singular: "Clause", plural: "Clauses" };
  
  // Calculate stats - only count generated tasks
  const totalGeneratedTasks = source.items.reduce((sum, item) => sum + item.tasks.length, 0);
  const totalPendingTasks = source.items.reduce(
    (sum, item) => sum + (item.metadata?.pendingTasks?.length || 0),
    0
  );
  const completedTasks = source.items.reduce(
    (sum, item) => sum + item.tasks.filter((t) => t.status === "COMPLETED").length,
    0
  );
  const overdueTasks = source.items.reduce(
    (sum, item) =>
      sum +
      item.tasks.filter((t) => {
        if (t.status === "COMPLETED" || t.status === "PLANNED") return false;
        if (!t.dueDate) return false;
        return new Date(t.dueDate) < new Date();
      }).length,
    0
  );
  const completionPercentage = totalGeneratedTasks > 0 ? Math.round((completedTasks / totalGeneratedTasks) * 100) : 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
          <button
            onClick={() => router.push("/sources")}
            className="transition-colors hover:text-[var(--blue)]"
          >
            Sources
          </button>
          <ChevronRight size={14} />
          <span style={{ color: "var(--text-primary)" }}>{source.name}</span>
        </div>

        {/* Source Header Card */}
        <div className="mb-6 rounded-[14px] border bg-white p-6" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-3">
                <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                  {source.name}
                </h1>
                <span
                  className="rounded-md px-2 py-0.5 font-mono text-xs font-medium"
                  style={{ backgroundColor: "var(--bg-muted)", color: "var(--text-secondary)" }}
                >
                  {source.code}
                </span>
                {source.status === "DRAFT" && (
                  <span
                    className="rounded-md px-2 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: "var(--amber-light)", color: "var(--amber)" }}
                  >
                    DRAFT
                  </span>
                )}
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
                  {source.entities.map(({ entity }) => (
                    <EntityBadge key={entity.id} entityCode={entity.code as "DIEL" | "DGL" | "DBVI" | "FINSERV" | "GROUP"} />
                  ))}
                </div>
                {source.issuingAuthority && (
                  <>
                    <span>·</span>
                    <span>{source.issuingAuthority.abbreviation || source.issuingAuthority.name}</span>
                  </>
                )}
                <span>·</span>
                <span>{source.team.name}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="mb-6 grid grid-cols-4 gap-4">
          <div className="rounded-[14px] border bg-white p-4" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              {itemLabel.plural}
            </p>
            <p className="mt-1 text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              {source.items.length}
            </p>
          </div>
          <div className="rounded-[14px] border bg-white p-4" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Total Tasks
            </p>
            <p className="mt-1 text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              {totalGeneratedTasks}
            </p>
          </div>
          <div className="rounded-[14px] border bg-white p-4" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Completion
            </p>
            <div className="mt-1 flex items-center gap-3">
              <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                {completionPercentage}%
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: "var(--bg-muted)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${completionPercentage}%`,
                    backgroundColor: completionPercentage < 50 ? "var(--amber)" : "var(--green)",
                  }}
                />
              </div>
            </div>
          </div>
          <div className="rounded-[14px] border bg-white p-4" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Overdue
            </p>
            <p className="mt-1 text-2xl font-bold" style={{ color: overdueTasks > 0 ? "var(--red)" : "var(--text-primary)" }}>
              {overdueTasks}
            </p>
          </div>
        </div>

        {/* Pending Tasks Generation Bar */}
        {totalPendingTasks > 0 && (
          <div
            className="mb-6 rounded-[14px] border bg-white p-4"
            style={{ borderColor: "var(--amber)", backgroundColor: "var(--amber-light)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  {totalPendingTasks} task definition{totalPendingTasks > 1 ? "s" : ""} pending generation
                </p>
                <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                  These tasks haven't been generated yet. Review and generate them to create task instances.
                </p>
              </div>
              <button
                onClick={handleGeneratePendingTasks}
                className="rounded-lg px-6 py-2 text-sm font-medium text-white transition-opacity"
                style={{ backgroundColor: "var(--green)" }}
              >
                Generate {totalPendingTasks} tasks
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex items-center gap-1 border-b" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={() => setActiveTab("clauses-tasks")}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "clauses-tasks"
                ? "border-b-2 border-[var(--blue)] text-[var(--blue)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {itemLabel.plural} & Tasks
          </button>
          <button
            onClick={() => setActiveTab("evidence")}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "evidence"
                ? "border-b-2 border-[var(--blue)] text-[var(--blue)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Evidence Summary
          </button>
          <button
            onClick={() => setActiveTab("findings")}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "findings"
                ? "border-b-2 border-[var(--blue)] text-[var(--blue)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Findings
          </button>
          <button
            onClick={() => setActiveTab("activity")}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "activity"
                ? "border-b-2 border-[var(--blue)] text-[var(--blue)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Activity
          </button>
        </div>

        {/* Clauses & Tasks Tab */}
        {activeTab === "clauses-tasks" && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleExpandAll}
                  className="text-sm font-medium transition-colors"
                  style={{ color: "var(--blue)" }}
                >
                  {expandAll ? "Collapse all" : "Expand all"}
                </button>
                <span style={{ color: "var(--text-muted)" }}>|</span>
                <div className="flex rounded-lg border" style={{ borderColor: "var(--border)" }}>
                  <button
                    onClick={() => setViewMode("by-clause")}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      viewMode === "by-clause"
                        ? "bg-[var(--blue)] text-white"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                    }`}
                  >
                    By {itemLabel.singular}
                  </button>
                  <button
                    onClick={() => setViewMode("by-task")}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      viewMode === "by-task"
                        ? "bg-[var(--blue)] text-white"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                    }`}
                  >
                    By Task
                  </button>
                </div>
              </div>
              <button
                onClick={() => setIsAddingClause(true)}
                className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <Plus size={14} />
                Add {itemLabel.singular}
              </button>
            </div>

            {/* By Clause View */}
            {viewMode === "by-clause" && (
              <div className="space-y-3">
                {source.items.map((item) => {
                  const isExpanded = expandedClauses.has(item.id);
                  const isEditingThisClause = editingClauseId === item.id;
                  const pendingTasks = (item.metadata?.pendingTasks || []) as PendingTaskDefinition[];
                  const generatedTasks = item.tasks;
                  const completedCount = generatedTasks.filter((t) => t.status === "COMPLETED").length;
                  const totalTaskCount = generatedTasks.length + pendingTasks.length;
                  const progress = generatedTasks.length > 0 ? Math.round((completedCount / generatedTasks.length) * 100) : 0;
                  
                  return (
                    <div
                      key={item.id}
                      className="rounded-[14px] border bg-white p-4"
                      style={{ borderColor: "var(--border)" }}
                    >
                      {/* Clause Header */}
                      {!isEditingThisClause ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <button
                              onClick={() => toggleClauseExpanded(item.id)}
                              className="rounded p-1 transition-colors hover:bg-[var(--bg-subtle)]"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            <span className="font-mono text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                              {item.reference}
                            </span>
                            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                              {item.title}
                            </span>
                            {pendingTasks.length > 0 && (
                              <span
                                className="rounded-md px-2 py-0.5 text-xs font-medium"
                                style={{ backgroundColor: "var(--amber-light)", color: "var(--amber)" }}
                              >
                                {pendingTasks.length} pending
                              </span>
                            )}
                            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                              {completedCount}/{generatedTasks.length} done
                            </span>
                            {generatedTasks.length > 0 && (
                              <div className="h-1 w-20 overflow-hidden rounded-full" style={{ backgroundColor: "var(--bg-muted)" }}>
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${progress}%`,
                                    backgroundColor: progress < 50 ? "var(--amber)" : "var(--green)",
                                  }}
                                />
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleEditClause(item)}
                            className="text-sm font-medium transition-colors"
                            style={{ color: "var(--blue)" }}
                          >
                            Edit
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <input
                              type="text"
                              value={editClauseForm.reference}
                              onChange={(e) => setEditClauseForm({ ...editClauseForm, reference: e.target.value })}
                              placeholder="Reference"
                              className="rounded-lg border px-3 py-2 text-sm outline-none"
                              style={{ borderColor: "var(--border)" }}
                            />
                            <input
                              type="text"
                              value={editClauseForm.title}
                              onChange={(e) => setEditClauseForm({ ...editClauseForm, title: e.target.value })}
                              placeholder="Title"
                              className="rounded-lg border px-3 py-2 text-sm outline-none"
                              style={{ borderColor: "var(--border)" }}
                            />
                          </div>
                          <textarea
                            value={editClauseForm.description}
                            onChange={(e) => setEditClauseForm({ ...editClauseForm, description: e.target.value })}
                            placeholder="Description (optional)"
                            rows={2}
                            className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                            style={{ borderColor: "var(--border)" }}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveClauseEdit(item.id)}
                              className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                              style={{ backgroundColor: "var(--blue)" }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingClauseId(null)}
                              className="rounded-lg border px-4 py-2 text-sm font-medium"
                              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Tasks (when expanded and not editing) */}
                      {isExpanded && !isEditingThisClause && (
                        <div className="mt-4 space-y-2 pl-7">
                          {/* Pending Tasks */}
                          {pendingTasks.map((task) => (
                            <PendingTaskRow key={task.tempId} task={task} />
                          ))}

                          {/* Generated Tasks */}
                          {generatedTasks.map((task) => (
                            <TaskRow key={task.id} task={task} onDelete={() => handleDeleteTaskClick(task)} />
                          ))}
                          
                          {/* Add Task Form */}
                          {addingTaskToClauseId === item.id ? (
                            <div className="rounded-lg border p-3 space-y-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-subtle)" }}>
                              <input
                                type="text"
                                value={newTaskForm.name}
                                onChange={(e) => setNewTaskForm({ ...newTaskForm, name: e.target.value })}
                                placeholder="Task name"
                                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                                style={{ borderColor: "var(--border)", backgroundColor: "white" }}
                              />
                              <div className="flex items-center gap-2">
                                <select
                                  value={newTaskForm.frequency}
                                  onChange={(e) => setNewTaskForm({ ...newTaskForm, frequency: e.target.value })}
                                  className="rounded-lg border px-2 py-1 text-xs outline-none"
                                  style={{ borderColor: "var(--border)" }}
                                >
                                  {["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "BIENNIAL", "ONE_TIME"].map((freq) => (
                                    <option key={freq} value={freq}>
                                      {FREQUENCY_LABELS[freq]}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  value={newTaskForm.riskRating}
                                  onChange={(e) => setNewTaskForm({ ...newTaskForm, riskRating: e.target.value })}
                                  className="rounded-lg border px-2 py-1 text-xs outline-none"
                                  style={{ borderColor: "var(--border)" }}
                                >
                                  {["HIGH", "MEDIUM", "LOW"].map((risk) => (
                                    <option key={risk} value={risk}>
                                      {risk}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={handleCancelAddTask}
                                  className="rounded-lg border px-3 py-1 text-xs font-medium"
                                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleSaveNewTask(item.id)}
                                  className="rounded-lg px-3 py-1 text-xs font-medium text-white"
                                  style={{ backgroundColor: "var(--blue)" }}
                                >
                                  Add to pending
                                </button>
                              </div>
                              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                Note: This will be added as a pending task definition. Click "Generate" to create actual task instances.
                              </p>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAddTaskToClause(item.id)}
                              className="flex w-full items-center gap-2 rounded-lg border border-dashed py-2 text-sm font-medium transition-colors hover:bg-[var(--bg-hover)]"
                              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                            >
                              <Plus size={14} className="ml-2" />
                              Add task to this {itemLabel.singular.toLowerCase()}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add New Clause Form */}
                {isAddingClause && (
                  <div className="rounded-[14px] border bg-white p-4" style={{ borderColor: "var(--border)" }}>
                    <h4 className="mb-3 font-semibold" style={{ color: "var(--text-primary)" }}>
                      Add New {itemLabel.singular}
                    </h4>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={newClauseForm.reference}
                          onChange={(e) => setNewClauseForm({ ...newClauseForm, reference: e.target.value })}
                          placeholder="Reference (e.g. Art. 5.1)"
                          className="rounded-lg border px-3 py-2 text-sm outline-none"
                          style={{ borderColor: "var(--border)" }}
                        />
                        <input
                          type="text"
                          value={newClauseForm.title}
                          onChange={(e) => setNewClauseForm({ ...newClauseForm, title: e.target.value })}
                          placeholder="Title"
                          className="rounded-lg border px-3 py-2 text-sm outline-none"
                          style={{ borderColor: "var(--border)" }}
                        />
                      </div>
                      <textarea
                        value={newClauseForm.description}
                        onChange={(e) => setNewClauseForm({ ...newClauseForm, description: e.target.value })}
                        placeholder="Description (optional)"
                        rows={2}
                        className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                        style={{ borderColor: "var(--border)" }}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleAddClause}
                          className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                          style={{ backgroundColor: "var(--blue)" }}
                        >
                          Add {itemLabel.singular}
                        </button>
                        <button
                          onClick={() => {
                            setIsAddingClause(false);
                            setNewClauseForm({ reference: "", title: "", description: "" });
                          }}
                          className="rounded-lg border px-4 py-2 text-sm font-medium"
                          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* By Task View */}
            {viewMode === "by-task" && (
              <div className="rounded-[14px] border bg-white overflow-hidden" style={{ borderColor: "var(--border)" }}>
                <table className="w-full">
                  <thead>
                    <tr style={{ backgroundColor: "var(--bg-subtle)", borderBottom: "1px solid var(--border)" }}>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: "var(--text-secondary)" }}>
                        Task
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: "var(--text-secondary)" }}>
                        {itemLabel.singular} Ref
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: "var(--text-secondary)" }}>
                        Entity
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: "var(--text-secondary)" }}>
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: "var(--text-secondary)" }}>
                        Frequency
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: "var(--text-secondary)" }}>
                        Risk
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: "var(--text-secondary)" }}>
                        PIC
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: "var(--text-secondary)" }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {source.items.flatMap((item) =>
                      item.tasks.map((task) => (
                        <tr
                          key={task.id}
                          className="cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                          style={{ borderBottom: "1px solid var(--border-light)" }}
                        >
                          <td className="px-4 py-3" onClick={() => router.push(`/tasks/${task.id}`)}>
                            <span className="text-sm" style={{ color: "var(--text-primary)" }}>{task.name}</span>
                          </td>
                          <td className="px-4 py-3" onClick={() => router.push(`/tasks/${task.id}`)}>
                            <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>{item.reference}</span>
                          </td>
                          <td className="px-4 py-3" onClick={() => router.push(`/tasks/${task.id}`)}>
                            <EntityBadge entityCode={task.entity.code as "DIEL" | "DGL" | "DBVI" | "FINSERV" | "GROUP"} />
                          </td>
                          <td className="px-4 py-3" onClick={() => router.push(`/tasks/${task.id}`)}>
                            <StatusPill status={task.status} />
                          </td>
                          <td className="px-4 py-3" onClick={() => router.push(`/tasks/${task.id}`)}>
                            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                              {FREQUENCY_LABELS[task.frequency]}
                            </span>
                          </td>
                          <td className="px-4 py-3" onClick={() => router.push(`/tasks/${task.id}`)}>
                            <span
                              className="rounded-md px-2 py-0.5 text-xs font-medium"
                              style={{
                                backgroundColor: RISK_COLORS[task.riskRating].bg,
                                color: RISK_COLORS[task.riskRating].color,
                              }}
                            >
                              {task.riskRating}
                            </span>
                          </td>
                          <td className="px-4 py-3" onClick={() => router.push(`/tasks/${task.id}`)}>
                            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                              {task.pic?.name || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTaskClick(task);
                              }}
                              className="rounded p-1 transition-colors hover:bg-[var(--red-light)]"
                              style={{ color: "var(--red)" }}
                              title="Delete task"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Other Tabs */}
        {activeTab !== "clauses-tasks" && (
          <div className="rounded-[14px] border bg-white p-12 text-center" style={{ borderColor: "var(--border)" }}>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {activeTab === "evidence" && "Evidence summary view coming soon"}
              {activeTab === "findings" && "Findings view coming soon"}
              {activeTab === "activity" && "Activity log coming soon"}
            </p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="mx-4 max-w-2xl rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Delete Task{deletePreview.recurrenceGroupId ? " Recurrence Group" : ""}
            </h3>
            
            <p className="mb-4 text-sm" style={{ color: "var(--text-secondary)" }}>
              Task: <span className="font-semibold">{deletePreview.taskName}</span>
            </p>

            {deletePreview.recurrenceGroupId ? (
              <div className="mb-4 space-y-3">
                {deletePreview.preservedCount > 0 && (
                  <div className="rounded-lg border p-3" style={{ borderColor: "var(--green)", backgroundColor: "var(--green-light)" }}>
                    <p className="mb-2 text-sm font-semibold" style={{ color: "var(--green)" }}>
                      {deletePreview.preservedCount} instance{deletePreview.preservedCount > 1 ? "s" : ""} will be preserved
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      These instances have evidence, narratives, or are in progress:
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {deletePreview.preservedInstances.map((inst) => (
                        <span
                          key={inst.id}
                          className="rounded px-2 py-0.5 text-xs"
                          style={{ backgroundColor: "white", color: "var(--text-primary)" }}
                        >
                          {inst.quarter || "Instance"} ({inst.status})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {deletePreview.deletableCount > 0 && (
                  <div className="rounded-lg border p-3" style={{ borderColor: "var(--red)", backgroundColor: "var(--red-light)" }}>
                    <p className="mb-2 text-sm font-semibold" style={{ color: "var(--red)" }}>
                      {deletePreview.deletableCount} instance{deletePreview.deletableCount > 1 ? "s" : ""} will be deleted
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      These instances are planned or have no work started:
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {deletePreview.deletableInstances.map((inst) => (
                        <span
                          key={inst.id}
                          className="rounded px-2 py-0.5 text-xs"
                          style={{ backgroundColor: "white", color: "var(--text-primary)" }}
                        >
                          {inst.quarter || "Instance"} ({inst.status})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-4 rounded-lg border p-3" style={{ borderColor: "var(--red)", backgroundColor: "var(--red-light)" }}>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  This will permanently delete this one-time task.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletePreview(null);
                }}
                disabled={isDeleting}
                className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
                style={{ backgroundColor: "var(--red)" }}
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// PendingTaskRow component for task definitions that haven't been generated yet
function PendingTaskRow({ task }: { task: PendingTaskDefinition }) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-dashed p-3"
      style={{ borderColor: "var(--amber)", backgroundColor: "var(--amber-light)" }}
    >
      <span className="flex-1 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        {task.name}
      </span>
      <span
        className="rounded-md px-2 py-0.5 text-xs font-medium"
        style={{ backgroundColor: "var(--amber)", color: "white" }}
      >
        Pending
      </span>
      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
        {FREQUENCY_LABELS[task.frequency]}
      </span>
      <span
        className="rounded-md px-2 py-0.5 text-xs font-medium"
        style={{
          backgroundColor: RISK_COLORS[task.riskRating].bg,
          color: RISK_COLORS[task.riskRating].color,
        }}
      >
        {task.riskRating}
      </span>
    </div>
  );
}

// TaskRow component for generated tasks
function TaskRow({ task, onDelete }: { task: Task; onDelete: () => void }) {
  const router = useRouter();
  
  return (
    <div
      className="flex items-center gap-3 rounded-lg border p-3 transition-colors cursor-pointer hover:bg-[var(--bg-hover)]"
      style={{ borderColor: "var(--border-light)" }}
    >
      <div className="flex-1 flex items-center gap-3" onClick={() => router.push(`/tasks/${task.id}`)}>
        <EntityBadge entityCode={task.entity.code as "DIEL" | "DGL" | "DBVI" | "FINSERV" | "GROUP"} />
        <span className="flex-1 text-sm" style={{ color: "var(--text-primary)" }}>
          {task.name}
        </span>
        <StatusPill status={task.status} />
        {task.recurrenceTotalCount && task.recurrenceTotalCount > 1 && task.quarter && (
          <span
            className="rounded-md px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: task.status === "COMPLETED" ? "var(--green-light)" : "var(--bg-muted)",
              color: task.status === "COMPLETED" ? "var(--green)" : "var(--text-muted)",
            }}
          >
            {task.quarter}
          </span>
        )}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="rounded p-1 transition-colors hover:bg-[var(--red-light)]"
        style={{ color: "var(--text-muted)" }}
        title="Delete task"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// StatusPill component
function StatusPill({ status }: { status: string }) {
  const config = {
    TO_DO: { icon: Circle, color: "var(--text-muted)", bg: "var(--bg-muted)", label: "To do" },
    IN_PROGRESS: { icon: Clock, color: "var(--blue)", bg: "var(--blue-light)", label: "In progress" },
    COMPLETED: { icon: CheckCircle, color: "var(--green)", bg: "var(--green-light)", label: "Completed" },
    OVERDUE: { icon: AlertTriangle, color: "var(--red)", bg: "var(--red-light)", label: "Overdue" },
    PLANNED: { icon: Clock, color: "var(--text-muted)", bg: "var(--bg-subtle)", label: "Planned" },
  };

  const statusConfig = config[status as keyof typeof config] || config.TO_DO;
  const Icon = statusConfig.icon;

  return (
    <span
      className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: statusConfig.bg, color: statusConfig.color }}
    >
      <Icon size={12} />
      {statusConfig.label}
    </span>
  );
}
