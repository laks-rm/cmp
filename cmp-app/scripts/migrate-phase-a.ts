import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log("Creating Department table...");
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Department" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "name" TEXT NOT NULL UNIQUE,
        "description" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("Creating MonitoringArea table...");
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "MonitoringArea" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "name" TEXT NOT NULL UNIQUE,
        "description" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("Creating TaskType table...");
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TaskType" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "name" TEXT NOT NULL UNIQUE,
        "description" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("Adding departmentId to Team table...");
    await prisma.$executeRawUnsafe(`ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS "departmentId" TEXT`);
    
    console.log("Adding foreign key constraint for Team.departmentId...");
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "Team" ADD CONSTRAINT "Team_departmentId_fkey" 
          FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    
    console.log("Creating index on Team.departmentId...");
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Team_departmentId_idx" ON "Team"("departmentId")`);

    console.log("Adding new columns to Task table...");
    await prisma.$executeRawUnsafe(`ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "monitoringAreaId" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "taskTypeId" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "deferralReason" TEXT`);
    
    console.log("Adding foreign key constraints for Task...");
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "Task" ADD CONSTRAINT "Task_monitoringAreaId_fkey" 
          FOREIGN KEY ("monitoringAreaId") REFERENCES "MonitoringArea"("id") ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "Task" ADD CONSTRAINT "Task_taskTypeId_fkey" 
          FOREIGN KEY ("taskTypeId") REFERENCES "TaskType"("id") ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    
    console.log("Creating indexes on Task...");
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Task_monitoringAreaId_idx" ON "Task"("monitoringAreaId")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Task_taskTypeId_idx" ON "Task"("taskTypeId")`);

    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
