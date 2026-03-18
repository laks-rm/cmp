/**
 * Debug: Check specific source tasks
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const sourceId = "3d76b582-2185-47af-8ef7-6e145a836c20"; // "test" source

  console.log(`🔍 Checking source: ${sourceId}\n`);

  // Get source details
  const source = await prisma.source.findUnique({
    where: { id: sourceId },
    include: {
      items: true,
      entities: {
        include: {
          entity: true,
        },
      },
    },
  });

  if (!source) {
    console.log("❌ Source not found!");
    return;
  }

  console.log(`Source: ${source.name} (${source.code})`);
  console.log(`Status: ${source.status}`);
  console.log(`Items: ${source.items.length}`);
  console.log(`Entities: ${source.entities.length}`);
  console.log();

  // Get all tasks (including deleted)
  const allTasks = await prisma.task.findMany({
    where: { sourceId },
    select: {
      id: true,
      name: true,
      frequency: true,
      recurrenceGroupId: true,
      status: true,
      deletedAt: true,
      deletedReason: true,
      entity: {
        select: {
          code: true,
        },
      },
    },
    orderBy: [
      { recurrenceGroupId: "asc" },
      { name: "asc" },
    ],
  });

  console.log(`Total tasks (including deleted): ${allTasks.length}`);

  const activeTasks = allTasks.filter((t) => !t.deletedAt);
  const deletedTasks = allTasks.filter((t) => t.deletedAt);

  console.log(`Active tasks: ${activeTasks.length}`);
  console.log(`Deleted tasks: ${deletedTasks.length}`);
  console.log();

  if (deletedTasks.length > 0) {
    console.log("❌ DELETED TASKS:");
    deletedTasks.forEach((task) => {
      console.log(`  - ${task.id.substring(0, 8)}... ${task.name} (${task.entity.code})`);
      console.log(`    Reason: ${task.deletedReason || "Not specified"}`);
      console.log(`    Deleted at: ${task.deletedAt?.toISOString()}`);
    });
    console.log();
  }

  if (activeTasks.length > 0) {
    console.log("✅ ACTIVE TASKS:");
    const groupedByRecurrence = new Map<string | null, typeof activeTasks>();
    activeTasks.forEach((task) => {
      const key = task.recurrenceGroupId || `standalone-${task.id}`;
      if (!groupedByRecurrence.has(key)) {
        groupedByRecurrence.set(key, []);
      }
      groupedByRecurrence.get(key)!.push(task);
    });

    console.log(`Recurrence groups: ${groupedByRecurrence.size}`);
    for (const [groupId, tasks] of groupedByRecurrence.entries()) {
      if (groupId.startsWith("standalone")) {
        console.log(`  - Standalone: ${tasks[0].name} (${tasks[0].entity.code})`);
      } else {
        console.log(`  - Group ${groupId.substring(0, 8)}...: ${tasks[0].name} (${tasks.length} instances)`);
      }
    }
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
