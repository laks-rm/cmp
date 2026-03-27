import { z } from "zod";

export const createSourceSchema = z.object({
  code: z.string().min(1).max(50).trim(),
  name: z.string().min(1).max(255).trim(),
  sourceType: z.enum([
    "REGULATION",
    "INDUSTRY_STANDARD",
    "INTERNAL_AUDIT",
    "BOARD_DIRECTIVE",
    "INTERNAL_POLICY",
    "CONTRACTUAL_OBLIGATION",
    "REGULATORY_GUIDANCE",
  ]),
  issuingAuthorityId: z.string().uuid().optional().nullable().or(z.literal("")),
  effectiveDate: z.string().optional().nullable().or(z.literal("")),
  reviewDate: z.string().optional().nullable().or(z.literal("")),
  teamId: z.string().uuid(),
  entityIds: z.array(z.string().uuid()).min(1),
  defaultFrequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "BIENNIAL", "ONE_TIME"]).optional(),
});

export const updateSourceSchema = createSourceSchema.partial().extend({
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
});

export const createSourceItemSchema = z.object({
  sourceId: z.string().uuid(),
  reference: z.string().min(1).max(100).trim(),
  title: z.string().min(1).max(255).trim(),
  description: z.string().max(2000).trim().optional(),
  parentId: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  sortOrder: z.number().int().default(0),
});

export const createTaskForSourceSchema = z.object({
  sourceId: z.string().uuid(),
  sourceItemId: z.string().uuid(),
  name: z.string().min(1).max(255).trim(),
  description: z.string().max(5000).trim().optional(),
  expectedOutcome: z.string().max(2000).trim().optional(),
  entityId: z.string().uuid(),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "BIENNIAL", "ONE_TIME"]),
  quarter: z.enum(["Q1", "Q2", "Q3", "Q4"]).optional().or(z.literal("").transform(() => undefined)),
  riskRating: z.enum(["HIGH", "MEDIUM", "LOW"]),
  assigneeId: z.string().uuid().optional().or(z.literal("")),
  responsibleTeamId: z.string().uuid().optional().or(z.literal("")),
  picId: z.string().uuid().optional().or(z.literal("")),
  reviewerId: z.string().uuid().optional().or(z.literal("")),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  testingPeriodStart: z.string().optional(),
  testingPeriodEnd: z.string().optional(),
  monitoringAreaId: z.string().uuid().optional(),
  taskTypeId: z.string().uuid().optional(),
  evidenceRequired: z.boolean().default(false),
  narrativeRequired: z.boolean().default(false),
  reviewRequired: z.boolean().default(true),
  clickupUrl: z.string().url().optional().or(z.literal("")),
  gdriveUrl: z.string().url().optional().or(z.literal("")),
});

export const bulkGenerateTasksSchema = z.object({
  sourceId: z.string().uuid(),
  items: z.array(
    z.object({
      item: createSourceItemSchema.omit({ sourceId: true }),
      tasks: z.array(createTaskForSourceSchema.omit({ sourceId: true, sourceItemId: true })),
    })
  ),
});
