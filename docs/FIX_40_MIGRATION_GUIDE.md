# FIX 40: Migration Strategy & Implementation Guide

**Date**: 2026-03-17  
**Status**: Implementation Guide  
**Estimated Effort**: Large (40-60 hours)

## Overview

This document provides a step-by-step guide to migrate CMP from the current flat source model to the version-aware source and task template model.

---

## Migration Phases

### Phase 1: Schema Migration (Days 1-3)
### Phase 2: Data Migration (Days 4-5)
### Phase 3: API Layer (Days 6-8)
### Phase 4: Business Logic (Days 9-11)
### Phase 5: UI Components (Days 12-15)
### Phase 6: Testing & Validation (Days 16-18)

---

## Phase 1: Schema Migration

### Step 1.1: Create New Models

Add to `schema.prisma`:

1. **SourceMaster** model
2. **SourceVersion** model
3. **SourceVersionEntity** junction table
4. **SourceItemVersion** (evolve from SourceItem)
5. **TaskTemplate** model

### Step 1.2: Update Existing Models

Modify:

1. **Task** model:
   - Add `taskTemplateId` (String, required)
   - Add `sourceVersionId` (String, required)
   - Add `sourceItemVersionId` (String, required)
   - Keep legacy `sourceId` temporarily for migration
   - Keep legacy `sourceItemId` temporarily for migration

2. **Entity** model:
   - Update `sourceLinks` relation to `sourceVersions`

3. **Team** model:
   - Add `sourceMasters` relation
   - Add `taskTemplates` relation

4. **User** model:
   - Add template-related relations
   - Add source master/version deletion relations

5. **Finding** model:
   - Add `sourceVersionId` field
   - Keep legacy `sourceId` temporarily for migration

### Step 1.3: Create Migration SQL

```bash
npx prisma migrate dev --name add_version_aware_sources --create-only
```

This generates a migration file in `prisma/migrations/`.

### Step 1.4: Enhance Migration with Data Migration Logic

The auto-generated migration will only create tables. We need to add data migration logic.

See detailed SQL in **Phase 2** below.

---

## Phase 2: Data Migration

### Step 2.1: Backup Database

**CRITICAL**: Always backup before migration.

```bash
./scripts/backup-database.sh
```

### Step 2.2: Migration SQL Strategy

The migration must:

1. Create SourceMaster records from unique Source records
2. Convert Source records to SourceVersion records
3. Link SourceItems to SourceVersions
4. Generate TaskTemplates from existing Tasks
5. Link existing Tasks to TaskTemplates

### Step 2.3: Detailed Migration SQL

Add this to the migration file after the schema changes:

