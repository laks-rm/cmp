# FIX 40: Version-Aware Source and Task Generation Model

**Date**: 2026-03-17  
**Status**: Design & Implementation  
**Priority**: High  
**Impact**: Major architectural enhancement

## Executive Summary

This document describes the design and implementation of a version-aware source management system for CMP. The system enables regulations, policies, and standards to evolve over time while maintaining complete auditability and operational clarity.

## Problem Statement

Current limitations:
1. **No version history**: Sources are edited in place, losing historical context
2. **Frequency misplacement**: Frequency is treated as a source property when it should belong to tasks
3. **No change tracking**: When regulations update, there's no systematic way to assess impact
4. **Audit risk**: Historical tasks lose traceability to the specific source version that created them
5. **No effective date logic**: Tasks can be generated before a source version becomes valid

## Core Design Principles

1. **Frequency belongs to the task, not the source**
2. **Source must be versioned**
3. **Existing history must be preserved**
4. **Future tasks must be reviewed when source changes**
5. **No overwriting sources without traceability**
6. **No backdating tasks before source effective date or task anchor date**

---

## Conceptual Model

### A. Data Objects

#### 1. Source Master (Long-lived regulation/policy family)

Represents the enduring obligation family, not a specific text version.

**Examples:**
- GDPR
- PCI DSS
- MFSA AML Rules
- Internal Compliance Policy

**Attributes:**
- `id`: UUID
- `code`: Unique identifier (e.g., "GDPR", "PCI-DSS")
- `name`: Display name
- `sourceType`: Type from enum
- `issuingAuthorityId`: Reference to issuing authority
- `ownerTeamId`: Responsible team
- `status`: Overall family status (ACTIVE, ARCHIVED)
- `metadata`: JSON for extensibility
- Timestamps and soft delete fields

**Relationships:**
- Has many Source Versions
- Belongs to Team
- Belongs to Issuing Authority (optional)

---

#### 2. Source Version (Time-specific regulation/policy snapshot)

Each regulatory update creates a new version.

**Examples:**
- GDPR v1 effective 2025-01-01
- GDPR v2 effective 2026-03-17
- PCI DSS 4.0 effective 2024-03-31

**Attributes:**
- `id`: UUID
- `sourceMasterId`: Reference to source master
- `versionNumber`: Semantic version or label (e.g., "1.0", "2023.1", "v4")
- `effectiveDate`: Date this version becomes valid
- `expiryDate`: Date this version is superseded (nullable)
- `reviewDate`: When to review this version
- `status`: Version status (DRAFT, ACTIVE, SUPERSEDED, ARCHIVED)
- `changeSummary`: Description of changes from previous version
- `documentUrl`: Link to reference document
- `supersededById`: Reference to newer version
- `supersedesId`: Reference to older version
- Timestamps and soft delete fields

**Relationships:**
- Belongs to Source Master
- Has many Source Item Versions
- Supersedes previous Source Version (optional)
- Superseded by next Source Version (optional)

**Business Rules:**
- Only ONE version can be ACTIVE per Source Master at any time
- `effectiveDate` must be unique per Source Master
- Cannot have overlapping ACTIVE periods
- When version becomes ACTIVE, previous ACTIVE version becomes SUPERSEDED

---

#### 3. Source Item Version (Clause/article/control point)

Specific regulation clauses belong to a specific source version.

**Examples:**
- GDPR Article 5(1)(f)
- PCI DSS Requirement 8.2
- MFSA Rule 12.3

**Attributes:**
- `id`: UUID
- `sourceVersionId`: Reference to source version
- `reference`: Stable reference code (e.g., "Art 5(1)(f)", "Req 8.2")
- `title`: Short title
- `description`: Full content/description
- `parentId`: For hierarchical structures (optional)
- `sortOrder`: Display order
- `changeType`: How this differs from previous version (UNCHANGED, MODIFIED, NEW, REMOVED)
- `previousItemId`: Link to equivalent item in previous version (if applicable)
- `metadata`: JSON for extensibility
- Timestamps

**Relationships:**
- Belongs to Source Version
- Parent-child relationship (self-referential)
- Has many Task Templates
- Links to previous version's equivalent item (optional)

**Business Rules:**
- `reference` should be stable across versions where possible
- `changeType` helps users understand version-to-version differences
- REMOVED items should remain in database for history

