"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { ErrorType, ErrorSeverity } from "@prisma/client";
import { logError, logApiError, logDataFetchError } from "@/lib/errorLogger";
import toast from "@/lib/toast";

export type ErrorHandlerOptions = {
  type?: ErrorType;
  severity?: ErrorSeverity;
  showModal?: boolean;
  showToast?: boolean;
  context?: string;
  onError?: (error: Error) => void;
};

export type ErrorModalState = {
  isOpen: boolean;
  title: string;
  message: string;
  errorId?: string;
  onRetry?: () => void;
};

export function useErrorHandler() {
  const { data: session } = useSession();
  const [errorModal, setErrorModal] = useState<ErrorModalState>({
    isOpen: false,
    title: "",
    message: "",
  });

  const handleError = useCallback(
    async (
      error: Error | string,
      options: ErrorHandlerOptions = {}
    ) => {
      const {
        type = ErrorType.COMPONENT_ERROR,
        severity = ErrorSeverity.ERROR,
        showModal = false,
        showToast = true,
        context,
        onError,
      } = options;

      const errorMessage = error instanceof Error ? error.message : String(error);

      // Log to database
      const errorId = await logError({
        error,
        errorType: type,
        severity,
        context: {
          userId: session?.user?.userId,
          componentName: context,
        },
      });

      // Call custom error handler if provided
      if (onError && error instanceof Error) {
        onError(error);
      }

      // Show modal for critical errors or if explicitly requested
      if (showModal || severity === ErrorSeverity.CRITICAL) {
        setErrorModal({
          isOpen: true,
          title: "An error occurred",
          message: errorMessage,
          errorId: errorId || undefined,
        });
      }
      // Show toast for non-critical errors
      else if (showToast) {
        toast.error(errorMessage);
      }

      // Log to console in development
      if (process.env.NODE_ENV === "development") {
        console.error(`[${type}] ${errorMessage}`, error);
      }
    },
    [session]
  );

  const handleApiError = useCallback(
    async (
      error: Error | string,
      endpoint: string,
      method: string = "GET",
      statusCode: number = 500,
      options: Omit<ErrorHandlerOptions, "type"> = {}
    ) => {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Log API error
      const errorId = await logApiError(
        error,
        endpoint,
        method,
        statusCode,
        session?.user?.userId
      );

      const {
        showModal = statusCode >= 500,
        showToast = true,
        onError,
      } = options;

      // Call custom error handler
      if (onError && error instanceof Error) {
        onError(error);
      }

      // Show modal for server errors
      if (showModal) {
        setErrorModal({
          isOpen: true,
          title: statusCode === 403 ? "Access Denied" : statusCode === 401 ? "Unauthorized" : "Request Failed",
          message: errorMessage,
          errorId: errorId || undefined,
        });
      }
      // Show toast for client errors
      else if (showToast) {
        toast.error(errorMessage);
      }
    },
    [session]
  );

  const handleDataFetchError = useCallback(
    async (
      error: Error | string,
      endpoint: string,
      options: Omit<ErrorHandlerOptions, "type"> = {}
    ) => {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Log data fetch error
      const errorId = await logDataFetchError(
        error,
        endpoint,
        session?.user?.userId
      );

      const {
        showModal = false,
        showToast = true,
        onError,
      } = options;

      if (onError && error instanceof Error) {
        onError(error);
      }

      if (showModal) {
        setErrorModal({
          isOpen: true,
          title: "Failed to load data",
          message: errorMessage,
          errorId: errorId || undefined,
        });
      } else if (showToast) {
        toast.error(errorMessage);
      }
    },
    [session]
  );

  const closeErrorModal = useCallback(() => {
    setErrorModal({
      isOpen: false,
      title: "",
      message: "",
    });
  }, []);

  return {
    handleError,
    handleApiError,
    handleDataFetchError,
    errorModal,
    closeErrorModal,
  };
}