```sql
-- ============================================================================
-- DATA MIGRATION: Source -> SourceMaster + SourceVersion
-- ============================================================================

-- Step 1: Create SourceMaster records
-- Each unique (code, teamId) combination becomes a SourceMaster
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
  s.name,
  s."sourceType",
  s."issuingAuthorityId",
  s."teamId" as "ownerTeamId",
  CASE 
    WHEN s.status = 'ACTIVE' THEN 'ACTIVE'::SourceMasterStatus
    ELSE 'ARCHIVED'::SourceMasterStatus
  END as status,
  s.metadata,
  s."deletedAt",
  s."deletedBy",
  s."deletedReason",
  MIN(s."createdAt") as "createdAt",
  MAX(s."updatedAt") as "updatedAt"
FROM "Source" s
GROUP BY 
  s.code,
  s.name,
  s."sourceType",
  s."issuingAuthorityId",
  s."teamId",
  s.status,
  s.metadata,
  s."deletedAt",
  s."deletedBy",
  s."deletedReason";

-- Step 2: Convert existing Source records to SourceVersion
-- Each Source becomes version "1.0" under its SourceMaster
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
  "supersededById",
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
    WHEN s.status = 'ACTIVE' THEN 'ACTIVE'::SourceVersionStatus
    WHEN s.status = 'DRAFT' THEN 'DRAFT'::SourceVersionStatus
    ELSE 'ARCHIVED'::SourceVersionStatus
  END as status,
  'Initial version migrated from legacy Source model' as "changeSummary",
  NULL as "documentUrl",
  NULL as "supersedesId",
  NULL as "supersededById",
  s."deletedAt",
  s."deletedBy",
  s."deletedReason",
  s."createdAt",
  s."updatedAt"
FROM "Source" s
JOIN "SourceMaster" sm ON 
  sm.code = s.code AND 
  sm."ownerTeamId" = s."teamId";

-- Step 3: Copy SourceEntity links to SourceVersionEntity
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

-- Step 4: Convert SourceItem to SourceItemVersion
-- Add sourceVersionId and set default values for new fields
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
  'NEW'::SourceItemChangeType as "changeType",  -- All existing items are "NEW" in their version
  NULL as "previousItemId",
  si.metadata,
  si."createdAt",
  si."updatedAt"
FROM "SourceItem" si;

-- ============================================================================
-- DATA MIGRATION: Generate TaskTemplates from Tasks
-- ============================================================================

-- Step 5: Generate TaskTemplates
-- Strategy: Group tasks by (sourceItemId, name, frequency, entityId)
-- Create one template per unique group
-- Derive anchorDate from earliest plannedDate in group

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
  t.description,
  t."expectedOutcome",
  t.frequency,
  MIN(COALESCE(t."plannedDate", t."dueDate", t."createdAt")) as "anchorDate",
  t."riskRating",
  BOOL_OR(t."evidenceRequired") as "evidenceRequired",
  BOOL_OR(t."narrativeRequired") as "narrativeRequired",
  BOOL_OR(t."reviewRequired") as "reviewRequired",
  t."responsibleTeamId" as "defaultResponsibleTeamId",
  t."picId" as "defaultPicId",
  t."reviewerId" as "defaultReviewerId",
  jsonb_build_array(t."entityId") as "applicableEntities",
  'ACTIVE'::TaskTemplateStatus as status,
  NULL as "retiredAt",
  NULL as "retiredReason",
  t."clickupUrl" as "clickupUrlTemplate",
  t."gdriveUrl" as "gdriveUrlTemplate",
  jsonb_build_object(
    'migratedFrom', 'legacy_task_model',
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
  t.description,
  t."expectedOutcome",
  t.frequency,
  t."riskRating",
  t."responsibleTeamId",
  t."picId",
  t."reviewerId",
  t."entityId",
  t."clickupUrl",
  t."gdriveUrl";

-- Step 6: Link Tasks to TaskTemplates
-- Find the template that matches each task's characteristics

-- First, add a temporary column to store template ID
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "tempTaskTemplateId" TEXT;

-- Update tasks with their matching template
UPDATE "Task" t
SET "tempTaskTemplateId" = tt.id
FROM "TaskTemplate" tt
WHERE t."sourceItemId" = tt."sourceItemVersionId"
  AND t.name = tt.name
  AND t.frequency = tt.frequency
  AND t."entityId"::text = ANY(
    SELECT jsonb_array_elements_text(tt."applicableEntities")
  )
  AND t."deletedAt" IS NULL;

-- Step 7: Add version references to Tasks
-- Use the sourceId to find the sourceVersionId (they have same ID from migration)
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "tempSourceVersionId" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "tempSourceItemVersionId" TEXT;

UPDATE "Task" t
SET 
  "tempSourceVersionId" = t."sourceId",  -- Same ID after migration
  "tempSourceItemVersionId" = t."sourceItemId";  -- Same ID after migration

-- Step 8: Verify migration success
-- Count tasks without templates (should be zero or minimal)
DO $$
DECLARE
  tasks_without_templates INTEGER;
BEGIN
  SELECT COUNT(*) INTO tasks_without_templates
  FROM "Task"
  WHERE "tempTaskTemplateId" IS NULL
    AND "deletedAt" IS NULL
    AND "sourceItemId" IS NOT NULL;
  
  IF tasks_without_templates > 0 THEN
    RAISE WARNING 'Found % tasks without matching templates. Creating fallback templates.', tasks_without_templates;
    
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
      "createdAt",
      "updatedAt"
    )
    SELECT DISTINCT
      gen_random_uuid(),
      t."sourceItemId",
      t.name,
      'Auto-generated template for orphaned task',
      t.frequency,
      COALESCE(t."plannedDate", t."dueDate", t."createdAt"),
      t."riskRating",
      'ACTIVE'::TaskTemplateStatus,
      NOW(),
      NOW()
    FROM "Task" t
    WHERE t."tempTaskTemplateId" IS NULL
      AND t."deletedAt" IS NULL
      AND t."sourceItemId" IS NOT NULL;
    
    -- Link orphaned tasks to fallback templates
    UPDATE "Task" t
    SET "tempTaskTemplateId" = tt.id
    FROM "TaskTemplate" tt
    WHERE t."tempTaskTemplateId" IS NULL
      AND t."sourceItemId" = tt."sourceItemVersionId"
      AND t.name = tt.name
      AND t."deletedAt" IS NULL;
  END IF;
END $$;

-- Step 9: Make temp columns permanent
-- This will be done after schema allows nullable fields initially

-- ============================================================================
-- UPDATE Finding references
-- ============================================================================

-- Step 10: Update Finding.sourceVersionId
-- Use the sourceId to find sourceVersionId (same ID after migration)
ALTER TABLE "Finding" ADD COLUMN IF NOT EXISTS "tempSourceVersionId" TEXT;

UPDATE "Finding" f
SET "tempSourceVersionId" = f."sourceId";  -- Same ID after migration

-- ============================================================================
-- MIGRATION COMPLETE - NEXT: Schema update to make new fields required
-- ============================================================================

-- After this migration runs successfully, we'll need a second migration to:
-- 1. Make taskTemplateId, sourceVersionId, sourceItemVersionId required (NOT NULL)
-- 2. Drop temp columns
-- 3. Drop legacy sourceId, sourceItemId columns from Task
-- 4. Drop legacy sourceId column from Finding
-- 5. Drop old Source, SourceEntity, SourceItem tables

RAISE NOTICE 'Phase 1 data migration complete. Verify data before proceeding to Phase 2.';
```

