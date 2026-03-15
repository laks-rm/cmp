import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type AuditEventParams = {
  action: string;
  module: string;
  userId?: string;
  entityId?: string;
  targetType?: string;
  targetId?: string;
  details?: Prisma.InputJsonValue;
  ipAddress?: string;
  /**
   * Previous state before the change (for UPDATE actions)
   * Use captureChanges() to automatically generate this
   */
  oldValues?: Record<string, any>;
  /**
   * New state after the change (for UPDATE actions)
   * Use captureChanges() to automatically generate this
   */
  newValues?: Record<string, any>;
};

/**
 * Type for change tracking
 */
export type ChangeSet = {
  field: string;
  oldValue: any;
  newValue: any;
  changed: boolean;
};

/**
 * Log an audit event with full before/after tracking
 * 
 * @example
 * ```typescript
 * // Fetch old state
 * const oldTask = await prisma.task.findUnique({ where: { id } });
 * 
 * // Make changes
 * const newTask = await prisma.task.update({
 *   where: { id },
 *   data: { status: "COMPLETED", picId: newPicId }
 * });
 * 
 * // Log with changes
 * await logAuditEvent({
 *   action: "TASK_UPDATED",
 *   module: "TASKS",
 *   userId: session.user.userId,
 *   targetType: "Task",
 *   targetId: id,
 *   oldValues: oldTask,
 *   newValues: newTask,
 * });
 * ```
 */
export async function logAuditEvent(params: AuditEventParams): Promise<void> {
  try {
    if (!params.userId) {
      console.error("Audit log skipped because userId is missing", {
        action: params.action,
        module: params.module,
      });
      return;
    }

    // If oldValues and newValues are provided, compute changes
    let enhancedDetails = params.details || {};
    if (params.oldValues && params.newValues) {
      const changes = captureChanges(params.oldValues, params.newValues);
      enhancedDetails = {
        ...enhancedDetails,
        changes: changes.filter((c) => c.changed),
        oldValues: params.oldValues,
        newValues: params.newValues,
      };
    }

    await prisma.auditLog.create({
      data: {
        action: params.action,
        module: params.module,
        userId: params.userId,
        entityId: params.entityId,
        targetType: params.targetType,
        targetId: params.targetId,
        details: enhancedDetails as Prisma.InputJsonValue,
        ipAddress: params.ipAddress,
      },
    });
  } catch (error) {
    console.error("Audit logging failed", {
      action: params.action,
      module: params.module,
      error,
    });
  }
}

/**
 * Capture changes between old and new values
 * Returns array of changed fields with before/after values
 * 
 * @param oldValues - Previous state
 * @param newValues - New state
 * @param fieldsToTrack - Optional: Only track specific fields
 * @returns Array of changes
 */
export function captureChanges(
  oldValues: Record<string, any>,
  newValues: Record<string, any>,
  fieldsToTrack?: string[]
): ChangeSet[] {
  const changes: ChangeSet[] = [];
  
  // Get all unique keys from both objects
  const allKeys = new Set([
    ...Object.keys(oldValues || {}),
    ...Object.keys(newValues || {}),
  ]);

  // Fields to exclude from change tracking (system fields)
  const excludeFields = [
    "updatedAt",
    "version",
    "createdAt",
    // Add other fields that shouldn't trigger change tracking
  ];

  for (const field of allKeys) {
    // Skip if field is in exclude list
    if (excludeFields.includes(field)) {
      continue;
    }

    // Skip if fieldsToTrack is specified and field is not in it
    if (fieldsToTrack && !fieldsToTrack.includes(field)) {
      continue;
    }

    const oldValue = oldValues?.[field];
    const newValue = newValues?.[field];

    // Compare values (handle null, undefined, dates, objects)
    const changed = !isEqual(oldValue, newValue);

    changes.push({
      field,
      oldValue: sanitizeValue(oldValue),
      newValue: sanitizeValue(newValue),
      changed,
    });
  }

  return changes;
}

/**
 * Compare two values for equality (handles dates, objects, arrays)
 */
