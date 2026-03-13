"use client";

import { useState, useEffect, useCallback } from "react";
import { useEntity } from "@/contexts/EntityContext";
import { TaskDetailModal } from "@/components/tasks/TaskDetailModal";
import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import toast from "@/lib/toast";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  isSameMonth,
  isSameDay,
  isToday,
  isPast,
  parseISO,
  getMonth,
  getYear,
  setMonth,
  setYear,
} from "date-fns";

type Task = {
  id: string;
  name: string;
  status: string;
  dueDate: string | null;
  plannedDate: string | null;
  frequency: string;
  quarter: string | null;
  entity: { id: string; code: string; name: string };
  source: { id: string; name: string; code: string };
  responsibleTeam: { id: string; name: string } | null;
};

type ViewMode = "month" | "quarter" | "year";

export function CalendarClient() {
  const { selectedEntityId, selectedTeamId } = useEntity();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalTaskId, setModalTaskId] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (selectedEntityId !== "GROUP") {
        params.set("entityId", selectedEntityId);
      }
      if (selectedTeamId !== "ALL") {
        params.set("teamId", selectedTeamId);
      }

      const res = await fetch(`/api/tasks?${params.toString()}&limit=1000`);
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [selectedEntityId, selectedTeamId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const getTasksForDate = (date: Date): Task[] => {
    return tasks.filter((task) => {
      const taskDate = task.plannedDate || task.dueDate;
      if (!taskDate) return false;
      return isSameDay(parseISO(taskDate), date);
    });
  };

  const getTaskColor = (task: Task): string => {
    const taskDate = task.plannedDate || task.dueDate;
    const isOverdue = taskDate && isPast(parseISO(taskDate)) && task.status !== "COMPLETED";
    
    if (isOverdue) return "var(--red)";
    
    switch (task.status) {
      case "PLANNED":
        return "#9AA0A6";
      case "TO_DO":
        return "#A0A7BE";
      case "IN_PROGRESS":
        return "var(--blue)";
      case "PENDING_REVIEW":
        return "var(--amber)";
      case "COMPLETED":
        return "var(--green)";
      default:
        return "#A0A7BE";
    }
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const dateFormat = "d";
    const rows = [];

    let days = [];
    let day = startDate;

    // Generate calendar grid
    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const dayTasks = getTasksForDate(day);
        const formattedDate = format(day, dateFormat);

        days.push(
          <div
            key={day.toString()}
            className={`min-h-[120px] border-r border-b p-2 transition-colors hover:bg-[var(--bg-hover)] cursor-pointer ${
              !isSameMonth(day, monthStart) ? "bg-[var(--bg-subtle)]" : ""
            } ${isToday(day) ? "bg-[var(--blue-light)]" : ""}`}
            style={{ borderColor: "var(--border-light)" }}
            onClick={() => {
              if (dayTasks.length === 1) {
                setModalTaskId(dayTasks[0].id);
              }
            }}
          >
            <div className="mb-1 flex items-center justify-between">
              <span
                className={`text-sm font-medium ${
                  isToday(day) ? "font-bold" : ""
                } ${!isSameMonth(day, monthStart) ? "text-[var(--text-faint)]" : ""}`}
                style={{ color: isToday(day) ? "var(--blue)" : "var(--text-secondary)" }}
              >
                {formattedDate}
              </span>
              {dayTasks.length > 0 && (
                <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                  {dayTasks.length}
                </span>
              )}
            </div>
            <div className="space-y-1">
              {dayTasks.slice(0, 3).map((task) => (
                <div
                  key={task.id}
                  className="truncate rounded px-1.5 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: `${getTaskColor(task)}20`,
                    color: getTaskColor(task),
                    borderLeft: `3px solid ${getTaskColor(task)}`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setModalTaskId(task.id);
                  }}
                >
                  {task.name}
                </div>
              ))}
              {dayTasks.length > 3 && (
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  +{dayTasks.length - 3} more
                </div>
              )}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div key={day.toString()} className="grid grid-cols-7">
          {days}
        </div>
      );
      days = [];
    }

    return (
      <div>
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b" style={{ borderColor: "var(--border)" }}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="border-r p-3 text-center text-sm font-semibold"
              style={{ color: "var(--text-secondary)", borderColor: "var(--border-light)" }}
            >
              {day}
            </div>
          ))}
        </div>
        {/* Calendar grid */}
        <div className="border-l border-t" style={{ borderColor: "var(--border-light)" }}>
          {rows}
        </div>
      </div>
    );
  };

  const renderQuarterView = () => {
    const currentMonth = getMonth(currentDate);
    const currentYear = getYear(currentDate);
    const quarter = Math.floor(currentMonth / 3);
    const monthsInQuarter = [quarter * 3, quarter * 3 + 1, quarter * 3 + 2];

    return (
      <div className="grid grid-cols-3 gap-4">
        {monthsInQuarter.map((monthIndex) => {
          const monthDate = setMonth(setYear(new Date(), currentYear), monthIndex);
          const monthName = format(monthDate, "MMMM yyyy");
          const monthStart = startOfMonth(monthDate);
          const monthEnd = endOfMonth(monthDate);
          const startDate = startOfWeek(monthStart);
          const endDate = endOfWeek(monthEnd);

          let day = startDate;
          const days = [];

          while (day <= endDate) {
            const dayTasks = getTasksForDate(day);
            const cloneDay = day;

            days.push(
              <div
                key={day.toString()}
                className={`aspect-square border p-1 text-center text-xs ${
                  !isSameMonth(day, monthDate) ? "bg-[var(--bg-subtle)]" : ""
                } ${dayTasks.length > 0 ? "font-semibold" : ""}`}
                style={{
                  borderColor: "var(--border-light)",
                  color: dayTasks.length > 0 ? "var(--blue)" : "var(--text-muted)",
                }}
                onClick={() => {
                  setCurrentDate(cloneDay);
                  setViewMode("month");
                }}
              >
                {format(day, "d")}
              </div>
            );
            day = addDays(day, 1);
          }

          return (
            <div key={monthIndex} className="rounded-lg border p-4" style={{ borderColor: "var(--border)" }}>
              <h3 className="mb-3 text-center text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {monthName}
              </h3>
              <div className="mb-2 grid grid-cols-7 gap-px text-xs" style={{ color: "var(--text-muted)" }}>
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <div key={i} className="text-center">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px">{days}</div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderYearView = () => {
    const currentYear = getYear(currentDate);
    const months = Array.from({ length: 12 }, (_, i) => i);

    return (
      <div className="grid grid-cols-4 gap-4">
        {months.map((monthIndex) => {
          const monthDate = setMonth(setYear(new Date(), currentYear), monthIndex);
          const monthName = format(monthDate, "MMMM");
          const monthTasks = tasks.filter((task) => {
            const taskDate = task.plannedDate || task.dueDate;
            if (!taskDate) return false;
            const date = parseISO(taskDate);
            return getMonth(date) === monthIndex && getYear(date) === currentYear;
          });

          const completedCount = monthTasks.filter((t) => t.status === "COMPLETED").length;
          const completionRate = monthTasks.length > 0 ? Math.round((completedCount / monthTasks.length) * 100) : 0;
          const intensity = Math.min(monthTasks.length / 10, 1);

          return (
            <div
              key={monthIndex}
              className="cursor-pointer rounded-lg border p-6 transition-all hover:shadow-lg"
              style={{
                borderColor: "var(--border)",
                backgroundColor: `rgba(59, 130, 246, ${intensity * 0.1})`,
              }}
              onClick={() => {
                setCurrentDate(monthDate);
                setViewMode("month");
              }}
            >
              <h3 className="mb-3 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                {monthName}
              </h3>
              <div className="space-y-2">
                <div className="text-2xl font-bold" style={{ color: "var(--blue)" }}>
                  {monthTasks.length}
                </div>
                <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {completedCount} completed
                </div>
                {monthTasks.length > 0 && (
                  <div className="text-sm font-medium" style={{ color: completionRate >= 70 ? "var(--green)" : "var(--amber)" }}>
                    {completionRate}% complete
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const handlePrevious = () => {
    if (viewMode === "month") {
      setCurrentDate(addMonths(currentDate, -1));
    } else if (viewMode === "quarter") {
      setCurrentDate(addMonths(currentDate, -3));
    } else {
      setCurrentDate(setYear(currentDate, getYear(currentDate) - 1));
    }
  };

  const handleNext = () => {
    if (viewMode === "month") {
      setCurrentDate(addMonths(currentDate, 1));
    } else if (viewMode === "quarter") {
      setCurrentDate(addMonths(currentDate, 3));
    } else {
      setCurrentDate(setYear(currentDate, getYear(currentDate) + 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const getViewTitle = () => {
    if (viewMode === "year") {
      return format(currentDate, "yyyy");
    } else if (viewMode === "quarter") {
      const quarter = Math.floor(getMonth(currentDate) / 3) + 1;
      return `Q${quarter} ${format(currentDate, "yyyy")}`;
    } else {
      return format(currentDate, "MMMM yyyy");
    }
  };

  // Calculate summary stats
  const currentPeriodTasks = tasks.filter((task) => {
    const taskDate = task.plannedDate || task.dueDate;
    if (!taskDate) return false;
    const date = parseISO(taskDate);

    if (viewMode === "year") {
      return getYear(date) === getYear(currentDate);
    } else if (viewMode === "quarter") {
      const taskQuarter = Math.floor(getMonth(date) / 3);
      const currentQuarter = Math.floor(getMonth(currentDate) / 3);
      return taskQuarter === currentQuarter && getYear(date) === getYear(currentDate);
    } else {
      return isSameMonth(date, currentDate);
    }
  });

  const plannedCount = currentPeriodTasks.filter((t) => t.status === "PLANNED").length;
  const completedCount = currentPeriodTasks.filter((t) => t.status === "COMPLETED").length;
  const inProgressCount = currentPeriodTasks.filter((t) => t.status === "IN_PROGRESS").length;
  const overdueCount = currentPeriodTasks.filter((t) => {
    const taskDate = t.plannedDate || t.dueDate;
    return taskDate && isPast(parseISO(taskDate)) && t.status !== "COMPLETED";
  }).length;
  const completionRate =
    currentPeriodTasks.length > 0 ? Math.round((completedCount / currentPeriodTasks.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Calendar</h1>
          <div className="flex items-center gap-2 rounded-lg border" style={{ borderColor: "var(--border)" }}>
            <button
              onClick={() => setViewMode("month")}
              className={`rounded-l-lg px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === "month" ? "bg-[var(--blue)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode("quarter")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === "quarter" ? "bg-[var(--blue)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              Quarter
            </button>
            <button
              onClick={() => setViewMode("year")}
              className={`rounded-r-lg px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === "year" ? "bg-[var(--blue)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              Year
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrevious}
            className="rounded-lg border p-2 transition-colors hover:bg-[var(--bg-hover)]"
            style={{ borderColor: "var(--border)" }}
          >
            <ChevronLeft size={20} style={{ color: "var(--text-secondary)" }} />
          </button>
          <button
            onClick={handleToday}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--bg-hover)]"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            Today
          </button>
          <button
            onClick={handleNext}
            className="rounded-lg border p-2 transition-colors hover:bg-[var(--bg-hover)]"
            style={{ borderColor: "var(--border)" }}
          >
            <ChevronRight size={20} style={{ color: "var(--text-secondary)" }} />
          </button>
          <div className="ml-2 text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {getViewTitle()}
          </div>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="rounded-lg border p-4" style={{ backgroundColor: "var(--bg-subtle)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                Total Tasks
              </div>
              <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                {currentPeriodTasks.length}
              </div>
            </div>
            <div className="h-12 w-px" style={{ backgroundColor: "var(--border)" }} />
            <div>
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                Planned
              </div>
              <div className="text-xl font-semibold" style={{ color: "#9AA0A6" }}>
                {plannedCount}
              </div>
            </div>
            <div>
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                Completed
              </div>
              <div className="text-xl font-semibold" style={{ color: "var(--green)" }}>
                {completedCount}
              </div>
            </div>
            <div>
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                In Progress
              </div>
              <div className="text-xl font-semibold" style={{ color: "var(--blue)" }}>
                {inProgressCount}
              </div>
            </div>
            <div>
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                Overdue
              </div>
              <div className="text-xl font-semibold" style={{ color: "var(--red)" }}>
                {overdueCount}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm" style={{ color: "var(--text-muted)" }}>
              Completion Rate
            </div>
            <div
              className="text-3xl font-bold"
              style={{ color: completionRate >= 70 ? "var(--green)" : completionRate >= 40 ? "var(--amber)" : "var(--red)" }}
            >
              {completionRate}%
            </div>
          </div>
        </div>
      </div>

      {/* Calendar View */}
      <div className="rounded-lg border bg-white" style={{ borderColor: "var(--border)" }}>
        {loading ? (
          <div className="flex h-96 items-center justify-center" style={{ color: "var(--text-muted)" }}>
            Loading calendar...
          </div>
        ) : (
          <>
            {viewMode === "month" && renderMonthView()}
            {viewMode === "quarter" && renderQuarterView()}
            {viewMode === "year" && renderYearView()}
          </>
        )}
      </div>

      {/* Task Detail Modal */}
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
