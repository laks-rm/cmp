"use client";

import { AlertTriangle } from "lucide-react";
import { ReactNode } from "react";

export type ErrorDisplayVariant = "page" | "modal" | "inline";

export type ErrorAction = {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
};

export type ErrorDisplayProps = {
  variant?: ErrorDisplayVariant;
  title?: string;
  message?: string;
  errorId?: string;
  icon?: ReactNode;
  primaryAction?: ErrorAction;
  secondaryAction?: ErrorAction;
  showDetails?: boolean;
  errorDetails?: string;
  className?: string;
};

export function ErrorDisplay({
  variant = "page",
  title = "Something went wrong",
  message = "An error occurred while loading this page. Please try again, or navigate back to the dashboard.",
  errorId,
  icon,
  primaryAction,
  secondaryAction,
  showDetails = false,
  errorDetails,
  className = "",
}: ErrorDisplayProps) {
  const containerClasses = {
    page: "flex min-h-screen items-center justify-center p-4",
    modal: "flex items-center justify-center p-4",
    inline: "flex items-center justify-center p-4",
  };

  const cardClasses = {
    page: "w-full max-w-[500px]",
    modal: "w-full max-w-[500px]",
    inline: "w-full max-w-[400px]",
  };

  const iconSizes = {
    page: { circle: 80, icon: 40 },
    modal: { circle: 80, icon: 40 },
    inline: { circle: 64, icon: 32 },
  };

  const size = iconSizes[variant];

  return (
    <div className={`${containerClasses[variant]} ${className}`} style={{ backgroundColor: variant === "page" ? "var(--bg-subtle)" : "transparent" }}>
      <div
        className="rounded-[20px] border bg-white p-12 text-center shadow-xl"
        style={{ borderColor: "var(--border)" }}
      >
        {/* Icon */}
        <div className="mb-6 flex justify-center">
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              width: `${size.circle}px`,
              height: `${size.circle}px`,
            }}
          >
            {icon || <AlertTriangle size={size.icon} style={{ color: "#ef4444" }} />}
          </div>
        </div>

        {/* Title */}
        <h2 className="mb-3 text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
          {title}
        </h2>

        {/* Message */}
        <p className="mb-8 text-base leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {message}
        </p>

        {/* Error ID */}
        {errorId && (
          <p className="mb-6 font-mono text-xs" style={{ color: "var(--text-muted)" }}>
            Error ID: {errorId}
          </p>
        )}

        {/* Error Details (for dev mode) */}
        {showDetails && errorDetails && (
          <details className="mb-6 text-left">
            <summary className="cursor-pointer text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              Technical Details
            </summary>
            <pre
              className="mt-2 max-h-40 overflow-auto rounded-lg p-3 text-xs"
              style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-muted)" }}
            >
              {errorDetails}
            </pre>
          </details>
        )}

        {/* Actions */}
        {(secondaryAction || primaryAction) && (
          <div className="flex gap-3">
            {secondaryAction && (
              <button
                onClick={secondaryAction.onClick}
                className="flex-1 rounded-lg border px-6 py-3 text-sm font-medium transition-colors"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text-secondary)",
                  backgroundColor: "white",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "white")}
              >
                {secondaryAction.label}
              </button>
            )}

            {primaryAction && (
              <button
                onClick={primaryAction.onClick}
                className="flex-1 rounded-lg px-6 py-3 text-sm font-medium text-white transition-opacity"
                style={{ backgroundColor: "var(--blue)" }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                {primaryAction.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
