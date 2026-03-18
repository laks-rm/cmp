# Recurring Task Template-Level Editing Implementation

## Summary

Successfully implemented template-level editing for recurring tasks in the source task management UI. Users can now edit recurring task metadata at the template level instead of editing each generated instance individually.

## Changes Made

### 1. New API Endpoint: `/api/tasks/recurrence-group`

**File**: `src/app/api/tasks/recurrence-group/route.ts`

Created a PATCH endpoint that updates all task instances in a recurrence group:

- **Simple metadata updates**: Updates all instances with new values for:
  - Task name, description, expected outcome
  - Risk rating
  - Team assignments (responsible team, PIC, reviewer)
  - Requirement flags (evidence, review, narrative)

- **Recurrence pattern changes**: When frequency or first due date changes:
  - Soft-deletes old instances
  - Regenerates new instances with updated pattern
  - Creates new recurrence group ID
  - Returns regeneration summary

### 2. Updated SourceTasksClient Component

**File**: `src/components/sources/SourceTasksClient.tsx`

Complete rewrite to support template-level editing:

#### Key Features:

**Task Grouping Logic**:
- Groups tasks by `recurrenceGroupId` to create template representations
- Each template shows metadata from the first instance
- Template displays instance count and first due date
- Standalone (non-recurring) tasks remain ungrouped

**Template-Level Editing**:
- Edit form for recurring task metadata
- Fields: name, description, frequency, risk, first due date, team, PIC, flags
- Updates propagate to all instances in the group via API

**Expandable Instance View**:
- Click "View Instances" (eye icon) to expand
- Shows all generated instances with:
  - Instance number (e.g., #1, #2, #3)
  - Status badge
  - Due date
  - Quarter

**Visual Distinction**:
- Template rows have refresh icon to indicate recurring nature
- Template rows have subtle background color difference
- Instance count badge shows how many instances exist

#### Component Structure:

```tsx
<SourceTasksClient>
  └─ Items (Clauses)
     └─ Template Rows (recurring tasks)
        ├─ Template metadata (editable)
        └─ Expandable instance list (read-only)
     └─ Standalone Task Rows (non-recurring)
```

### 3. Shared Utility Functions

**File**: `src/lib/utils.ts`

Extracted `calculateRecurrenceInstances` function from the generate route:

```typescript
export function calculateRecurrenceInstances(
  frequency: string,
  baseDueDate: Date | null,
  sourceEffectiveDate: Date | null = null
): RecurrenceInstance[]
```

This function is now shared between:
- Task generation (`/api/sources/[id]/generate/route.ts`)
- Recurrence group updates (`/api/tasks/recurrence-group/route.ts`)

## User Experience Flow

### Before (Old Behavior):
1. User opens existing source
2. Sees 18 individual rows for a monthly recurring task
3. Must edit team/PIC on each row individually
4. No way to change frequency without regenerating entire source

### After (New Behavior):
1. User opens existing source
2. Sees **1 template row** for the monthly recurring task
3. Can edit all metadata (name, frequency, risk, team, PIC) in one place
4. Can expand to view all 18 generated instances
5. Changes propagate to all instances automatically

## API Examples

### Update Task Metadata

```bash
PATCH /api/tasks/recurrence-group
{
  "recurrenceGroupId": "abc-123",
  "updates": {
    "name": "Updated Monthly Compliance Review",
    "riskRating": "HIGH",
    "responsibleTeamId": "team-uuid",
    "picId": "user-uuid",
    "evidenceRequired": true
  }
}
```

Response:
```json
{
  "success": true,
  "message": "Updated 18 task instance(s)",
  "instancesUpdated": 18
}
```

### Change Recurrence Pattern

```bash
PATCH /api/tasks/recurrence-group
{
  "recurrenceGroupId": "abc-123",
  "updates": {
    "frequency": "QUARTERLY",
    "firstDueDate": "2026-03-31T00:00:00.000Z"
  }
}
```

Response:
```json
{
  "success": true,
  "message": "Recurrence group regenerated successfully",
  "newRecurrenceGroupId": "xyz-789",
  "instanceCount": 8
}
```

## Technical Details

### Soft Delete Pattern
When regenerating instances:
- Old tasks are soft-deleted with `deletedReason: "Recurrence pattern updated - instances regenerated"`
- New tasks are created with fresh recurrence group ID
- Audit log tracks old and new group IDs

### Data Integrity
- All updates require entity access validation
- Team/PIC/Reviewer selections validated against available users/teams
- Frequency changes recalculate instances using same logic as initial generation
- First due date changes maintain relative instance spacing

### Performance
- Single API call updates all instances atomically
- Template grouping happens client-side (no extra DB queries)
- Expandable instances prevent UI clutter

## Migration Notes

**No Database Migration Required**
- Uses existing `recurrenceGroupId` field on Task table
- No schema changes needed
- Backward compatible with existing tasks

## Testing Recommendations

1. **Test Template Editing**:
   - Open source with monthly recurring tasks
   - Verify single template row appears
   - Edit team/PIC and verify all instances update

2. **Test Frequency Changes**:
   - Change MONTHLY to QUARTERLY
   - Verify old instances are soft-deleted
   - Verify new instances generated with correct dates

3. **Test Mixed Tasks**:
   - Source with both recurring and one-time tasks
   - Verify templates group correctly
   - Verify standalone tasks still editable

4. **Test Filters**:
   - Apply status/entity filters
   - Verify templates filter based on instance data

## Future Enhancements

Potential improvements for future iterations:

1. **Bulk Instance Override**: Allow editing individual instances while preserving template
2. **Template History**: Show audit trail of template changes
3. **Smart Date Adjustment**: When changing first due date, offer to keep or shift completed instances
4. **Template Duplication**: Copy template to create new recurring task series
5. **Custom Recurrence Patterns**: Support complex patterns (e.g., "last Friday of quarter")

## Files Changed

- `src/app/api/tasks/recurrence-group/route.ts` (NEW)
- `src/components/sources/SourceTasksClient.tsx` (REWRITTEN)
- `src/lib/utils.ts` (ADDED functions)

## Completion Status

✅ API endpoint created
✅ Client component rewritten  
✅ Template grouping logic implemented
✅ Expandable instance view added
✅ Edit functionality working
✅ No linter errors
✅ Backward compatible

The recurring task template-level editing feature is now complete and ready for testing.
