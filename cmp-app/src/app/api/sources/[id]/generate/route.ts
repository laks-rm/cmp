import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { bulkGenerateTasksSchema } from "@/lib/validations/sources";
import { logAuditEvent } from "@/lib/audit";
import { ApiError } from "@/lib/errors";

export async function POST(req: NextRequest, context: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "SOURCES", "CREATE");

    const sourceId = context.params.id;
    const body = await req.json();
    const validatedData = bulkGenerateTasksSchema.parse({ ...body, sourceId });

    // Verify source exists and user has access
    const source = await prisma.source.findUnique({
      where: { id: sourceId },
      include: { entities: true },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    const sourceEntityIds = source.entities.map((e) => e.entityId);
    const hasAccess = sourceEntityIds.some((id) => session.user.entityIds.includes(id));
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Validation: check for blocking issues
    const errors: string[] = [];
    const warnings: string[] = [];

    if (validatedData.items.length === 0) {
      errors.push("No items provided");
    }

    const totalTasks = validatedData.items.reduce((sum, item) => sum + item.tasks.length, 0);
    if (totalTasks === 0) {
      errors.push("No tasks to generate");
    }

    // Check for items with no tasks
    const itemsWithoutTasks = validatedData.items.filter((item) => item.tasks.length === 0);
    if (itemsWithoutTasks.length > 0) {
      warnings.push(`${itemsWithoutTasks.length} items have no tasks`);
    }

    // Check for tasks with no assignee
    const tasksWithoutAssignee = validatedData.items.flatMap((item) =>
      item.tasks.filter((task) => !task.assigneeId)
    );
    if (tasksWithoutAssignee.length > 0) {
      warnings.push(`${tasksWithoutAssignee.length} tasks have no assignee`);
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: "Validation failed", errors, warnings },
        { status: 400 }
      );
    }

    // Generate items and tasks in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const createdItems = [];
      const createdTasks = [];

      for (const itemData of validatedData.items) {
        // Create source item
        const item = await tx.sourceItem.create({
          data: {
            sourceId,
            reference: itemData.item.reference,
            title: itemData.item.title,
            description: itemData.item.description,
            parentId: itemData.item.parentId,
            sortOrder: itemData.item.sortOrder || 0,
          },
        });

        createdItems.push(item);

        // Create tasks for this item
        for (const taskData of itemData.tasks) {
          const task = await tx.task.create({
            data: {
              sourceId,
              sourceItemId: item.id,
              name: taskData.name,
              description: taskData.description,
              expectedOutcome: taskData.expectedOutcome,
              entityId: taskData.entityId,
              frequency: taskData.frequency,
              quarter: taskData.quarter,
              riskRating: taskData.riskRating,
              assigneeId: taskData.assigneeId,
              responsibleTeamId: taskData.responsibleTeamId,
              picId: taskData.picId,
              reviewerId: taskData.reviewerId,
              startDate: taskData.startDate ? new Date(taskData.startDate) : null,
              dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
              testingPeriodStart: taskData.testingPeriodStart ? new Date(taskData.testingPeriodStart) : null,
              testingPeriodEnd: taskData.testingPeriodEnd ? new Date(taskData.testingPeriodEnd) : null,
              evidenceRequired: taskData.evidenceRequired,
              narrativeRequired: taskData.narrativeRequired,
              reviewRequired: taskData.reviewRequired,
              clickupUrl: taskData.clickupUrl || null,
              gdriveUrl: taskData.gdriveUrl || null,
              status: "TO_DO",
            },
          });

          createdTasks.push(task);
        }
      }

      // Update source status to ACTIVE
      await tx.source.update({
        where: { id: sourceId },
        data: { status: "ACTIVE" },
      });

      return { createdItems, createdTasks };
    });

    // Audit log
    await logAuditEvent({
      action: "SOURCE_GENERATED",
      module: "SOURCES",
      userId: session.user.userId,
      targetType: "Source",
      targetId: sourceId,
      details: {
        itemsCount: result.createdItems.length,
        tasksCount: result.createdTasks.length,
      },
    });

    return NextResponse.json({
      success: true,
      itemsCreated: result.createdItems.length,
      tasksCreated: result.createdTasks.length,
      warnings,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Source generation error:", error);
    return NextResponse.json({ error: "Failed to generate source tasks" }, { status: 500 });
  }
}
