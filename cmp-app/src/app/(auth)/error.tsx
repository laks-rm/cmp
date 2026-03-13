"use client";

import { useEffect, useState } from "react";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { logPageError } from "@/lib/errorLogger";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [errorId, setErrorId] = useState<string | null>(null);

  useEffect(() => {
    console.error("Auth error:", error);

    // Log error to database (no userId since auth failed)
    const logErrorAsync = async () => {
      const id = await logPageError(
        error,
        typeof window !== "undefined" ? window.location.href : "",
        undefined,
        error.digest
      );
      if (id) setErrorId(id);
    };

    logErrorAsync();
  }, [error, error.digest]);

  return (
    <ErrorDisplay
      variant="page"
      title="Authentication Error"
      message="An error occurred during authentication. Please try logging in again."
      errorId={errorId || error.digest}
      showDetails={process.env.NODE_ENV === "development"}
      errorDetails={error.stack}
      primaryAction={{
        label: "Try Again",
        onClick: reset,
      }}
    />
  );
}
