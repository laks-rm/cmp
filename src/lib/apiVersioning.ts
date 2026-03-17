/**
 * API Versioning Utilities
 * 
 * Supports both URL-based and header-based API versioning to prevent
 * breaking changes from affecting existing clients.
 * 
 * Versioning Strategies:
 * 1. URL-based: /api/v1/tasks, /api/v2/tasks
 * 2. Header-based: API-Version: v1, API-Version: v2
 * 3. Query param: /api/tasks?version=v1
 * 
 * Default: v1 (current stable API)
 */

import { NextRequest } from "next/server";

export type ApiVersion = "v1" | "v2";

export const CURRENT_VERSION: ApiVersion = "v1";
export const SUPPORTED_VERSIONS: ApiVersion[] = ["v1"];
export const LATEST_VERSION: ApiVersion = "v1";
export const DEPRECATED_VERSIONS: ApiVersion[] = [];

/**
 * Extract API version from request
 * 
 * Priority order:
 * 1. URL path (/api/v2/tasks)
 * 2. API-Version header
 * 3. version query parameter
 * 4. Default to v1
 * 
 * @param req - Next.js request object
 * @returns Validated API version
 */
export function getApiVersion(req: NextRequest): ApiVersion {
  // Check URL path first
  const urlVersion = extractVersionFromUrl(req.nextUrl.pathname);
  if (urlVersion && isValidVersion(urlVersion)) {
    return urlVersion as ApiVersion;
  }

  // Check header
  const headerVersion = req.headers.get("api-version") || req.headers.get("API-Version");
  if (headerVersion && isValidVersion(headerVersion)) {
    return headerVersion as ApiVersion;
  }

  // Check query parameter
  const queryVersion = req.nextUrl.searchParams.get("version");
  if (queryVersion && isValidVersion(queryVersion)) {
    return queryVersion as ApiVersion;
  }

  // Default to v1
  return CURRENT_VERSION;
}

/**
 * Extract version from URL path
 * Example: /api/v2/tasks → "v2"
 */
function extractVersionFromUrl(pathname: string): string | null {
  const match = pathname.match(/\/api\/(v\d+)\//);
  return match ? match[1] : null;
}

/**
 * Check if version is valid and supported
 */
export function isValidVersion(version: string): boolean {
  return SUPPORTED_VERSIONS.includes(version as ApiVersion);
}

/**
 * Check if version is deprecated
 */
export function isDeprecatedVersion(version: ApiVersion): boolean {
  return DEPRECATED_VERSIONS.includes(version);
}

/**
 * Get deprecation warning for a version
 */
export function getDeprecationWarning(version: ApiVersion): string | null {
  if (!isDeprecatedVersion(version)) {
    return null;
  }

  return `API version ${version} is deprecated and will be removed in a future release. Please migrate to ${LATEST_VERSION}.`;
}

/**
 * Version metadata for response headers
 */
export function getVersionHeaders(version: ApiVersion): Record<string, string> {
  const headers: Record<string, string> = {
    "API-Version": version,
    "API-Current-Version": CURRENT_VERSION,
    "API-Latest-Version": LATEST_VERSION,
    "API-Supported-Versions": SUPPORTED_VERSIONS.join(", "),
  };

  const deprecationWarning = getDeprecationWarning(version);
  if (deprecationWarning) {
    headers["API-Deprecation-Warning"] = deprecationWarning;
    headers["Sunset"] = getSunsetDate(version); // RFC 8594
  }

  return headers;
}

/**
 * Get sunset date for deprecated version (6 months from now)
 */
function getSunsetDate(version: ApiVersion): string {
  const sunsetDate = new Date();
  sunsetDate.setMonth(sunsetDate.getMonth() + 6);
  return sunsetDate.toUTCString();
}

/**
 * Version-specific feature flags
 * Use this to enable/disable features based on API version
 */
export function getVersionFeatures(version: ApiVersion) {
  const features: Record<ApiVersion, Record<string, boolean>> = {
    v1: {
      softDelete: true,
      concurrentLimiting: true,
      enhancedFiltering: false, // New feature for v2
      bulkOperationsV2: false,
    },
    v2: {
      softDelete: true,
      concurrentLimiting: true,
      enhancedFiltering: true,
      bulkOperationsV2: true,
    },
  };

  return features[version] || features.v1;
}

/**
 * Version-specific field transformations
 * Use for backward compatibility when field names change
 */
export function transformResponseForVersion<T>(
  data: T,
  version: ApiVersion
): T {
  if (version === "v1") {
    // V1: No transformations needed (current format)
    return data;
  }

  if (version === "v2") {
    // V2: Future transformations
    // Example: Add new fields, rename fields, etc.
    return data;
  }

  return data;
}

/**
 * Version compatibility checker
 * Use to verify if a feature is available in requested version
 */
export function isFeatureAvailable(
  feature: string,
  version: ApiVersion
): boolean {
  const features = getVersionFeatures(version);
  return features[feature] === true;
}

/**
 * Breaking change validator
 * Throws error if trying to use v1-only endpoint with v2
 */
export function validateVersionCompatibility(
  endpoint: string,
  version: ApiVersion
): void {
  // Define endpoints that are removed/changed in v2
  const v1OnlyEndpoints: string[] = [
    // Add endpoints here when they're removed in v2
  ];

  if (version === "v2" && v1OnlyEndpoints.includes(endpoint)) {
    throw new Error(
      `Endpoint ${endpoint} is not available in API version ${version}. Please use ${LATEST_VERSION}.`
    );
  }
}

/**
 * Get version from route path (for versioned route structure)
 * Example: src/app/api/v1/tasks → "v1"
 */
export function getVersionFromRoutePath(path: string): ApiVersion | null {
  const match = path.match(/\/api\/(v\d+)\//);
  return match ? (match[1] as ApiVersion) : null;
}

/**
 * Version migration helper
 * Provides migration path information for deprecated versions
 */
export function getMigrationGuide(fromVersion: ApiVersion, toVersion: ApiVersion): string {
  const guides: Record<string, string> = {
    "v1->v2": "See migration guide at /docs/api-migration-v1-to-v2.md",
  };

  return guides[`${fromVersion}->${toVersion}`] || "No migration guide available";
}