function isEqual(a: any, b: any): boolean {
  // Handle null/undefined
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a === undefined || b === undefined) return false;

  // Handle dates
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => isEqual(val, b[idx]));
  }

  // Handle objects
  if (typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => isEqual(a[key], b[key]));
  }

  return false;
}

/**
 * Sanitize value for audit log (remove sensitive data, format properly)
 */
function sanitizeValue(value: any): any {
  // Remove sensitive fields
  if (typeof value === "object" && value !== null) {
    if ("passwordHash" in value) {
      return { ...value, passwordHash: "[REDACTED]" };
    }
    if ("password" in value) {
      return { ...value, password: "[REDACTED]" };
    }
  }

  // Convert dates to ISO strings
  if (value instanceof Date) {
    return value.toISOString();
  }

  // Handle null/undefined
  if (value === null) return null;
  if (value === undefined) return undefined;

  return value;
}

/**
 * Helper to fetch old values before update
 * Use this to get a snapshot of the current state before making changes
 * 
 * @example
 * ```typescript
 * const oldTask = await getAuditSnapshot(prisma.task, { id: taskId });
 * await prisma.task.update({ where: { id: taskId }, data: updates });
 * await logAuditEvent({
 *   action: "TASK_UPDATED",
 *   oldValues: oldTask,
 *   newValues: { ...oldTask, ...updates },
 * });
 * ```
 */
export async function getAuditSnapshot<T extends { findUnique: any }>(
  model: T,
  where: any,
  include?: any
): Promise<any> {
  try {
    return await model.findUnique({
      where,
      ...(include && { include }),
    });
  } catch (error) {
    console.error("Failed to get audit snapshot:", error);
    return null;
  }
}

/**
 * Log a creation event (no old values)
 */
export async function logCreate(
  module: string,
  targetType: string,
  targetId: string,
  newValues: Record<string, any>,
  userId: string,
  entityId?: string
): Promise<void> {
  await logAuditEvent({
    action: `${targetType.toUpperCase()}_CREATED`,
    module,
    userId,
    entityId,
    targetType,
    targetId,
    details: {
      created: true,
      values: sanitizeValue(newValues),
    },
  });
}

/**
 * Log an update event with before/after values
 */
export async function logUpdate(
  module: string,
  targetType: string,
  targetId: string,
  oldValues: Record<string, any>,
  newValues: Record<string, any>,
  userId: string,
  entityId?: string,
  fieldsToTrack?: string[]
): Promise<void> {
  const changes = captureChanges(oldValues, newValues, fieldsToTrack);
  const changedFields = changes.filter((c) => c.changed);

  // Only log if there were actual changes
  if (changedFields.length === 0) {
    return;
  }

  await logAuditEvent({
    action: `${targetType.toUpperCase()}_UPDATED`,
    module,
    userId,
    entityId,
    targetType,
    targetId,
    oldValues,
    newValues,
    details: {
      changedFields: changedFields.map((c) => c.field),
      changeCount: changedFields.length,
    },
  });
}

/**
 * Log a deletion event (soft or hard delete)
 */
export async function logDelete(
  module: string,
  targetType: string,
  targetId: string,
  oldValues: Record<string, any>,
  userId: string,
  entityId?: string,
  reason?: string,
  softDelete: boolean = false
): Promise<void> {
  await logAuditEvent({
    action: `${targetType.toUpperCase()}_DELETED`,
    module,
    userId,
    entityId,
    targetType,
    targetId,
    details: {
      deleted: true,
      softDelete,
      reason,
      deletedValues: sanitizeValue(oldValues),
    },
  });
}

/**
 * Format changes for human-readable display
 */
export function formatChanges(changes: ChangeSet[]): string {
  return changes
    .filter((c) => c.changed)
    .map((c) => {
      const oldVal = formatValue(c.oldValue);
      const newVal = formatValue(c.newValue);
      return `${c.field}: ${oldVal} → ${newVal}`;
    })
    .join(", ");
}

/**
 * Format a value for display
 */
function formatValue(value: any): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (value === "") return "(empty)";
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
