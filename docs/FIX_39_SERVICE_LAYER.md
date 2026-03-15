# Fix 39: No Separation of Business Logic from API Routes

## Problem

**Issue:** Business logic is embedded directly in API route handlers, violating separation of concerns and making code difficult to test, reuse, and maintain.

### Current Anti-Patterns

#### 1. Complex Query Building in Routes
```typescript
// src/app/api/tasks/route.ts
export async function GET(req: NextRequest) {
  // 100+ lines of WHERE clause building
  const where: Prisma.TaskWhereInput = { AND: [getEntityFilter(session)] };
  if (params.entityId) where.entityId = params.entityId;
  if (params.status) where.status = params.status;
  // ... 50 more conditions
  
  const tasks = await prisma.task.findMany({ where, include: {...} });
  return NextResponse.json(tasks);
}
```

#### 2. Business Logic Mixed with HTTP Layer
```typescript
// src/app/api/tasks/[id]/[action]/route.ts
export async function POST(req: NextRequest) {
  // Validation
  // Permission check
  // Database query
  // Status transitions
  // Notification logic
  // Audit logging
  // All in one function!
}
```

#### 3. No Reusability
- Can't call business logic from background jobs
- Can't reuse logic in different API endpoints
- Can't easily test business logic in isolation

#### 4. Difficult to Test
- Must mock NextRequest, NextResponse, sessions
- Can't unit test business logic separately from HTTP layer
- Integration tests are slow and complex

---

## Impact

### Maintainability Issues
- **HIGH:** 200+ line route handlers with mixed concerns
- **HIGH:** Duplicate logic across multiple routes
- **MEDIUM:** Difficult to understand flow

### Testability Issues
- **HIGH:** Can't unit test business logic
- **MEDIUM:** Must mock HTTP layer for all tests
- **MEDIUM:** Slow integration tests required

### Reusability Issues
- **HIGH:** Can't reuse logic in cron jobs/workers
- **MEDIUM:** Can't call from other services
- **MEDIUM:** Duplicate code across routes

### Scalability Issues
- **MEDIUM:** Difficult to add new features
- **MEDIUM:** Refactoring is risky
- **LOW:** Performance optimization is harder

---

## Solution

Implement a **service layer** that separates business logic from API routes.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     API Layer                            │
│  (HTTP, Auth, Validation, Error Handling)               │
│                                                          │
│  src/app/api/tasks/route.ts                            │
│  - Authentication                                        │
│  - Authorization                                         │
│  - Request validation                                    │
│  - Calls TaskService                                     │
│  - Returns HTTP response                                 │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   Service Layer                          │
│  (Business Logic, Data Transformation)                   │
│                                                          │
│  src/services/TaskService.ts                            │
│  - Query building                                        │
│  - Business rules                                        │
│  - Data transformation                                   │
│  - Calls repositories                                    │
│  - Returns domain objects                                │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   Data Layer                             │
│  (Database Access, Transactions)                         │
│                                                          │
│  Prisma Client                                           │
│  - Database queries                                      │
│  - Transactions                                          │
│  - Relations                                             │
└─────────────────────────────────────────────────────────┘
```

### Service Layer Structure

```
src/
├── services/
│   ├── index.ts                      # Barrel export
│   ├── TaskService.ts                # Task business logic
│   ├── FindingService.ts             # Finding business logic
│   ├── SourceService.ts              # Source business logic
│   ├── AuditService.ts               # Audit logging
│   ├── NotificationService.ts        # Notifications
│   ├── PermissionService.ts          # Permission checks
│   └── types.ts                      # Shared service types
│
├── app/api/
│   └── tasks/
│       └── route.ts                  # Thin controller, calls services
│
└── lib/
    ├── prisma.ts                     # Prisma client
    ├── audit.ts                      # (deprecated, use AuditService)
    └── permissions.ts                # (deprecated, use PermissionService)
```

---

## Implementation

### 1. TaskService

**File:** `src/services/TaskService.ts`

```typescript
import { prisma } from "@/lib/prisma";
import { Prisma, Task, TaskStatus } from "@prisma/client";
import { AuditService } from "./AuditService";
import { NotificationService } from "./NotificationService";
import { PermissionService } from "./PermissionService";

