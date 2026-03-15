/**
 * API Response Utilities
 * 
 * Ensures consistent camelCase formatting in all API responses
 */

import { NextResponse } from "next/server";
import { serializeResponse } from "./prisma";

/**
 * Standard API response structure
 */
export type ApiResponse<T = any> = {
  data?: T;
  error?: string;
  code?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  meta?: Record<string, any>;
};

/**
 * Create a standardized API success response
 * Automatically serializes data to camelCase
 * 
 * @param data - Response data
 * @param options - Additional options (status, pagination, meta)
 * 
 * @example
 * ```typescript
 * return apiSuccess({ tasks: [...] });
 * // Returns: { data: { tasks: [...] } } with 200 status
 * 
 * return apiSuccess(tasks, {
 *   pagination: { page: 1, limit: 10, total: 100 }
 * });
 * ```
 */
export function apiSuccess<T>(
  data: T,
  options: {
    status?: number;
    pagination?: ApiResponse["pagination"];
    meta?: Record<string, any>;
  } = {}
): NextResponse {
  const { status = 200, pagination, meta } = options;

  // Serialize to ensure camelCase
  const serializedData = serializeResponse(data);

  const response: ApiResponse<T> = {
    data: serializedData,
    ...(pagination && { pagination }),
    ...(meta && { meta }),
  };

  return NextResponse.json(response, { status });
}

/**
 * Create a standardized API error response
 * 
 * @param error - Error message
 * @param options - Additional options (status, code)
 * 
 * @example
 * ```typescript
 * return apiError("Task not found", { status: 404, code: "NOT_FOUND" });
 * ```
 */
export function apiError(
  error: string,
  options: {
    status?: number;
    code?: string;
  } = {}
): NextResponse {
  const { status = 500, code } = options;

  const response: ApiResponse = {
    error,
    ...(code && { code }),
  };

  return NextResponse.json(response, { status });
}

/**
 * Pagination helper
 * Calculates pagination metadata
 */
export function createPagination(
  page: number,
  limit: number,
  total: number
): ApiResponse["pagination"] {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Transform Prisma result to camelCase (legacy compatibility)
 * 
 * Note: This is primarily for raw SQL queries or external data sources.
 * Prisma ORM results are already in camelCase.
 * 
 * @deprecated Use serializeResponse from prisma.ts instead
 */
export function toCamelCase<T>(obj: T): T {
  return serializeResponse(obj);
}

/**
 * Validate and sanitize query parameters
 * Ensures consistent parameter naming
 */
export function parseQueryParams(searchParams: URLSearchParams) {
  return {
    // Pagination
    page: Math.max(1, parseInt(searchParams.get("page") || "1")),
    limit: Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10"))),
    
    // Sorting
    sortBy: searchParams.get("sortBy") || searchParams.get("sort_by") || "createdAt",
    sortOrder: (searchParams.get("sortOrder") || searchParams.get("sort_order") || "desc") as "asc" | "desc",
    
    // Filtering
    search: searchParams.get("search") || searchParams.get("q") || "",
    status: searchParams.get("status"),
    entityId: searchParams.get("entityId") || searchParams.get("entity_id"),
    teamId: searchParams.get("teamId") || searchParams.get("team_id"),
    
    // Flags
    includeDeleted: searchParams.get("includeDeleted") === "true" || 
                    searchParams.get("include_deleted") === "true",
    showDeleted: searchParams.get("showDeleted") === "true" || 
                 searchParams.get("show_deleted") === "true",
  };
}

/**
 * Standard error codes
 */
export const ErrorCodes = {
  // Authentication & Authorization
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  
  // Resource Errors
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  CONFLICT: "CONFLICT",
  
  // Validation Errors
  VALIDATION_FAILED: "VALIDATION_FAILED",
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  
  // Rate Limiting
  RATE_LIMIT_HIT: "RATE_LIMIT_HIT",
  CONCURRENT_LIMIT_HIT: "CONCURRENT_LIMIT_HIT",
  
  // Server Errors
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
} as const;

/**
 * HTTP Status codes
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;
