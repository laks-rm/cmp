/**
 * Example: Refactored API Route using TaskService
 * 
 * This is an example of how API routes should look after refactoring.
 * Compare this to the current implementation which has 300+ lines.
 * 
 * Benefits:
 * - Thin controller (80 lines vs 300 lines)
 * - Business logic in service (testable, reusable)
 * - Clear separation of concerns
 * - Easy to understand and maintain
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { taskQuerySchema, createTaskSchema } from "@/lib/validations/tasks";
import { taskService } from "@/services";
import { hitApiRateLimit } from "@/lib/rate-limit";
import { ServiceError } from "@/services/types";
import { z } from "zod";

/**
 * GET /api/tasks
 * 
 * Query tasks with filters and pagination
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Authorization
    await requirePermission(session, "TASKS", "VIEW");

    // 3. Validation
    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const params = taskQuerySchema.parse(searchParams);

    // 4. Call service (business logic)
    const result = await taskService.queryTasks(params, {
      userId: session.user.userId,
      entityIds: session.user.entityIds,
      permissions: [], // Add permissions if needed
    });

    // 5. Return response
    return NextResponse.json(result);
  } catch (error) {
    // Error handling
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    
    if (error instanceof ServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    
    console.error("Tasks query error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tasks
 * 
 * Create new task
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Rate limiting
    if (await hitApiRateLimit(session.user.userId)) {
      return NextResponse.json(
        { error: "Rate limit exceeded", code: "RATE_LIMIT_EXCEEDED" },
        { status: 429 }
      );
    }

    // 3. Authorization
    await requirePermission(session, "TASKS", "CREATE");

    // 4. Validation
    const body = await req.json();
    const validatedData = createTaskSchema.parse(body);

    // 5. Call service (business logic)
    const task = await taskService.createTask(
      {
        ...validatedData,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : undefined,
        startDate: validatedData.startDate ? new Date(validatedData.startDate) : undefined,
        testingPeriodStart: validatedData.testingPeriodStart ? new Date(validatedData.testingPeriodStart) : undefined,
        testingPeriodEnd: validatedData.testingPeriodEnd ? new Date(validatedData.testingPeriodEnd) : undefined,
      },
      {
        userId: session.user.userId,
        entityIds: session.user.entityIds,
        permissions: [], // Add permissions if needed
      }
    );

    // 6. Return response
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    // Error handling
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    
    if (error instanceof ServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    
    console.error("Task creation error:", error);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}

/**
 * Comparison:
 * 
 * Before (Current):
 * - 300+ lines
 * - Business logic mixed with HTTP layer
 * - Difficult to test
 * - Cannot reuse logic
 * 
 * After (With Service):
 * - 80 lines
 * - Clean separation of concerns
 * - Easy to test (mock service)
 * - Reusable logic (service can be called from anywhere)
 */
