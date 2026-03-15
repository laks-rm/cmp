type StatusPillProps = {
  status: "PLANNED" | "TO_DO" | "IN_PROGRESS" | "PENDING_REVIEW" | "COMPLETED" | "DEFERRED" | "NOT_APPLICABLE" | "OVERDUE";
};

const STATUS_CONFIG = {
  PLANNED: { label: "Planned", bg: "#E8EAED", color: "#5F6368", dot: "#9AA0A6" },
  TO_DO: { label: "To Do", bg: "#F1F3F8", color: "#7C849B", dot: "#A0A7BE" },
  IN_PROGRESS: { label: "In Progress", bg: "var(--blue-light)", color: "var(--blue)", dot: "var(--blue)" },
  PENDING_REVIEW: { label: "Pending Review", bg: "var(--amber-light)", color: "var(--amber)", dot: "var(--amber)" },
  COMPLETED: { label: "Completed", bg: "var(--green-light)", color: "var(--green)", dot: "var(--green)" },
  DEFERRED: { label: "Deferred", bg: "var(--purple-light)", color: "var(--purple)", dot: "var(--purple)" },
  NOT_APPLICABLE: { label: "N/A", bg: "#F1F3F8", color: "#7C849B", dot: "#A0A7BE" },
  OVERDUE: { label: "Overdue", bg: "var(--red-light)", color: "var(--red)", dot: "var(--red)" },
};

export function StatusPill({ status }: StatusPillProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: config.bg, color: config.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: config.dot }} />
      {config.label}
    </span>
  );
}
