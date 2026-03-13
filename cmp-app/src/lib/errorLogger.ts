import { ErrorType, ErrorSeverity } from "@prisma/client";

export type ErrorContext = {
  url?: string;
  userAgent?: string;
  userId?: string;
  httpMethod?: string;
  statusCode?: number;
  apiEndpoint?: string;
  requestBody?: any;
  componentName?: string;
  additionalInfo?: Record<string, any>;
};

export type LogErrorParams = {
  error: Error | string;
  errorType: ErrorType;
  severity?: ErrorSeverity;
  context?: ErrorContext;
  errorDigest?: string;
};

/**
 * Sanitizes sensitive data from objects before logging
 */
function sanitizeData(data: any): any {
  if (!data || typeof data !== "object") return data;

  const sensitiveKeys = [
    "password",
    "passwordHash",
    "token",
    "apiKey",
    "secret",
    "authorization",
    "cookie",
    "sessionId",
    "creditCard",
    "ssn",
    "pin",
  ];

  const sanitized = Array.isArray(data) ? [...data] : { ...data };

  for (const key in sanitized) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof sanitized[key] === "object" && sanitized[key] !== null) {
      sanitized[key] = sanitizeData(sanitized[key]);
    }
  }

  return sanitized;
}

/**
 * Logs an error to the database via API
 */
export async function logError({
  error,
  errorType,
  severity = ErrorSeverity.ERROR,
  context = {},
  errorDigest,
}: LogErrorParams): Promise<string | null> {
  try {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Get environment info
    const environment = process.env.NODE_ENV || "production";
    const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || undefined;

    // Sanitize request body if present
    const sanitizedRequestBody = context.requestBody
      ? sanitizeData(context.requestBody)
      : undefined;

    const payload = {
      errorType,
      errorMessage,
      errorStack,
      errorDigest,
      url: context.url || (typeof window !== "undefined" ? window.location.href : ""),
      userAgent: context.userAgent || (typeof window !== "undefined" ? navigator.userAgent : undefined),
      userId: context.userId,
      httpMethod: context.httpMethod,
      statusCode: context.statusCode,
      apiEndpoint: context.apiEndpoint,
      requestBody: sanitizedRequestBody,
      environment,
      appVersion,
      severity,
    };

    // Send to API
    const response = await fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error("Failed to log error to database:", await response.text());
      return null;
    }

    const data = await response.json();
    return data.id || null;
  } catch (loggingError) {
    // Don't let logging errors break the app
    console.error("Error while logging error:", loggingError);
    return null;
  }
}

/**
 * Logs a page crash error
 */
export async function logPageError(
  error: Error,
  url: string,
  userId?: string,
  errorDigest?: string
): Promise<string | null> {
  return logError({
    error,
    errorType: ErrorType.PAGE_CRASH,
    severity: ErrorSeverity.CRITICAL,
    context: { url, userId },
    errorDigest,
  });
}

/**
 * Logs an API error
 */
export async function logApiError(
  error: Error | string,
  endpoint: string,
  method: string,
  statusCode: number,
  userId?: string,
  requestBody?: any
): Promise<string | null> {
  const errorType =
    statusCode === 401
      ? ErrorType.UNAUTHORIZED
      : statusCode === 403
      ? ErrorType.FORBIDDEN
      : statusCode === 404
      ? ErrorType.NOT_FOUND
      : statusCode === 408
      ? ErrorType.TIMEOUT
      : ErrorType.API_FAILURE;

  const severity =
    statusCode >= 500
      ? ErrorSeverity.ERROR
      : statusCode === 401 || statusCode === 403
      ? ErrorSeverity.WARNING
      : ErrorSeverity.ERROR;

  return logError({
    error,
    errorType,
    severity,
    context: {
      apiEndpoint: endpoint,
      httpMethod: method,
      statusCode,
      userId,
      requestBody,
    },
  });
}

/**
 * Logs a component error
 */
export async function logComponentError(
  error: Error,
  componentName: string,
  userId?: string
): Promise<string | null> {
  return logError({
    error,
    errorType: ErrorType.COMPONENT_ERROR,
    severity: ErrorSeverity.ERROR,
    context: {
      componentName,
      userId,
    },
  });
}

/**
 * Logs a data fetch error
 */
export async function logDataFetchError(
  error: Error | string,
  endpoint: string,
  userId?: string
): Promise<string | null> {
  return logError({
    error,
    errorType: ErrorType.DATA_FETCH_FAILED,
    severity: ErrorSeverity.ERROR,
    context: {
      apiEndpoint: endpoint,
      userId,
    },
  });
}