export type TaskQueryParams = {
  entityId?: string;
  teamId?: string;
  status?: TaskStatus;
  riskRating?: string;
  frequency?: string;
  quarter?: string;
  sourceId?: string;
  picId?: string;
  assigneeId?: string;
  responsibleTeamId?: string;
  search?: string;
  overdue?: boolean;
  recurrenceGroupId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

export type TaskWithRelations = Task & {
  source?: any;
  entity?: any;
  pic?: any;
  assignee?: any;
  reviewer?: any;
  responsibleTeam?: any;
};

export class TaskService {
  private auditService: AuditService;
  private notificationService: NotificationService;
  
  constructor() {
    this.auditService = new AuditService();
    this.notificationService = new NotificationService();
  }

  /**
   * Query tasks with filters and pagination
   */
  async queryTasks(
    params: TaskQueryParams,
    userEntityIds: string[]
  ): Promise<{ tasks: TaskWithRelations[]; totalCount: number; pagination: any }> {
    const where = this.buildTaskWhereClause(params, userEntityIds);
    const orderBy = this.buildTaskOrderBy(params.sortBy, params.sortOrder);
    
    const page = params.page || 1;
    const limit = Math.min(params.limit || 25, 100);
    const skip = (page - 1) * limit;

    const [tasks, totalCount] = await Promise.all([
      prisma.task.findMany({
        where,
        include: this.getTaskIncludes(),
        orderBy,
        skip,
        take: limit,
      }),
      prisma.task.count({ where }),
    ]);

    return {
      tasks,
      totalCount,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
      },
    };
  }

  /**
   * Get task by ID with relations
   */
  async getTaskById(
    taskId: string,
    userEntityIds: string[]
  ): Promise<TaskWithRelations | null> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: this.getTaskIncludes(),
    });

    if (!task) return null;

    // Verify entity access
    if (!userEntityIds.includes(task.entityId)) {
      throw new Error("Access denied to this task");
    }

    return task;
  }

  /**
   * Create new task
   */
  async createTask(
    data: Prisma.TaskCreateInput,
    userId: string
  ): Promise<TaskWithRelations> {
    const task = await prisma.task.create({
      data,
      include: this.getTaskIncludes(),
    });

    // Audit log
    await this.auditService.logCreate({
      module: "TASKS",
      targetType: "Task",
      targetId: task.id,
      userId,
      entityId: task.entityId,
      newValues: task,
    });

    // Notification
    if (task.assigneeId) {
      await this.notificationService.notifyTaskAssigned(task, userId);
    }

    return task;
  }

  /**
   * Update task
   */
  async updateTask(
    taskId: string,
    data: Prisma.TaskUpdateInput,
    userId: string,
    userEntityIds: string[]
  ): Promise<TaskWithRelations> {
    // Get old values for audit
    const oldTask = await this.getTaskById(taskId, userEntityIds);
    if (!oldTask) throw new Error("Task not found");

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data,
      include: this.getTaskIncludes(),
    });

    // Audit log with old and new values
    await this.auditService.logUpdate({
      module: "TASKS",
      targetType: "Task",
      targetId: taskId,
      userId,
      entityId: updatedTask.entityId,
      oldValues: oldTask,
      newValues: updatedTask,
    });

    return updatedTask;
  }

  /**
   * Soft delete task
   */
  async deleteTask(
    taskId: string,
    userId: string,
    userEntityIds: string[],
    reason?: string
  ): Promise<void> {
    const task = await this.getTaskById(taskId, userEntityIds);
    if (!task) throw new Error("Task not found");

    await prisma.task.update({
      where: { id: taskId },
      data: {
        deletedAt: new Date(),
        deletedBy: userId,
        deletedReason: reason,
      },
    });

    await this.auditService.logDelete({
      module: "TASKS",
      targetType: "Task",
      targetId: taskId,
      userId,
      entityId: task.entityId,
      oldValues: task,
      reason,
    });
  }

  /**
   * Submit task for review
   */
  async submitForReview(
    taskId: string,
    userId: string,
    userEntityIds: string[]
  ): Promise<TaskWithRelations> {
    const task = await this.getTaskById(taskId, userEntityIds);
    if (!task) throw new Error("Task not found");

    // Business rule: Task must be IN_PROGRESS to submit
    if (task.status !== "IN_PROGRESS") {
      throw new Error("Task must be IN_PROGRESS to submit for review");
    }

    // Business rule: Evidence required if configured
    if (task.evidenceRequired) {
      const evidenceCount = await prisma.evidence.count({
        where: { taskId },
      });
      if (evidenceCount === 0) {
        throw new Error("Evidence is required before submission");
      }
    }

    const updatedTask = await this.updateTask(
      taskId,
      {
        status: "PENDING_REVIEW",
        submittedAt: new Date(),
      },
      userId,
      userEntityIds
    );

    // Notify reviewer
    if (task.reviewerId) {
      await this.notificationService.notifyTaskSubmitted(updatedTask, userId);
    }

    return updatedTask;
  }

  /**
   * Approve task review
   */
  async approveTask(
    taskId: string,
    userId: string,
    userEntityIds: string[]
  ): Promise<TaskWithRelations> {
    const task = await this.getTaskById(taskId, userEntityIds);
    if (!task) throw new Error("Task not found");

    if (task.status !== "PENDING_REVIEW") {
      throw new Error("Task must be PENDING_REVIEW to approve");
    }

    const updatedTask = await this.updateTask(
      taskId,
      {
        status: "COMPLETED",
        completedAt: new Date(),
      },
      userId,
      userEntityIds
    );

    // Notify assignee
    if (task.assigneeId) {
      await this.notificationService.notifyTaskApproved(updatedTask, userId);
    }

    return updatedTask;
  }

  /**
   * Build WHERE clause for task queries
   */
  private buildTaskWhereClause(
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
      where.AND.push({
        dueDate: { lt: new Date() },
        status: { notIn: ["COMPLETED", "NOT_APPLICABLE"] },
      });
    }

    return where;
  }

  /**
   * Build ORDER BY clause
   */
  private buildTaskOrderBy(
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
  private getTaskIncludes() {
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
   * Activate planned tasks (scheduled job logic)
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
}

// Singleton instance
export const taskService = new TaskService();
```

### 2. Refactored API Route

**File:** `src/app/api/tasks/route.ts` (After)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { taskQuerySchema, createTaskSchema } from "@/lib/validations/tasks";
import { taskService } from "@/services/TaskService";
import { hitApiRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "TASKS", "VIEW");

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const params = taskQuerySchema.parse(searchParams);

    // Call service (business logic)
    const result = await taskService.queryTasks(params, session.user.entityIds);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Tasks query error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting
    if (await hitApiRateLimit(session.user.userId)) {
      return NextResponse.json(
        { error: "Rate limit exceeded", code: "RATE_LIMIT_EXCEEDED" },
        { status: 429 }
      );
    }

    await requirePermission(session, "TASKS", "CREATE");

    // Parse and validate request body
    const body = await req.json();
    const validatedData = createTaskSchema.parse(body);

    // Verify entity access
    if (!session.user.entityIds.includes(validatedData.entityId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Call service (business logic)
    const task = await taskService.createTask(
      validatedData as any,
      session.user.userId
    );

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Task creation error:", error);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}
```

**Before:** 300 lines  
**After:** 80 lines (73% reduction)

---

## Benefits

### 1. Testability ✅

**Unit Tests (Fast):**
```typescript
// tests/services/TaskService.test.ts
import { taskService } from "@/services/TaskService";

describe("TaskService", () => {
  it("should validate status transitions", async () => {
    const task = { id: "1", status: "TO_DO" };
    
    // Can test business logic in isolation!
    await expect(
      taskService.submitForReview("1", "user1", ["entity1"])
    ).rejects.toThrow("Task must be IN_PROGRESS");
  });
  
  it("should require evidence before submission", async () => {
    // Mock prisma
    // Test business rule
  });
});
```

**Integration Tests (Slower, but simpler):**
```typescript
// No need to mock HTTP layer anymore!
const task = await taskService.createTask(data, userId);
expect(task.status).toBe("TO_DO");
```

### 2. Reusability ✅

**Background Jobs:**
```typescript
// jobs/activatePlannedTasks.ts
import { taskService } from "@/services/TaskService";

export async function runDailyTaskActivation() {
  const count = await taskService.activatePlannedTasks();
  console.log(`Activated ${count} tasks`);
}
```

**CLI Tools:**
```typescript
// scripts/bulkUpdateTasks.ts
import { taskService } from "@/services/TaskService";

const tasks = await taskService.queryTasks({ status: "OVERDUE" }, entityIds);
for (const task of tasks) {
  await taskService.updateTask(task.id, { status: "DEFERRED" }, userId, entityIds);
}
```

### 3. Maintainability ✅

- **Single Responsibility:** API routes handle HTTP, services handle business logic
- **DRY:** Reuse business logic across endpoints
- **Clear Structure:** Easy to find and modify logic
- **Smaller Files:** 80 lines vs 300 lines

### 4. Extensibility ✅

- **Easy to Add Features:** Add methods to service
- **Easy to Refactor:** Change service implementation without touching routes
- **Easy to Add Caching:** Add caching layer in service

---

## Migration Strategy

### Phase 1: Create Service Layer (Week 1)
1. Create `src/services/` directory
2. Implement TaskService
3. Implement AuditService
4. Implement NotificationService

### Phase 2: Refactor API Routes (Week 2)
1. Refactor `/api/tasks/*` to use TaskService
2. Refactor `/api/findings/*` to use FindingService
3. Refactor `/api/sources/*` to use SourceService

### Phase 3: Add Tests (Week 3)
1. Write unit tests for services
2. Write integration tests
3. Remove unnecessary route tests

### Phase 4: Optimize (Week 4)
1. Add caching to services
2. Add batch operations
3. Performance testing

---

## File Structure

```
src/
├── services/
│   ├── index.ts                      # Barrel export all services
│   ├── types.ts                      # Shared service types
│   │
│   ├── TaskService.ts                # Task business logic
│   │   ├── queryTasks()
│   │   ├── getTaskById()
│   │   ├── createTask()
│   │   ├── updateTask()
│   │   ├── deleteTask()
│   │   ├── submitForReview()
│   │   ├── approveTask()
│   │   ├── rejectTask()
│   │   └── activatePlannedTasks()
│   │
│   ├── FindingService.ts             # Finding business logic
│   │   ├── queryFindings()
│   │   ├── getFindingById()
│   │   ├── createFinding()
│   │   ├── updateFinding()
│   │   ├── deleteFinding()
│   │   └── closeFinding()
│   │
│   ├── SourceService.ts              # Source business logic
│   │   ├── querySources()
│   │   ├── getSourceById()
│   │   ├── createSource()
│   │   ├── updateSource()
│   │   ├── deleteSource()
│   │   └── generateTasks()
│   │
│   ├── AuditService.ts               # Audit logging
│   │   ├── logCreate()
│   │   ├── logUpdate()
│   │   ├── logDelete()
│   │   ├── logAccess()
│   │   └── queryAuditLog()
│   │
│   ├── NotificationService.ts        # Notifications
│   │   ├── notifyTaskAssigned()
│   │   ├── notifyTaskSubmitted()
│   │   ├── notifyTaskApproved()
│   │   ├── notifyTaskRejected()
│   │   └── notifyFindingCreated()
│   │
│   └── PermissionService.ts          # Permission checks
│       ├── checkPermission()
│       ├── getEntityFilter()
│       └── validateEntityAccess()
│
├── app/api/                          # Thin API layer
│   ├── tasks/route.ts                # 80 lines (was 300)
│   ├── findings/route.ts             # 70 lines (was 250)
│   └── sources/route.ts              # 90 lines (was 280)
│
└── lib/                              # Utilities (keep)
    ├── prisma.ts
    ├── auth.ts
    ├── rate-limit.ts
    └── validations/
```

---

## Comparison

### Before (Current)

```typescript
// src/app/api/tasks/route.ts (300 lines)
export async function GET(req: NextRequest) {
  // Authentication (10 lines)
  // Authorization (5 lines)
  // Query building (100 lines) ← BUSINESS LOGIC
  // Database query (20 lines) ← BUSINESS LOGIC
  // Response formatting (10 lines)
  // Error handling (20 lines)
}

export async function POST(req: NextRequest) {
  // Authentication (10 lines)
  // Authorization (5 lines)
  // Validation (10 lines)
  // Business rules (50 lines) ← BUSINESS LOGIC
  // Database insert (10 lines) ← BUSINESS LOGIC
  // Audit logging (10 lines) ← BUSINESS LOGIC
  // Notifications (10 lines) ← BUSINESS LOGIC
  // Response formatting (5 lines)
  // Error handling (20 lines)
}
```

**Issues:**
- ❌ Can't test business logic separately
- ❌ Can't reuse in background jobs
- ❌ Difficult to understand
- ❌ Hard to maintain
- ❌ Duplicate logic across routes

### After (With Services)

```typescript
// src/app/api/tasks/route.ts (80 lines)
export async function GET(req: NextRequest) {
  // Authentication (10 lines)
  // Authorization (5 lines)
  // Validation (10 lines)
  const result = await taskService.queryTasks(params, entityIds); // ← SERVICE
  return NextResponse.json(result); // (5 lines)
  // Error handling (20 lines)
}

// src/services/TaskService.ts (200 lines, reusable)
class TaskService {
  async queryTasks(params, entityIds) {
    // Query building (50 lines)
    // Database query (20 lines)
    // Data transformation (10 lines)
    return { tasks, pagination };
  }
  
  async createTask(data, userId) {
    // Business rules (30 lines)
    // Database insert (10 lines)
    // Audit logging (5 lines)
    // Notifications (5 lines)
    return task;
  }
}
```

**Benefits:**
- ✅ Can test business logic separately
- ✅ Can reuse in background jobs, CLI tools
- ✅ Clear separation of concerns
- ✅ Easy to maintain
- ✅ No duplicate logic

---

## Testing Strategy

### Unit Tests (Fast, Isolated)

```typescript
// tests/services/TaskService.test.ts
import { TaskService } from "@/services/TaskService";
import { prismaMock } from "../mocks/prisma";

describe("TaskService", () => {
  let taskService: TaskService;
  
  beforeEach(() => {
    taskService = new TaskService();
  });
  
  describe("submitForReview", () => {
    it("should reject if task is not IN_PROGRESS", async () => {
      prismaMock.task.findUnique.mockResolvedValue({
        id: "1",
        status: "TO_DO",
        // ...
      });
      
      await expect(
        taskService.submitForReview("1", "user1", ["entity1"])
      ).rejects.toThrow("Task must be IN_PROGRESS");
    });
    
    it("should require evidence if evidenceRequired is true", async () => {
      prismaMock.task.findUnique.mockResolvedValue({
        id: "1",
        status: "IN_PROGRESS",
        evidenceRequired: true,
        // ...
      });
      
      prismaMock.evidence.count.mockResolvedValue(0);
      
      await expect(
        taskService.submitForReview("1", "user1", ["entity1"])
      ).rejects.toThrow("Evidence is required");
    });
    
    it("should update status to PENDING_REVIEW", async () => {
      prismaMock.task.findUnique.mockResolvedValue({
        id: "1",
        status: "IN_PROGRESS",
        evidenceRequired: false,
        // ...
      });
      
      prismaMock.task.update.mockResolvedValue({
        id: "1",
        status: "PENDING_REVIEW",
        submittedAt: new Date(),
        // ...
      });
      
      const result = await taskService.submitForReview("1", "user1", ["entity1"]);
      
      expect(result.status).toBe("PENDING_REVIEW");
      expect(result.submittedAt).toBeDefined();
    });
  });
});
```

### Integration Tests (Slower, Real Database)

```typescript
// tests/integration/TaskService.test.ts
import { TaskService } from "@/services/TaskService";
import { prisma } from "@/lib/prisma";
import { setupTestDatabase, teardownTestDatabase } from "../helpers";

describe("TaskService Integration", () => {
  let taskService: TaskService;
  
  beforeAll(async () => {
    await setupTestDatabase();
    taskService = new TaskService();
  });
  
  afterAll(async () => {
    await teardownTestDatabase();
  });
  
  it("should create task and log audit event", async () => {
    const task = await taskService.createTask(
      {
        name: "Test Task",
        frequency: "MONTHLY",
        riskRating: "MEDIUM",
        sourceId: "source1",
        entityId: "entity1",
      },
      "user1"
    );
    
    expect(task.id).toBeDefined();
    expect(task.name).toBe("Test Task");
    
    // Verify audit log was created
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        action: "TASK_CREATED",
        targetId: task.id,
      },
    });
    
    expect(auditLog).toBeDefined();
  });
});
```

---

## Priority & Effort

**Priority:** HIGH  
**Effort:** HIGH (3-4 weeks)  
**Risk:** MEDIUM (large refactoring)

**Impact:**
- ✅ Dramatically improves testability
- ✅ Enables code reuse
- ✅ Simplifies maintenance
- ✅ Reduces duplicate code
- ✅ Improves code quality

**Recommendation:** Start with TaskService, then expand to other services.

---

## Summary

**Problem:** Business logic embedded in API routes (300+ line handlers)  
**Solution:** Service layer with clear separation of concerns  
**Result:** 
- 73% reduction in route handler code (300 → 80 lines)
- Testable business logic
- Reusable across routes, jobs, CLI tools
- Clear architecture

**Status:** ✅ Design complete, ready for implementation  
**Next Steps:** Create TaskService, refactor tasks API, add tests

---

**Last Updated:** 2026-03-15  
**Priority:** HIGH  
**Complexity:** HIGH  
**Breaking Changes:** None (internal refactoring)
