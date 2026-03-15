/**
 * Soft Delete Utilities
 * 
 * Provides helper functions and Prisma extensions for soft delete functionality.
 * 
 * Soft delete allows "deleting" records by setting deletedAt timestamp instead of
 * removing them from the database, enabling:
 * - Audit trail preservation
 * - Recovery from mistakes
 * - Compliance with data retention regulations
 * - Historical reporting
 */

import { Prisma } from "@prisma/client";

/**
 * Type guard to check if a model supports soft delete
 */
export type SoftDeletable = {
  deletedAt: Date | null;
  deletedBy: string | null;
  deletedReason?: string | null;
};

/**
 * Models that support soft delete
 */
export type SoftDeleteModel = "task" | "finding" | "source";

/**
 * Default where clause to exclude soft-deleted records
 */
export const notDeleted = {
  deletedAt: null,
} as const;

/**
 * Default where clause to get only soft-deleted records
 */
export const onlyDeleted = {
  deletedAt: { not: null },
} as const;

/**
 * Create soft delete data
 */
export function createSoftDeleteData(userId: string, reason?: string) {
  return {
    deletedAt: new Date(),
    deletedBy: userId,
    deletedReason: reason || null,
  };
}

/**
 * Create restore data (undo soft delete)
 */
export function createRestoreData() {
  return {
    deletedAt: null,
    deletedBy: null,
    deletedReason: null,
  };
}

/**
 * Prisma middleware to automatically exclude soft-deleted records
 * 
 * Usage:
 * ```typescript
 * import { prisma } from './prisma';
 * import { applySoftDeleteMiddleware } from './softDelete';
 * 
 * applySoftDeleteMiddleware(prisma);
 * ```
 */
export function applySoftDeleteMiddleware(prisma: any) {
  // Models that support soft delete
  const softDeleteModels: SoftDeleteModel[] = ["task", "finding", "source"];

  prisma.$use(async (params: any, next: any) => {
    // Only apply to models that support soft delete
    if (!softDeleteModels.includes(params.model?.toLowerCase())) {
      return next(params);
    }

    // Intercept delete operations and convert to soft delete
    if (params.action === "delete") {
      params.action = "update";
      params.args.data = createSoftDeleteData("system"); // Use "system" for now, should be passed in
    }

    if (params.action === "deleteMany") {
      params.action = "updateMany";
      if (params.args.data === undefined) {
        params.args.data = {};
      }
      params.args.data = createSoftDeleteData("system");
    }

    // Automatically filter out soft-deleted records for read operations
    if (params.action === "findUnique" || params.action === "findFirst") {
      // Only add filter if not explicitly querying deleted records
      if (params.args.where && params.args.where.deletedAt === undefined) {
        params.args.where.deletedAt = null;
      }
    }

    if (params.action === "findMany") {
      // Only add filter if not explicitly querying deleted records
      if (params.args.where) {
        if (params.args.where.deletedAt === undefined) {
          params.args.where.deletedAt = null;
        }
      } else {
        params.args.where = { deletedAt: null };
      }
    }

    if (params.action === "count") {
      if (params.args.where) {
        if (params.args.where.deletedAt === undefined) {
          params.args.where.deletedAt = null;
        }
      } else {
        params.args.where = { deletedAt: null };
      }
    }

    // For update operations, add a check to prevent updating deleted records
    if (params.action === "update" || params.action === "updateMany") {
      if (params.args.where) {
        if (params.args.where.deletedAt === undefined) {
          params.args.where.deletedAt = null;
        }
      }
    }

    return next(params);
  });
}

/**
 * Build where clause with soft delete filter
 * 
 * @param includeDeleted - If true, includes deleted records. If false or undefined, excludes them.
 * @param onlyDeleted - If true, returns only deleted records
 */
export function withSoftDelete(
  where: any = {},
  options: { includeDeleted?: boolean; onlyDeleted?: boolean } = {}
) {
  if (options.onlyDeleted) {
    return { ...where, ...onlyDeleted };
  }

  if (!options.includeDeleted) {
    return { ...where, ...notDeleted };
  }

  return where;
}

/**
 * Check if a record is soft deleted
 */
export function isSoftDeleted(record: SoftDeletable | null | undefined): boolean {
  return record?.deletedAt !== null && record?.deletedAt !== undefined;
}

/**
 * Format deletion info for display
 */
export function formatDeletionInfo(record: SoftDeletable) {
  if (!isSoftDeleted(record)) {
    return null;
  }

  return {
    deletedAt: record.deletedAt,
    deletedBy: record.deletedBy,
    deletedReason: record.deletedReason,
  };
}

/**
 * Validate if a record can be deleted
 * Returns error message if cannot be deleted, null if OK
 */
export function validateCanDelete(
  model: string,
  record: any
): string | null {
  // Already deleted
  if (isSoftDeleted(record)) {
    return `This ${model} has already been deleted`;
  }

  // Model-specific validation
  switch (model.toLowerCase()) {
    case "task":
      // Don't allow deleting completed tasks (archive instead)
      if (record.status === "COMPLETED" && record.completedAt) {
        const daysSinceCompletion = Math.floor(
          (Date.now() - new Date(record.completedAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceCompletion < 30) {
          return "Cannot delete recently completed tasks. Please wait 30 days or archive instead.";
        }
      }

      // Don't allow deleting tasks with evidence
      if (record.evidence && record.evidence.length > 0) {
        return "Cannot delete tasks with uploaded evidence. Please remove evidence first.";
      }
      break;

    case "finding":
      // Don't allow deleting open critical findings
      if (record.severity === "CRITICAL" && record.status === "OPEN") {
        return "Cannot delete open critical findings. Please close the finding first.";
      }
      break;

    case "source":
      // Don't allow deleting sources with active tasks
      if (record.tasks && record.tasks.some((t: any) => t.status !== "COMPLETED" && !isSoftDeleted(t))) {
        return "Cannot delete sources with active tasks. Please complete or delete all tasks first.";
      }
      break;
  }

  return null;
}
