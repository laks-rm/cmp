/**
 * Shared types for service layer
 */

import { Task, Finding, Source, User, Entity, Team } from "@prisma/client";

/**
 * Pagination result
 */
export type PaginatedResult<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
  };
};

/**
 * Query options for pagination and sorting
 */
export type QueryOptions = {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

/**
 * Service context (user info for authorization)
 */
export type ServiceContext = {
  userId: string;
  entityIds: string[];
  permissions: string[];
};

/**
 * Task with all relations
 */
export type TaskWithRelations = Task & {
  source?: {
    id: string;
    code: string;
    name: string;
    team?: { id: string; name: string };
  };
  entity?: {
    id: string;
    code: string;
    name: string;
  };
  pic?: UserSelect;
  assignee?: UserSelect;
  reviewer?: UserSelect;
  responsibleTeam?: {
    id: string;
    name: string;
  };
};

/**
 * Finding with relations
 */
export type FindingWithRelations = Finding & {
  entity?: {
    id: string;
    code: string;
    name: string;
  };
  actionOwner?: UserSelect;
  createdBy?: UserSelect;
};

/**
 * Source with relations
 */
export type SourceWithRelations = Source & {
  team?: {
    id: string;
    name: string;
  };
  issuingAuthority?: {
    id: string;
    name: string;
  };
  entities?: {
    id: string;
    code: string;
    name: string;
  }[];
};

/**
 * User selection (for relations)
 */
export type UserSelect = {
  id: string;
  name: string;
  email: string;
  initials: string;
  avatarColor: string;
};

/**
 * Audit log event params
 */
export type AuditLogParams = {
  action: string;
  module: string;
  userId: string;
  entityId?: string;
  targetType?: string;
  targetId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  details?: Record<string, any>;
};

/**
 * Notification params
 */
export type NotificationParams = {
  type: string;
  userId: string;
  title: string;
  message: string;
  linkUrl?: string;
  metadata?: Record<string, any>;
};

/**
 * Service error (business logic errors)
 */
export class ServiceError extends Error {
  constructor(
    message: string,
    public code: string = "SERVICE_ERROR",
    public status: number = 400
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

/**
 * Authorization error
 */
export class AuthorizationError extends ServiceError {
  constructor(message: string = "Access denied") {
    super(message, "AUTHORIZATION_ERROR", 403);
    this.name = "AuthorizationError";
  }
}

/**
 * Not found error
 */
export class NotFoundError extends ServiceError {
  constructor(resource: string = "Resource") {
    super(`${resource} not found`, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}

/**
 * Validation error
 */
export class ValidationError extends ServiceError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
  }
}