### Step 2.4: Run Migration

```bash
# Run migration
npx prisma migrate dev

# Verify migration
npx prisma db pull
npx prisma generate
```

### Step 2.5: Validation Queries

Run these to verify migration success:

```sql
-- Check SourceMaster count
SELECT COUNT(*) FROM "SourceMaster";

-- Check SourceVersion count (should equal old Source count)
SELECT COUNT(*) FROM "SourceVersion";

-- Check SourceItemVersion count (should equal old SourceItem count)
SELECT COUNT(*) FROM "SourceItemVersion";

-- Check TaskTemplate count
SELECT COUNT(*) FROM "TaskTemplate";

-- Check tasks with templates
SELECT 
  COUNT(*) as total_tasks,
  COUNT("tempTaskTemplateId") as tasks_with_template,
  COUNT(*) - COUNT("tempTaskTemplateId") as orphaned_tasks
FROM "Task"
WHERE "deletedAt" IS NULL;

-- Check findings with version references
SELECT 
  COUNT(*) as total_findings,
  COUNT("tempSourceVersionId") as findings_with_version
FROM "Finding"
WHERE "deletedAt" IS NULL;
```

---

## Phase 3: API Layer

### Step 3.1: Create New API Routes

#### SourceMaster Routes

Create: `src/app/api/source-masters/route.ts`

```typescript
// GET /api/source-masters - List all source masters
// POST /api/source-masters - Create new source master
```

Create: `src/app/api/source-masters/[id]/route.ts`

```typescript
// GET /api/source-masters/:id - Get source master detail
// PUT /api/source-masters/:id - Update source master
// DELETE /api/source-masters/:id - Soft delete source master
```

#### SourceVersion Routes

Create: `src/app/api/source-masters/[id]/versions/route.ts`

```typescript
// GET /api/source-masters/:id/versions - List versions
// POST /api/source-masters/:id/versions - Create new version
```

Create: `src/app/api/source-versions/[id]/route.ts`

```typescript
// GET /api/source-versions/:id - Get version detail
// PUT /api/source-versions/:id - Update version
// DELETE /api/source-versions/:id - Soft delete version
```

Create: `src/app/api/source-versions/[id]/activate/route.ts`

```typescript
// POST /api/source-versions/:id/activate - Activate version
```

