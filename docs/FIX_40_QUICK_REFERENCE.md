# FIX 40: Quick Reference Guide

**Version-Aware Sources Quick Reference for Developers**

---

## Core Concepts

### Before FIX 40 ❌

```
Source (single record, edited in place)
  └─ SourceItem (clauses)
       └─ Task (generated work)
            - Contains frequency (WRONG!)
            - No version tracking
            - No historical linkage
```

### After FIX 40 ✅

```
SourceMaster (regulation family)
  └─ SourceVersion (time-specific version)
       ├─ SourceItemVersion (versioned clauses)
       │    └─ TaskTemplate (operational definition)
       │         ├─ Contains frequency (CORRECT!)
       │         ├─ Contains anchor date
       │         └─ Task (generated instances)
       │              ├─ Links to template
       │              ├─ Links to version (snapshot)
       │              └─ Immutable version reference
       └─ SourceVersionEntity (applicability)
```

---

## Key Principles

1. **Frequency belongs to TaskTemplate, not Source**
2. **Source versions are immutable once active**
3. **Tasks keep snapshot references to version at creation**
4. **No task generated before max(version.effectiveDate, template.anchorDate)**
5. **Only one ACTIVE version per SourceMaster at a time**

---

## Common Operations

### 1. Create a New Regulation

```typescript
// Step 1: Create SourceMaster
const master = await prisma.sourceMaster.create({
  data: {
    code: "GDPR",
    name: "General Data Protection Regulation",
    sourceType: "REGULATION",
    ownerTeamId: teamId,
    status: "ACTIVE"
  }
});

// Step 2: Create First Version
const version = await prisma.sourceVersion.create({
  data: {
    sourceMasterId: master.id,
    versionNumber: "1.0",
    effectiveDate: new Date("2025-01-01"),
    status: "DRAFT",
    changeSummary: "Initial version"
  }
});

// Step 3: Add Items
const item = await prisma.sourceItemVersion.create({
  data: {
    sourceVersionId: version.id,
    reference: "Art 5(1)(f)",
    title: "Integrity and confidentiality",
    description: "Processed in a manner that ensures...",
    changeType: "NEW"
  }
});

// Step 4: Create Task Template (Frequency lives here!)
const template = await prisma.taskTemplate.create({
  data: {
    sourceItemVersionId: item.id,
    name: "Review data security measures",
    frequency: "QUARTERLY",  // ← Frequency here!
    anchorDate: new Date("2025-03-31"),  // ← First occurrence
    riskRating: "HIGH",
    evidenceRequired: true,
    status: "ACTIVE"
  }
});

// Step 5: Generate Tasks
const tasks = await generateTasksFromTemplate(template.id, [entityId]);
```

---

### 2. Create a New Version (Regulation Update)

```typescript
// Step 1: Create new version
const newVersion = await prisma.sourceVersion.create({
  data: {
    sourceMasterId: existingMaster.id,
    versionNumber: "2.0",
    effectiveDate: new Date("2026-06-01"),
    reviewDate: new Date("2027-06-01"),
    status: "DRAFT",
    changeSummary: "Updated data retention requirements",
    supersedesId: currentActiveVersion.id  // Link to previous
  }
});

// Step 2: Import items from previous version + changes
// Mark each item with changeType:
// - UNCHANGED: Copy from previous, link via previousItemId
// - MODIFIED: New item, link to previous via previousItemId
// - NEW: Brand new item, no previousItemId
// - REMOVED: Don't create new item, old one remains in old version

await prisma.sourceItemVersion.create({
  data: {
    sourceVersionId: newVersion.id,
    reference: "Art 5(1)(f)",
    title: "Integrity and confidentiality - UPDATED",
    description: "New requirements...",
    changeType: "MODIFIED",
    previousItemId: oldItemId  // Link to previous version
  }
});

// Step 3: Review impact
const impact = await analyzeVersionImpact(newVersion.id);
// Returns:
// - items: { new: 5, modified: 12, removed: 2, unchanged: 45 }
// - affectedTemplates: 12
// - affectedFutureTasks: 156
// - entitiesImpacted: 8

// Step 4: Migrate/update templates as needed
// User reviews each MODIFIED or REMOVED item
// Decides to:
// - Keep template as-is
// - Update template metadata
// - Retire template
// - Create new template

// Step 5: Activate new version
await activateSourceVersion(newVersion.id, userId);
// This automatically:
// - Sets newVersion.status = ACTIVE
// - Sets oldVersion.status = SUPERSEDED
// - Sets oldVersion.expiryDate = newVersion.effectiveDate
```

