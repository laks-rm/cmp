import originalToast from "react-hot-toast";
import { logError } from "./errorLogger";
import { ErrorType, ErrorSeverity } from "@prisma/client";

/**
 * Wrapper around react-hot-toast that automatically logs errors to the database
 * This is a temporary solution for development/testing to catch all errors
 * Can be removed or disabled in production once the app is stable
 * 
 * Usage: import toast from "@/lib/toast" instead of "react-hot-toast"
 */

// Enhanced toast.error that logs to database
const enhancedToastError = (message: string, options?: any) => {
  // Log to database (async, non-blocking)
  logError({
    error: new Error(message),
    errorType: ErrorType.COMPONENT_ERROR,
    severity: ErrorSeverity.ERROR,
    context: {
      url: typeof window !== "undefined" ? window.location.href : "",
    },
  }).catch((err) => {
    console.error("Failed to log toast error:", err);
  });

  // Show the toast as normal
  return originalToast.error(message, options);
};

// Create enhanced toast object that matches react-hot-toast API
const toast = Object.assign(
  // Default function
  (message: string, options?: any) => originalToast(message, options),
  {
    // Enhanced error method (logs to DB)
    error: enhancedToastError,
    // Pass through all other methods unchanged
    success: originalToast.success,
    loading: originalToast.loading,
    promise: originalToast.promise,
    custom: originalToast.custom,
    dismiss: originalToast.dismiss,
    remove: originalToast.remove,
  }
);

// Export as default to match react-hot-toast import pattern
export default toast;

// Also export Toaster component for AppToaster
export { Toaster } from "react-hot-toast";
