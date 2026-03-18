# Fix: Unwanted Task Regeneration on Metadata-Only Edits

## Issue Description

**Problem**: When editing only the title or description of a recurring task template, ALL instances were being deleted and regenerated, causing tasks to temporarily disappear from the UI.

**User Report**: "For the test source showing 0/36 tasks, when I clicked 'View Tasks' and edited the title from 'test' to 'teste' and saved, all tasks disappeared."

## Root Cause

The `/api/tasks/recurrence-group` endpoint was checking if `updates.frequency` or `updates.firstDueDate` **existed** in the request body, not if they actually **changed**:

```typescript
// ❌ WRONG: Triggers regeneration if fields are present, even if unchanged
const shouldRegenerateInstances = updates.frequency || updates.firstDueDate;
```

Since the client sends all template fields (including frequency and firstDueDate) even when only the title changes, this caused unnecessary regeneration every time.

## Impact

- When editing title/description only → All 18 instances deleted and recreated
- Task IDs changed, breaking any external references
- Tasks briefly disappeared from UI during regeneration
- Audit trail polluted with unnecessary regeneration events

## Solution

Changed the logic to compare new values with existing values:

```typescript
// ✅ CORRECT: Only regenerate if values actually changed
const frequencyChanged = updates.frequency && updates.frequency !== existingTasks[0].frequency;
const firstDueDateChanged = updates.firstDueDate && 
  new Date(updates.firstDueDate).getTime() !== existingTasks[0].dueDate?.getTime();

const shouldRegenerateInstances = frequencyChanged || firstDueDateChanged;
```

## Files Changed

**`src/app/api/tasks/recurrence-group/route.ts`**
- Added value comparison logic for frequency and firstDueDate
- Added detailed logging for change detection
- Prevents unnecessary regeneration for metadata-only updates

## Data Restoration

For the affected "test" source (18 tasks):
- Created restoration script: `scripts/restore-test-source-tasks.ts`
- Deleted the incorrectly regenerated tasks
- Restored the original 18 tasks with the updated title "teste"
- All tasks now show correctly in the UI

## Testing

After the fix:
1. Edit only title/description → Tasks update in place, no regeneration ✅
2. Edit frequency → Tasks regenerate with new schedule ✅
3. Edit first due date → Tasks regenerate with new anchor ✅
4. Edit multiple fields including title + frequency → Tasks regenerate once ✅

## Prevention

Going forward:
- Always compare new vs. old values before triggering destructive operations
- Consider client-side optimization: only send changed fields
- Add integration tests for template editing scenarios
- Monitor audit logs for unexpected regeneration events

## Related Files

- `src/app/api/tasks/recurrence-group/route.ts` - Main fix
- `scripts/restore-test-source-tasks.ts` - Data restoration script
- `scripts/debug-source-tasks.ts` - Diagnostic utility