---

### 3. Generate Tasks from Template

```typescript
async function generateTasksFromTemplate(
  templateId: string,
  entityIds: string[]
): Promise<Task[]> {
  const template = await prisma.taskTemplate.findUnique({
    where: { id: templateId },
    include: {
      sourceItemVersion: {
        include: {
          sourceVersion: true
        }
      }
    }
  });

  // Calculate recurrence instances
  const instances = calculateRecurrenceInstances(
    template.frequency,
    template.anchorDate,
    template.sourceItemVersion.sourceVersion.effectiveDate
  );

  // Create tasks
  const tasks = [];
  for (const entityId of entityIds) {
    for (const instance of instances) {
      tasks.push({
        taskTemplateId: template.id,
        sourceVersionId: template.sourceItemVersion.sourceVersionId,
        sourceItemVersionId: template.sourceItemVersionId,
        name: template.name,
        frequency: template.frequency,
        plannedDate: instance.plannedDate,
        dueDate: instance.plannedDate,
        entityId,
        riskRating: template.riskRating,
        status: shouldActivateTask(instance.plannedDate) ? "TO_DO" : "PLANNED",
        // ... other fields from template
      });
    }
  }

  return await prisma.task.createMany({ data: tasks });
}

function calculateRecurrenceInstances(
  frequency: Frequency,
  anchorDate: Date,
  sourceEffectiveDate: Date
): RecurrenceInstance[] {
  // CRITICAL RULE: No task before max(anchorDate, effectiveDate)
  const earliestValidDate = max(anchorDate, sourceEffectiveDate);
  
  const instances = [];
  let currentDate = anchorDate;
  
  while (instances.length < getInstanceCount(frequency)) {
    if (currentDate >= earliestValidDate) {
      instances.push({
        index: instances.length + 1,
        plannedDate: currentDate,
        quarter: getQuarter(currentDate)
      });
    }
    currentDate = addInterval(currentDate, frequency);
  }
  
  return instances;
}
```

---

### 4. Query Tasks with Version Context

```typescript
// Get task with full version lineage
const task = await prisma.task.findUnique({
  where: { id: taskId },
  include: {
    taskTemplate: {
      include: {
        sourceItemVersion: {
          include: {
            sourceVersion: {
              include: {
                sourceMaster: true
              }
            }
          }
        }
      }
    }
  }
});

// Display to user:
// Task: "Review data security measures"
// From: GDPR v2.0 (effective 2026-06-01)
// Article: Art 5(1)(f) - Integrity and confidentiality
// Template: [link to template]
// Frequency: Quarterly (from template)
// Due: 2026-09-30 (Q3 2026)
```

---

### 5. Find Active Version of a Source

```typescript
const activeVersion = await prisma.sourceVersion.findFirst({
  where: {
    sourceMasterId: masterId,
    status: "ACTIVE"
  },
  include: {
    items: true,
    entities: true
  }
});
```

---

### 6. Compare Two Versions

```typescript
interface VersionComparison {
  oldVersion: SourceVersion;
  newVersion: SourceVersion;
  changes: {
    new: SourceItemVersion[];
    modified: SourceItemVersion[];
    removed: SourceItemVersion[];
    unchanged: SourceItemVersion[];
  };
  templateImpact: {
    template: TaskTemplate;
    itemChangeType: SourceItemChangeType;
    futureTasks: number;
  }[];
}

async function compareVersions(
  oldVersionId: string,
  newVersionId: string
): Promise<VersionComparison> {
  const [oldVersion, newVersion] = await Promise.all([
    prisma.sourceVersion.findUnique({
      where: { id: oldVersionId },
      include: { items: true }
    }),
    prisma.sourceVersion.findUnique({
      where: { id: newVersionId },
      include: { items: true }
    })
  ]);

  const changes = categorizeChanges(oldVersion.items, newVersion.items);
  const templateImpact = await assessTemplateImpact(changes);

  return { oldVersion, newVersion, changes, templateImpact };
}
```

---

## Database Queries

### Most Common Queries

