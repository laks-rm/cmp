/**
 * Concurrent Request Limiting Utilities
 * 
 * Prevents resource exhaustion by limiting the number of simultaneous requests per user.
 * Use this in API routes that perform expensive operations (database queries, file uploads, AI processing).
 * 
 * Usage Example:
 * ```typescript
 * export async function POST(req: NextRequest) {
 *   let releaseSlot: (() => void) | undefined;
 *   
 *   try {
 *     const session = await getServerSession(authOptions);
 *     if (!session) {
 *       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 *     }
 * 
 *     // Acquire concurrent slot
 *     releaseSlot = await acquireConcurrentSlot(session.user.userId);
 *     if (!releaseSlot) {
 *       return NextResponse.json(
 *         { error: "Too many concurrent requests" },
 *         { status: 429 }
 *       );
 *     }
 * 
 *     // ... your route logic ...
 * 
 *   } catch (error) {
 *     // ... error handling ...
 *   } finally {
 *     // CRITICAL: Always release slot
 *     releaseSlot?.();
 *   }
 * }
 * ```
 */

import { NextResponse } from "next/server";
import { checkConcurrentLimit, releaseConcurrentSlot, getConcurrentCount } from "@/lib/rate-limit";
import { logAuditEvent } from "@/lib/audit";

export type ConcurrentLimitConfig = {
  /**
   * Maximum concurrent requests per user (default: 10)
   */
  maxConcurrent?: number;
  
  /**
   * Whether to log when limit is hit (default: true)
   */
  logOnLimitHit?: boolean;
  
  /**
   * Custom error message
   */
  errorMessage?: string;
};

/**
 * Acquire a concurrent request slot for a user.
 * Returns a cleanup function if successful, undefined if limit exceeded.
 * 
 * @param userId - User ID to acquire slot for
 * @param config - Configuration options
 * @returns Cleanup function to release the slot, or undefined if limit exceeded
 */
export async function acquireConcurrentSlot(
  userId: string,
  config: ConcurrentLimitConfig = {}
): Promise<(() => void) | undefined> {
  const {
    maxConcurrent = 10,
    logOnLimitHit = true,
  } = config;

  const acquired = checkConcurrentLimit(userId, maxConcurrent);

  if (!acquired) {
    if (logOnLimitHit) {
      await logAuditEvent({
        action: "CONCURRENT_LIMIT_HIT",
        module: "SECURITY",
        userId,
        details: {
          currentCount: getConcurrentCount(userId),
          maxConcurrent,
          timestamp: new Date().toISOString(),
        },
      });
    }
    return undefined;
  }

  // Return cleanup function
  return () => releaseConcurrentSlot(userId);
}

/**
 * Create a standard 429 response for concurrent limit exceeded.
 * 
 * @param message - Custom error message
 * @returns NextResponse with 429 status
 */
export function createConcurrentLimitResponse(message?: string): NextResponse {
  return NextResponse.json(
    {
      error: message || "Too many concurrent requests. Please wait for previous requests to complete.",
      code: "CONCURRENT_LIMIT_HIT",
      retryAfter: 5, // Suggest retry after 5 seconds
    },
    { 
      status: 429,
      headers: {
        'Retry-After': '5',
      },
    }
  );
}

/**
 * Middleware-style wrapper for API route handlers with concurrent limiting.
 * Automatically handles slot acquisition and cleanup.
 * 
 * @param handler - The API route handler function
 * @param config - Configuration options
 * @returns Wrapped handler with concurrent limiting
 */
export function withConcurrentLimit<T extends unknown[]>(
  handler: (userId: string, ...args: T) => Promise<NextResponse>,
  config: ConcurrentLimitConfig = {}
) {
  return async (userId: string, ...args: T): Promise<NextResponse> => {
    const releaseSlot = await acquireConcurrentSlot(userId, config);
    
    if (!releaseSlot) {
      return createConcurrentLimitResponse(config.errorMessage);
    }

    try {
      return await handler(userId, ...args);
    } finally {
      releaseSlot();
    }
  };
}
