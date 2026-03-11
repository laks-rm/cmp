import { z } from "zod";

export const uploadEvidenceSchema = z.object({
  taskId: z.string().uuid().optional(),
  findingId: z.string().uuid().optional(),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024), // 10MB max
  mimeType: z.string().min(1).max(100),
});

export const createCommentSchema = z.object({
  content: z.string().min(1).max(2000).trim(),
  taskId: z.string().uuid().optional(),
  findingId: z.string().uuid().optional(),
});

export const updateNarrativeSchema = z.object({
  narrative: z.string().max(5000).trim().optional(),
});
