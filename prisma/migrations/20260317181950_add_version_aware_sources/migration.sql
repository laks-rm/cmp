-- CreateEnum
CREATE TYPE "SourceMasterStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SourceVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SourceItemChangeType" AS ENUM ('UNCHANGED', 'MODIFIED', 'NEW', 'REMOVED');

-- CreateEnum
CREATE TYPE "TaskTemplateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- AlterTable
ALTER TABLE "Finding" ADD COLUMN     "sourceVersionId" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "sourceItemVersionId" TEXT,
ADD COLUMN     "sourceVersionId" TEXT,
ADD COLUMN     "taskTemplateId" TEXT;

-- CreateTable
CREATE TABLE "SourceMaster" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "issuingAuthorityId" TEXT,
    "ownerTeamId" TEXT NOT NULL,
    "status" "SourceMasterStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceVersion" (
    "id" TEXT NOT NULL,
    "sourceMasterId" TEXT NOT NULL,
    "versionNumber" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "reviewDate" TIMESTAMP(3),
    "status" "SourceVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "changeSummary" TEXT,
    "documentUrl" TEXT,
    "supersedesId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceVersionEntity" (
    "id" TEXT NOT NULL,
    "sourceVersionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,

    CONSTRAINT "SourceVersionEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceItemVersion" (
    "id" TEXT NOT NULL,
    "sourceVersionId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "changeType" "SourceItemChangeType" NOT NULL DEFAULT 'NEW',
    "previousItemId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceItemVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskTemplate" (
    "id" TEXT NOT NULL,
    "sourceItemVersionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "expectedOutcome" TEXT,
    "frequency" "Frequency" NOT NULL,
    "anchorDate" TIMESTAMP(3) NOT NULL,
    "riskRating" "RiskRating" NOT NULL,
    "evidenceRequired" BOOLEAN NOT NULL DEFAULT false,
    "narrativeRequired" BOOLEAN NOT NULL DEFAULT false,
    "reviewRequired" BOOLEAN NOT NULL DEFAULT true,
    "defaultResponsibleTeamId" TEXT,
    "defaultPicId" TEXT,
    "defaultReviewerId" TEXT,
    "applicableEntities" JSONB,
    "status" "TaskTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "retiredAt" TIMESTAMP(3),
    "retiredReason" TEXT,
    "clickupUrlTemplate" TEXT,
    "gdriveUrlTemplate" TEXT,
    "metadata" JSONB,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "deletedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourceMaster_ownerTeamId_idx" ON "SourceMaster"("ownerTeamId");

-- CreateIndex
CREATE INDEX "SourceMaster_issuingAuthorityId_idx" ON "SourceMaster"("issuingAuthorityId");

-- CreateIndex
CREATE INDEX "SourceMaster_status_idx" ON "SourceMaster"("status");

-- CreateIndex
CREATE INDEX "SourceMaster_deletedAt_idx" ON "SourceMaster"("deletedAt");

-- CreateIndex
CREATE INDEX "SourceMaster_deletedBy_idx" ON "SourceMaster"("deletedBy");

-- CreateIndex
CREATE UNIQUE INDEX "SourceMaster_code_ownerTeamId_key" ON "SourceMaster"("code", "ownerTeamId");

-- CreateIndex
CREATE INDEX "SourceVersion_sourceMasterId_idx" ON "SourceVersion"("sourceMasterId");

-- CreateIndex
CREATE INDEX "SourceVersion_sourceMasterId_status_idx" ON "SourceVersion"("sourceMasterId", "status");

-- CreateIndex
CREATE INDEX "SourceVersion_effectiveDate_idx" ON "SourceVersion"("effectiveDate");

-- CreateIndex
CREATE INDEX "SourceVersion_status_idx" ON "SourceVersion"("status");

-- CreateIndex
CREATE INDEX "SourceVersion_supersedesId_idx" ON "SourceVersion"("supersedesId");

-- CreateIndex
CREATE INDEX "SourceVersion_deletedAt_idx" ON "SourceVersion"("deletedAt");

-- CreateIndex
CREATE INDEX "SourceVersion_deletedBy_idx" ON "SourceVersion"("deletedBy");

-- CreateIndex
CREATE UNIQUE INDEX "SourceVersion_sourceMasterId_versionNumber_key" ON "SourceVersion"("sourceMasterId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SourceVersion_sourceMasterId_effectiveDate_key" ON "SourceVersion"("sourceMasterId", "effectiveDate");

-- CreateIndex
CREATE INDEX "SourceVersionEntity_sourceVersionId_idx" ON "SourceVersionEntity"("sourceVersionId");

-- CreateIndex
CREATE INDEX "SourceVersionEntity_entityId_idx" ON "SourceVersionEntity"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceVersionEntity_sourceVersionId_entityId_key" ON "SourceVersionEntity"("sourceVersionId", "entityId");

-- CreateIndex
CREATE INDEX "SourceItemVersion_sourceVersionId_idx" ON "SourceItemVersion"("sourceVersionId");

-- CreateIndex
CREATE INDEX "SourceItemVersion_sourceVersionId_reference_idx" ON "SourceItemVersion"("sourceVersionId", "reference");

-- CreateIndex
CREATE INDEX "SourceItemVersion_parentId_idx" ON "SourceItemVersion"("parentId");

-- CreateIndex
CREATE INDEX "SourceItemVersion_previousItemId_idx" ON "SourceItemVersion"("previousItemId");

-- CreateIndex
CREATE INDEX "SourceItemVersion_changeType_idx" ON "SourceItemVersion"("changeType");

-- CreateIndex
CREATE INDEX "TaskTemplate_sourceItemVersionId_idx" ON "TaskTemplate"("sourceItemVersionId");

-- CreateIndex
CREATE INDEX "TaskTemplate_status_idx" ON "TaskTemplate"("status");

-- CreateIndex
CREATE INDEX "TaskTemplate_defaultResponsibleTeamId_idx" ON "TaskTemplate"("defaultResponsibleTeamId");

-- CreateIndex
CREATE INDEX "TaskTemplate_deletedAt_idx" ON "TaskTemplate"("deletedAt");

-- CreateIndex
CREATE INDEX "TaskTemplate_deletedBy_idx" ON "TaskTemplate"("deletedBy");

-- CreateIndex
CREATE INDEX "Finding_sourceVersionId_idx" ON "Finding"("sourceVersionId");

-- CreateIndex
CREATE INDEX "Task_taskTemplateId_idx" ON "Task"("taskTemplateId");

-- CreateIndex
CREATE INDEX "Task_sourceVersionId_idx" ON "Task"("sourceVersionId");

-- CreateIndex
CREATE INDEX "Task_sourceItemVersionId_idx" ON "Task"("sourceItemVersionId");

-- AddForeignKey
ALTER TABLE "SourceMaster" ADD CONSTRAINT "SourceMaster_issuingAuthorityId_fkey" FOREIGN KEY ("issuingAuthorityId") REFERENCES "IssuingAuthority"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceMaster" ADD CONSTRAINT "SourceMaster_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceMaster" ADD CONSTRAINT "SourceMaster_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceVersion" ADD CONSTRAINT "SourceVersion_sourceMasterId_fkey" FOREIGN KEY ("sourceMasterId") REFERENCES "SourceMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceVersion" ADD CONSTRAINT "SourceVersion_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "SourceVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceVersion" ADD CONSTRAINT "SourceVersion_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceVersionEntity" ADD CONSTRAINT "SourceVersionEntity_sourceVersionId_fkey" FOREIGN KEY ("sourceVersionId") REFERENCES "SourceVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceVersionEntity" ADD CONSTRAINT "SourceVersionEntity_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceItemVersion" ADD CONSTRAINT "SourceItemVersion_sourceVersionId_fkey" FOREIGN KEY ("sourceVersionId") REFERENCES "SourceVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceItemVersion" ADD CONSTRAINT "SourceItemVersion_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SourceItemVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceItemVersion" ADD CONSTRAINT "SourceItemVersion_previousItemId_fkey" FOREIGN KEY ("previousItemId") REFERENCES "SourceItemVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_sourceItemVersionId_fkey" FOREIGN KEY ("sourceItemVersionId") REFERENCES "SourceItemVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_defaultResponsibleTeamId_fkey" FOREIGN KEY ("defaultResponsibleTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_defaultPicId_fkey" FOREIGN KEY ("defaultPicId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_defaultReviewerId_fkey" FOREIGN KEY ("defaultReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_taskTemplateId_fkey" FOREIGN KEY ("taskTemplateId") REFERENCES "TaskTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_sourceVersionId_fkey" FOREIGN KEY ("sourceVersionId") REFERENCES "SourceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_sourceItemVersionId_fkey" FOREIGN KEY ("sourceItemVersionId") REFERENCES "SourceItemVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_sourceVersionId_fkey" FOREIGN KEY ("sourceVersionId") REFERENCES "SourceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- FIX 40: DATA MIGRATION - Transform existing data to version-aware model
-- ============================================================================

DO $$
DECLARE
  v_source_count INTEGER;
  v_sourcemaster_count INTEGER;
  v_sourceversion_count INTEGER;
  v_sourceitem_count INTEGER;
  v_sourceitemversion_count INTEGER;
  v_task_count INTEGER;
  v_template_count INTEGER;
  v_finding_count INTEGER;
BEGIN
  RAISE NOTICE 'FIX 40: Starting data migration to version-aware source model';
  RAISE NOTICE '====================================================================';
  
  -- Count existing records
  SELECT COUNT(*) INTO v_source_count FROM "Source";
  SELECT COUNT(*) INTO v_sourceitem_count FROM "SourceItem";
  SELECT COUNT(*) INTO v_task_count FROM "Task" WHERE "deletedAt" IS NULL;
  SELECT COUNT(*) INTO v_finding_count FROM "Finding" WHERE "deletedAt" IS NULL;
  
  RAISE NOTICE 'Existing records:';
  RAISE NOTICE '  Sources: %', v_source_count;
  RAISE NOTICE '  SourceItems: %', v_sourceitem_count;
  RAISE NOTICE '  Tasks: %', v_task_count;
  RAISE NOTICE '  Findings: %', v_finding_count;
  RAISE NOTICE '';

  -- ============================================================================
  -- Step 1: Create SourceMaster records from unique Source records
  -- ============================================================================
  RAISE NOTICE 'Step 1: Creating SourceMaster records...';
  
  INSERT INTO "SourceMaster" (
    id,
    code,
    name,
    "sourceType",
    "issuingAuthorityId",
    "ownerTeamId",
    status,
    metadata,
    "deletedAt",
    "deletedBy",
    "deletedReason",
    "createdAt",
    "updatedAt"
  )
  SELECT
    gen_random_uuid() as id,
    s.code,
    MAX(s.name) as name,  -- Use MAX to pick one name if there are duplicates
    s."sourceType",
    MAX(s."issuingAuthorityId") as "issuingAuthorityId",
    s."teamId" as "ownerTeamId",
    CASE 
      WHEN MAX(CASE WHEN s.status = 'ACTIVE' THEN 1 ELSE 0 END) = 1 
      THEN 'ACTIVE'::"SourceMasterStatus"
      ELSE 'ARCHIVED'::"SourceMasterStatus"
    END as status,
    NULL as metadata,  -- No metadata in Source model
    MIN(s."deletedAt") as "deletedAt",
    MAX(s."deletedBy") as "deletedBy",
    MAX(s."deletedReason") as "deletedReason",
    MIN(s."createdAt") as "createdAt",
    MAX(s."updatedAt") as "updatedAt"
  FROM "Source" s
  GROUP BY 
    s.code,
    s."teamId",
    s."sourceType";
  
  GET DIAGNOSTICS v_sourcemaster_count = ROW_COUNT;
  RAISE NOTICE '  Created % SourceMaster records', v_sourcemaster_count;

  -- ============================================================================
  -- Step 2: Convert existing Source records to SourceVersion
  -- ============================================================================
  RAISE NOTICE 'Step 2: Creating SourceVersion records...';
  
  INSERT INTO "SourceVersion" (
    id,
    "sourceMasterId",
    "versionNumber",
    "effectiveDate",
    "expiryDate",
    "reviewDate",
    status,
    "changeSummary",
    "documentUrl",
    "supersedesId",
    "deletedAt",
    "deletedBy",
    "deletedReason",
    "createdAt",
    "updatedAt"
  )
  SELECT
    s.id as id,  -- Keep same ID for easier reference mapping
    sm.id as "sourceMasterId",
    '1.0' as "versionNumber",
    COALESCE(s."effectiveDate", s."createdAt") as "effectiveDate",
    NULL as "expiryDate",
    s."reviewDate",
    CASE 
      WHEN s.status = 'ACTIVE' THEN 'ACTIVE'::"SourceVersionStatus"
      WHEN s.status = 'DRAFT' THEN 'DRAFT'::"SourceVersionStatus"
      ELSE 'ARCHIVED'::"SourceVersionStatus"
    END as status,
    'Initial version migrated from legacy Source model on ' || CURRENT_DATE as "changeSummary",
    NULL as "documentUrl",
    NULL as "supersedesId",
    s."deletedAt",
    s."deletedBy",
    s."deletedReason",
    s."createdAt",
    s."updatedAt"
  FROM "Source" s
  JOIN "SourceMaster" sm ON 
    sm.code = s.code AND 
    sm."ownerTeamId" = s."teamId";
  
  GET DIAGNOSTICS v_sourceversion_count = ROW_COUNT;
  RAISE NOTICE '  Created % SourceVersion records', v_sourceversion_count;

  -- ============================================================================
  -- Step 3: Copy SourceEntity links to SourceVersionEntity
  -- ============================================================================
  RAISE NOTICE 'Step 3: Creating SourceVersionEntity links...';
  
  INSERT INTO "SourceVersionEntity" (
    id,
    "sourceVersionId",
    "entityId"
  )
  SELECT
    gen_random_uuid() as id,
    se."sourceId" as "sourceVersionId",  -- SourceVersion kept same ID as Source
    se."entityId"
  FROM "SourceEntity" se;

  -- ============================================================================
  -- Step 4: Convert SourceItem to SourceItemVersion
  -- ============================================================================
  RAISE NOTICE 'Step 4: Creating SourceItemVersion records...';
  
  INSERT INTO "SourceItemVersion" (
    id,
    "sourceVersionId",
    reference,
    title,
    description,
    "parentId",
    "sortOrder",
    "changeType",
    "previousItemId",
    metadata,
    "createdAt",
    "updatedAt"
  )
  SELECT
    si.id as id,  -- Keep same ID
    si."sourceId" as "sourceVersionId",  -- Link to SourceVersion (same ID as old Source)
    si.reference,
    si.title,
    si.description,
    si."parentId",
    si."sortOrder",
    'NEW'::"SourceItemChangeType" as "changeType",  -- All existing items are "NEW" in their version
    NULL as "previousItemId",
    si.metadata,
    si."createdAt",
    si."updatedAt"
  FROM "SourceItem" si;
  
  GET DIAGNOSTICS v_sourceitemversion_count = ROW_COUNT;
  RAISE NOTICE '  Created % SourceItemVersion records', v_sourceitemversion_count;

  -- ============================================================================
  -- Step 5: Generate TaskTemplates from existing Tasks
  -- ============================================================================
  RAISE NOTICE 'Step 5: Generating TaskTemplates from existing Tasks...';
  RAISE NOTICE '  Grouping tasks by (sourceItemId, name, frequency, entityId)...';
  
  -- Create templates from task groups
  INSERT INTO "TaskTemplate" (
    id,
    "sourceItemVersionId",
    name,
    description,
    "expectedOutcome",
    frequency,
    "anchorDate",
    "riskRating",
    "evidenceRequired",
    "narrativeRequired",
    "reviewRequired",
    "defaultResponsibleTeamId",
    "defaultPicId",
    "defaultReviewerId",
    "applicableEntities",
    status,
    "retiredAt",
    "retiredReason",
    "clickupUrlTemplate",
    "gdriveUrlTemplate",
    metadata,
    "deletedAt",
    "deletedBy",
    "deletedReason",
    "createdAt",
    "updatedAt"
  )
  SELECT
    gen_random_uuid() as id,
    t."sourceItemId" as "sourceItemVersionId",
    t.name,
    MAX(t.description) as description,
    MAX(t."expectedOutcome") as "expectedOutcome",
    t.frequency,
    MIN(COALESCE(t."plannedDate", t."dueDate", t."createdAt")) as "anchorDate",
    t."riskRating",
    BOOL_OR(t."evidenceRequired") as "evidenceRequired",
    BOOL_OR(t."narrativeRequired") as "narrativeRequired",
    BOOL_OR(t."reviewRequired") as "reviewRequired",
    MAX(t."responsibleTeamId") as "defaultResponsibleTeamId",
    MAX(t."picId") as "defaultPicId",
    MAX(t."reviewerId") as "defaultReviewerId",
    jsonb_build_array(t."entityId") as "applicableEntities",
    'ACTIVE'::"TaskTemplateStatus" as status,
    NULL as "retiredAt",
    NULL as "retiredReason",
    MAX(t."clickupUrl") as "clickupUrlTemplate",
    MAX(t."gdriveUrl") as "gdriveUrlTemplate",
    jsonb_build_object(
      'migratedFrom', 'legacy_task_model',
      'migrationDate', CURRENT_DATE,
      'taskCount', COUNT(*)
    ) as metadata,
    NULL as "deletedAt",
    NULL as "deletedBy",
    NULL as "deletedReason",
    MIN(t."createdAt") as "createdAt",
    MAX(t."updatedAt") as "updatedAt"
  FROM "Task" t
  WHERE t."sourceItemId" IS NOT NULL  -- Only tasks with source items
    AND t."deletedAt" IS NULL         -- Exclude soft-deleted tasks
  GROUP BY
    t."sourceItemId",
    t.name,
    t.frequency,
    t."riskRating",
    t."entityId";
  
  GET DIAGNOSTICS v_template_count = ROW_COUNT;
  RAISE NOTICE '  Created % TaskTemplate records', v_template_count;

  -- ============================================================================
  -- Step 6: Link Tasks to TaskTemplates
  -- ============================================================================
  RAISE NOTICE 'Step 6: Linking Tasks to TaskTemplates...';
  
  -- Update tasks with their matching template
  UPDATE "Task" t
  SET "taskTemplateId" = tt.id
  FROM "TaskTemplate" tt
  WHERE t."sourceItemId" = tt."sourceItemVersionId"
    AND t.name = tt.name
    AND t.frequency = tt.frequency
    AND t."entityId"::text = tt."applicableEntities"->0->>0
    AND t."deletedAt" IS NULL
    AND t."taskTemplateId" IS NULL;

  -- ============================================================================
  -- Step 7: Add version references to Tasks
  -- ============================================================================
  RAISE NOTICE 'Step 7: Adding version references to Tasks...';
  
  UPDATE "Task" t
  SET 
    "sourceVersionId" = t."sourceId",  -- Same ID after migration
    "sourceItemVersionId" = t."sourceItemId"
  WHERE t."deletedAt" IS NULL;

  -- ============================================================================
  -- Step 8: Add version references to Findings
  -- ============================================================================
  RAISE NOTICE 'Step 8: Adding version references to Findings...';
  
  UPDATE "Finding" f
  SET "sourceVersionId" = f."sourceId"  -- Same ID after migration
  WHERE f."deletedAt" IS NULL;

  -- ============================================================================
  -- Step 9: Create fallback templates for orphaned tasks
  -- ============================================================================
  RAISE NOTICE 'Step 9: Checking for orphaned tasks...';
  
  DECLARE
    v_orphaned_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO v_orphaned_count
    FROM "Task"
    WHERE "taskTemplateId" IS NULL
      AND "deletedAt" IS NULL
      AND "sourceItemId" IS NOT NULL;
    
    IF v_orphaned_count > 0 THEN
      RAISE NOTICE '  Found % orphaned tasks - creating fallback templates', v_orphaned_count;
      
      -- Create fallback templates for orphaned tasks
      INSERT INTO "TaskTemplate" (
        id,
        "sourceItemVersionId",
        name,
        description,
        frequency,
        "anchorDate",
        "riskRating",
        status,
        metadata,
        "createdAt",
        "updatedAt"
      )
      SELECT DISTINCT
        gen_random_uuid(),
        t."sourceItemId",
        t.name,
        'Auto-generated template for orphaned task during FIX 40 migration',
        t.frequency,
        COALESCE(t."plannedDate", t."dueDate", t."createdAt"),
        t."riskRating",
        'ACTIVE'::"TaskTemplateStatus",
        jsonb_build_object('fallbackTemplate', true, 'migrationDate', CURRENT_DATE),
        NOW(),
        NOW()
      FROM "Task" t
      WHERE t."taskTemplateId" IS NULL
        AND t."deletedAt" IS NULL
        AND t."sourceItemId" IS NOT NULL;
      
      -- Link orphaned tasks to fallback templates
      UPDATE "Task" t
      SET "taskTemplateId" = tt.id
      FROM "TaskTemplate" tt
      WHERE t."taskTemplateId" IS NULL
        AND t."sourceItemId" = tt."sourceItemVersionId"
        AND t.name = tt.name
        AND t."deletedAt" IS NULL
        AND (tt.metadata->>'fallbackTemplate')::boolean = true;
    ELSE
      RAISE NOTICE '  No orphaned tasks found';
    END IF;
  END;

  -- ============================================================================
  -- Step 10: Validation
  -- ============================================================================
  RAISE NOTICE '';
  RAISE NOTICE 'Step 10: Validating migration...';
  
  -- Count tasks without templates
  DECLARE
    v_tasks_without_templates INTEGER;
    v_tasks_without_version INTEGER;
    v_findings_without_version INTEGER;
  BEGIN
    SELECT COUNT(*) INTO v_tasks_without_templates
    FROM "Task"
    WHERE "taskTemplateId" IS NULL
      AND "deletedAt" IS NULL
      AND "sourceItemId" IS NOT NULL;
    
    SELECT COUNT(*) INTO v_tasks_without_version
    FROM "Task"
    WHERE "sourceVersionId" IS NULL
      AND "deletedAt" IS NULL;
    
    SELECT COUNT(*) INTO v_findings_without_version
    FROM "Finding"
    WHERE "sourceVersionId" IS NULL
      AND "deletedAt" IS NULL;
    
    RAISE NOTICE '  Tasks without templates: %', v_tasks_without_templates;
    RAISE NOTICE '  Tasks without version reference: %', v_tasks_without_version;
    RAISE NOTICE '  Findings without version reference: %', v_findings_without_version;
    
    IF v_tasks_without_templates > 0 THEN
      RAISE WARNING 'Migration completed but % tasks still lack templates - manual review required', v_tasks_without_templates;
    END IF;
    
    IF v_tasks_without_version > 0 OR v_findings_without_version > 0 THEN
      RAISE WARNING 'Migration completed but some records lack version references - manual review required';
    END IF;
  END;

  -- ============================================================================
  -- Migration Summary
  -- ============================================================================
  RAISE NOTICE '';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'FIX 40: Data migration complete';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  SourceMaster records created: %', v_sourcemaster_count;
  RAISE NOTICE '  SourceVersion records created: %', v_sourceversion_count;
  RAISE NOTICE '  SourceItemVersion records created: %', v_sourceitemversion_count;
  RAISE NOTICE '  TaskTemplate records created: %', v_template_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Verify migration results';
  RAISE NOTICE '  2. Test application functionality';
  RAISE NOTICE '  3. If successful, legacy fields can be removed in future migration';
  RAISE NOTICE '  4. Review documentation at docs/FIX_40_*.md';
  RAISE NOTICE '====================================================================';
END $$;
