"use client";

import { AlertCircle, CheckCircle, X } from "lucide-react";
import type { ItemWithTasks, Entity, MonitoringArea, TaskType } from "@/types/source-management";
import { ITEM_LABEL_MAP, FREQUENCY_LABELS, RISK_COLORS, SOURCE_TYPE_COLORS } from "@/types/source-management";

type GenerationConfirmModalProps = {
  isOpen: boolean;
  sourceName: string;
  sourceCode: string;
  sourceType: string;
  selectedEntities: Entity[];
  authorityName?: string;
  teamName: string;
  items: ItemWithTasks[];
  monitoringAreas: MonitoringArea[];
  taskTypes: TaskType[];
  onConfirm: () => void;
  onCancel: () => void;
  isGenerating?: boolean;
};

export function GenerationConfirmModal({
  isOpen,
  sourceName,
  sourceCode,
  sourceType,
  selectedEntities,
  authorityName,
  teamName,
  items,
  monitoringAreas,
  taskTypes,
  onConfirm,
  onCancel,
  isGenerating = false,
}: GenerationConfirmModalProps) {
  if (!isOpen) return null;

  const itemLabel = ITEM_LABEL_MAP[sourceType] || { singular: "Clause", plural: "Clauses" };
  const typeConfig = SOURCE_TYPE_COLORS[sourceType as keyof typeof SOURCE_TYPE_COLORS];
  
  const taskDefinitionsCount = items.reduce((sum, item) => sum + item.tasks.length, 0);
  const totalTasksToGenerate = taskDefinitionsCount * selectedEntities.length;
  
  // Validation - classify into blocking errors vs warnings
  const errors: string[] = [];
  const warnings: string[] = [];

  if (items.length === 0) {
    errors.push(`No ${itemLabel.plural.toLowerCase()} defined`);
  }

  if (taskDefinitionsCount === 0) {
    errors.push("No tasks defined");
  }

  // Check for blocking issues (required fields) and warnings (optional fields)
  items.forEach((item, itemIndex) => {
    const clauseLabel = item.reference || `Clause ${itemIndex + 1}`;
    
    if (!item.reference.trim()) {
      warnings.push(`${clauseLabel}: Missing reference (recommended)`);
    }
    if (!item.title.trim()) {
      warnings.push(`${clauseLabel}: Missing title (recommended)`);
    }
    
    item.tasks.forEach((task, taskIndex) => {
      const taskLabel = `${clauseLabel}, Task ${taskIndex + 1}`;
      
      // BLOCKING: Task name is required
      if (!task.name.trim()) {
        errors.push(`${taskLabel}: Task name is required`);
      }
      
      // WARNINGS: Optional but recommended fields
      if (!task.responsibleTeamId) {
        warnings.push(`${taskLabel} ("${task.name || "unnamed"}"): No team assigned (optional)`);
      }
      if (!task.picId) {
        warnings.push(`${taskLabel} ("${task.name || "unnamed"}"): No PIC assigned (optional)`);
      }
    });
  });

  const hasErrors = errors.length > 0;
  const statusColor = hasErrors ? "var(--red)" : warnings.length > 0 ? "var(--amber)" : "var(--green)";
  const statusBg = hasErrors ? "var(--red-light)" : warnings.length > 0 ? "var(--amber-light)" : "var(--green-light)";
  const statusIcon = hasErrors ? AlertCircle : warnings.length > 0 ? AlertCircle : CheckCircle;
  const StatusIcon = statusIcon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[14px] bg-white shadow-lg">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b bg-white px-6 py-4" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            Review & Generate
          </h2>
          <button
            onClick={onCancel}
            disabled={isGenerating}
            className="rounded-lg p-1 transition-colors hover:bg-[var(--bg-subtle)]"
            style={{ color: "var(--text-secondary)" }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Source Summary */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Source Summary
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{sourceName}</span>
              <span
                className="rounded-md px-2 py-0.5 font-mono text-xs font-medium"
                style={{ backgroundColor: "var(--bg-muted)", color: "var(--text-secondary)" }}
              >
                {sourceCode}
              </span>
              <span>·</span>
              <span
                className="rounded-md px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: typeConfig.bg, color: typeConfig.color }}
              >
                {typeConfig.label}
              </span>
              <span>·</span>
              <span style={{ color: "var(--text-secondary)" }}>
                {selectedEntities.map((e) => e.code).join(", ")}
              </span>
              {authorityName && (
                <>
                  <span>·</span>
                  <span style={{ color: "var(--text-secondary)" }}>{authorityName}</span>
                </>
              )}
              <span>·</span>
              <span style={{ color: "var(--text-secondary)" }}>{teamName}</span>
            </div>
          </div>

          {/* Generation Math */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Generation Plan
            </h3>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{taskDefinitionsCount}</span> task definitions × {" "}
              <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{selectedEntities.length}</span> entities ={" "}
              <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{totalTasksToGenerate}</span> total tasks
            </p>
          </div>

          {/* Validation Status */}
          <div
            className="rounded-lg border p-4"
            style={{ borderColor: statusColor, backgroundColor: statusBg }}
          >
            <div className="flex items-start gap-3">
              <StatusIcon size={20} style={{ color: statusColor, marginTop: 2 }} />
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: statusColor }}>
                  {hasErrors ? "Cannot Generate - Fix Required Fields" : warnings.length > 0 ? "Ready with Optional Warnings" : "Ready to Generate"}
                </p>
                {errors.length > 0 && (
                  <>
                    <p className="mt-1 text-xs font-medium" style={{ color: statusColor }}>
                      Required fields missing:
                    </p>
                    <ul className="mt-2 space-y-1">
                      {errors.map((error, idx) => (
                        <li key={idx} className="text-xs" style={{ color: statusColor }}>
                          • {error}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {warnings.length > 0 && !hasErrors && (
                  <>
                    <p className="mt-1 text-xs font-medium" style={{ color: statusColor }}>
                      Optional fields not set (you can still generate):
                    </p>
                    <ul className="mt-2 space-y-1">
                      {warnings.slice(0, 8).map((warning, idx) => (
                        <li key={idx} className="text-xs" style={{ color: statusColor }}>
                          • {warning}
                        </li>
                      ))}
                      {warnings.length > 8 && (
                        <li className="text-xs" style={{ color: statusColor }}>
                          • ... and {warnings.length - 8} more optional fields
                        </li>
                      )}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Detailed Breakdown */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Detailed Breakdown
            </h3>
            <div className="max-h-96 overflow-y-auto rounded-lg border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full">
                <thead className="sticky top-0 bg-white">
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase" style={{ color: "var(--text-secondary)" }}>
                      Reference
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase" style={{ color: "var(--text-secondary)" }}>
                      Task
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase" style={{ color: "var(--text-secondary)" }}>
                      Frequency
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase" style={{ color: "var(--text-secondary)" }}>
                      Risk
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <>
                      <tr key={`clause-${item.tempId}`} style={{ backgroundColor: "var(--bg-subtle)", borderBottom: "1px solid var(--border)" }}>
                        <td colSpan={4} className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                              {item.reference || "—"}
                            </span>
                            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                              {item.title || "Untitled"}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {item.tasks.map((task, taskIndex) => {
                        const riskColor = RISK_COLORS[task.riskRating];
                        // Calculate recurrence count
                        let recurrenceCount = 1;
                        switch (task.frequency) {
                          case "DAILY": recurrenceCount = 365; break;
                          case "WEEKLY": recurrenceCount = 52; break;
                          case "MONTHLY": recurrenceCount = 12; break;
                          case "QUARTERLY": recurrenceCount = 4; break;
                          case "SEMI_ANNUAL": recurrenceCount = 2; break;
                          case "ANNUAL": recurrenceCount = 1; break;
                          case "BIENNIAL": recurrenceCount = 1; break;
                          case "ONE_TIME": recurrenceCount = 1; break;
                        }
                        
                        return (
                          <tr key={task.tempId} style={{ borderBottom: "1px solid var(--border-light)" }}>
                            <td className="px-4 py-2"></td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm" style={{ color: task.name ? "var(--text-primary)" : "var(--red)" }}>
                                  {task.name || `[Task ${taskIndex + 1} - name required]`}
                                </span>
                                {task.monitoringAreaId && (
                                  <span className="rounded-md px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: "var(--blue-light)", color: "var(--blue)" }}>
                                    {monitoringAreas.find((a) => a.id === task.monitoringAreaId)?.name}
                                  </span>
                                )}
                                {task.taskTypeId && (
                                  <span className="rounded-md px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: "var(--purple-light)", color: "var(--purple)" }}>
                                    {taskTypes.find((t) => t.id === task.taskTypeId)?.name}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                                {FREQUENCY_LABELS[task.frequency]} {recurrenceCount > 1 && `(${recurrenceCount})`}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <span
                                className="rounded-md px-2 py-0.5 text-xs font-medium"
                                style={{ backgroundColor: riskColor.bg, color: riskColor.color }}
                              >
                                {task.riskRating}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between border-t bg-white px-6 py-4" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={onCancel}
            disabled={isGenerating}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            onMouseEnter={(e) => !isGenerating && (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            Back to editing
          </button>
          <button
            onClick={onConfirm}
            disabled={hasErrors || isGenerating}
            className="rounded-lg px-6 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "var(--green)" }}
          >
            {isGenerating ? "Generating..." : `Generate ${totalTasksToGenerate} tasks`}
          </button>
        </div>
      </div>
    </div>
  );
}
