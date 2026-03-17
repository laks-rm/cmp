import { z } from "zod";

/**
 * Validation schema for creating a new entity
 */
export const createEntitySchema = z.object({
  code: z.string()
    .min(1, "Code is required")
    .max(50, "Code must be 50 characters or less")
    .trim()
    .regex(/^[A-Z0-9_]+$/, "Code must contain only uppercase letters, numbers, and underscores"),
  name: z.string()
    .min(1, "Name is required")
    .max(255, "Name must be 255 characters or less")
    .trim(),
  shortName: z.string()
    .min(1, "Short name is required")
    .max(100, "Short name must be 100 characters or less")
    .trim(),
  jurisdiction: z.string()
    .min(1, "Jurisdiction is required")
    .max(100, "Jurisdiction must be 100 characters or less")
    .trim(),
  regulator: z.string()
    .min(1, "Regulator is required")
    .max(100, "Regulator must be 100 characters or less")
    .trim(),
});

/**
 * Validation schema for updating an entity
 * All fields are optional, including isActive status
 */
export const updateEntitySchema = createEntitySchema.partial().extend({
  isActive: z.boolean().optional(),
});

/**
 * Validation schema for querying entities
 */
export const queryEntitySchema = z.object({
  isActive: z.enum(["true", "false"]).optional(),
  search: z.string().optional(),
});
