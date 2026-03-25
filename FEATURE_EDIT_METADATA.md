# Feature: Edit Metadata for Existing Sources

## Overview
Added functionality to display and edit metadata for existing clause (items) and tasks when adding items & tasks to existing sources in the Source Wizard.

## Problem Solved
Previously, when adding items & tasks to an existing source:
- Only basic information was shown (reference, title, task name, team, frequency, quarter, risk rating)
- Metadata fields like description, expected outcome, start/due dates, URLs, evidence/review requirements were not visible
- There was no way to edit existing items or tasks
- The frequency field was editable but should not be to avoid breaking task generation

## Changes Made

### 1. Type Definitions (`SourceWizard.tsx`)
- Added `id?: string` to `TaskDefinition` type to track existing tasks
- This distinguishes between new tasks (no id) and existing tasks (with id)

### 2. State Management (`SourceWizard.tsx`)
Added state for editing:
```typescript
- editingItemId: string | null
- editingTaskId: string | null
- editItemForm: { reference, title, description, isInformational }
- editTaskForm: { name, description, expectedOutcome, responsibleTeamId, picId, reviewerId, quarter, riskRating, startDate, dueDate, evidenceRequired, reviewRequired, clickupUrl, gdriveUrl }
```

### 3. Handler Functions (`SourceWizard.tsx`)
Added handlers for editing items and tasks:
- `handleEditItem(itemTempId)` - Initiates item editing
- `handleSaveItemEdit(itemTempId)` - Saves item changes (to DB if existing, to state if new)
- `handleCancelItemEdit()` - Cancels item editing
- `handleEditTask(itemTempId, taskTempId)` - Initiates task editing
- `handleSaveTaskEdit(itemTempId, taskTempId)` - Saves task changes (to DB if existing, to state if new)
- `handleCancelTaskEdit()` - Cancels task editing

### 4. API Endpoints
Created new API endpoint for updating source items:
- **File**: `/api/sources/[id]/items/[itemId]/route.ts`
- **Method**: `PATCH`
- **Purpose**: Update reference, title, description, and isInformational flag for existing items
- **Security**: Validates user access to source entities, checks reference uniqueness
- **Audit**: Logs all item updates

The task update endpoint already existed at `/api/tasks/[id]` with PATCH method.

### 5. UI Changes (`SourceWizard.tsx`)

#### Item Display
**View Mode:**
- Shows reference, title, description (if present)
- Shows informational badge or task count
- Added Edit button (pencil icon) - only visible for existing items (with id)
- Expand/collapse arrow to show tasks

**Edit Mode:**
- Form with reference, title, description, and isInformational checkbox
- Save/Cancel buttons
- Only allows editing if item has an id (exists in DB)

#### Task Display
**View Mode:**
- Shows full task metadata:
  - Name, description, expected outcome
  - Team, PIC, Reviewer (with labels)
  - Frequency (read-only, highlighted), Quarter, Risk Rating (color-coded badge)
  - Start/Due dates (formatted)
  - Evidence Required and Review Required badges
  - ClickUp and Google Drive links (if present)
- Edit button (pencil icon) - only visible for existing tasks (with id)
- Delete button (trash icon)

**Edit Mode:**
- Comprehensive form with all task fields:
  - Name, Description, Expected Outcome (text areas)
  - Department/Team, PIC, Reviewer (dropdowns)
  - Risk Rating, Quarter (dropdowns)
  - Start Date, Due Date (date pickers)
  - ClickUp URL, Google Drive URL (text inputs)
  - Evidence Required, Review Required (checkboxes)
- **Note**: Frequency is NOT editable for existing tasks to avoid breaking task generation
- Save/Cancel buttons
- Form is highlighted with blue background to indicate edit mode

### 6. Data Flow

#### Loading Existing Items
1. When Source Wizard opens with an existing source, `fetchExistingItems()` is called
2. Fetches source with all items and tasks from `/api/sources/[id]`
3. Maps data to `ItemWithTasks[]` format with proper IDs
4. Sets items in state

#### Editing an Item
1. User clicks Edit button on item card
2. `handleEditItem()` populates `editItemForm` with current values
3. Form is shown in place of view mode
4. On Save: 
   - If item has `id`: PATCH to `/api/sources/[id]/items/[itemId]`
   - If no `id`: Updates state only (new item)
5. On Cancel: Clears edit state

#### Editing a Task
1. User clicks Edit button on task card
2. `handleEditTask()` populates `editTaskForm` with current values
3. Form is shown in place of view mode
4. On Save:
   - If task has `id`: PATCH to `/api/tasks/[id]`
   - If no `id`: Updates state only (new task)
5. On Cancel: Clears edit state

## Security Considerations
- Edit buttons only shown for existing items/tasks (with database IDs)
- API validates user access to source entities
- Reference uniqueness is checked when updating items
- Frequency field is NOT editable for existing tasks to prevent:
  - Breaking recurring task generation
  - Orphaning past task instances
  - Inconsistencies in task schedules

## User Experience Improvements
1. **Visibility**: All metadata is now visible in a clean, organized layout
2. **Clarity**: Field labels are clear (e.g., "Team:", "PIC:", "Expected:")
3. **Color Coding**: Risk ratings are color-coded (High=red, Medium=yellow, Low=green)
4. **Badges**: Visual badges for Evidence Required, Review Required, and links
5. **Inline Editing**: Edit forms appear in place, maintaining context
6. **Loading States**: Buttons show "Saving..." during API calls
7. **Protection**: Frequency is protected from accidental changes with a note in the edit form

## Files Modified
1. `/cmp-app/src/components/sources/SourceWizard.tsx`
   - Added types, state, handlers, and UI for editing
   - Enhanced task display to show all metadata

2. `/cmp-app/src/app/api/sources/[id]/items/[itemId]/route.ts`
   - New file: API endpoint for updating source items

## Testing Recommendations
1. Open Source Wizard with an existing source
2. Verify all metadata is displayed for items and tasks
3. Click Edit on an item, modify fields, save - verify changes persist
4. Click Edit on a task, modify fields (not frequency), save - verify changes persist
5. Try canceling edits - verify no changes are saved
6. Verify frequency field is not shown in task edit form for existing tasks
7. Check that new items/tasks (added during session) can still be edited
8. Verify edit buttons only appear on existing items/tasks, not new ones

## Future Enhancements
- Add bulk edit functionality for multiple tasks
- Add validation for date ranges (start < due)
- Add confirmation dialog for sensitive changes
- Add revision history for items and tasks