Create: `src/app/api/source-versions/[id]/compare/[otherId]/route.ts`

```typescript
// GET /api/source-versions/:id/compare/:otherId - Compare two versions
```

#### SourceItemVersion Routes

Create: `src/app/api/source-versions/[id]/items/route.ts`

```typescript
// GET /api/source-versions/:id/items - List items in version
// POST /api/source-versions/:id/items - Create item in version
```

Create: `src/app/api/source-item-versions/[id]/route.ts`

```typescript
// GET /api/source-item-versions/:id - Get item detail
// PUT /api/source-item-versions/:id - Update item
// DELETE /api/source-item-versions/:id - Soft delete item
```

#### TaskTemplate Routes

Create: `src/app/api/source-item-versions/[id]/templates/route.ts`

```typescript
// GET /api/source-item-versions/:id/templates - List templates
// POST /api/source-item-versions/:id/templates - Create template
```

Create: `src/app/api/task-templates/[id]/route.ts`

```typescript
// GET /api/task-templates/:id - Get template detail
// PUT /api/task-templates/:id - Update template
// DELETE /api/task-templates/:id - Retire template
```

Create: `src/app/api/task-templates/[id]/generate/route.ts`

```typescript
// POST /api/task-templates/:id/generate - Generate tasks from template
```

#### Impact Assessment Routes

Create: `src/app/api/source-versions/[id]/impact/route.ts`

```typescript
// GET /api/source-versions/:id/impact - Get impact assessment
```

### Step 3.2: Update Existing Routes

Update: `src/app/api/tasks/route.ts`
- Add taskTemplateId to response
- Add sourceVersion info to response

Update: `src/app/api/tasks/[id]/route.ts`
- Include template and version details

---

## Phase 4: Business Logic

### Step 4.1: Create Service Layer

Create: `src/services/SourceMasterService.ts`

```typescript
export class SourceMasterService {
  async createSourceMaster(data: CreateSourceMasterInput): Promise<SourceMaster>
  async getSourceMaster(id: string): Promise<SourceMasterWithVersions>
  async updateSourceMaster(id: string, data: UpdateSourceMasterInput): Promise<SourceMaster>
  async deleteSourceMaster(id: string, userId: string, reason: string): Promise<void>
  async listSourceMasters(filters: SourceMasterFilters): Promise<SourceMaster[]>
}
```

Create: `src/services/SourceVersionService.ts`

```typescript
export class SourceVersionService {
  async createVersion(masterId: string, data: CreateVersionInput): Promise<SourceVersion>
  async activateVersion(versionId: string, userId: string): Promise<SourceVersion>
  async compareVersions(versionId1: string, versionId2: string): Promise<VersionComparison>
  async getImpactAssessment(versionId: string): Promise<ImpactAssessment>
  async supersedePreviousVersion(newVersionId: string): Promise<void>
}
```

Create: `src/services/TaskTemplateService.ts`

```typescript
export class TaskTemplateService {
  async createTemplate(data: CreateTemplateInput): Promise<TaskTemplate>
  async updateTemplate(id: string, data: UpdateTemplateInput): Promise<TaskTemplate>
  async retireTemplate(id: string, reason: string, userId: string): Promise<void>
  async generateTasksFromTemplate(templateId: string, entityIds: string[]): Promise<Task[]>
  async previewGeneration(templateId: string, entityIds: string[]): Promise<TaskPreview[]>
}
```

### Step 4.2: Update Task Generation Logic

Update: `src/app/api/sources/[id]/generate/route.ts`

Change from:
- Generating tasks directly from source items

To:
- Creating task templates first
- Generating tasks from templates
- Enforcing effective date + anchor date rules

Key changes:

```typescript
// OLD (before FIX 40)
function calculateRecurrenceInstances(frequency, baseDueDate, sourceEffectiveDate)

// NEW (after FIX 40)
function calculateRecurrenceInstances(
  frequency: Frequency,
  anchorDate: Date,           // From task template
  sourceEffectiveDate: Date   // From source version
): RecurrenceInstance[]

// Enforce rule:
const earliestValidDate = max(anchorDate, sourceEffectiveDate);
// Only generate instances >= earliestValidDate
```

