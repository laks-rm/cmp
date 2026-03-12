import { z } from "zod";

export const taskQuerySchema = z.object({
  entityId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  sourceId: z.string().uuid().optional(),
  status: z.enum(["TO_DO", "IN_PROGRESS", "PENDING_REVIEW", "COMPLETED", "DEFERRED", "NOT_APPLICABLE"]).optional(),
  riskRating: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "BIENNIAL", "ONE_TIME"]).optional(),
  quarter: z.enum(["Q1", "Q2", "Q3", "Q4"]).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  sortBy: z.enum(["name", "dueDate", "status", "riskRating", "createdAt"]).default("dueDate"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export const createTaskSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(5000).optional(),
  expectedOutcome: z.string().trim().max(5000).optional(),
  riskRating: z.enum(["HIGH", "MEDIUM", "LOW"]),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "BIENNIAL", "ONE_TIME"]),
  quarter: z.enum(["Q1", "Q2", "Q3", "Q4"]).optional(),
  dueDate: z.string().datetime().optional(),
  startDate: z.string().datetime().optional(),
  testingPeriodStart: z.string().datetime().optional(),
  testingPeriodEnd: z.string().datetime().optional(),
  evidenceRequired: z.boolean().default(false),
  narrativeRequired: z.boolean().default(false),
  reviewRequired: z.boolean().default(true),
  narrative: z.string().trim().max(5000).optional(),
  clickupUrl: z.string().url().max(500).optional(),
  gdriveUrl: z.string().url().max(500).optional(),
  sourceId: z.string().uuid(),
  sourceItemId: z.string().uuid().optional(),
  entityId: z.string().uuid(),
  assigneeId: z.string().uuid().optional(),
  responsibleTeamId: z.string().uuid().optional(),
  picId: z.string().uuid().optional(),
  reviewerId: z.string().uuid().optional(),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  status: z.enum(["TO_DO", "IN_PROGRESS", "PENDING_REVIEW", "COMPLETED", "DEFERRED", "NOT_APPLICABLE"]).optional(),
});

export const bulkTaskSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1),
  action: z.enum(["assign", "changeStatus", "setDueDate", "setResponsibleTeam"]),
  assigneeId: z.string().uuid().optional(),
  responsibleTeamId: z.string().uuid().optional(),
  status: z.enum(["TO_DO", "IN_PROGRESS", "PENDING_REVIEW", "COMPLETED", "DEFERRED", "NOT_APPLICABLE"]).optional(),
  dueDate: z.string().datetime().optional(),
});
