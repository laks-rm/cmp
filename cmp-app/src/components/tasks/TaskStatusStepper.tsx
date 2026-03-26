"use client";

type TaskStatusStepperProps = {
  currentStatus: string;
};

const STEPS = [
  { id: "TO_DO", label: "To Do" },
  { id: "IN_PROGRESS", label: "In Progress" },
  { id: "PENDING_REVIEW", label: "Pending Review" },
  { id: "COMPLETED", label: "Completed" },
];

export function TaskStatusStepper({ currentStatus }: TaskStatusStepperProps) {
  // Handle alternative end states
  const isDeferred = currentStatus === "DEFERRED";
  const isNotApplicable = currentStatus === "NOT_APPLICABLE";

  const currentStepIndex = STEPS.findIndex((step) => step.id === currentStatus);

  if (isDeferred || isNotApplicable) {
    return (
      <div className="rounded-lg border p-4" style={{ backgroundColor: "var(--bg-subtle)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-center">
          <span 
            className="rounded-full px-4 py-2 text-sm font-semibold" 
            style={{ 
              backgroundColor: isDeferred ? "var(--purple-light)" : "var(--bg-muted)", 
              color: isDeferred ? "var(--purple)" : "var(--text-muted)" 
            }}
          >
            {isDeferred ? "Task Deferred" : "Not Applicable"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-6" style={{ backgroundColor: "var(--bg-subtle)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const isPast = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isFuture = index > currentStepIndex;

          return (
            <div key={step.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-all"
                  style={{
                    backgroundColor: isPast || isCurrent ? "var(--blue)" : "white",
                    color: isPast || isCurrent ? "white" : "var(--text-muted)",
                    border: isFuture ? "2px solid var(--border)" : "none",
                  }}
                >
                  {isPast ? "✓" : index + 1}
                </div>
                <span
                  className="mt-2 text-xs font-medium"
                  style={{ color: isCurrent ? "var(--blue)" : isPast ? "var(--text-secondary)" : "var(--text-muted)" }}
                >
                  {step.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className="mx-4 h-0.5 flex-1"
                  style={{ backgroundColor: isPast ? "var(--blue)" : "var(--border)" }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