### Step 4.3: Create Version Activation Logic

Create: `src/lib/versionActivation.ts`

```typescript
/**
 * Activates a source version and handles supersession
 */
export async function activateSourceVersion(
  versionId: string,
  userId: string
): Promise<ActivationResult> {
  // 1. Validate version can be activated
  // 2. Find current active version of same master
  // 3. Set current active version to SUPERSEDED
  // 4. Set expiryDate on old version
  // 5. Set new version to ACTIVE
  // 6. Log audit events
  // 7. Return impact summary
}

/**
 * Analyzes impact of a version change
 */
export async function analyzeVersionImpact(
  newVersionId: string
): Promise<ImpactAssessment> {
  // 1. Compare items with previous version
  // 2. Find affected task templates
  // 3. Find affected future tasks
  // 4. Count entities impacted
  // 5. Generate recommendations
}
```

---

## Phase 5: UI Components

### Step 5.1: Source Master Components

Create: `src/components/sources/SourceMasterList.tsx`
- Lists all source masters
- Shows active version info
- Quick actions: create version, view history

Create: `src/components/sources/SourceMasterDetail.tsx`
- Shows source master metadata
- Version timeline
- Entity assignments

### Step 5.2: Source Version Components

Create: `src/components/sources/SourceVersionList.tsx`
- Timeline view of versions
- Status indicators
- Version comparison tool

Create: `src/components/sources/SourceVersionDetail.tsx`
- Version metadata
- Item list
- Task template summary

Create: `src/components/sources/VersionComparisonView.tsx`
- Side-by-side comparison
- Change highlighting
- Impact summary

Create: `src/components/sources/VersionActivationWizard.tsx`
- Multi-step activation workflow
- Impact review step
- Template migration step
- Confirmation step

### Step 5.3: Task Template Components

Create: `src/components/templates/TaskTemplateList.tsx`
- List templates for a source item
- Filter by status
- Generation statistics

Create: `src/components/templates/TaskTemplateEditor.tsx`
- Template creation/editing form
- Frequency and anchor date pickers
- Entity applicability selector
- Preview generation

Create: `src/components/templates/TemplateGenerationPreview.tsx`
- Shows what tasks would be generated
- Entity-by-entity breakdown
- Date calculations preview

### Step 5.4: Update Existing Components

Update: `src/components/sources/SourceWizard.tsx`
- Change to create SourceMaster + SourceVersion
- Add version metadata fields
- Add effective date picker

Update: `src/components/tasks/TaskDetailModal.tsx`
- Show template info
- Show source version info
- Link to template and version

Update: `src/components/tasks/TaskTrackerClient.tsx`
- Add version filter
- Add template filter

---

## Phase 6: Testing & Validation

### Step 6.1: Unit Tests

Test files to create:

1. `src/services/SourceMasterService.test.ts`
2. `src/services/SourceVersionService.test.ts`
3. `src/services/TaskTemplateService.test.ts`
4. `src/lib/versionActivation.test.ts`
5. `src/lib/taskGeneration.test.ts`

Key test scenarios:

- ✅ Task generation respects effective date
- ✅ Task generation respects anchor date
- ✅ Recurrence calculation with anchor date
- ✅ Version activation supersedes previous
- ✅ Only one active version per master
- ✅ Impact assessment accuracy
- ✅ Template retirement logic

### Step 6.2: Integration Tests

Test scenarios:

1. **Complete version lifecycle**
   - Create source master
   - Create version 1.0
   - Add items
   - Create templates
   - Generate tasks
   - Create version 2.0
   - Compare versions
   - Activate version 2.0
   - Verify version 1.0 superseded

2. **Task generation with dates**
   - Source effective date = 2026-01-01
   - Template anchor date = 2025-12-01
   - Should generate from 2026-01-01 (max of both)

3. **Template retirement**
   - Retire template
   - Verify no new tasks generated
   - Historical tasks remain

### Step 6.3: Manual QA Checklist

