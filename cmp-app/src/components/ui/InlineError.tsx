"use client";

import { AlertCircle, RefreshCw } from "lucide-react";

export type InlineErrorProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
};

export function InlineError({
  title = "Failed to load",
  message = "An error occurred while loading this content.",
  onRetry,
  retryLabel = "Try Again",
  className = "",
}: InlineErrorProps) {
  return (
    <div
      className={`rounded-lg border p-6 text-center ${className}`}
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-subtle)" }}
    >
      <div className="mb-3 flex justify-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: "rgba(239, 68, 68, 0.1)" }}
        >
          <AlertCircle size={24} style={{ color: "#ef4444" }} />
        </div>
      </div>

      <h3 className="mb-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        {title}
      </h3>

      <p className="mb-4 text-xs" style={{ color: "var(--text-secondary)" }}>
        {message}
      </p>

      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium text-white transition-opacity"
          style={{ backgroundColor: "var(--blue)" }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <RefreshCw size={14} />
          {retryLabel}
        </button>
      )}
    </div>
  );
}
