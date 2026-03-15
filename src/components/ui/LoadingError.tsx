"use client";

import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export type LoadingErrorProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  onGoHome?: () => void;
  showHomeButton?: boolean;
};

export function LoadingError({
  title = "Failed to load data",
  message = "We couldn't load the requested data. Please try again or go back to the dashboard.",
  onRetry,
  onGoHome,
  showHomeButton = true,
}: LoadingErrorProps) {
  return (
    <div className="flex min-h-[400px] items-center justify-center p-8">
      <div className="w-full max-w-md text-center">
        <div className="mb-4 flex justify-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: "rgba(239, 68, 68, 0.1)" }}
          >
            <AlertTriangle size={32} style={{ color: "#ef4444" }} />
          </div>
        </div>

        <h3 className="mb-2 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          {title}
        </h3>

        <p className="mb-6 text-sm" style={{ color: "var(--text-secondary)" }}>
          {message}
        </p>

        <div className="flex justify-center gap-3">
          {showHomeButton && onGoHome && (
            <button
              onClick={onGoHome}
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-secondary)",
                backgroundColor: "white",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "white")}
            >
              <Home size={16} />
              Go to Dashboard
            </button>
          )}

          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity"
              style={{ backgroundColor: "var(--blue)" }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              <RefreshCw size={16} />
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
