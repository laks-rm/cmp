# Controlled Source Editing Implementation

## Overview

Implemented safe source editing capability with entity applicability management and downstream impact awareness. Users can now edit existing sources, add/remove entities, and optionally generate tasks for newly added entities without disturbing existing task history.

## Key Principle

**Source editing is separate from task template editing.**
- Source editing = governance scope (what entities, which authority, source metadata)
- Task template editing = execution metadata (frequency, risk, team assignments)

## Implementation Summary

### 1. Enhanced Validation Schema

**File**: `src/lib/validations/sources.ts`

```typescript
export const editSourceMetadataSchema = z.object({
  name: z.string().min(1).max(255).trim().optional(),
  code: z.string().min(1).max(50).trim().optional(),
  sourceType: z.enum([...]).optional(),
  issuingAuthorityId: z.string().uuid().optional().nullable(),
  effectiveDate: z.string().datetime().optional().nullable(),
  reviewDate: z.string().datetime().optional().nullable(),
  entityIds: z.array(z.string().uuid()).min(1).optional(),
  generateTasksForNewEntities: z.boolean().default(false),
});

export const generateForEntitiesSchema = z.object({
  sourceId: z.string().uuid(),
  entityIds: z.array(z.string().uuid()).min(1),
});
```

### 2. Conservative Source Update API

**Endpoint**: `PATCH /api/sources/[id]`
**File**: `src/app/api/sources/[id]/route.ts`

#### Behavior:

**Metadata-only updates**: Applied immediately
- Source name, code, type
- Issuing authority
- Effective/review dates

**Entity additions**: Impact summary returned, no auto-generation
- Detects newly added entities
- Calculates impact estimate:
  - Number of source items
  - Estimated task templates
  - Total tasks to be generated
- Returns response with `impactSummary`
- Does NOT automatically generate tasks
- User chooses next action

**Entity removals**: Warning returned, history preserved
- Detects removed entities
- Counts existing tasks for those entities
- Returns warning message
- Historical tasks remain intact (not deleted)
- Tasks just become "out of scope" but traceable

#### Response Format:

```json
{
  "source": { ...updatedSource },
  "impactSummary": {
    "addedEntities": [{ "id": "...", "code": "DIEL", "name": "..." }],
    "sourceItemCount": 25,
    "estimatedTaskTemplates": 15,
    "estimatedTotalTasks": 15,
    "message": "New entity will be added to source..."
  },
  "removedEntityWarnings": {
    "removedEntities": [...],
    "existingTaskCount": 42,
    "warning": "42 existing tasks will remain but out of scope..."
  },
  "message": "Source updated successfully"
}
```

### 3. Targeted Task Generation API

**Endpoint**: `POST /api/sources/[id]/generate-for-entities`
**File**: `src/app/api/sources/[id]/generate-for-entities/route.ts`

#### Purpose:
Generate tasks ONLY for newly added entities without touching existing entities.

#### How It Works:

1. **Verify Entities**: Checks that requested entities are linked to source
2. **Check Existing Tasks**: Prevents regeneration if tasks already exist for those entities
3. **Infer Templates**: Reads task definitions from existing tasks of other entities
4. **Generate Tasks**: Creates task instances only for new entities
5. **Respect Current Date**: No historical backfill (starts from current/future dates)

#### Safety Checks:

```typescript
// Prevents accidental regeneration
const existingTasksCount = await prisma.task.count({
  where: {
    sourceId,
    entityId: { in: entityIds },
    deletedAt: null,
  },
});

if (existingTasksCount > 0) {
  return NextResponse.json({
    error: "Tasks already exist for requested entities",
    existingTasksCount,
  }, { status: 409 });
}
```

#### Request/Response:

```json
// Request
POST /api/sources/{sourceId}/generate-for-entities
{
  "entityIds": ["new-entity-uuid"]
}

// Response
{
  "success": true,
  "message": "Generated 156 tasks for 1 entity",
  "tasksCreated": 156,
  "entityIds": ["new-entity-uuid"],
  "warnings": ["3 tasks kept as PLANNED due to missing team..."]
}
```

### 4. Source Edit Modal Component

**File**: `src/components/sources/SourceEditModal.tsx`

#### Features:

**Two-Screen Flow:**

**Screen 1: Edit Form**
- Source metadata editing (name, code, type, authority, dates)
- Entity selection with visual indicators:
  - Green "NEW" badge for added entities
  - Red "REMOVE" badge for removed entities
