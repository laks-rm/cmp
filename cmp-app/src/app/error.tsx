"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4" style={{ backgroundColor: "var(--bg-subtle)" }}>
      <div className="w-full max-w-md rounded-[20px] border bg-white p-8 text-center shadow-lg" style={{ borderColor: "var(--border)" }}>
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: "var(--red-light)" }}>
            <AlertTriangle size={32} style={{ color: "var(--red)" }} />
          </div>
        </div>
        
        <h2 className="mb-2 text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
          Something went wrong
        </h2>
        
        <p className="mb-6 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          An unexpected error occurred. Please try again, or contact support if the problem persists.
        </p>

        {error.digest && (
          <p className="mb-6 text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            Error ID: {error.digest}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => window.location.href = "/"}
            className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "white" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "white")}
          >
            Go Home
          </button>
          
          <button
            onClick={reset}
            className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-opacity"
            style={{ backgroundColor: "var(--blue)" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}
