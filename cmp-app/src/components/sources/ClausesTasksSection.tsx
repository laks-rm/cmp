"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, Upload, FileText, Table as TableIcon } from "lucide-react";
import type { ItemWithTasks, TaskDefinition, Entity, Team, User, ExtractedClause, InputMethod, ViewMode, MonitoringArea, TaskType } from "@/types/source-management";
import { ITEM_LABEL_MAP, FREQUENCIES, FREQUENCY_LABELS, RISK_RATINGS, RISK_COLORS } from "@/types/source-management";
import toast from "@/lib/toast";

type ClausesTasksSectionProps = {
  sourceType: string;
  items: ItemWithTasks[];
  onChange: (items: ItemWithTasks[]) => void;
  selectedEntities: Entity[];
  teams: Team[];
  users: User[];
  monitoringAreas: MonitoringArea[];
  taskTypes: TaskType[];
  disabled?: boolean;
};

export function ClausesTasksSection({
  sourceType,
  items,
  onChange,
  selectedEntities,
  teams,
  users,
  monitoringAreas,
  taskTypes,
  disabled = false,
}: ClausesTasksSectionProps) {
  const [inputMethod, setInputMethod] = useState<InputMethod>("manual");
  const [viewMode, setViewMode] = useState<ViewMode>("by-clause");
  const [expandAllFields, setExpandAllFields] = useState(false);
  const [aiExtractEnabled, setAiExtractEnabled] = useState(false);
  
  // AI Extract state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [extractionLevel, setExtractionLevel] = useState("articles-sub");
  const [taskSuggestion, setTaskSuggestion] = useState("full");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedClauses, setExtractedClauses] = useState<ExtractedClause[]>([]);
  
  // Excel Paste state
  const [pastedData, setPastedData] = useState("");

  const itemLabel = ITEM_LABEL_MAP[sourceType] || { singular: "Clause", plural: "Clauses" };

  // Check if AI features are enabled
  useEffect(() => {
    const checkFeatures = async () => {
      try {
        const res = await fetch("/api/features");
        if (res.ok) {
          const data = await res.json();
          setAiExtractEnabled(data.aiExtractEnabled);
        }
      } catch (error) {
        console.error("Failed to check features:", error);
      }
    };
    checkFeatures();
  }, []);

  const handleAddClause = () => {
    const newClause: ItemWithTasks = {
      tempId: `temp-${Date.now()}`,
      reference: "",
      title: "",
      description: "",
      isInformational: false,
      tasks: [],
      expanded: true,
    };
    onChange([...items, newClause]);
  };

  const handleDeleteClause = (tempId: string) => {
    onChange(items.filter((item) => item.tempId !== tempId));
  };

  const handleUpdateClause = (tempId: string, field: string, value: string) => {
    onChange(
      items.map((item) =>
        item.tempId === tempId ? { ...item, [field]: value } : item
      )
    );
  };

  const handleToggleClauseExpanded = (tempId: string) => {
    onChange(
      items.map((item) =>
        item.tempId === tempId ? { ...item, expanded: !item.expanded } : item
      )
    );
  };

  const handleAddTask = (clauseTempId: string) => {
    const newTask: TaskDefinition = {
      tempId: `task-${Date.now()}`,
      name: "",
      description: "",
      expectedOutcome: "",
      responsibleTeamId: "",
      picId: "",
      reviewerId: "",
      frequency: "MONTHLY",
      quarter: "",
      riskRating: "MEDIUM",
      startDate: "",
      dueDate: "",
      evidenceRequired: false,
      reviewRequired: true,
      clickupUrl: "",
      gdriveUrl: "",
      expanded: false,
    };
    
    onChange(
      items.map((item) =>
        item.tempId === clauseTempId
          ? { ...item, tasks: [...item.tasks, newTask] }
          : item
      )
    );
  };

  const handleDeleteTask = (clauseTempId: string, taskTempId: string) => {
    onChange(
      items.map((item) =>
        item.tempId === clauseTempId
          ? { ...item, tasks: item.tasks.filter((t) => t.tempId !== taskTempId) }
          : item
      )
    );
  };

  const handleUpdateTask = (clauseTempId: string, taskTempId: string, field: string, value: string | boolean) => {
    onChange(
      items.map((item) =>
        item.tempId === clauseTempId
          ? {
              ...item,
              tasks: item.tasks.map((task) =>
                task.tempId === taskTempId ? { ...task, [field]: value } : task
              ),
            }
          : item
      )
    );
  };

  const handleToggleTaskExpanded = (clauseTempId: string, taskTempId: string) => {
    onChange(
      items.map((item) =>
        item.tempId === clauseTempId
          ? {
              ...item,
              tasks: item.tasks.map((task) =>
                task.tempId === taskTempId ? { ...task, expanded: !task.expanded } : task
              ),
            }
          : item
      )
    );
  };

  const handleExpandAllFields = () => {
    const newExpandState = !expandAllFields;
    setExpandAllFields(newExpandState);
    onChange(
      items.map((item) => ({
        ...item,
        tasks: item.tasks.map((task) => ({ ...task, expanded: newExpandState })),
      }))
    );
  };

  const handleFileUpload = (file: File) => {
    const validTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a PDF, DOCX, or TXT file");
      return;
    }
    setUploadedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleAIExtract = async () => {
    if (!uploadedFile) {
      toast.error("Please upload a document first");
      return;
    }

    setIsExtracting(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);
      formData.append("sourceType", sourceType);
      formData.append("extractionLevel", extractionLevel);
      formData.append("taskSuggestion", taskSuggestion);
      if (additionalInstructions) {
        formData.append("additionalInstructions", additionalInstructions);
      }

      const res = await fetch("/api/sources/ai-extract", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("AI extraction failed");

      const result = await res.json();
      const formattedClauses: ExtractedClause[] = result.data.clauses.map((clause: { reference: string; title: string; description: string; isInformational: boolean; suggestedTasks: Array<{ name: string; frequency: string; riskRating: string }> }) => ({
        reference: clause.reference,
        title: clause.title,
        description: clause.description,
        isInformational: clause.isInformational || false,
        included: true,
        expanded: false,
        tasks: clause.suggestedTasks.map((task: { name: string; frequency: string; riskRating: string }, idx: number) => ({
          id: `task-${Date.now()}-${idx}`,
          name: task.name,
          frequency: task.frequency,
          riskRating: task.riskRating,
          included: true,
        })),
      }));

      setExtractedClauses(formattedClauses);
      toast.success(`AI extracted ${result.meta.clausesExtracted} clauses with ${result.meta.totalSuggestedTasks} suggested tasks`);
    } catch (error) {
      console.error("AI extraction error:", error);
      toast.error("Failed to extract from document");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleApplyExtractedClauses = () => {
    const newItems: ItemWithTasks[] = extractedClauses
      .filter((clause) => clause.included)
      .map((clause) => ({
        tempId: `temp-${Date.now()}-${Math.random()}`,
        reference: clause.reference,
        title: clause.title,
        description: clause.description,
        isInformational: clause.isInformational,
        expanded: false,
        tasks: clause.tasks
          .filter((task) => task.included)
          .map((task) => ({
            tempId: `task-${Date.now()}-${Math.random()}`,
            name: task.name,
            description: "",
            expectedOutcome: "",
            responsibleTeamId: "",
            picId: "",
            reviewerId: "",
            frequency: task.frequency,
            quarter: "",
            riskRating: task.riskRating,
            startDate: "",
            dueDate: "",
            evidenceRequired: false,
            reviewRequired: true,
            clickupUrl: "",
            gdriveUrl: "",
            expanded: false,
          })),
      }));

    onChange([...items, ...newItems]);
    setExtractedClauses([]);
    setUploadedFile(null);
    setInputMethod("manual");
    toast.success(`Added ${newItems.length} clauses with ${newItems.reduce((sum, c) => sum + c.tasks.length, 0)} tasks`);
  };

  const handlePasteFromExcel = () => {
    if (!pastedData.trim()) {
      toast.error("Please paste data first");
      return;
    }

    const lines = pastedData.trim().split("\n");
    const newItems: ItemWithTasks[] = [];
    let currentClause: ItemWithTasks | null = null;

    lines.forEach((line) => {
      const cols = line.split("\t");
      if (cols.length < 2) return;

      const [reference, title, taskName, frequency = "MONTHLY", risk = "MEDIUM"] = cols;

      if (reference.trim()) {
        if (currentClause) {
          newItems.push(currentClause);
        }
        currentClause = {
          tempId: `temp-${Date.now()}-${Math.random()}`,
          reference: reference.trim(),
          title: title.trim(),
          description: "",
          isInformational: false,
          expanded: false,
          tasks: [],
        };
      }

      if (taskName && taskName.trim() && currentClause) {
        const validFrequency = FREQUENCIES.includes(frequency.toUpperCase() as (typeof FREQUENCIES)[number]) ? frequency.toUpperCase() : "MONTHLY";
        const validRisk = RISK_RATINGS.includes(risk.toUpperCase() as (typeof RISK_RATINGS)[number]) ? risk.toUpperCase() : "MEDIUM";
        
        currentClause.tasks.push({
          tempId: `task-${Date.now()}-${Math.random()}`,
          name: taskName.trim(),
          description: "",
          expectedOutcome: "",
          responsibleTeamId: "",
          picId: "",
          reviewerId: "",
          frequency: validFrequency,
          quarter: "",
          riskRating: validRisk,
          startDate: "",
          dueDate: "",
          evidenceRequired: false,
          reviewRequired: true,
          clickupUrl: "",
          gdriveUrl: "",
          expanded: false,
        });
      }
    });

    if (currentClause) {
      newItems.push(currentClause);
    }

    onChange([...items, ...newItems]);
    setPastedData("");
    setInputMethod("manual");
    toast.success(`Imported ${newItems.length} clauses with ${newItems.reduce((sum, c) => sum + c.tasks.length, 0)} tasks`);
  };

  const totalTasks = items.reduce((sum, item) => sum + item.tasks.length, 0);

  if (disabled) {
    return (
      <div className="rounded-[14px] border bg-white p-12 text-center" style={{ borderColor: "var(--border)" }}>
        <FileText size={48} style={{ color: "var(--text-muted)", margin: "0 auto 16px" }} />
        <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          Save source details first to add {itemLabel.plural.toLowerCase()}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Adding <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{itemLabel.plural}</span> for{" "}
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
              {selectedEntities.map((e) => e.code).join(", ")}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExpandAllFields}
            className="text-sm font-medium transition-colors"
            style={{ color: "var(--blue)" }}
          >
            {expandAllFields ? "Collapse all" : "Expand all fields"}
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
      </div>

      {/* Input Method Toggle */}
      <div className="flex rounded-lg border" style={{ borderColor: "var(--border)", width: "fit-content" }}>
        {aiExtractEnabled && (
          <button
            onClick={() => setInputMethod("ai-extract")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
              inputMethod === "ai-extract"
                ? "bg-[var(--blue)] text-white"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            <Upload size={16} />
            AI Extract
          </button>
        )}
        <button
          onClick={() => setInputMethod("manual")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
            inputMethod === "manual"
              ? "bg-[var(--blue)] text-white"
              : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          }`}
        >
          <FileText size={16} />
          Build Manually
        </button>
        <button
          onClick={() => setInputMethod("excel-paste")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
            inputMethod === "excel-paste"
              ? "bg-[var(--blue)] text-white"
              : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          }`}
        >
          <TableIcon size={16} />
          Paste from Excel
        </button>
      </div>

      {/* AI Extract Mode */}
      {inputMethod === "ai-extract" && extractedClauses.length === 0 && (
        <div className="rounded-[14px] border bg-white p-6" style={{ borderColor: "var(--border)" }}>
          <h4 className="mb-4 font-semibold" style={{ color: "var(--text-primary)" }}>
            AI-Powered Extraction
          </h4>
          
          {/* File Upload */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            className={`relative mb-4 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              isDragging ? "border-[var(--blue)] bg-[var(--blue-light)]" : "border-[var(--border)]"
            }`}
          >
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
            <Upload size={32} style={{ color: "var(--text-muted)", margin: "0 auto 8px" }} />
            {uploadedFile ? (
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {uploadedFile.name}
              </p>
            ) : (
              <>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  Drop document here or click to upload
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  PDF, DOCX, or TXT files supported
                </p>
              </>
            )}
          </div>

          {/* Extraction Options */}
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Extraction Level
              </label>
              <select
                value={extractionLevel}
                onChange={(e) => setExtractionLevel(e.target.value)}
                className="h-10 w-full rounded-lg border px-3 text-sm outline-none"
                style={{ borderColor: "var(--border)" }}
              >
                <option value="articles-sub">Articles & Sub-articles</option>
                <option value="articles-only">Top-level Articles only</option>
                <option value="sections">Sections & Clauses</option>
                <option value="all-paragraphs">All numbered paragraphs</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Task Suggestion
              </label>
              <select
                value={taskSuggestion}
                onChange={(e) => setTaskSuggestion(e.target.value)}
                className="h-10 w-full rounded-lg border px-3 text-sm outline-none"
                style={{ borderColor: "var(--border)" }}
              >
                <option value="full">Full (with frequency & risk)</option>
                <option value="tasks-only">Tasks only</option>
                <option value="clauses-only">Clauses only (no tasks)</option>
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Additional Instructions (Optional)
            </label>
            <textarea
              value={additionalInstructions}
              onChange={(e) => setAdditionalInstructions(e.target.value)}
              placeholder="E.g., Focus on operational controls, exclude informational sections..."
              rows={3}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          <button
            onClick={handleAIExtract}
            disabled={!uploadedFile || isExtracting}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "var(--blue)" }}
          >
            {isExtracting ? "Extracting..." : "Extract with AI"}
          </button>
        </div>
      )}

      {/* Extracted Clauses Review */}
      {inputMethod === "ai-extract" && extractedClauses.length > 0 && (
        <div className="rounded-[14px] border bg-white p-6" style={{ borderColor: "var(--border)" }}>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              AI extracted {extractedClauses.length} clauses with{" "}
              {extractedClauses.reduce((sum, c) => sum + c.tasks.length, 0)} suggested tasks
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const allSelected = extractedClauses.every((c) => c.included);
                  setExtractedClauses((prev) =>
                    prev.map((c) => ({
                      ...c,
                      included: !allSelected,
                      tasks: c.tasks.map((t) => ({ ...t, included: !allSelected })),
                    }))
                  );
                }}
                className="rounded-lg border px-3 py-1.5 text-sm font-medium"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                {extractedClauses.every((c) => c.included) ? "Deselect All" : "Select All"}
              </button>
              <button
                onClick={() => {
                  setExtractedClauses([]);
                  setUploadedFile(null);
                }}
                className="rounded-lg border px-3 py-1.5 text-sm font-medium"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleApplyExtractedClauses}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-white"
                style={{ backgroundColor: "var(--blue)" }}
              >
                Apply Selected
              </button>
            </div>
          </div>

          <div className="max-h-96 space-y-3 overflow-y-auto">
            {extractedClauses.map((clause, idx) => (
              <div
                key={idx}
                className={`rounded-lg border p-4 ${clause.included ? "bg-white" : "border-dashed opacity-50"}`}
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={clause.included}
                    onChange={(e) =>
                      setExtractedClauses((prev) =>
                        prev.map((c, i) => (i === idx ? { ...c, included: e.target.checked } : c))
                      )
                    }
                    className="mt-1 rounded"
                  />
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="font-mono text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                        {clause.reference}
                      </span>
                      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {clause.title}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {clause.description}
                    </p>
                    {clause.tasks.length > 0 && (
                      <div className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                        {clause.tasks.length} suggested task{clause.tasks.length !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setExtractedClauses((prev) => prev.filter((_, i) => i !== idx))}
                    className="rounded p-1 transition-colors hover:bg-[var(--red-light)]"
                    style={{ color: "var(--red)" }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Excel Paste Mode */}
      {inputMethod === "excel-paste" && (
        <div className="rounded-[14px] border bg-white p-6" style={{ borderColor: "var(--border)" }}>
          <h4 className="mb-4 font-semibold" style={{ color: "var(--text-primary)" }}>
            Paste from Excel
          </h4>
          <p className="mb-4 text-sm" style={{ color: "var(--text-secondary)" }}>
            Paste tab-delimited data from Excel. Format: Reference | Title | Task Name | Frequency | Risk
          </p>
          <textarea
            value={pastedData}
            onChange={(e) => setPastedData(e.target.value)}
            placeholder="Paste Excel data here..."
            rows={10}
            className="mb-4 w-full rounded-lg border px-3 py-2 font-mono text-sm outline-none"
            style={{ borderColor: "var(--border)" }}
          />
          <button
            onClick={handlePasteFromExcel}
            disabled={!pastedData.trim()}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "var(--blue)" }}
          >
            Import Data
          </button>
        </div>
      )}

      {/* Manual Build Mode - By Clause View */}
      {inputMethod === "manual" && viewMode === "by-clause" && (
        <div className="space-y-4">
          {items.map((item) => (
            <ClauseCard
              key={item.tempId}
              item={item}
              itemLabel={itemLabel.singular}
              teams={teams}
              users={users}
              monitoringAreas={monitoringAreas}
              taskTypes={taskTypes}
              onUpdate={handleUpdateClause}
              onDelete={handleDeleteClause}
              onToggleExpanded={handleToggleClauseExpanded}
              onAddTask={handleAddTask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onToggleTaskExpanded={handleToggleTaskExpanded}
            />
          ))}

          <button
            onClick={handleAddClause}
            className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-dashed py-4 text-sm font-medium transition-colors hover:bg-[var(--bg-hover)]"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            <Plus size={18} />
            Add {itemLabel.singular}
          </button>
        </div>
      )}

      {/* Manual Build Mode - By Task View */}
      {inputMethod === "manual" && viewMode === "by-task" && (
        <div className="rounded-[14px] border bg-white overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: "var(--bg-subtle)", borderBottom: "1px solid var(--border)" }}>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: "var(--text-secondary)" }}>
                  Task Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: "var(--text-secondary)" }}>
                  {itemLabel.singular} Ref
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: "var(--text-secondary)" }}>
                  Frequency
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: "var(--text-secondary)" }}>
                  Risk
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: "var(--text-secondary)" }}>
                  Team
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase" style={{ color: "var(--text-secondary)" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {items.flatMap((item) =>
                item.tasks.map((task) => (
                  <tr key={task.tempId} style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td className="px-4 py-3">
                      <span className="text-sm" style={{ color: "var(--text-primary)" }}>{task.name || "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>{item.reference || "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{FREQUENCY_LABELS[task.frequency]}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="rounded-md px-2 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: RISK_COLORS[task.riskRating].bg, color: RISK_COLORS[task.riskRating].color }}
                      >
                        {task.riskRating}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                        {task.responsibleTeamId ? teams.find((t) => t.id === task.responsibleTeamId)?.name : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteTask(item.tempId, task.tempId)}
                        className="rounded p-1 transition-colors hover:bg-[var(--red-light)]"
                        style={{ color: "var(--red)" }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {totalTasks === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No tasks yet. Add clauses to get started.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ClauseCard sub-component
function ClauseCard({
  item,
  itemLabel,
  teams,
  users,
  monitoringAreas,
  taskTypes,
  onUpdate,
  onDelete,
  onToggleExpanded,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onToggleTaskExpanded,
}: {
  item: ItemWithTasks;
  itemLabel: string;
  teams: Team[];
  users: User[];
  monitoringAreas: MonitoringArea[];
  taskTypes: TaskType[];
  onUpdate: (tempId: string, field: string, value: string) => void;
  onDelete: (tempId: string) => void;
  onToggleExpanded: (tempId: string) => void;
  onAddTask: (clauseTempId: string) => void;
  onUpdateTask: (clauseTempId: string, taskTempId: string, field: string, value: string | boolean) => void;
  onDeleteTask: (clauseTempId: string, taskTempId: string) => void;
  onToggleTaskExpanded: (clauseTempId: string, taskTempId: string) => void;
}) {
  return (
    <div className="rounded-[14px] border bg-white p-4" style={{ borderColor: "var(--border)" }}>
      {/* Clause Header */}
      <div className="mb-4 flex items-start gap-3">
        <input
          type="text"
          value={item.reference}
          onChange={(e) => onUpdate(item.tempId, "reference", e.target.value)}
          placeholder="Ref (e.g. Art. 5.1)"
          className="w-32 rounded-lg border px-2 py-1 font-mono text-xs outline-none"
          style={{ borderColor: "var(--border)" }}
        />
        <input
          type="text"
          value={item.title}
          onChange={(e) => onUpdate(item.tempId, "title", e.target.value)}
          placeholder={`${itemLabel} title`}
          className="flex-1 rounded-lg border px-3 py-1 text-sm font-medium outline-none"
          style={{ borderColor: "var(--border)" }}
        />
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{item.tasks.length} tasks</span>
          <button
            onClick={() => onToggleExpanded(item.tempId)}
            className="rounded p-1 transition-colors hover:bg-[var(--bg-subtle)]"
            style={{ color: "var(--text-secondary)" }}
          >
            {item.expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button
            onClick={() => onDelete(item.tempId)}
            className="rounded p-1 transition-colors hover:bg-[var(--red-light)]"
            style={{ color: "var(--red)" }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {item.expanded && (
        <>
          <textarea
            value={item.description}
            onChange={(e) => onUpdate(item.tempId, "description", e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="mb-4 w-full rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: "var(--border)" }}
          />

          {/* Tasks */}
          <div className="space-y-2">
            {item.tasks.map((task) => (
              <TaskRow
                key={task.tempId}
                task={task}
                teams={teams}
                users={users}
                monitoringAreas={monitoringAreas}
                taskTypes={taskTypes}
                onUpdate={(field, value) => onUpdateTask(item.tempId, task.tempId, field, value)}
                onDelete={() => onDeleteTask(item.tempId, task.tempId)}
                onToggleExpanded={() => onToggleTaskExpanded(item.tempId, task.tempId)}
              />
            ))}

            <button
              onClick={() => onAddTask(item.tempId)}
              className="flex w-full items-center gap-2 rounded-lg border border-dashed py-2 text-sm font-medium transition-colors hover:bg-[var(--bg-hover)]"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              <Plus size={14} className="ml-2" />
              Add Task
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// TaskRow sub-component
function TaskRow({
  task,
  teams,
  users,
  monitoringAreas,
  taskTypes,
  onUpdate,
  onDelete,
  onToggleExpanded,
}: {
  task: TaskDefinition;
  teams: Team[];
  users: User[];
  monitoringAreas: MonitoringArea[];
  taskTypes: TaskType[];
  onUpdate: (field: string, value: string | boolean) => void;
  onDelete: () => void;
  onToggleExpanded: () => void;
}) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: "var(--border-light)", backgroundColor: "var(--bg-subtle)" }}>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={task.name}
          onChange={(e) => onUpdate("name", e.target.value)}
          placeholder="Task name"
          className="flex-1 rounded-lg border bg-white px-3 py-1 text-sm outline-none"
          style={{ borderColor: "var(--border)" }}
        />
        <select
          value={task.frequency}
          onChange={(e) => onUpdate("frequency", e.target.value)}
          className="h-8 rounded-lg border bg-white px-2 text-xs outline-none"
          style={{ borderColor: "var(--border)" }}
        >
          {FREQUENCIES.map((freq) => (
            <option key={freq} value={freq}>
              {FREQUENCY_LABELS[freq]}
            </option>
          ))}
        </select>
        <select
          value={task.riskRating}
          onChange={(e) => onUpdate("riskRating", e.target.value)}
          className="h-8 rounded-lg border bg-white px-2 text-xs outline-none"
          style={{ borderColor: "var(--border)" }}
        >
          {RISK_RATINGS.map((risk) => (
            <option key={risk} value={risk}>
              {risk}
            </option>
          ))}
        </select>
        <button
          onClick={onToggleExpanded}
          className="text-xs font-medium"
          style={{ color: "var(--blue)" }}
        >
          {task.expanded ? "Less" : "All fields"}
        </button>
        <button
          onClick={onDelete}
          className="rounded p-1 transition-colors hover:bg-[var(--red-light)]"
          style={{ color: "var(--red)" }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {task.expanded && (
        <div className="mt-3 grid grid-cols-2 gap-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Description
            </label>
            <textarea
              value={task.description}
              onChange={(e) => onUpdate("description", e.target.value)}
              rows={2}
              className="w-full rounded-lg border px-2 py-1 text-sm outline-none"
              style={{ borderColor: "var(--border)" }}
            />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Expected Outcome
            </label>
            <textarea
              value={task.expectedOutcome}
              onChange={(e) => onUpdate("expectedOutcome", e.target.value)}
              rows={2}
              className="w-full rounded-lg border px-2 py-1 text-sm outline-none"
              style={{ borderColor: "var(--border)" }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Responsible Team
            </label>
            <select
              value={task.responsibleTeamId}
              onChange={(e) => onUpdate("responsibleTeamId", e.target.value)}
              className="h-8 w-full rounded-lg border px-2 text-xs outline-none"
              style={{ borderColor: "var(--border)" }}
            >
              <option value="">Select team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              PIC
            </label>
            <select
              value={task.picId}
              onChange={(e) => onUpdate("picId", e.target.value)}
              className="h-8 w-full rounded-lg border px-2 text-xs outline-none"
              style={{ borderColor: "var(--border)" }}
            >
              <option value="">Select PIC</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Reviewer
            </label>
            {task.reviewRequired ? (
              <select
                value={task.reviewerId}
                onChange={(e) => onUpdate("reviewerId", e.target.value)}
                className="h-8 w-full rounded-lg border px-2 text-xs outline-none"
                style={{ borderColor: "var(--border)" }}
              >
                <option value="">Select reviewer</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            ) : (
              <div
                className="flex h-8 items-center rounded-lg border px-2 text-xs"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-subtle)", color: "var(--text-muted)" }}
              >
                Review not required
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Due Date
            </label>
            <input
              type="date"
              value={task.dueDate}
              onChange={(e) => onUpdate("dueDate", e.target.value)}
              className="h-8 w-full rounded-lg border px-2 text-xs outline-none"
              style={{ borderColor: "var(--border)" }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Monitoring Area
            </label>
            <select
              value={task.monitoringAreaId || ""}
              onChange={(e) => onUpdate("monitoringAreaId", e.target.value)}
              className="h-8 w-full rounded-lg border px-2 text-xs outline-none"
              style={{ borderColor: "var(--border)" }}
            >
              <option value="">Select monitoring area</option>
              {monitoringAreas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Task Type
            </label>
            <select
              value={task.taskTypeId || ""}
              onChange={(e) => onUpdate("taskTypeId", e.target.value)}
              className="h-8 w-full rounded-lg border px-2 text-xs outline-none"
              style={{ borderColor: "var(--border)" }}
            >
              <option value="">Select task type</option>
              {taskTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Testing Period Start
            </label>
            <input
              type="date"
              value={task.testingPeriodStart || ""}
              onChange={(e) => onUpdate("testingPeriodStart", e.target.value)}
              className="h-8 w-full rounded-lg border px-2 text-xs outline-none"
              style={{ borderColor: "var(--border)" }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Testing Period End
            </label>
            <input
              type="date"
              value={task.testingPeriodEnd || ""}
              onChange={(e) => onUpdate("testingPeriodEnd", e.target.value)}
              className="h-8 w-full rounded-lg border px-2 text-xs outline-none"
              style={{ borderColor: "var(--border)" }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              ClickUp URL
            </label>
            <input
              type="url"
              value={task.clickupUrl}
              onChange={(e) => onUpdate("clickupUrl", e.target.value)}
              className="h-8 w-full rounded-lg border px-2 text-xs outline-none"
              style={{ borderColor: "var(--border)" }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Google Drive URL
            </label>
            <input
              type="url"
              value={task.gdriveUrl}
              onChange={(e) => onUpdate("gdriveUrl", e.target.value)}
              className="h-8 w-full rounded-lg border px-2 text-xs outline-none"
              style={{ borderColor: "var(--border)" }}
            />
          </div>
          <div className="col-span-2 flex gap-4">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={task.evidenceRequired}
                onChange={(e) => onUpdate("evidenceRequired", e.target.checked)}
                className="rounded"
              />
              <span style={{ color: "var(--text-secondary)" }}>Evidence Required</span>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={task.reviewRequired}
                onChange={(e) => {
                  onUpdate("reviewRequired", e.target.checked);
                  // Clear reviewer selection when review is not required
                  if (!e.target.checked && task.reviewerId) {
                    onUpdate("reviewerId", "");
                  }
                }}
                className="rounded"
              />
              <span style={{ color: "var(--text-secondary)" }}>Review Required</span>
            </label>
          </div>
          {task.picId && task.responsibleTeamId && (() => {
            const selectedTeam = teams.find(t => t.id === task.responsibleTeamId);
            const selectedPIC = users.find(u => u.id === task.picId);
            const isPICInTeam = selectedTeam?.memberships?.some(m => m.userId === task.picId);
            
            if (!isPICInTeam && selectedTeam && selectedPIC) {
              return (
                <div className="col-span-2 text-xs" style={{ color: "var(--amber)" }}>
                  ⚠ {selectedPIC.name} is not a member of {selectedTeam.name}
                </div>
              );
            }
            return null;
          })()}
        </div>
      )}
    </div>
  );
}
