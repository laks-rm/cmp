-- Phase A: Add Department, MonitoringArea, TaskType models
-- and optional fields to Team and Task

-- Create Department table
CREATE TABLE IF NOT EXISTS "Department" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL UNIQUE,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create MonitoringArea table
CREATE TABLE IF NOT EXISTS "MonitoringArea" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL UNIQUE,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create TaskType table
CREATE TABLE IF NOT EXISTS "TaskType" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL UNIQUE,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add departmentId to Team table (nullable - backward compatible)
ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS "departmentId" TEXT;
ALTER TABLE "Team" ADD CONSTRAINT IF NOT EXISTS "Team_departmentId_fkey" 
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "Team_departmentId_idx" ON "Team"("departmentId");

-- Add monitoringAreaId, taskTypeId, and deferralReason to Task table (nullable - backward compatible)
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "monitoringAreaId" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "taskTypeId" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "deferralReason" TEXT;
ALTER TABLE "Task" ADD CONSTRAINT IF NOT EXISTS "Task_monitoringAreaId_fkey" 
    FOREIGN KEY ("monitoringAreaId") REFERENCES "MonitoringArea"("id") ON DELETE SET NULL;
ALTER TABLE "Task" ADD CONSTRAINT IF NOT EXISTS "Task_taskTypeId_fkey" 
    FOREIGN KEY ("taskTypeId") REFERENCES "TaskType"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "Task_monitoringAreaId_idx" ON "Task"("monitoringAreaId");
CREATE INDEX IF NOT EXISTS "Task_taskTypeId_idx" ON "Task"("taskTypeId");
