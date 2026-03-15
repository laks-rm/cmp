/**
 * Example: Unit Tests for TaskService
 * 
 * This shows how business logic can be tested in isolation
 * without needing to mock HTTP requests, sessions, etc.
 * 
 * Benefits:
 * - Fast (no HTTP layer overhead)
 * - Isolated (tests one thing at a time)
 * - Clear (easy to understand what's being tested)
 * - Maintainable (tests are simple)
 */

import { TaskService } from "@/services/TaskService";
import { prisma } from "@/lib/prisma";
import { ValidationError, AuthorizationError, NotFoundError } from "@/services/types";

// Mock Prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    task: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    evidence: {
      count: jest.fn(),
    },
  },
}));

// Mock audit service
jest.mock("@/lib/audit", () => ({
  logAuditEvent: jest.fn(),
}));

describe("TaskService", () => {
  let taskService: TaskService;
  const mockContext = {
    userId: "user-1",
    entityIds: ["entity-1"],
    permissions: ["TASKS:VIEW", "TASKS:CREATE", "TASKS:EDIT"],
  };

  beforeEach(() => {
    taskService = new TaskService();
    jest.clearAllMocks();
  });

  describe("submitForReview", () => {
    it("should reject if task is not IN_PROGRESS", async () => {
      // Arrange
      const mockTask = {
        id: "task-1",
        status: "TO_DO",
        entityId: "entity-1",
        evidenceRequired: false,
      };

      (prisma.task.findUnique as jest.Mock).mockResolvedValue(mockTask);

      // Act & Assert
      await expect(
        taskService.submitForReview("task-1", mockContext)
      ).rejects.toThrow(ValidationError);

      await expect(
        taskService.submitForReview("task-1", mockContext)
      ).rejects.toThrow("Task must be IN_PROGRESS to submit for review");
    });

    it("should require evidence if evidenceRequired is true", async () => {
      // Arrange
      const mockTask = {
        id: "task-1",
        status: "IN_PROGRESS",
        entityId: "entity-1",
        evidenceRequired: true,
      };

      (prisma.task.findUnique as jest.Mock).mockResolvedValue(mockTask);
      (prisma.evidence.count as jest.Mock).mockResolvedValue(0);

      // Act & Assert
      await expect(
        taskService.submitForReview("task-1", mockContext)
      ).rejects.toThrow(ValidationError);

      await expect(
        taskService.submitForReview("task-1", mockContext)
      ).rejects.toThrow("Evidence is required before submitting");
    });

    it("should update status to PENDING_REVIEW", async () => {
      // Arrange
      const mockTask = {
        id: "task-1",
        status: "IN_PROGRESS",
        entityId: "entity-1",
        evidenceRequired: false,
        narrativeRequired: false,
      };

      const mockUpdatedTask = {
        ...mockTask,
        status: "PENDING_REVIEW",
        submittedAt: new Date(),
      };

      (prisma.task.findUnique as jest.Mock).mockResolvedValue(mockTask);
      (prisma.task.update as jest.Mock).mockResolvedValue(mockUpdatedTask);

      // Act
      const result = await taskService.submitForReview("task-1", mockContext);

      // Assert
      expect(result.status).toBe("PENDING_REVIEW");
      expect(result.submittedAt).toBeDefined();
      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "task-1" },
          data: expect.objectContaining({
            status: "PENDING_REVIEW",
            submittedAt: expect.any(Date),
          }),
        })
      );
    });
  });

  describe("approveTask", () => {
    it("should reject if task is not PENDING_REVIEW", async () => {
      // Arrange
      const mockTask = {
        id: "task-1",
        status: "IN_PROGRESS",
        entityId: "entity-1",
      };

      (prisma.task.findUnique as jest.Mock).mockResolvedValue(mockTask);

      // Act & Assert
      await expect(
        taskService.approveTask("task-1", mockContext)
      ).rejects.toThrow(ValidationError);
    });

    it("should update status to COMPLETED", async () => {
      // Arrange
      const mockTask = {
        id: "task-1",
        status: "PENDING_REVIEW",
        entityId: "entity-1",
        reviewerId: "user-1",
      };

      const mockUpdatedTask = {
        ...mockTask,
        status: "COMPLETED",
        completedAt: new Date(),
      };

      (prisma.task.findUnique as jest.Mock).mockResolvedValue(mockTask);
      (prisma.task.update as jest.Mock).mockResolvedValue(mockUpdatedTask);

      // Act
      const result = await taskService.approveTask("task-1", mockContext);

      // Assert
      expect(result.status).toBe("COMPLETED");
      expect(result.completedAt).toBeDefined();
    });
  });

  describe("getTaskById", () => {
    it("should throw NotFoundError if task doesn't exist", async () => {
      // Arrange
      (prisma.task.findUnique as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(
        taskService.getTaskById("task-999", mockContext)
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw AuthorizationError if user doesn't have entity access", async () => {
      // Arrange
      const mockTask = {
        id: "task-1",
        entityId: "entity-2", // Different entity
      };

      (prisma.task.findUnique as jest.Mock).mockResolvedValue(mockTask);

      // Act & Assert
      await expect(
        taskService.getTaskById("task-1", mockContext)
      ).rejects.toThrow(AuthorizationError);
    });

    it("should return task with relations", async () => {
      // Arrange
      const mockTask = {
        id: "task-1",
        name: "Test Task",
        status: "TO_DO",
        entityId: "entity-1",
        source: { id: "source-1", code: "REG-001", name: "Regulation" },
      };

      (prisma.task.findUnique as jest.Mock).mockResolvedValue(mockTask);

      // Act
      const result = await taskService.getTaskById("task-1", mockContext);

      // Assert
      expect(result).toEqual(mockTask);
      expect(result.source).toBeDefined();
    });
  });

  describe("queryTasks", () => {
    it("should apply entity filter from context", async () => {
      // Arrange
      (prisma.task.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.task.count as jest.Mock).mockResolvedValue(0);

      // Act
      await taskService.queryTasks({}, mockContext);

      // Assert
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { entityId: { in: ["entity-1"] } },
              { deletedAt: null },
            ]),
          }),
        })
      );
    });

    it("should build WHERE clause with search", async () => {
      // Arrange
      (prisma.task.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.task.count as jest.Mock).mockResolvedValue(0);

      // Act
      await taskService.queryTasks(
        { search: "test" },
        mockContext
      );

      // Assert
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: "test", mode: "insensitive" } },
              { description: { contains: "test", mode: "insensitive" } },
            ],
          }),
        })
      );
    });

    it("should return paginated results", async () => {
      // Arrange
      const mockTasks = [
        { id: "task-1", name: "Task 1" },
        { id: "task-2", name: "Task 2" },
      ];

      (prisma.task.findMany as jest.Mock).mockResolvedValue(mockTasks);
      (prisma.task.count as jest.Mock).mockResolvedValue(10);

      // Act
      const result = await taskService.queryTasks(
        { page: 1, limit: 2 },
        mockContext
      );

      // Assert
      expect(result.data).toEqual(mockTasks);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 2,
        totalCount: 10,
        totalPages: 5,
        hasMore: true,
      });
    });
  });

  describe("activatePlannedTasks", () => {
    it("should activate tasks within 30 days", async () => {
      // Arrange
      (prisma.task.updateMany as jest.Mock).mockResolvedValue({ count: 5 });

      // Act
      const count = await taskService.activatePlannedTasks();

      // Assert
      expect(count).toBe(5);
      expect(prisma.task.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "PLANNED",
            plannedDate: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
            deletedAt: null,
          }),
          data: {
            status: "TO_DO",
          },
        })
      );
    });
  });
});

/**
 * Benefits of these tests:
 * 
 * 1. Fast: No HTTP layer, no database, just logic
 * 2. Isolated: Tests one method at a time
 * 3. Clear: Easy to see what's being tested
 * 4. Maintainable: Simple mocks, no complex setup
 * 5. Comprehensive: Can test all business rules easily
 * 
 * Compare to testing API routes directly:
 * - Would need to mock NextRequest, NextResponse
 * - Would need to mock getServerSession
 * - Would need to mock authentication/authorization
 * - Would need to test HTTP layer AND business logic together
 * - Tests are slower and more complex
 */