- Change summary at bottom
- Clear separation between safe edits and impactful changes

**Screen 2: Impact Preview** (shown if entities added)
- Summary of changes
- Newly added entities with badges
- Impact estimate cards:
  - Source items count
  - Task templates count
  - Total tasks estimate (~)
- Important notes:
  - Existing entity history untouched
  - Tasks only for new entities
  - No historical backfill
  - Can skip generation
- Action buttons:
  - "Skip Task Generation" (just save source changes)
  - "Generate Tasks Now" (proceed with task creation)

#### UX Principles:

1. **Explicit Intent**: User must confirm task generation
2. **No Surprises**: Clear impact preview before operations
3. **Reversibility**: Can save source without generating tasks
4. **Visibility**: Color-coded entity changes

### 5. Integration with SourcesClient

**File**: `src/components/sources/SourcesClient.tsx`

Added Edit button to each source card:

```tsx
<button onClick={() => handleEditSource(source)}>
  <Edit2 size={16} />
</button>
```

Modal triggered on click, with callbacks for success/close.

## User Flow Example

### Scenario: Add New Entity to Existing Source

1. **User clicks Edit** on GDPR source card
2. **Edit modal opens** showing current metadata and entities
3. **User selects new entity** (e.g., adds "DBVI")
   - Green "NEW" badge appears on DBVI
   - Change summary updates: "1 entity will be added..."
4. **User clicks "Save Changes"**
5. **Impact preview screen appears**:
   - Shows DBVI will be added
   - Displays: 25 source items, 15 task templates, ~15 total tasks
   - Notes that existing entities (DIEL, DGL) are unchanged
6. **User chooses action**:
   - Option A: "Skip Task Generation" → Source updated, no tasks created yet
   - Option B: "Generate Tasks Now" → Tasks created for DBVI only
7. **Success toast** appears with summary
8. **Modal closes**, source list refreshes

## API Safety Features

### 1. Entity Change Detection

```typescript
const oldEntityIds = new Set(sourceEntityIds);
const newEntityIds = new Set(validatedData.entityIds);

const addedEntityIds = validatedData.entityIds 
  ? validatedData.entityIds.filter((id) => !oldEntityIds.has(id))
  : [];

const removedEntityIds = Array.from(oldEntityIds)
  .filter((id) => !newEntityIds.has(id));
```

### 2. Access Control Verification

```typescript
// User must have access to all entities being added
const hasAccessToNewEntities = addedEntityIds.every((id) =>
  session.user.entityIds.includes(id)
);

if (!hasAccessToNewEntities) {
  return NextResponse.json({ error: "Access denied" }, { status: 403 });
}
```

### 3. Historical Preservation

```typescript
// Entity removal does NOT delete tasks
if (removedEntityIds.length > 0) {
  const tasksForRemovedEntities = await prisma.task.count({
    where: {
      sourceId,
      entityId: { in: removedEntityIds },
      deletedAt: null,
    },
  });
  
  // Return warning but complete save
  removedEntityWarnings = {
    removedEntities,
    existingTaskCount,
    warning: "Tasks will remain but no longer in source scope"
  };
}
```

### 4. Duplicate Prevention

```typescript
// Check if tasks already exist before generating
const existingTasksCount = await prisma.task.count({
  where: {
    sourceId,
    entityId: { in: entityIds },
    deletedAt: null,
  },
});

if (existingTasksCount > 0) {
  return NextResponse.json({
    error: "Tasks already exist. Will not regenerate.",
    existingTasksCount,
  }, { status: 409 });
}
```

## Audit Logging

Comprehensive audit trail for all source edits:

### Event Types:

1. **SOURCE_METADATA_UPDATED**
   - Tracks which fields were changed
   - Captures old and new entity lists

2. **SOURCE_ENTITY_ADDED**
   - Lists added entity IDs
   - Includes impact summary

3. **SOURCE_ENTITY_REMOVED**
   - Lists removed entity IDs
   - Includes task count warning

4. **TASKS_GENERATED_FOR_ENTITIES**
   - Entity IDs for which tasks were generated
   - Number of tasks created
   - Source items processed

### Example Audit Log:

```typescript
await logAuditEvent({
  action: "SOURCE_ENTITY_ADDED",
  module: "SOURCES",
  userId: session.user.userId,
  targetType: "Source",
  targetId: sourceId,
  details: {
    addedEntityIds: ["entity-uuid"],
    impactSummary: { ... }
  },
});
```

