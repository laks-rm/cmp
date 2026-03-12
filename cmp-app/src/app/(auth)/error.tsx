"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Auth error:", error);
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
          Authentication Error
        </h2>
        
        <p className="mb-6 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          An error occurred during authentication. Please try logging in again.
        </p>

        {error.digest && (
          <p className="mb-6 text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            Error ID: {error.digest}
          </p>
        )}

        <button
          onClick={reset}
          className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-opacity"
          style={{ backgroundColor: "var(--blue)" }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
