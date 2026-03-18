# Fix: Recurrence Group Missing on Single-Instance Recurring Tasks

## Issue Description

**Error**: `Error: Not found` when attempting to edit recurring task templates through `/sources/{id}/tasks`.

**Root Causes** (Two separate issues):

1. **Missing Recurrence Group IDs**: Tasks with a non-ADHOC frequency (MONTHLY, QUARTERLY, etc.) but only one generated instance were incorrectly assigned `recurrenceGroupId = null` during task generation.

2. **Soft-Deleted Tasks Visible in UI**: The `/api/tasks` endpoint was not filtering out soft-deleted tasks (`deletedAt IS NOT NULL`), causing the UI to display deleted recurrence groups that couldn't be edited.

## Technical Details

### Original Flawed Logic

In both `/api/sources/[id]/generate/route.ts` and `/api/sources/[id]/generate-for-entities/route.ts`:

```typescript
// ❌ WRONG: Only assigns recurrenceGroupId if multiple instances exist
recurrenceGroupId: instances.length > 1 ? recurrenceGroupId : null,
recurrenceIndex: instances.length > 1 ? instance.index : null,
recurrenceTotalCount: instances.length > 1 ? instance.totalCount : null,
```

**Why This is Wrong**:
- A task with `frequency: 'MONTHLY'` is conceptually a recurring task template, regardless of how many instances are generated
- Instance count depends on date constraints (source effective date, calculation window)
- A task near the end of a calculation period might only generate 1 future instance but is still a recurring template
- Without `recurrenceGroupId`, the task cannot be edited at the template level

### Corrected Logic

```typescript
// ✅ CORRECT: Assigns recurrenceGroupId based on frequency, not instance count
const isRecurring = taskData.frequency !== 'ADHOC';
const recurrenceGroupId = isRecurring ? uuidv4() : null;

// Later:
recurrenceGroupId,  // Always set for non-ADHOC
recurrenceIndex: isRecurring ? instance.index : null,
recurrenceTotalCount: isRecurring ? instance.totalCount : null,
```

**Why This is Correct**:
- `recurrenceGroupId` presence is determined by **template nature** (frequency), not **instance count**
- Separates the concept of "recurring task template" from "number of generated instances"
- Enables template-level editing for all recurring tasks
- Consistent behavior regardless of date constraints

## Files Changed

### 1. Task Generation Logic (Backend)

**`/api/sources/[id]/generate/route.ts`**
- Changed recurrence group assignment logic from instance-count-based to frequency-based
- Ensures all tasks with `frequency !== 'ADHOC'` get a `recurrenceGroupId`

**`/api/sources/[id]/generate-for-entities/route.ts`**
- Applied the same fix for entity-specific task generation
- Maintains consistency across all generation paths

### 2. Task Query Filtering (Backend) - CRITICAL FIX

**`/api/tasks/route.ts`**
- **Added `deletedAt: null` filter** to exclude soft-deleted tasks from query results
- This was causing the UI to display deleted recurrence groups that couldn't be edited
- Ensures consistency with other endpoints that filter soft-deleted records

```typescript
const where: Prisma.TaskWhereInput = {
  AND: [getEntityFilter(session)],
  deletedAt: null, // Exclude soft-deleted tasks
};
```

### 3. Error Handling and Debugging (Backend)

**`/api/tasks/recurrence-group/route.ts`**
- Enhanced error messages with context about deleted vs. missing groups
- Added server-side logging to track recurrence group update attempts
- Added check for deleted tasks when group is not found

### 4. UI Error Handling (Frontend)

**`/components/sources/SourceTasksClient.tsx`**
- Added validation in `saveTemplate` to check for missing `recurrenceGroupId`
- Improved error messaging to show actual error from API
- Added client-side logging for debugging
- Added clarifying comment in task grouping logic to document edge case handling

### 5. Data Migration and Diagnostic Scripts

**`scripts/fix-recurrence-groups.ts`**
- New migration script to fix existing tasks in the database
- Groups legacy tasks by template characteristics
- Assigns proper `recurrenceGroupId`, `recurrenceIndex`, and `recurrenceTotalCount`

**`scripts/check-recurrence-groups.ts`** (NEW)
- Diagnostic script to check current state of recurrence groups
- Useful for verifying migration success and troubleshooting issues

## Migration Required

Existing tasks created before this fix will still have `recurrenceGroupId = null` and cannot be edited as templates.

### Run the Migration

```bash
cd cmp-app
npx tsx scripts/fix-recurrence-groups.ts
```

### What the Migration Does

1. Finds all tasks with:
   - `frequency !== 'ADHOC'`
   - `recurrenceGroupId = null`
   - `deletedAt = null`

2. Groups them by template characteristics:
   - sourceId
   - sourceItemId
   - entityId
   - task name
   - frequency
   - risk rating
   - team assignments

3. For each logical group:
   - Generates a new `recurrenceGroupId`
   - Assigns `recurrenceIndex` (0-based, sorted by due date)
   - Sets `recurrenceTotalCount`

4. Reports:
   - Number of tasks updated
   - Number of recurrence groups created

### Expected Output

```
🔍 Finding tasks with missing recurrence groups...
📊 Found 45 tasks without recurrence groups
🔗 Identified 12 logical recurrence groups
✓ Group 1/12: Monthly Compliance Report (MONTHLY) - 4 instances
✓ Group 2/12: Quarterly Risk Assessment (QUARTERLY) - 3 instances
...
✅ Migration complete!
   Updated 45 tasks
   Created 12 recurrence groups
```

## Verification

After applying the fix and running the migration:

1. Navigate to `/sources/{sourceId}/tasks`
2. Expand any source item
3. Recurring tasks should show as **one template row** with an expand toggle
4. Click "Edit" on a template row
5. Modify the task name or description
6. Click "Save"
7. Should see success message: "Recurring task template updated successfully"

## Impact

**Existing Sources**: Tasks already generated will need the migration script to be editable.

**New Sources**: Will work correctly immediately after deploying the fix.

**No Breaking Changes**: 
- Standalone/ADHOC tasks continue to work as before (no recurrenceGroupId)
- Display logic already handles both grouped and standalone tasks
- API changes are backward compatible (only affects new task creation)

## Related Files

- `/api/sources/[id]/generate/route.ts` - Main task generation endpoint ✅
- `/api/sources/[id]/generate-for-entities/route.ts` - Entity-specific generation ✅
- `/api/tasks/route.ts` - **Task query endpoint (CRITICAL FIX - soft-delete filter)** ✅
- `/api/tasks/recurrence-group/route.ts` - Template editing endpoint (enhanced logging) ✅
- `/components/sources/SourceTasksClient.tsx` - Template display and editing UI ✅
- `/lib/utils.ts` - `calculateRecurrenceInstances` helper
- `scripts/fix-recurrence-groups.ts` - Data migration script ✅
- `scripts/check-recurrence-groups.ts` - Diagnostic script (NEW) ✅

## Prevention

Going forward, always consider:
1. **Template identity** is about the task definition (frequency), not generated count
2. Date-constrained generation can produce varying instance counts for the same template
3. Recurrence group assignment should happen before instance generation
4. **ALL query endpoints must filter `deletedAt: null`** to exclude soft-deleted records
5. Test task generation with sources that have late effective dates to verify single-instance cases
6. When implementing soft-delete, audit ALL query endpoints to ensure proper filtering
