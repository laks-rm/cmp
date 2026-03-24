"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { FileText, Paperclip } from "lucide-react";
import { StatusPill } from "@/components/ui/StatusPill";
import { EntityBadge } from "@/components/ui/EntityBadge";
import { TaskDetailModal } from "@/components/tasks/TaskDetailModal";
import toast from "@/lib/toast";

type Task = {
  id: string;
  name: string;
  status: string;
  riskRating: string;
  submittedAt: string | null;
  source: {
    name: string;
    code: string;
  };
  entity: {
    code: string;
  };
  assignee: {
    id: string;
    name: string;
    initials: string;
    avatarColor: string | null;
  } | null;
  _count?: {
    evidence: number;
  };
};

export function ReviewQueueClient() {
  const { data: session } = useSession();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"my-reviews" | "all-pending">("my-reviews");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, session]);

  const fetchTasks = async () => {
    if (!session?.user) return;

    try {
      setLoading(true);
      const params = new URLSearchParams({
        status: "PENDING_REVIEW",
      });

      if (activeTab === "my-reviews") {
        params.set("reviewerId", session.user.userId);
      }

      const res = await fetch(`/api/tasks?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch tasks");

      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (error) {
      console.error("Error fetching review queue:", error);
      toast.error("Failed to load review queue");
    } finally {
      setLoading(false);
    }
  };

  const RISK_COLORS = {
    HIGH: { bg: "var(--red-light)", color: "var(--red)" },
    MEDIUM: { bg: "var(--amber-light)", color: "var(--amber)" },
    LOW: { bg: "var(--green-light)", color: "var(--green)" },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          Review Queue
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Tasks pending your review
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b" style={{ borderColor: "var(--border-light)" }}>
        <button
          onClick={() => setActiveTab("my-reviews")}
          className="relative pb-3 px-4 text-sm font-medium transition-colors"
          style={{
            color: activeTab === "my-reviews" ? "var(--blue)" : "var(--text-muted)",
          }}
        >
          Awaiting My Review
          {activeTab === "my-reviews" && (
            <div
              className="absolute bottom-0 left-0 right-0 h-0.5"
              style={{ backgroundColor: "var(--blue)" }}
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab("all-pending")}
          className="relative pb-3 px-4 text-sm font-medium transition-colors"
          style={{
            color: activeTab === "all-pending" ? "var(--blue)" : "var(--text-muted)",
          }}
        >
          All Pending
          {activeTab === "all-pending" && (
            <div
              className="absolute bottom-0 left-0 right-0 h-0.5"
              style={{ backgroundColor: "var(--blue)" }}
            />
          )}
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex h-96 items-center justify-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Loading review queue...
          </p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex h-96 flex-col items-center justify-center rounded-[14px] border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-subtle)" }}>
          <FileText size={64} style={{ color: "var(--text-muted)", marginBottom: 16 }} />
          <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
            No tasks pending review
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            {activeTab === "my-reviews" ? "You're all caught up!" : "No tasks are pending review"}
          </p>
        </div>
      ) : (
        <div className="rounded-[14px] border bg-white shadow-sm" style={{ borderColor: "var(--border)" }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ backgroundColor: "var(--bg-subtle)", borderColor: "var(--border)" }}>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Task
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Submitted By
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Source
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Risk
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Evidence
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Submitted
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => {
                  const riskConfig = RISK_COLORS[task.riskRating as keyof typeof RISK_COLORS];

                  return (
                    <tr
                      key={task.id}
                      className="border-t transition-colors hover:bg-[var(--bg-hover)]"
                      style={{ borderColor: "var(--border-light)" }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <p className="font-medium leading-tight" style={{ color: "var(--text-primary)" }}>
                              {task.name}
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                              <EntityBadge entityCode={task.entity.code as "DIEL" | "DGL" | "DBVI" | "FINSERV" | "GROUP"} />
                              <StatusPill status={task.status as "TO_DO" | "IN_PROGRESS" | "PENDING_REVIEW" | "COMPLETED" | "DEFERRED" | "NOT_APPLICABLE"} />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {task.assignee ? (
                          <div className="flex items-center gap-2">
                            <div
                              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                              style={{ background: task.assignee.avatarColor || "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
                            >
                              {task.assignee.initials}
                            </div>
                            <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                              {task.assignee.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm" style={{ color: "var(--text-muted)" }}>Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                            {task.source.name}
                          </p>
                          <p className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                            {task.source.code}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="rounded-md px-2 py-1 text-xs font-medium"
                          style={{
                            backgroundColor: riskConfig.bg,
                            color: riskConfig.color,
                          }}
                        >
                          {task.riskRating}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Paperclip size={14} style={{ color: "var(--text-muted)" }} />
                          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                            {task._count?.evidence || 0}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {task.submittedAt ? (
                          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                            {format(new Date(task.submittedAt), "MMM d, yyyy")}
                          </span>
                        ) : (
                          <span className="text-sm" style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedTaskId(task.id)}
                          className="rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-opacity"
                          style={{ backgroundColor: "var(--blue)" }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedTaskId && (
        <TaskDetailModal
          isOpen={!!selectedTaskId}
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onTaskUpdated={fetchTasks}
        />
      )}
    </div>
  );
}
