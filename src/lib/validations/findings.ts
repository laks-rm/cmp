import { z } from "zod";

export const createFindingSchema = z.object({
  title: z.string().min(1).max(255).trim(),
  description: z.string().max(5000).trim().optional(),
  severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "OBSERVATION"]),
  rootCause: z.string().max(2000).trim().optional(),
  impact: z.string().max(2000).trim().optional(),
  managementResponse: z.string().max(2000).trim().optional(),
  targetDate: z.string().optional(),
  sourceId: z.string().uuid(),
  taskId: z.string().uuid().optional(),
  entityId: z.string().uuid(),
  actionOwnerId: z.string().uuid(),
});

export const updateFindingSchema = createFindingSchema.partial().extend({
  status: z.enum(["OPEN", "IN_PROGRESS", "IMPLEMENTED", "VERIFIED", "CLOSED", "OVERDUE"]).optional(),
  closureNote: z.string().max(2000).trim().optional(),
});
