"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { logPageError } from "@/lib/errorLogger";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { data: session } = useSession();
  const [errorId, setErrorId] = useState<string | null>(null);

  useEffect(() => {
    console.error("Dashboard error:", error);

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
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center p-4">
      <ErrorDisplay
        variant="page"
        title="Something went wrong"
        message="An error occurred while loading this page. Please try again, or navigate back to the dashboard."
        errorId={errorId || error.digest}
        showDetails={process.env.NODE_ENV === "development"}
        errorDetails={error.stack}
        secondaryAction={{
          label: "Go to Dashboard",
          onClick: () => (window.location.href = "/"),
        }}
        primaryAction={{
          label: "Try Again",
          onClick: reset,
        }}
        className="bg-transparent"
      />
    </div>
  );
}
