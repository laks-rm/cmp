# Design Decision: Frequency and Due Date are Read-Only

## Decision

Recurring task template editing will **NOT** allow changing frequency or first due date. These fields are read-only after task creation.

## Rationale

### User Feedback
"When I change something, it should not regenerate the entire recurrence group, it should edit the particulars of the existing one only. For that reason, the frequency and due date cannot be changed, rest of it like title, description, review required, evidence required can be changed."

### Technical Reasons

1. **Task Identity**: Frequency and first due date define the fundamental identity of a recurring task pattern. Changing them means creating a fundamentally different task.

2. **Complexity**: Regenerating instances causes:
   - Task IDs to change (breaks external references)
   - Temporary disappearance from UI during regeneration
   - Loss of task-specific data (assignments, progress, comments)
   - Audit trail pollution

3. **User Expectations**: Users expect metadata edits (title, description, flags) to update in-place, not trigger regeneration.

4. **Better Alternatives**: If frequency/due date needs to change, users should create a new source with the desired schedule rather than trying to modify an existing one.

## Implementation

### Backend (API)
**`/api/tasks/recurrence-group`** now:
- Rejects requests containing `frequency` or `firstDueDate` with 400 error
- Returns clear error message directing users to create new source
- Only updates metadata fields in-place

### Frontend (UI)
**Template editing UI** now shows:
- Frequency field: Disabled select with lock icon 🔒
- First due date field: Disabled date input with lock icon 🔒
- Tooltip: "Cannot be changed after task creation"
- Visual indicators: Gray background, reduced opacity, not-allowed cursor

### Editable Fields
Users CAN edit:
- ✅ Task name/title
- ✅ Description
- ✅ Risk rating (HIGH/MEDIUM/LOW)
- ✅ Responsible team
- ✅ Person in charge (PIC)
- ✅ Reviewer
- ✅ Evidence required flag
- ✅ Review required flag
- ✅ Narrative required flag

### Read-Only Fields
Users CANNOT edit:
- 🔒 Frequency (ADHOC, MONTHLY, QUARTERLY, etc.)
- 🔒 First due date (recurrence anchor)
- 🔒 Entity (determined by source applicability)
- 🔒 Source item (clause/regulation reference)

## User Workflow

### To Edit Metadata Only
1. Navigate to `/sources/{id}/tasks`
2. Expand the source item
3. Click "Edit" on the template row
4. Modify editable fields (title, description, risk, team, etc.)
5. Click "Save" → All instances update in-place instantly ✅

### To Change Frequency or Due Date
Since these fields define the recurrence pattern, users must:
1. Create a new source with the desired frequency and due date
2. Optionally mark the old source as inactive/superseded

## Benefits

1. **Predictable**: Edits always update in-place, never regenerate
2. **Fast**: No database churn, instant updates
3. **Safe**: Preserves task IDs, history, and relationships
4. **Clear**: UI shows which fields are editable vs. read-only
5. **Simple**: No complex regeneration logic to maintain

## Trade-offs

**Limitation**: Cannot modify frequency or due date after creation.

**Mitigation**: 
- Clear UI indicators prevent confusion
- Error messages guide users to correct workflow
- Creating new sources is straightforward
- Old sources can be marked inactive if needed

## Related Documentation

- `docs/RECURRING_TASK_TEMPLATE_EDITING.md` - Overall template editing guide
- `docs/FIX_UNWANTED_REGENERATION.md` - Why regeneration was problematic
- `docs/RECURRING_TASK_QUICK_REFERENCE.md` - Quick reference for users
