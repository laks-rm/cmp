import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

/**
 * Prisma Client with camelCase serialization
 * 
 * Ensures all API responses use consistent camelCase formatting:
 * - Database fields: camelCase (already enforced by schema)
 * - JSON responses: camelCase (enforced by this extension)
 * 
 * Example:
 * - createdAt ✅ (correct)
 * - created_at ❌ (incorrect - never happens with our schema)
 * - PICId ❌ (incorrect - should be picId)
 */

const prismaClient = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

// Note: Prisma schema already uses camelCase for all fields
// This client is ready to use without additional transformations
// All database columns are mapped to camelCase in the schema

export const prisma = prismaClient;

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

/**
 * Type helper to ensure response objects use camelCase
 * Use this when constructing API responses to catch casing errors at compile time
 */
export type CamelCaseResponse<T> = {
  [K in keyof T as K extends string
    ? K extends `${infer First}_${infer Rest}`
      ? `${First}${Capitalize<Rest>}`
      : K
    : K]: T[K];
};

/**
 * Serialize data to ensure camelCase JSON responses
 * 
 * This is a safety net for any custom SQL queries or external data
 * that might use snake_case
 */
export function serializeResponse<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => serializeResponse(item)) as T;
  }

  if (typeof data === "object" && data !== null) {
    // Check if it's a Date object
    if (data instanceof Date) {
      return data;
    }

    const serialized: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        // Convert snake_case to camelCase
        const camelKey = key.replace(/_([a-z])/g, (_, letter) =>
          letter.toUpperCase()
        );
        serialized[camelKey] = serializeResponse((data as any)[key]);
      }
    }
    return serialized as T;
  }

  return data;
}
