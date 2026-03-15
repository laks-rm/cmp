import { prisma } from "@/lib/prisma";

type NotificationType =
  | "TASK_SUBMITTED"
  | "TASK_APPROVED"
  | "TASK_REJECTED"
  | "TASK_ASSIGNED"
  | "TASK_OVERDUE"
  | "FINDING_CREATED"
  | "FINDING_OVERDUE"
  | "SOURCE_GENERATED"
  | "COMMENT_ADDED";

type EntityType = "Task" | "Finding" | "Source";

const DEDUPLICATION_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export async function createNotification(
  type: NotificationType,
  recipientId: string,
  title: string,
  message: string,
  linkUrl?: string,
  entityType?: EntityType,
  entityId?: string
): Promise<void> {
  try {
    // Check for recent duplicate notification
    if (entityType && entityId) {
      const recentDuplicate = await prisma.notification.findFirst({
        where: {
          userId: recipientId,
          type,
          entityType,
          entityId,
          createdAt: {
            gte: new Date(Date.now() - DEDUPLICATION_WINDOW_MS),
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (recentDuplicate) {
        console.log("Skipping duplicate notification:", {
          type,
          recipientId,
          entityType,
          entityId,
          existingNotificationAge: Date.now() - recentDuplicate.createdAt.getTime(),
        });
        return;
      }
    }

    await prisma.notification.create({
      data: {
        type,
        title,
        message,
        userId: recipientId,
        linkUrl: linkUrl || null,
        entityType: entityType || null,
        entityId: entityId || null,
        isRead: false,
      },
    });
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
}

export async function notifyTaskSubmitted(taskId: string, taskName: string, reviewerId: string, assigneeName: string): Promise<void> {
  await createNotification(
    "TASK_SUBMITTED",
    reviewerId,
    "Task Submitted for Review",
    `${assigneeName} submitted "${taskName}" for your review`,
    `/tasks/${taskId}`,
    "Task",
    taskId
  );
}

export async function notifyTaskApproved(taskId: string, taskName: string, picId: string, reviewerName: string): Promise<void> {
  await createNotification(
    "TASK_APPROVED",
    picId,
    "Task Approved",
    `${reviewerName} approved your task "${taskName}"`,
    `/tasks/${taskId}`,
    "Task",
    taskId
  );
}

export async function notifyTaskRejected(
  taskId: string,
  taskName: string,
  picId: string,
  reviewerName: string,
  reason?: string
): Promise<void> {
  const message = reason
    ? `${reviewerName} requested changes on "${taskName}": ${reason}`
    : `${reviewerName} requested changes on "${taskName}"`;

  await createNotification(
    "TASK_REJECTED",
    picId,
    "Changes Requested",
    message,
    `/tasks/${taskId}`,
    "Task",
    taskId
  );
}

export async function notifyTaskAssigned(taskId: string, taskName: string, picId: string, entityName: string): Promise<void> {
  await createNotification(
    "TASK_ASSIGNED",
    picId,
    "Task Assigned",
    `You've been assigned to task "${taskName}" for ${entityName}`,
    `/tasks/${taskId}`,
    "Task",
    taskId
  );
}

export async function notifyTaskOverdue(
  taskId: string,
  taskName: string,
  recipientIds: string[],
  daysOverdue: number
): Promise<void> {
  const message = `Task "${taskName}" is ${daysOverdue} day${daysOverdue > 1 ? "s" : ""} overdue`;

  for (const recipientId of recipientIds) {
    await createNotification(
      "TASK_OVERDUE",
      recipientId,
      "Task Overdue",
      message,
      `/tasks/${taskId}`,
      "Task",
      taskId
    );
  }
}

export async function notifyFindingCreated(
  findingId: string,
  findingRef: string,
  findingTitle: string,
  actionOwnerId: string,
  raiserName: string
): Promise<void> {
  await createNotification(
    "FINDING_CREATED",
    actionOwnerId,
    "New Finding Assigned",
    `${raiserName} raised finding ${findingRef}: ${findingTitle}`,
    `/findings/${findingId}`,
    "Finding",
    findingId
  );
}

export async function notifyFindingOverdue(
  findingId: string,
  findingRef: string,
  findingTitle: string,
  recipientIds: string[],
  daysOverdue: number
): Promise<void> {
  const message = `Finding ${findingRef} "${findingTitle}" is ${daysOverdue} day${daysOverdue > 1 ? "s" : ""} overdue`;

  for (const recipientId of recipientIds) {
    await createNotification(
      "FINDING_OVERDUE",
      recipientId,
      "Finding Overdue",
      message,
      `/findings/${findingId}`,
      "Finding",
      findingId
    );
  }
}

export async function notifySourceGenerated(
  sourceId: string,
  sourceName: string,
  teamMemberIds: string[],
  tasksCount: number
): Promise<void> {
  const message = `Source "${sourceName}" has been activated with ${tasksCount} tasks`;

  for (const memberId of teamMemberIds) {
    await createNotification(
      "SOURCE_GENERATED",
      memberId,
      "New Source Available",
      message,
      `/sources?sourceId=${sourceId}`,
      "Source",
      sourceId
    );
  }
}

// TODO: Email notifications
// - Implement email service integration (SendGrid, AWS SES, etc.)
// - Create email templates for each notification type
// - Add user preference: emailOnNotification boolean field
// - Queue emails for batch sending to avoid rate limits

// TODO: Slack webhooks
// - Add Slack webhook URL to Team model
// - Create Slack message formatter for each notification type
// - Add user preference: slackUserId field for @mentions
// - Implement retry logic for failed webhook calls

/**
 * Clean up old read notifications to prevent database bloat
 * Should be called periodically via cron job
 * @param olderThanDays - Delete notifications older than this many days (default: 30)
 * @returns Number of notifications deleted
 */
export async function cleanupOldNotifications(olderThanDays: number = 30): Promise<number> {
  try {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const result = await prisma.notification.deleteMany({
      where: {
        isRead: true,
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  } catch (error) {
    console.error("Failed to cleanup old notifications:", error);
    return 0;
  }
}