```sql
-- Get active version for a source
SELECT sv.* FROM "SourceVersion" sv
JOIN "SourceMaster" sm ON sv."sourceMasterId" = sm.id
WHERE sm.code = 'GDPR'
  AND sv.status = 'ACTIVE';

-- Get all templates for a source version
SELECT tt.* FROM "TaskTemplate" tt
JOIN "SourceItemVersion" siv ON tt."sourceItemVersionId" = siv.id
WHERE siv."sourceVersionId" = '<version-id>'
  AND tt.status = 'ACTIVE';

-- Get tasks generated from a template
SELECT t.* FROM "Task" t
WHERE t."taskTemplateId" = '<template-id>'
  AND t."deletedAt" IS NULL
ORDER BY t."plannedDate" ASC;

-- Get version history for a source master
SELECT sv.* FROM "SourceVersion" sv
WHERE sv."sourceMasterId" = '<master-id>'
ORDER BY sv."effectiveDate" DESC;

-- Find templates affected by version change
SELECT DISTINCT tt.* FROM "TaskTemplate" tt
JOIN "SourceItemVersion" siv ON tt."sourceItemVersionId" = siv.id
WHERE siv."sourceVersionId" = '<old-version-id>'
  AND siv."changeType" IN ('MODIFIED', 'REMOVED')
  AND tt.status = 'ACTIVE';

-- Count future tasks affected by template change
SELECT 
  tt.id as template_id,
  tt.name,
  COUNT(t.id) as future_task_count
FROM "TaskTemplate" tt
LEFT JOIN "Task" t ON t."taskTemplateId" = tt.id
WHERE tt."sourceItemVersionId" IN (
  SELECT id FROM "SourceItemVersion"
  WHERE "sourceVersionId" = '<new-version-id>'
    AND "changeType" IN ('MODIFIED', 'REMOVED')
)
  AND t.status IN ('PLANNED', 'TO_DO')
  AND t."plannedDate" > NOW()
GROUP BY tt.id, tt.name;
```

---

## API Endpoints

### New Endpoints

```
# Source Master
GET    /api/source-masters              # List all masters
POST   /api/source-masters              # Create master
GET    /api/source-masters/:id          # Get master detail
PUT    /api/source-masters/:id          # Update master
DELETE /api/source-masters/:id          # Delete master

# Source Version
GET    /api/source-masters/:id/versions # List versions
POST   /api/source-masters/:id/versions # Create version
GET    /api/source-versions/:id         # Get version
PUT    /api/source-versions/:id         # Update version
DELETE /api/source-versions/:id         # Delete version
POST   /api/source-versions/:id/activate # Activate version
GET    /api/source-versions/:id/compare/:otherId # Compare

# Source Item Version
GET    /api/source-versions/:id/items   # List items
POST   /api/source-versions/:id/items   # Create item
GET    /api/source-item-versions/:id    # Get item
PUT    /api/source-item-versions/:id    # Update item
DELETE /api/source-item-versions/:id    # Delete item

# Task Template
GET    /api/source-item-versions/:id/templates # List templates
POST   /api/source-item-versions/:id/templates # Create template
GET    /api/task-templates/:id          # Get template
PUT    /api/task-templates/:id          # Update template
DELETE /api/task-templates/:id          # Retire template
POST   /api/task-templates/:id/generate # Generate tasks

# Impact Assessment
GET    /api/source-versions/:id/impact  # Get impact
```

---

## TypeScript Types

```typescript
// SourceMaster
interface SourceMaster {
  id: string;
  code: string;
  name: string;
  sourceType: SourceType;
  issuingAuthorityId: string | null;
  ownerTeamId: string;
  status: SourceMasterStatus;
  versions?: SourceVersion[];
}

// SourceVersion
interface SourceVersion {
  id: string;
  sourceMasterId: string;
  versionNumber: string;
  effectiveDate: Date;
  expiryDate: Date | null;
  reviewDate: Date | null;
  status: SourceVersionStatus;
  changeSummary: string | null;
  supersedesId: string | null;
  supersededById: string | null;
  items?: SourceItemVersion[];
}

// SourceItemVersion
interface SourceItemVersion {
  id: string;
  sourceVersionId: string;
  reference: string;
  title: string;
  description: string | null;
  parentId: string | null;
  changeType: SourceItemChangeType;
  previousItemId: string | null;
  templates?: TaskTemplate[];
}

// TaskTemplate
interface TaskTemplate {
  id: string;
  sourceItemVersionId: string;
  name: string;
  frequency: Frequency;  // ← Key: frequency here!
  anchorDate: Date;      // ← Key: anchor date here!
  riskRating: RiskRating;
  evidenceRequired: boolean;
  narrativeRequired: boolean;
  reviewRequired: boolean;
  status: TaskTemplateStatus;
}

// Task (enhanced)
interface Task {
  id: string;
  taskTemplateId: string;        // ← New
  sourceVersionId: string;        // ← New
  sourceItemVersionId: string;    // ← New
  // ... all existing fields
}
```

---

