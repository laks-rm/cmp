"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { logPageError } from "@/lib/errorLogger";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { data: session } = useSession();
  const [errorId, setErrorId] = useState<string | null>(null);

  useEffect(() => {
    console.error("Global error:", error);

    // Log error to database
    const logErrorAsync = async () => {
      const id = await logPageError(
        error,
        typeof window !== "undefined" ? window.location.href : "",
        session?.user?.userId,
        error.digest
      );
      if (id) setErrorId(id);
    };

    logErrorAsync();
  }, [error, session, error.digest]);

  return (
    <ErrorDisplay
      variant="page"
      title="Something went wrong"
      message="An unexpected error occurred. Please try again, or contact support if the problem persists."
      errorId={errorId || error.digest}
      showDetails={process.env.NODE_ENV === "development"}
      errorDetails={error.stack}
      secondaryAction={{
        label: "Go Home",
        onClick: () => (window.location.href = "/"),
      }}
      primaryAction={{
        label: "Try Again",
        onClick: reset,
      }}
    />
  );
}
