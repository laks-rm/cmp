import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Updating user timezones...");

  // Optionally set specific timezones for known users
  const updates = [
    { email: "lakshmi.bichu@cmp.local", timezone: "Asia/Dubai" },
    { email: "gary.roberts@cmp.local", timezone: "Europe/London" },
    { email: "sarah.mitchell@cmp.local", timezone: "Europe/London" },
    { email: "waed.alrashid@cmp.local", timezone: "Asia/Dubai" },
    { email: "ahmed.khalil@cmp.local", timezone: "Asia/Dubai" },
    { email: "reem.khalil@cmp.local", timezone: "Asia/Dubai" },
  ];

  for (const { email, timezone } of updates) {
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        await prisma.user.update({
          where: { email },
          data: { timezone },
        });
        console.log(`Set ${email} timezone to ${timezone}`);
      } else {
        console.log(`User ${email} not found`);
      }
    } catch (error) {
      console.error(`Error updating ${email}:`, error);
    }
  }

  console.log("Done!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