---

#### 4. Task Template (Operational task definition)

Defines HOW and WHEN a control activity should occur.

**Frequency lives here, not in the source.**

**Attributes:**
- `id`: UUID
- `sourceItemVersionId`: Reference to source item version
- `name`: Task name
- `description`: Task description
- `expectedOutcome`: What should be achieved
- `frequency`: ADHOC, MONTHLY, QUARTERLY, etc.
- `anchorDate`: First occurrence date for recurrence calculation
- `riskRating`: HIGH, MEDIUM, LOW
- `evidenceRequired`: Boolean
- `narrativeRequired`: Boolean
- `reviewRequired`: Boolean
- `defaultResponsibleTeamId`: Default team assignment
- `defaultPicId`: Default PIC (optional)
- `defaultReviewerId`: Default reviewer (optional)
- `status`: Template status (DRAFT, ACTIVE, RETIRED)
- `retiredReason`: Why template was retired (if applicable)
- `applicableEntities`: JSON array of entity IDs
- `metadata`: JSON for extensibility
- Timestamps and soft delete fields

**Relationships:**
- Belongs to Source Item Version
- Has many Generated Task Instances
- Belongs to Team (default responsible team)

**Business Rules:**
- Template can only generate tasks if status is ACTIVE
- Cannot delete template that has generated tasks (soft delete only)
- Template inherits source version effective date as lower bound for task generation

---

#### 5. Generated Task Instance (Actionable work item)

Actual work created from a task template.

**Attributes:**
- All current Task model fields
- `taskTemplateId`: Reference to task template (REQUIRED)
- `sourceVersionId`: Reference to source version at creation (REQUIRED)
- `sourceItemVersionId`: Reference to source item version at creation (REQUIRED)
- Keep existing: `recurrenceGroupId`, `recurrenceIndex`, `recurrenceTotalCount`
- Keep existing status, dates, assignments, audit fields

**Relationships:**
- Belongs to Task Template
- Belongs to Source Version (snapshot reference)
- Belongs to Source Item Version (snapshot reference)
- Belongs to Entity
- All existing relationships (assignee, PIC, reviewer, team, evidence, comments, findings)

**Business Rules:**
- Task is immutable once created (regarding template/version references)
- Completed tasks NEVER change their source version reference
- `plannedDate` must be >= `max(source version effectiveDate, template anchorDate)`

---

### B. Date and Recurrence Rules

#### 1. Source Effective Date
- Earliest date from which the source version is considered valid
- Used as lower bound for task generation
- Cannot generate tasks before this date

#### 2. Source Review Date
- For reviewing the source/version itself
- Not related to operational task due dates
- Triggers administrative review workflow

#### 3. Task Frequency
- Belongs ONLY to Task Template
- Defines recurrence pattern (DAILY, WEEKLY, MONTHLY, QUARTERLY, etc.)
- Applied during task generation

#### 4. Task Anchor Date
- Belongs to Task Template
- First occurrence date for recurrence calculation
- All future instances calculated from this anchor

#### 5. Task Generation Rule

```
For each generated task instance:
  earliest_valid_date = max(
    source_version.effectiveDate,
    task_template.anchorDate
  )
  
  planned_date >= earliest_valid_date
```

**No backdating allowed.**

---

### C. Source Change Workflow

When a regulation/policy changes:

#### Step 1: Create New Version
1. User creates new Source Version under same Source Master
2. Set `effectiveDate` to when regulation takes effect
3. Set `status` to DRAFT initially
4. Link to previous version via `supersedesId`

#### Step 2: Import/Create Items
1. Import new Source Item Versions
2. For each item, classify as:
   - **UNCHANGED**: Same content as previous version
   - **MODIFIED**: Changed content
   - **NEW**: Didn't exist before
   - **REMOVED**: Existed before but removed
3. Link items to equivalent previous items via `previousItemId`

#### Step 3: Impact Assessment
System analyzes:
1. Task templates linked to MODIFIED or REMOVED items
2. Future planned/to_do tasks from affected templates
3. Count of entities impacted
4. Provides summary report

#### Step 4: User Review & Action
User reviews impact report and decides:
- **Unchanged items**: Keep templates and tasks as-is
- **Modified items**: 
  - Review templates for metadata updates
  - Decide if future tasks need regeneration
- **New items**: 
  - Create new task templates