- [ ] Create new source master
- [ ] Create version with effective date
- [ ] Add source items
- [ ] Create task templates with frequencies
- [ ] Generate tasks and verify dates
- [ ] Create second version
- [ ] Compare versions (unchanged/modified/new/removed)
- [ ] Review impact assessment
- [ ] Activate new version
- [ ] Verify old version superseded
- [ ] Verify historical tasks unchanged
- [ ] Verify future tasks flagged for review
- [ ] Edit task template
- [ ] Retire task template
- [ ] Verify soft delete works throughout
- [ ] Test audit logging

---

## Rollback Strategy

### If Migration Fails

1. **Restore database from backup**

```bash
./scripts/restore-database.sh <backup-file>
```

2. **Revert schema changes**

```bash
npx prisma migrate reset
```

3. **Checkout previous commit**

```bash
git checkout HEAD~1
```

### If Issues Found After Deployment

1. **Feature flag to disable new features**

Add to `.env`:

```
FEATURE_VERSION_AWARE_SOURCES=false
```

2. **API compatibility layer**

Keep old `/api/sources` endpoints working alongside new endpoints.

3. **Gradual rollout**

- Phase 1: Read-only access to new models
- Phase 2: Create new sources using new model
- Phase 3: Migrate existing sources
- Phase 4: Deprecate old endpoints

---

## Post-Migration Tasks

### Data Cleanup

After successful migration and validation:

1. Drop temporary columns:
   - `Task.tempTaskTemplateId`
   - `Task.tempSourceVersionId`
   - `Task.tempSourceItemVersionId`
   - `Finding.tempSourceVersionId`

2. Drop legacy columns:
   - `Task.sourceId`
   - `Task.sourceItemId`
   - `Finding.sourceId`

3. Drop legacy tables:
   - `Source`
   - `SourceEntity`
   - `SourceItem`

Create migration:

```bash
npx prisma migrate dev --name remove_legacy_source_columns
```

### Documentation Updates

- [ ] Update API documentation
- [ ] Update user guide
- [ ] Create version management guide
- [ ] Create video tutorials
- [ ] Update README

### Performance Optimization

- [ ] Add database indexes based on query patterns
- [ ] Implement caching for active versions
- [ ] Optimize complex joins
- [ ] Add query result pagination

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Schema | 3 days | None |
| Phase 2: Data Migration | 2 days | Phase 1 |
| Phase 3: API Layer | 3 days | Phase 2 |
| Phase 4: Business Logic | 3 days | Phase 3 |
| Phase 5: UI Components | 4 days | Phase 4 |
| Phase 6: Testing | 3 days | Phase 5 |
| **Total** | **18 days** | Sequential |

With parallel work (backend + frontend teams):
- Backend (Phases 1-4): ~10 days
- Frontend (Phase 5): ~4 days (starts after Phase 3)
- Testing (Phase 6): ~3 days
- **Total with parallelization**: ~13 days

---

## Success Metrics

After implementation, verify:

1. **Data Integrity**
   - All existing tasks have template references
   - All existing tasks have version references
   - No orphaned records
   - Historical data unchanged

2. **Functionality**
   - New sources create with version
   - Tasks generate with correct dates
   - Version comparison works
   - Impact assessment accurate
   - Activation workflow completes

3. **Performance**
   - Task generation time < 5% slower than before
   - Version list loads in < 500ms
   - Impact assessment < 2s

4. **User Experience**
   - Users can create versions without confusion
   - Version timeline is clear
   - Impact review is actionable
   - Template management is intuitive

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Data loss during migration | Low | Critical | Mandatory backups, dry runs, staged rollout |
| Performance degradation | Medium | High | Load testing, query optimization, indexes |
| User confusion | High | Medium | Training, documentation, intuitive UI |
| Template generation errors | Medium | High | Comprehensive testing, validation, previews |
| Version conflict bugs | Low | High | Unique constraints, transaction boundaries |

---

## Next Steps

1. **Review this implementation guide**
2. **Get stakeholder approval**
3. **Schedule implementation sprint**
4. **Assign team resources**
5. **Begin Phase 1**

---

## Questions & Clarifications

Before starting implementation, clarify:

1. Should we support importing source versions from external documents?
2. Do we need approval workflow for version activation?
3. Should templates support version inheritance?
4. What's the retention policy for superseded versions?
5. Do we need bulk template operations?

