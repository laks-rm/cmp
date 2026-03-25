"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api-client";
import { StatusPill } from "@/components/ui/StatusPill";
import { EntityBadge } from "@/components/ui/EntityBadge";
import { TaskDetailModal } from "@/components/tasks/TaskDetailModal";
import { format } from "date-fns";
import { ArrowLeft, FileText } from "lucide-react";
import toast from "react-hot-toast";

type Task = {
  id: string;
  name: string;
  status: string;
  riskRating: string;
  dueDate: string | null;
  entity: {
    code: string;
  };
  pic: {
    id: string;
    name: string;
    initials: string;
    avatarColor: string | null;
  } | null;
};

type Source = {
  id: string;
  name: string;
  code: string;
  entity: {
    code: string;
  };
};

export function SourceTasksClient({ sourceId }: { sourceId: string }) {
  const router = useRouter();
  const [source, setSource] = useState<Source | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [sourceData, tasksData] = await Promise.all([
        fetchApi<Source>(`/api/sources/${sourceId}`),
        fetchApi<Task[]>(`/api/tasks?sourceId=${sourceId}`),
      ]);
      setSource(sourceData);
      setTasks(tasksData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load source tasks";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [sourceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="text-sm text-gray-600">Loading tasks...</p>
        </div>
      </div>
    );
  }

  if (!source) {
    return (
      <div className="p-8">
        <div className="text-center">
          <p className="text-red-600">Source not found</p>
          <button
            onClick={() => router.push("/sources")}
            className="mt-4 text-blue-600 hover:underline"
          >
            Back to Sources
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <button
          onClick={() => router.push("/sources")}
          className="mb-4 flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Sources
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{source.name}</h1>
            <div className="mt-2 flex items-center gap-3">
              <EntityBadge entityCode={source.entity.code as "DIEL" | "DGL" | "DBVI" | "FINSERV" | "GROUP"} />
              <span className="text-sm text-gray-600">Code: {source.code}</span>
            </div>
          </div>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No tasks found</h3>
          <p className="mt-2 text-sm text-gray-600">
            There are no tasks associated with this source yet.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Task
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Entity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Risk
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Assignee
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {tasks.map((task) => (
                <tr
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{task.name}</div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <EntityBadge entityCode={task.entity.code as "DIEL" | "DGL" | "DBVI" | "FINSERV" | "GROUP"} />
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <StatusPill status={task.status as "PLANNED" | "TO_DO" | "IN_PROGRESS" | "PENDING_REVIEW" | "COMPLETED" | "DEFERRED" | "NOT_APPLICABLE" | "OVERDUE"} />
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        task.riskRating === "HIGH"
                          ? "bg-red-100 text-red-800"
                          : task.riskRating === "MEDIUM"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {task.riskRating}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {task.dueDate ? format(new Date(task.dueDate), "MMM d, yyyy") : "—"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    {task.pic ? (
                      <div className="flex items-center">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: task.pic.avatarColor || "#6B7280" }}
                        >
                          {task.pic.initials}
                        </div>
                        <span className="ml-2 text-sm text-gray-900">{task.pic.name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Unassigned</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedTaskId && (
        <TaskDetailModal
          isOpen={true}
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onNavigateToTask={(taskId) => setSelectedTaskId(taskId)}
        />
      )}
    </div>
  );
}
