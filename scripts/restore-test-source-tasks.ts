/**
 * Restore accidentally deleted tasks from the "test" source
 * 
 * This restores the 18 tasks that were soft-deleted during an unintended regeneration
 * when only the title was changed from "test" to "teste".
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const sourceId = "3d76b582-2185-47af-8ef7-6e145a836c20";

  console.log("🔍 Finding accidentally deleted tasks...\n");

  // Find the deleted tasks
  const deletedTasks = await prisma.task.findMany({
    where: {
      sourceId,
      deletedAt: { not: null },
      deletedReason: "Recurrence pattern updated - instances regenerated",
    },
    orderBy: {
      deletedAt: "desc",
    },
  });

  if (deletedTasks.length === 0) {
    console.log("✅ No deleted tasks found.");
    return;
  }

  console.log(`Found ${deletedTasks.length} deleted tasks`);
  console.log(`Deleted at: ${deletedTasks[0].deletedAt?.toISOString()}\n`);

  // Get the new active tasks (these are the regenerated ones)
  const newTasks = await prisma.task.findMany({
    where: {
      sourceId,
      deletedAt: null,
    },
  });

  console.log(`Current active tasks: ${newTasks.length}\n`);

  // Strategy: Delete the new tasks and restore the old ones
  console.log("⚠️  This will:");
  console.log(`  1. Delete ${newTasks.length} newly created tasks`);
  console.log(`  2. Restore ${deletedTasks.length} previously deleted tasks`);
  console.log();

  await prisma.$transaction(async (tx) => {
    // Hard delete the newly created tasks (they shouldn't exist)
    if (newTasks.length > 0) {
      await tx.task.deleteMany({
        where: {
          id: { in: newTasks.map((t) => t.id) },
        },
      });
      console.log(`✓ Deleted ${newTasks.length} new tasks`);
    }

    // Restore the old tasks by clearing their deletedAt fields
    await tx.task.updateMany({
      where: {
        id: { in: deletedTasks.map((t) => t.id) },
      },
      data: {
        deletedAt: null,
        deletedBy: null,
        deletedReason: null,
        // Update the name to "teste" as the user intended
        name: "teste",
      },
    });
    console.log(`✓ Restored ${deletedTasks.length} old tasks with updated name`);
  });

  console.log("\n✅ Restoration complete!");
  console.log("   The tasks should now appear in the UI with the updated title 'teste'");
}

main()
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