## What's NOT Included (By Design)

### Out of Scope:

1. **Task Template Editing**: Use separate task template editing feature
2. **Frequency Changes**: Not part of source governance
3. **Recurrence Anchor Changes**: Handled in task template editor
4. **Source Versioning**: Full version control is future enhancement
5. **Automatic Regeneration**: Never automatic, always explicit user action
6. **Historical Backfill**: New entities start from current/future dates only

## Testing Scenarios

### 1. Simple Metadata Edit
- Change source name
- Update effective date
- Verify no task impact
- Check audit log

### 2. Add Entity Without Task Generation
- Add new entity
- View impact preview
- Click "Skip Task Generation"
- Verify source updated but no new tasks

### 3. Add Entity With Task Generation
- Add new entity
- View impact preview
- Click "Generate Tasks Now"
- Verify tasks created only for new entity
- Check existing entity tasks untouched

### 4. Remove Entity
- Remove entity from source
- Verify warning shown
- Check tasks remain in database
- Verify tasks marked as "out of scope" conceptually

### 5. Add Multiple Entities
- Select 3 new entities
- Verify impact shows total across all
- Generate tasks
- Verify correct task count

### 6. Prevent Duplicate Generation
- Add entity
- Generate tasks
- Try to generate again
- Verify 409 Conflict error

## File Checklist

### Created/Modified Files:

✅ `src/lib/validations/sources.ts` - Enhanced validation schemas
✅ `src/app/api/sources/[id]/route.ts` - Conservative PATCH with impact detection
✅ `src/app/api/sources/[id]/generate-for-entities/route.ts` - Targeted task generation
✅ `src/components/sources/SourceEditModal.tsx` - Two-screen edit + impact flow
✅ `src/components/sources/SourcesClient.tsx` - Edit button integration

### No Schema Changes Required:

- Uses existing `sourceId`, `entityId`, `recurrenceGroupId` fields
- No migrations needed
- Backward compatible

## Success Criteria

| Criterion | Status |
|-----------|--------|
| User can edit source metadata safely | ✅ |
| User can add entities to existing source | ✅ |
| Entity additions show impact preview | ✅ |
| Task generation is optional and explicit | ✅ |
| Existing entity tasks remain untouched | ✅ |
| Historical data preserved on removal | ✅ |
| No automatic/hidden regeneration | ✅ |
| Audit logging comprehensive | ✅ |
| Access control enforced | ✅ |
| Duplicate generation prevented | ✅ |
| Separate from task template editing | ✅ |
| No schema redesign required | ✅ |

## Implementation Notes

### Conservative Design Decisions:

1. **No Auto-Generation**: User must explicitly confirm task generation
2. **No Historical Backfill**: Tasks start from current date forward
3. **No Destructive Removal**: Entity removal preserves task history
4. **No Silent Changes**: All impacts shown in preview
5. **No Mixed Concerns**: Source editing stays separate from task editing

### Performance Considerations:

- Impact calculation uses efficient counting queries
- Task generation uses batch insert (`createMany`)
- Template inference reads from existing tasks (no N+1 queries)
- Entity changes detected with Set operations (O(n) complexity)

### Security:

- Session-based authentication
- Permission checks on all endpoints
- Entity access validation for additions
- No unauthorized entity linking
- Audit trail for compliance

## Future Enhancements

Potential additions (not in current scope):

1. **Source Versioning**: Full version control with history tracking
2. **Bulk Entity Operations**: Add/remove multiple sources at once
3. **Task Template Preview**: Show exact tasks before generation
4. **Backfill Option**: Allow historical task generation with consent
5. **Entity Mapping**: Auto-map tasks when entities change
6. **Change Preview**: Diff view before/after entity changes
7. **Rollback**: Undo recent source edits
8. **Impact Simulation**: "What-if" analysis before committing

---

## Quick Reference

### Add Entity to Source:
```
1. Click Edit on source card
2. Select new entity
3. Click Save Changes
4. Review impact preview
5. Choose: Skip or Generate Tasks
```

### Edit Source Metadata:
```
1. Click Edit on source card
2. Update name, dates, etc.
3. Click Save Changes
4. Done (no impact preview if no entity changes)
```

### Remove Entity:
```
1. Click Edit on source card
2. Deselect entity
3. Click Save Changes
4. Read warning about existing tasks
5. Confirm save
```

---

**Implementation Complete**: Controlled source editing with safe entity management and explicit downstream impact handling.