- **Removed items**: 
  - Retire task templates
  - Cancel or reassign future tasks
  - Historical completed tasks remain untouched

#### Step 5: Activate New Version
1. Set new version status to ACTIVE
2. Set previous version status to SUPERSEDED
3. Set previous version `expiryDate` to new version `effectiveDate`
4. All future task generation uses new ACTIVE version

---

### D. Task Handling on Version Change

| Task State | Action |
|-----------|--------|
| **COMPLETED** | Keep as-is. Never change. Historical record. |
| **IN_PROGRESS, PENDING_REVIEW** | Do not auto-update. Flag for review if source item changed materially. |
| **TO_DO** (due soon) | Do not auto-update. Flag for review if source item changed. |
| **PLANNED** (future) | Candidate for cancellation/regeneration. User decides. |
| **Future recurring generation** | Use ACTIVE source version and ACTIVE templates only. |

---

### E. Implementation Phases

#### Phase 1: Schema Migration & Core Models
1. Create `SourceMaster` model
2. Create `SourceVersion` model
3. Migrate existing `Source` records to `SourceMaster` + `SourceVersion`
4. Create `SourceItemVersion` model (evolve from `SourceItem`)
5. Create `TaskTemplate` model
6. Add `taskTemplateId`, `sourceVersionId` to `Task` model
7. Write comprehensive migration script

#### Phase 2: Task Generation Refactor
1. Update task generation to use Task Templates
2. Enforce effective date + anchor date logic
3. Update recurrence calculation
4. Preserve all existing functionality

#### Phase 3: Version Management UI
1. Source Master list/detail screens
2. Source Version management
3. Version comparison view
4. Impact assessment dashboard

#### Phase 4: Change Workflow
1. New version creation wizard
2. Item import/comparison
3. Impact analysis tools
4. Template retirement workflow

#### Phase 5: Task Template Management
1. Template creation/edit UI
2. Template-to-entity mapping
3. Template preview/testing
4. Template lifecycle management

---

## Migration Strategy

### Data Migration

```sql
-- Step 1: Create SourceMaster records from existing Source records
-- Each unique (code, teamId) becomes a SourceMaster

-- Step 2: Convert existing Source records to SourceVersion
-- Each Source becomes a SourceVersion under its SourceMaster
-- Initial version number: "1.0"
-- Status: ACTIVE if source status was ACTIVE

-- Step 3: Link SourceItems to SourceVersions
-- Rename to SourceItemVersion
-- Add sourceVersionId

-- Step 4: Generate initial TaskTemplates from Tasks
-- Group tasks by (sourceItemId, name, frequency, entity)
-- Create one template per unique group
-- Derive anchorDate from earliest plannedDate in group

-- Step 5: Link existing Tasks to TaskTemplates
-- Add taskTemplateId, sourceVersionId references
```

### Rollback Plan

- Keep old schema columns until migration is verified
- Maintain dual-write capability during transition
- Feature flag for version-aware mode
- Database backup before migration

---

## API Changes

### New Endpoints

```
POST   /api/source-masters                    # Create source master
GET    /api/source-masters                    # List masters
GET    /api/source-masters/:id                # Get master detail
PUT    /api/source-masters/:id                # Update master
DELETE /api/source-masters/:id                # Soft delete master

POST   /api/source-masters/:id/versions       # Create new version
GET    /api/source-masters/:id/versions       # List versions
GET    /api/source-versions/:id               # Get version detail
PUT    /api/source-versions/:id               # Update version
DELETE /api/source-versions/:id               # Soft delete version
POST   /api/source-versions/:id/activate      # Activate version
POST   /api/source-versions/:id/compare/:otherId  # Compare versions

POST   /api/source-versions/:id/items         # Create item version
GET    /api/source-versions/:id/items         # List items
GET    /api/source-item-versions/:id          # Get item detail
PUT    /api/source-item-versions/:id          # Update item
DELETE /api/source-item-versions/:id          # Soft delete item

POST   /api/source-item-versions/:id/templates  # Create task template
GET    /api/source-item-versions/:id/templates  # List templates
GET    /api/task-templates/:id                # Get template detail
PUT    /api/task-templates/:id                # Update template
DELETE /api/task-templates/:id                # Retire template
POST   /api/task-templates/:id/generate       # Generate tasks from template

GET    /api/source-versions/:id/impact        # Impact assessment
POST   /api/source-versions/:id/migrate-tasks # Migrate future tasks to new version
```

