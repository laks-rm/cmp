/**
 * Utility functions for SourceWizard
 * Extracted from monolithic component for reusability
 */

import type { ItemWithTasks, TaskDefinition } from "./types";

/**
 * Generate a unique temporary ID for new items/tasks
 */
export function generateTempId(prefix: string = "temp"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate file type and size
 */
export function validateFile(
  file: File,
  acceptedTypes: string[],
  maxSize: number
): { valid: boolean; error?: string } {
  const fileExtension = `.${file.name.split(".").pop()?.toLowerCase()}`;

  if (!acceptedTypes.includes(fileExtension)) {
    return {
      valid: false,
      error: `Invalid file type. Accepted types: ${acceptedTypes.join(", ")}`,
    };
  }

  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(0);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File too large (${fileSizeMB}MB). Maximum size: ${maxSizeMB}MB`,
    };
  }

  return { valid: true };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

/**
 * Check if an item has any non-informational tasks
 */
export function hasActionableTasks(item: ItemWithTasks): boolean {
  return !item.isInformational && item.tasks.length > 0;
}

/**
 * Count total tasks across all items
 */
export function countTotalTasks(items: ItemWithTasks[]): number {
  return items.reduce((sum, item) => sum + item.tasks.length, 0);
}

/**
 * Count tasks by risk rating
 */
export function countTasksByRisk(items: ItemWithTasks[]): {
  HIGH: number;
  MEDIUM: number;
  LOW: number;
} {
  const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 };

  items.forEach((item) => {
    item.tasks.forEach((task) => {
      if (task.riskRating in counts) {
        counts[task.riskRating as keyof typeof counts]++;
      }
    });
  });

  return counts;
}

/**
 * Group items by entity
 */
export function groupItemsByEntity(items: ItemWithTasks[]): Map<string, ItemWithTasks[]> {
  const grouped = new Map<string, ItemWithTasks[]>();

  items.forEach((item) => {
    item.tasks.forEach((task) => {
      if (!grouped.has(task.entityId)) {
        grouped.set(task.entityId, []);
      }
      // Note: This groups tasks, might need adjustment
    });
  });

  return grouped;
}

/**
 * Validate source code format
 * Source codes should be uppercase alphanumeric with optional hyphens/underscores
 */
export function validateSourceCode(code: string): { valid: boolean; error?: string } {
  if (!code.trim()) {
    return { valid: false, error: "Source code is required" };
  }

  if (code.length < 2) {
    return { valid: false, error: "Source code must be at least 2 characters" };
  }

  if (code.length > 50) {
    return { valid: false, error: "Source code must be less than 50 characters" };
  }

  const validFormat = /^[A-Z0-9_-]+$/.test(code);
  if (!validFormat) {
    return {
      valid: false,
      error: "Source code must be uppercase letters, numbers, hyphens, or underscores",
    };
  }

  return { valid: true };
}

/**
 * Check for duplicate item references
 */
export function findDuplicateReferences(items: ItemWithTasks[]): string[] {
  const references = items.map((item) => item.reference.trim().toLowerCase());
  const duplicates = references.filter((ref, idx) => references.indexOf(ref) !== idx);
  return Array.from(new Set(duplicates));
}

/**
 * Transform extracted clauses to ItemWithTasks format
 */
export function transformClausesToItems(
  clauses: Array<{
    reference: string;
    title: string;
    description: string;
    isInformational: boolean;
    included: boolean;
    tasks: Array<{ id: string; name: string; frequency: string; riskRating: string; included: boolean }>;
  }>,
  defaultTeamId: string,
  defaultEntityId: string,
  defaultUserId: string
): ItemWithTasks[] {
  return clauses
    .filter((clause) => clause.included)
    .map((clause) => ({
      tempId: generateTempId("item"),
      reference: clause.reference,
      title: clause.title,
      description: clause.description,
      isInformational: clause.isInformational,
      expanded: false,
      tasks: clause.tasks
        .filter((task) => task.included)
        .map((task) => ({
          tempId: generateTempId("task"),
          name: task.name,
          description: "",
          expectedOutcome: "",
          entityId: defaultEntityId,
          responsibleTeamId: defaultTeamId,
          picId: defaultUserId,
          reviewerId: defaultUserId,
          frequency: task.frequency || "QUARTERLY",
          quarter: "",
          riskRating: task.riskRating || "MEDIUM",
          startDate: "",
          dueDate: "",
          testingPeriodStart: "",
          testingPeriodEnd: "",
          evidenceRequired: true,
          narrativeRequired: false,
          reviewRequired: true,
          clickupUrl: "",
          gdriveUrl: "",
        })),
    }));
}

/**
 * Deep clone an item (useful for editing without mutating original)
 */
export function cloneItem(item: ItemWithTasks): ItemWithTasks {
  return {
    ...item,
    tasks: item.tasks.map((task) => ({ ...task })),
  };
}

/**
 * Sort items by reference (natural sort)
 */
export function sortItemsByReference(items: ItemWithTasks[]): ItemWithTasks[] {
  return [...items].sort((a, b) => {
    return a.reference.localeCompare(b.reference, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}
