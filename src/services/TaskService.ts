/**
 * TaskService - Business logic for task operations
 * 
 * This service handles all task-related business logic, separating it from
 * the API layer. It provides reusable methods that can be called from:
 * - API routes
 * - Background jobs
 * - CLI scripts
 * - Other services
 * 
 * Benefits:
 * - Testable in isolation
 * - Reusable across different contexts
 * - Clear separation of concerns
 * - Single source of truth for business rules
 */

import { prisma } from "@/lib/prisma";
import { Prisma, Task, TaskStatus } from "@prisma/client";
import { logAuditEvent } from "@/lib/audit";
import {
  TaskWithRelations,
  PaginatedResult,
  QueryOptions,
  ServiceContext,
  ServiceError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from "./types";

export type TaskQueryParams = {
  entityId?: string;
  teamId?: string;
  status?: TaskStatus;
  riskRating?: "HIGH" | "MEDIUM" | "LOW";
  frequency?: string;
  quarter?: string;
  sourceId?: string;
  picId?: string;
  assigneeId?: string;
  responsibleTeamId?: string;
  search?: string;
  overdue?: boolean;
  recurrenceGroupId?: string;
} & QueryOptions;

export type TaskCreateInput = {
  name: string;
  description?: string;
  expectedOutcome?: string;
  riskRating: "HIGH" | "MEDIUM" | "LOW";
  frequency: string;
  quarter?: string;
  dueDate?: Date;
  startDate?: Date;
  testingPeriodStart?: Date;
  testingPeriodEnd?: Date;
  evidenceRequired?: boolean;
  narrativeRequired?: boolean;
  reviewRequired?: boolean;
  sourceId: string;
  sourceItemId?: string;
  entityId: string;
  assigneeId?: string;
  responsibleTeamId?: string;
  picId?: string;
  reviewerId?: string;
  clickupUrl?: string;
  gdriveUrl?: string;
};

export type TaskUpdateInput = Partial<TaskCreateInput> & {
  status?: TaskStatus;
  narrative?: string;
};

export class TaskService {
  /**
   * Query tasks with filters and pagination
   */
  async queryTasks(
    params: TaskQueryParams,
    context: ServiceContext
  ): Promise<PaginatedResult<TaskWithRelations>> {
    // Build WHERE clause
    const where = this.buildWhereClause(params, context.entityIds);

    // Build ORDER BY clause
    const orderBy = this.buildOrderBy(params.sortBy, params.sortOrder);

    // Pagination
    const page = params.page || 1;
    const limit = Math.min(params.limit || 25, 100);
    const skip = (page - 1) * limit;

    // Execute queries in parallel
    const [tasks, totalCount] = await Promise.all([
      prisma.task.findMany({
        where,
        include: this.getDefaultIncludes(),
        orderBy,
        skip,
        take: limit,
      }),
      prisma.task.count({ where }),
    ]);

    return {
      data: tasks as TaskWithRelations[],
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + tasks.length < totalCount,
      },
    };
  }

  /**
   * Get task by ID with full relations
   */
  async getTaskById(
    taskId: string,
    context: ServiceContext
  ): Promise<TaskWithRelations> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: this.getDefaultIncludes(),
    });

    if (!task) {
      throw new NotFoundError("Task");
    }

    // Verify entity access
    if (!context.entityIds.includes(task.entityId)) {
      throw new AuthorizationError("Access denied to this task");
    }

    return task as TaskWithRelations;
  }

  /**
   * Create new task
   */
  async createTask(
    data: TaskCreateInput,
    context: ServiceContext
  ): Promise<TaskWithRelations> {
    // Verify entity access
    if (!context.entityIds.includes(data.entityId)) {
      throw new AuthorizationError("Access denied to this entity");
    }

    // Business rule: Validate status based on dates
    const status = this.calculateInitialStatus(data);

    // Create task
    const task = await prisma.task.create({
      data: {
        ...data,
        status,
        dueDate: data.dueDate,
        startDate: data.startDate,
        testingPeriodStart: data.testingPeriodStart,
        testingPeriodEnd: data.testingPeriodEnd,
      },
      include: this.getDefaultIncludes(),
    });

    // Audit log
    await logAuditEvent({
      action: "TASK_CREATED",
      module: "TASKS",
      userId: context.userId,
      entityId: task.entityId,
      targetType: "Task",
      targetId: task.id,
      details: {
        name: task.name,
        frequency: task.frequency,
        riskRating: task.riskRating,
      },
    });

    return task as TaskWithRelations;
  }

  /**
   * Update task
   */
  async updateTask(
    taskId: string,
    data: TaskUpdateInput,
    context: ServiceContext
  ): Promise<TaskWithRelations> {
    // Get existing task
    const existingTask = await this.getTaskById(taskId, context);

    // Update task
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: data as any,
      include: this.getDefaultIncludes(),
    });

    // Audit log with old and new values
    await logAuditEvent({
      action: "TASK_UPDATED",
      module: "TASKS",
      userId: context.userId,
      entityId: updatedTask.entityId,
      targetType: "Task",
      targetId: taskId,
      details: {
        changes: this.getChangedFields(existingTask, data),
      },
    });

    return updatedTask as TaskWithRelations;
  }

  /**
   * Soft delete task
   */
  async deleteTask(
    taskId: string,
    reason: string | undefined,
    context: ServiceContext
  ): Promise<void> {
    // Get task and verify access
    const task = await this.getTaskById(taskId, context);

    // Business rule: Cannot delete task with evidence (optional - can be relaxed)
    const evidenceCount = await prisma.evidence.count({
      where: { taskId },
    });

    if (evidenceCount > 0) {
      throw new ValidationError(
        "Cannot delete task with evidence. Please remove evidence first or use soft delete."
      );
    }

    // Soft delete
    await prisma.task.update({
      where: { id: taskId },
      data: {
        deletedAt: new Date(),
        deletedBy: context.userId,
        deletedReason: reason,
      },
    });

    // Audit log
    await logAuditEvent({
      action: "TASK_DELETED",
      module: "TASKS",
      userId: context.userId,
      entityId: task.entityId,
      targetType: "Task",
      targetId: taskId,
      details: {
        name: task.name,
        reason,
      },
    });
  }

  /**
   * Submit task for review
   */
  async submitForReview(
    taskId: string,
    context: ServiceContext
  ): Promise<TaskWithRelations> {
    const task = await this.getTaskById(taskId, context);

    // Business rule: Task must be IN_PROGRESS
    if (task.status !== "IN_PROGRESS") {
      throw new ValidationError(
        "Task must be IN_PROGRESS to submit for review. Current status: " + task.status
      );
    }

    // Business rule: Evidence required if configured
    if (task.evidenceRequired) {
      const evidenceCount = await prisma.evidence.count({
        where: { taskId },
      });

      if (evidenceCount === 0) {
        throw new ValidationError(
          "Evidence is required before submitting this task for review"
        );
      }
    }

    // Business rule: Narrative required if configured
    if (task.narrativeRequired && !task.narrative) {
      throw new ValidationError(
        "Narrative is required before submitting this task for review"
      );
    }

    // Update status
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: "PENDING_REVIEW",
        submittedAt: new Date(),
      },
      include: this.getDefaultIncludes(),
    });

    // Audit log
    await logAuditEvent({
      action: "TASK_SUBMITTED",
      module: "TASKS",
      userId: context.userId,
      entityId: task.entityId,
      targetType: "Task",
      targetId: taskId,
      details: {
        reviewerId: task.reviewerId,
      },
    });

    // TODO: Send notification to reviewer
    // await notificationService.notifyTaskSubmitted(updatedTask, context.userId);

    return updatedTask as TaskWithRelations;
  }

  /**
   * Approve task (reviewer action)
   */
  async approveTask(
    taskId: string,
    context: ServiceContext
  ): Promise<TaskWithRelations> {
    const task = await this.getTaskById(taskId, context);

    // Business rule: Task must be PENDING_REVIEW
    if (task.status !== "PENDING_REVIEW") {
      throw new ValidationError(
        "Task must be PENDING_REVIEW to approve. Current status: " + task.status
      );
    }

    // Business rule: Only reviewer can approve (optional check)
    if (task.reviewerId && task.reviewerId !== context.userId) {
      throw new AuthorizationError(
        "Only the assigned reviewer can approve this task"
      );
    }

    // Update status
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
      include: this.getDefaultIncludes(),
    });

    // Audit log
    await logAuditEvent({
      action: "TASK_APPROVED",
      module: "TASKS",
      userId: context.userId,
      entityId: task.entityId,
      targetType: "Task",
      targetId: taskId,
    });

    // TODO: Send notification to assignee
    // await notificationService.notifyTaskApproved(updatedTask, context.userId);

    return updatedTask as TaskWithRelations;
  }

  /**
   * Reject task (reviewer action)
   */
  async rejectTask(
    taskId: string,
    reason: string,
    context: ServiceContext
  ): Promise<TaskWithRelations> {
    const task = await this.getTaskById(taskId, context);

    // Business rule: Task must be PENDING_REVIEW
    if (task.status !== "PENDING_REVIEW") {
      throw new ValidationError(
        "Task must be PENDING_REVIEW to reject. Current status: " + task.status
      );
    }

    // Update status back to IN_PROGRESS
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: "IN_PROGRESS",
      },
      include: this.getDefaultIncludes(),
    });

    // Audit log
    await logAuditEvent({
      action: "TASK_REJECTED",
      module: "TASKS",
      userId: context.userId,
      entityId: task.entityId,
      targetType: "Task",
      targetId: taskId,
      details: {
        reason,
      },
    });

    // TODO: Send notification to assignee
    // await notificationService.notifyTaskRejected(updatedTask, context.userId, reason);

    return updatedTask as TaskWithRelations;
  }

  /**
   * Activate planned tasks (for scheduled jobs)
   */
  async activatePlannedTasks(): Promise<number> {
    const now = new Date();
    const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const result = await prisma.task.updateMany({
      where: {
        status: "PLANNED",
        plannedDate: {
          gte: now,
          lte: thirtyDaysAhead,
        },
        deletedAt: null,
      },
      data: {
        status: "TO_DO",
      },
    });

    return result.count;
  }

  /**
   * Build WHERE clause for task queries
   */
  private buildWhereClause(
    params: TaskQueryParams,
    userEntityIds: string[]
  ): Prisma.TaskWhereInput {
    const where: Prisma.TaskWhereInput = {
      AND: [
        // Entity filter (scoped to user's entities)
        { entityId: { in: userEntityIds } },
        // Exclude soft-deleted
        { deletedAt: null },
      ],
    };

    if (params.entityId) {
      where.entityId = params.entityId;
    }

    if (params.teamId && params.teamId !== "ALL") {
      where.source = { teamId: params.teamId };
    }

    if (params.status) {
      where.status = params.status;
    } else {
      // Default: exclude PLANNED tasks
      where.status = { not: "PLANNED" };
    }

    if (params.riskRating) {
      where.riskRating = params.riskRating;
    }

    if (params.frequency) {
      where.frequency = params.frequency;
    }

    if (params.quarter) {
      where.quarter = params.quarter;
    }

    if (params.sourceId) {
      where.sourceId = params.sourceId;
    }

    if (params.picId) {
      where.picId = params.picId;
    }

    if (params.assigneeId) {
      where.assigneeId = params.assigneeId;
    }

    if (params.responsibleTeamId) {
      const teamIds = params.responsibleTeamId.split(",");
      where.responsibleTeamId = { in: teamIds };
    }

    if (params.recurrenceGroupId) {
      where.recurrenceGroupId = params.recurrenceGroupId;
    }

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { description: { contains: params.search, mode: "insensitive" } },
      ];
    }

    if (params.overdue) {
      where.AND?.push({
        dueDate: { lt: new Date() },
        status: { notIn: ["COMPLETED", "NOT_APPLICABLE"] },
      });
    }

    return where;
  }

  /**
   * Build ORDER BY clause
   */
  private buildOrderBy(
    sortBy?: string,
    sortOrder?: "asc" | "desc"
  ): Prisma.TaskOrderByWithRelationInput {
    const order = sortOrder || "asc";

    switch (sortBy) {
      case "name":
        return { name: order };
      case "status":
        return { status: order };
      case "riskRating":
        return { riskRating: order };
      case "createdAt":
        return { createdAt: order };
      case "dueDate":
      default:
        return { dueDate: order };
    }
  }

  /**
   * Get standard task includes
   */
  private getDefaultIncludes() {
    return {
      source: {
        select: {
          id: true,
          code: true,
          name: true,
          team: { select: { id: true, name: true } },
        },
      },
      entity: {
        select: { id: true, code: true, name: true },
      },
      pic: {
        select: {
          id: true,
          name: true,
          email: true,
          initials: true,
          avatarColor: true,
        },
      },
      assignee: {
        select: {
          id: true,
          name: true,
          email: true,
          initials: true,
          avatarColor: true,
        },
      },
      reviewer: {
        select: {
          id: true,
          name: true,
          email: true,
          initials: true,
          avatarColor: true,
        },
      },
      responsibleTeam: {
        select: { id: true, name: true },
      },
    };
  }

  /**
   * Calculate initial status based on dates
   */
  private calculateInitialStatus(data: TaskCreateInput): TaskStatus {
    if (!data.dueDate) {
      return "PLANNED";
    }

    const now = new Date();
    const dueDate = new Date(data.dueDate);
    const daysUntilDue = Math.floor(
      (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    // If due within 30 days, start as TO_DO
    if (daysUntilDue <= 30) {
      return "TO_DO";
    }

    // Otherwise, start as PLANNED
    return "PLANNED";
  }

  /**
   * Get changed fields for audit log
   */
  private getChangedFields(
    oldTask: Task,
    updates: TaskUpdateInput
  ): Record<string, { old: any; new: any }> {
    const changes: Record<string, { old: any; new: any }> = {};

    for (const key in updates) {
      if (updates.hasOwnProperty(key)) {
        const oldValue = (oldTask as any)[key];
        const newValue = (updates as any)[key];

        if (oldValue !== newValue) {
          changes[key] = { old: oldValue, new: newValue };
        }
      }
    }

    return changes;
  }
}

// Singleton instance
export const taskService = new TaskService();