### Modified Endpoints

```
GET    /api/tasks/:id                         # Add template & version info
POST   /api/tasks                             # Must reference taskTemplateId
```

---

## UI Guidance

### Source Master Screen
- Shows list of source families (GDPR, PCI DSS, etc.)
- For each master, display:
  - Active version number and effective date
  - Count of historical versions
  - Status indicator
  - Quick actions: Create new version, View history

### Source Version Screen
- Shows all versions of a source master
- Timeline view showing effective dates
- Version comparison tool
- Impact metrics:
  - Items added/modified/removed
  - Task templates affected
  - Future tasks affected
  - Entities impacted

### Task Template Screen
- Clearly shows linked source version
- Displays frequency and anchor date
- Shows generation statistics:
  - Total tasks generated
  - Active tasks
  - Completed tasks
- Template lifecycle status

### Version Change Impact Panel
- Shown when new version is created/activated
- Sections:
  - **New Items**: List + "Create templates" action
  - **Modified Items**: List + "Review templates" action
  - **Removed Items**: List + "Retire templates" action
  - **Task Templates Requiring Review**: Count + list
  - **Future Tasks Requiring Action**: Count + list

---

## Success Criteria

✅ Sources can change over time without losing history  
✅ Frequency is a task-level concept  
✅ Source effective/review dates separate from task due dates  
✅ Generated tasks are traceable to exact source version  
✅ Completed tasks preserve historical truth  
✅ Future tasks can be reviewed and updated when source changes  
✅ No backdated task generation  
✅ Clear indication of which version is currently active  

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Complex migration breaks existing data | HIGH | Comprehensive testing, rollback plan, staged rollout |
| Performance degradation from joins | MEDIUM | Proper indexing, query optimization, caching |
| User confusion with new concepts | MEDIUM | Clear UI/UX, training, documentation |
| Existing integrations break | MEDIUM | API versioning, backward compatibility layer |
| Data inconsistencies | HIGH | Transaction boundaries, constraints, validation |

---

## Testing Strategy

### Unit Tests
- Task generation respects effective dates
- Recurrence calculation with anchor dates
- Version activation/supersession logic
- Change type detection algorithm

### Integration Tests
- End-to-end version creation workflow
- Task generation from templates
- Impact assessment accuracy
- Migration script correctness

### Manual Tests
- UI workflows for version management
- Task template creation and editing
- Version comparison and impact review
- Historical data integrity

---

## Implementation Checklist

- [ ] Phase 1: Schema design and migration script
- [ ] Phase 1: Create Prisma models
- [ ] Phase 1: Write and test migration
- [ ] Phase 1: Add indexes and constraints
- [ ] Phase 2: Refactor task generation logic
- [ ] Phase 2: Update recurrence calculation
- [ ] Phase 2: Add template-based generation
- [ ] Phase 3: Build source master UI
- [ ] Phase 3: Build version management UI
- [ ] Phase 3: Build version comparison UI
- [ ] Phase 4: Implement version creation workflow
- [ ] Phase 4: Build impact assessment
- [ ] Phase 4: Add template migration tools
- [ ] Phase 5: Build task template UI
- [ ] Phase 5: Add template testing features
- [ ] Testing: Unit tests
- [ ] Testing: Integration tests
- [ ] Testing: Manual QA
- [ ] Documentation: API documentation
- [ ] Documentation: User guide
- [ ] Documentation: Migration guide

---

## Next Steps

1. Review and approve this design document
2. Create database migration script
3. Implement Phase 1 (schema changes)
4. Run migration on test environment
5. Implement Phase 2 (task generation)
6. Build Phase 3 (basic UI)
7. Iterate and expand functionality

---

## Questions for Review

1. Should we support multiple active versions simultaneously (for different jurisdictions)?
2. How far back should version history be retained?
3. Should templates inherit metadata from previous versions automatically?
4. What approval workflow is needed for version activation?
5. Should we version task templates themselves?

---

## References

- Current schema: `cmp-app/prisma/schema.prisma`
- Current task generation: `cmp-app/src/app/api/sources/[id]/generate/route.ts`
- Current task activation: `cmp-app/src/lib/taskActivation.ts`