## Common Mistakes to Avoid

### ❌ DON'T: Edit source version in place

```typescript
// WRONG - loses history
await prisma.sourceVersion.update({
  where: { id: existingVersionId },
  data: { 
    changeSummary: "Updated requirements"  // This loses history!
  }
});
```

### ✅ DO: Create new version

```typescript
// CORRECT - preserves history
const newVersion = await prisma.sourceVersion.create({
  data: {
    sourceMasterId: master.id,
    versionNumber: "2.0",
    supersedesId: existingVersionId,
    // ... other fields
  }
});
```

---

### ❌ DON'T: Put frequency in source

```typescript
// WRONG - frequency doesn't belong to source
const source = {
  code: "GDPR",
  frequency: "QUARTERLY"  // ❌ NO!
};
```

### ✅ DO: Put frequency in task template

```typescript
// CORRECT - frequency belongs to template
const template = {
  sourceItemVersionId: itemId,
  frequency: "QUARTERLY",  // ✅ YES!
  anchorDate: new Date("2026-03-31")
};
```

---

### ❌ DON'T: Generate tasks before effective date

```typescript
// WRONG - can generate backdated tasks
const instances = calculateInstances(
  frequency,
  new Date("2025-01-01")  // Anchor before effective date
);
// Could generate tasks before source is valid!
```

### ✅ DO: Enforce effective date as lower bound

```typescript
// CORRECT - respects effective date
const instances = calculateInstances(
  frequency,
  template.anchorDate,
  sourceVersion.effectiveDate  // Pass effective date
);
// Implementation ensures: plannedDate >= max(anchor, effective)
```

---

### ❌ DON'T: Update completed tasks when version changes

```typescript
// WRONG - changes historical record
await prisma.task.updateMany({
  where: {
    sourceVersionId: oldVersionId,
    status: "COMPLETED"
  },
  data: {
    sourceVersionId: newVersionId  // ❌ Breaks audit trail!
  }
});
```

### ✅ DO: Leave completed tasks unchanged

```typescript
// CORRECT - completed tasks keep original version reference
// Only update PLANNED/TO_DO tasks if necessary
await prisma.task.updateMany({
  where: {
    sourceVersionId: oldVersionId,
    status: "PLANNED",
    plannedDate: { gte: newVersion.effectiveDate }
  },
  data: {
    // Maybe update, but with user review
  }
});
```

---

## Testing Checklist

When implementing version-aware features:

- [ ] Task generation respects effective date
- [ ] Task generation respects anchor date
- [ ] No tasks generated before max(effective, anchor)
- [ ] Only one active version per master
- [ ] Version activation supersedes previous
- [ ] Completed tasks never change version reference
- [ ] Template retirement prevents future generation
- [ ] Historical tasks remain linked to original version
- [ ] Impact assessment is accurate
- [ ] Version comparison shows all changes
- [ ] Soft delete works for all models
- [ ] Audit logging captures all changes

---

## Troubleshooting

### Problem: Tasks generating before source effective date

**Cause**: Anchor date is before effective date, and logic doesn't enforce max().

**Fix**: Update `calculateRecurrenceInstances()` to enforce:

```typescript
const earliestValidDate = max(anchorDate, effectiveDate);
// Only include instances >= earliestValidDate
```

---

### Problem: Multiple active versions

**Cause**: Version activation didn't supersede previous version.

**Fix**: Ensure `activateSourceVersion()` atomically:
1. Sets new version to ACTIVE
2. Sets old version to SUPERSEDED
3. Sets old version expiryDate

---

### Problem: Orphaned tasks after migration

**Cause**: Tasks couldn't be matched to templates during migration.

**Fix**: Create fallback templates for orphaned tasks (see migration guide).

---

### Problem: Template changes affect historical tasks

**Cause**: Using template fields directly instead of task snapshot fields.

**Fix**: Tasks should copy template fields at generation time. Never read from template for historical tasks.

---

## Further Reading

- Full design: `docs/FIX_40_VERSION_AWARE_SOURCES.md`
- Migration guide: `docs/FIX_40_MIGRATION_GUIDE.md`
- Schema design: `docs/FIX_40_SCHEMA_DESIGN.prisma`

---

## Summary

**Remember the three core rules:**

1. **Frequency belongs to TaskTemplate** (not Source)
2. **Versions are immutable snapshots** (create new, don't edit)
3. **Tasks lock to version at creation** (never update historical version references)

**Golden rule for task generation:**

```
plannedDate >= max(sourceVersion.effectiveDate, taskTemplate.anchorDate)
```

