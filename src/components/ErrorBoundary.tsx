"use client";

import { Component, ReactNode } from "react";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { logComponentError } from "@/lib/errorLogger";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorId: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  async componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    // Log error to database
    try {
      const errorId = await logComponentError(
        error,
        this.props.componentName || "Unknown Component",
        undefined // userId not available in class component
      );
      if (errorId) {
        this.setState({ errorId });
      }
    } catch (loggingError) {
      console.error("Failed to log component error:", loggingError);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorDisplay
          variant="page"
          title="Something went wrong"
          message={this.state.error?.message || "An unexpected error occurred in this component"}
          errorId={this.state.errorId || undefined}
          showDetails={process.env.NODE_ENV === "development"}
          errorDetails={this.state.error?.stack}
          primaryAction={{
            label: "Reload Page",
            onClick: () => {
              this.setState({ hasError: false, error: null, errorId: null });
              window.location.reload();
            },
          }}
        />
      );
    }

    return this.props.children;
  }
}
