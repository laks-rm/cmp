/**
 * Fix Recurrence Groups Migration Script
 * 
 * This script fixes tasks that have a non-ADHOC frequency but missing recurrenceGroupId.
 * This can happen with tasks created before the recurrence group logic was properly implemented.
 * 
 * The script:
 * 1. Finds all tasks with frequency !== 'ADHOC' and recurrenceGroupId = null
 * 2. Groups them by (sourceId, sourceItemId, entityId, name, frequency, dueDate pattern)
 * 3. Assigns a new recurrenceGroupId to each logical group
 * 4. Updates recurrenceIndex and recurrenceTotalCount accordingly
 * 
 * Usage:
 *   npx tsx scripts/fix-recurrence-groups.ts
 */

import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Finding tasks with missing recurrence groups...");

  // Find all tasks with frequency but no recurrenceGroupId
  const tasksWithoutGroup = await prisma.task.findMany({
    where: {
      frequency: {
        not: "ADHOC",
      },
      recurrenceGroupId: null,
      deletedAt: null,
    },
    orderBy: [
      { sourceId: "asc" },
      { sourceItemId: "asc" },
      { entityId: "asc" },
      { name: "asc" },
      { dueDate: "asc" },
    ],
  });

  if (tasksWithoutGroup.length === 0) {
    console.log("✅ No tasks found that need fixing!");
    return;
  }

  console.log(`📊 Found ${tasksWithoutGroup.length} tasks without recurrence groups`);

  // Group tasks by their template characteristics
  const taskGroups = new Map<string, typeof tasksWithoutGroup>();

  tasksWithoutGroup.forEach((task) => {
    // Create a grouping key based on template characteristics
    const key = [
      task.sourceId,
      task.sourceItemId,
      task.entityId,
      task.name,
      task.frequency,
      task.riskRating,
      task.responsibleTeamId,
      task.picId,
      task.reviewerId,
    ].join("|");

    if (!taskGroups.has(key)) {
      taskGroups.set(key, []);
    }
    taskGroups.get(key)!.push(task);
  });

  console.log(`🔗 Identified ${taskGroups.size} logical recurrence groups`);

  let updatedCount = 0;
  let groupsCreated = 0;

  // Process each group
  for (const [groupKey, groupTasks] of taskGroups.entries()) {
    // Only create groups for tasks that actually have multiple instances
    // Single-instance tasks should still get a recurrenceGroupId for consistency
    const newRecurrenceGroupId = uuidv4();
    const totalCount = groupTasks.length;

    // Sort by due date
    groupTasks.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.getTime() - b.dueDate.getTime();
    });

    // Update each task in the group
    for (let i = 0; i < groupTasks.length; i++) {
      const task = groupTasks[i];
      await prisma.task.update({
        where: { id: task.id },
        data: {
          recurrenceGroupId: newRecurrenceGroupId,
          recurrenceIndex: i,
          recurrenceTotalCount: totalCount,
        },
      });
      updatedCount++;
    }

    groupsCreated++;
    console.log(
      `✓ Group ${groupsCreated}/${taskGroups.size}: ${groupTasks[0].name} (${groupTasks[0].frequency}) - ${totalCount} instances`
    );
  }

  console.log("\n✅ Migration complete!");
  console.log(`   Updated ${updatedCount} tasks`);
  console.log(`   Created ${groupsCreated} recurrence groups`);
}

main()
  .catch((error) => {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
