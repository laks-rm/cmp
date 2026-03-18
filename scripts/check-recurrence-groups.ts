/**
 * Debug: Check Recurrence Group Status
 * 
 * Quick diagnostic script to check the current state of recurrence groups in the database.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Checking recurrence group status...\n");

  // Check tasks with frequency but no recurrence group
  const tasksWithoutGroup = await prisma.task.count({
    where: {
      frequency: { not: "ADHOC" },
      recurrenceGroupId: null,
      deletedAt: null,
    },
  });

  console.log(`Tasks with frequency but no recurrenceGroupId: ${tasksWithoutGroup}`);

  // Check all recurrence groups
  const allRecurringTasks = await prisma.task.findMany({
    where: {
      recurrenceGroupId: { not: null },
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      frequency: true,
      recurrenceGroupId: true,
      recurrenceIndex: true,
      recurrenceTotalCount: true,
      dueDate: true,
    },
    orderBy: [
      { recurrenceGroupId: "asc" },
      { recurrenceIndex: "asc" },
    ],
  });

  console.log(`\nTotal recurring tasks (with recurrenceGroupId): ${allRecurringTasks.length}`);

  // Group by recurrenceGroupId
  const groups = new Map<string, typeof allRecurringTasks>();
  allRecurringTasks.forEach((task) => {
    if (!groups.has(task.recurrenceGroupId!)) {
      groups.set(task.recurrenceGroupId!, []);
    }
    groups.get(task.recurrenceGroupId!)!.push(task);
  });

  console.log(`\nRecurrence groups: ${groups.size}\n`);

  // Show details of each group
  let groupNum = 1;
  for (const [groupId, tasks] of groups.entries()) {
    console.log(`Group ${groupNum++}: ${groupId}`);
    console.log(`  Name: ${tasks[0].name}`);
    console.log(`  Frequency: ${tasks[0].frequency}`);
    console.log(`  Instances: ${tasks.length}`);
    tasks.forEach((task, idx) => {
      console.log(
        `    [${idx}] ${task.id.substring(0, 8)}... Due: ${task.dueDate?.toISOString().split("T")[0]} (Index: ${task.recurrenceIndex})`
      );
    });
    console.log();
  }
}

main()
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
