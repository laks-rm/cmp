/**
 * API Versioning Middleware
 * 
 * Automatically handles API versioning for all routes
 * Adds version headers to responses
 * Validates version compatibility
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getApiVersion,
  isValidVersion,
  getVersionHeaders,
  getDeprecationWarning,
  validateVersionCompatibility,
  SUPPORTED_VERSIONS,
} from "./apiVersioning";
import { logAuditEvent } from "./audit";

/**
 * Middleware wrapper to add versioning support to API routes
 * 
 * Usage:
 * ```typescript
 * export async function GET(req: NextRequest) {
 *   return withVersioning(req, async (req, version) => {
 *     // Your route logic here
 *     // `version` is automatically extracted and validated
 *     return NextResponse.json({ data: "..." });
 *   });
 * }
 * ```
 */
export async function withVersioning(
  req: NextRequest,
  handler: (req: NextRequest, version: string) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    // Extract and validate version
    const version = getApiVersion(req);

    if (!isValidVersion(version)) {
      return NextResponse.json(
        {
          error: `Invalid API version: ${version}`,
          supportedVersions: SUPPORTED_VERSIONS,
          code: "INVALID_API_VERSION",
        },
        { status: 400 }
      );
    }

    // Validate version compatibility with endpoint
    try {
      validateVersionCompatibility(req.nextUrl.pathname, version);
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Version incompatibility",
          code: "VERSION_INCOMPATIBLE",
        },
        { status: 410 } // 410 Gone - endpoint no longer available
      );
    }

    // Log deprecation warnings
    const deprecationWarning = getDeprecationWarning(version);
    if (deprecationWarning) {
      console.warn(`[API Deprecation] ${req.nextUrl.pathname} - ${deprecationWarning}`);
      
      // Optional: Log to audit trail
      try {
        await logAuditEvent({
          action: "API_DEPRECATED_VERSION_USED",
          module: "API",
          userId: "system",
          details: {
            path: req.nextUrl.pathname,
            version,
            warning: deprecationWarning,
          },
        });
      } catch (auditError) {
        console.error("Failed to log deprecation audit:", auditError);
      }
    }

    // Execute handler
    const response = await handler(req, version);

    // Add version headers to response
    const versionHeaders = getVersionHeaders(version);
    Object.entries(versionHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    // Add CORS headers if needed
    response.headers.set("Access-Control-Expose-Headers", [
      "API-Version",
      "API-Latest-Version",
      "API-Deprecation-Warning",
      "Sunset",
    ].join(", "));

    return response;
  } catch (error) {
    console.error("API versioning middleware error:", error);
    
    // Return error response without versioning
    return NextResponse.json(
      {
        error: "Internal server error",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}

/**
 * Check if request is using versioned URL structure
 * /api/v1/tasks → true
 * /api/tasks → false
 */
export function isVersionedUrl(req: NextRequest): boolean {
  return /\/api\/v\d+\//.test(req.nextUrl.pathname);
}

/**
 * Redirect old unversioned URLs to v1
 * /api/tasks → /api/v1/tasks
 * 
 * Use this during migration period only
 */
export function redirectToVersionedUrl(req: NextRequest): NextResponse | null {
  if (isVersionedUrl(req)) {
    return null; // Already versioned
  }

  // Check if this is an API route
  if (!req.nextUrl.pathname.startsWith("/api/")) {
    return null;
  }

  // Skip auth and other special routes
  const skipRedirect = ["/api/auth/", "/api/cron/"];
  if (skipRedirect.some((path) => req.nextUrl.pathname.startsWith(path))) {
    return null;
  }

  // Create versioned URL
  const versionedPath = req.nextUrl.pathname.replace("/api/", "/api/v1/");
  const versionedUrl = new URL(versionedPath, req.url);
  versionedUrl.search = req.nextUrl.search; // Preserve query params

  // 308 Permanent Redirect
  return NextResponse.redirect(versionedUrl, { status: 308 });
}
