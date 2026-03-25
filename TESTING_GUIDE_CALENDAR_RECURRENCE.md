# Testing Guide - Calendar & Recurrence Display Improvements

## Prerequisites
- CMP application running locally
- Database with at least one source that has items
- User account with appropriate permissions

---

## Test 1: Generate Monthly Recurring Tasks

**Objective**: Verify that monthly tasks create 12 instances with PLANNED status for future months.

### Steps:
1. Navigate to **Sources** page
2. Select a source and ensure it has at least one source item
3. Click **Generate Tasks** for that source
4. In the generation modal:
   - Select **Frequency**: `MONTHLY`
   - Choose an entity
   - Fill in required fields (task name, risk rating, etc.)
   - Click **Generate**
5. Wait for the success toast

### Expected Results:
✅ Success message: "12 tasks generated"
✅ In the Task Tracker, only the current/upcoming month instances appear (status TO_DO or IN_PROGRESS)
✅ Future month instances do NOT appear in Task Tracker (they have PLANNED status)

---

## Test 2: Calendar Year View - Shows PLANNED Tasks

**Objective**: Verify that the calendar year view includes all 12 months with task counts, including PLANNED tasks.

### Steps:
1. Navigate to **Calendar** page
2. Ensure **Year** view is selected (top-left toggle)
3. Look at all 12 month cards

### Expected Results:
✅ Every month that has a generated task shows a non-zero count
✅ Future months (with PLANNED tasks) show counts like "1" or "2" etc.
✅ Each month card shows breakdown:
   - "X completed · Y active · Z planned" (if planned count > 0)
   - OR "X completed · Y active" (if no planned tasks)
✅ Completion rate percentage is shown
✅ Cards have blue-tinted background intensity based on task count

**Example Month Card:**
```
January
12
5 completed · 4 active · 3 planned
42% complete
```

---

## Test 3: Calendar Month View - Current Month

**Objective**: Verify active tasks appear correctly in the current month's calendar grid.

### Steps:
1. Navigate to **Calendar** page
2. Switch to **Month** view
3. Look at the current month's calendar grid

### Expected Results:
✅ Days with tasks show task count badge (e.g., "3")
✅ Tasks appear as colored pills on their due dates
✅ Task pills have colors based on status:
   - Gray (#9AA0A6) for PLANNED tasks
   - Blue border for TO_DO tasks
   - Blue filled for IN_PROGRESS tasks
   - Amber for PENDING_REVIEW tasks
   - Green for COMPLETED tasks
   - Red for overdue tasks
✅ Clicking a task pill opens the Task Detail Modal

---

## Test 4: Calendar Month View - Future Month with PLANNED Tasks

**Objective**: Verify PLANNED tasks appear in future months with muted styling.

### Steps:
1. Navigate to **Calendar** page
2. Switch to **Month** view
3. Click the **→** (next month) button multiple times to navigate to a future month (e.g., 3 months ahead)
4. Look at the calendar grid

### Expected Results:
✅ Days with PLANNED tasks show task pills in muted gray color (#9AA0A6)
✅ PLANNED task pills are visually distinct from active tasks
✅ Clicking a PLANNED task pill opens the Task Detail Modal
✅ The task modal shows status as "PLANNED" (gray pill)

---

## Test 5: Recurrence Timeline - All Siblings Visible

**Objective**: Verify that the recurrence section shows all sibling instances with correct statuses.

### Steps:
1. Open a recurring task's detail modal (from calendar or task tracker)
2. Scroll down to the **Recurrence** section

### Expected Results:
✅ Header shows: "MONTHLY task — instance X of 12 (QX or Month YYYY)"
✅ 12 instance pills are displayed in a horizontal row
✅ Pills are sorted by recurrence index (1, 2, 3... 12)
✅ Each pill shows:
   - Circle with instance number (or checkmark ✓ if completed)
   - Quarter label below (e.g., Q1, Q2, Q3, Q4 or Jan, Feb, etc.)
✅ Current instance has thicker border (2px) and blue-light background
✅ Pill colors match status:
   - Green filled = COMPLETED (with ✓)
   - Gray = PLANNED
   - White with blue border = TO_DO
   - Blue filled = IN_PROGRESS
   - Amber-light with amber border = PENDING_REVIEW
   - Purple-light with purple border = DEFERRED
   - White with red border = OVERDUE

---

## Test 6: Recurrence Timeline - Click to Navigate

**Objective**: Verify clicking a recurrence instance opens that specific task.

### Steps:
1. Open a recurring task's detail modal (instance 1 of 12)
2. In the recurrence section, click on instance pill #3
3. Wait for modal to refresh

### Expected Results:
✅ Modal refreshes and now shows instance #3's details
✅ The recurrence timeline updates - pill #3 now has the thick border (current instance)
✅ Task details (evidence, comments, narrative, status) all belong to instance #3
✅ The header shows: "instance 3 of 12"

**Repeat**:
- Click instance #6 → modal shows instance #6
- Click instance #12 → modal shows instance #12

---

## Test 7: Recurrence Timeline - Progress Summary

**Objective**: Verify the progress summary shows correct status distribution.

### Steps:
1. Open a recurring task's detail modal
2. Scroll to the recurrence section
3. Look at the text below the instance pills

### Expected Results:
✅ Progress summary is displayed in muted text
✅ Format: "X completed · Y in progress · Z planned" (or similar)
✅ Only shows statuses with count > 0
✅ Examples:
   - "3 completed · 1 in progress · 8 planned"
   - "1 completed · 11 planned"
   - "12 completed" (if all done)

**Test with different scenarios:**
1. **Fresh monthly tasks**: Should show "11 planned" or "1 active · 11 planned"
2. **Some completed**: Mark 3 tasks complete → should show "3 completed · X in progress/planned"
3. **Some deferred**: Defer a task → should include "X deferred" in summary

---

## Test 8: Complete a Task and Verify Timeline Updates

**Objective**: Verify that completing a task updates the recurrence timeline.

### Steps:
1. Open a recurring task (instance 2 of 12) with status IN_PROGRESS
2. Submit for review and approve (or mark complete if no review required)
3. Close the modal
4. Re-open the same task (or any sibling from the same recurrence group)
5. Look at the recurrence timeline

### Expected Results:
✅ Instance #2 pill now shows:
   - Green filled circle
   - White checkmark (✓) instead of number
   - Still clickable
✅ Progress summary updates: "1 completed · ..." or "2 completed · ..." etc.
✅ Clicking the completed pill (#2) opens that task with COMPLETED status

---

## Test 9: Calendar Summary Bar - Status Breakdown

**Objective**: Verify the calendar summary bar shows PLANNED task counts.

### Steps:
1. Navigate to **Calendar** page
2. Look at the summary bar below the header (shows "Total Tasks", "Planned", "Completed", etc.)
3. Switch between Month, Quarter, and Year views

### Expected Results:
✅ Summary bar shows:
   - Total Tasks (includes PLANNED)
   - Planned count (in gray color #9AA0A6)
   - Completed count (in green)
   - In Progress count (in blue)
   - Overdue count (in red)
✅ Counts update when changing views
✅ PLANNED tasks are included in the total
✅ Example: "Total Tasks: 36" with "Planned: 24" (if most tasks are in future months)

---

## Test 10: Build and Lint Verification

**Objective**: Ensure no TypeScript or linting errors were introduced.

### Steps:
1. Open terminal in `cmp-app` directory
2. Run: `npm run build`
3. Wait for build to complete
4. Run: `npm run lint`

### Expected Results:
✅ Build completes successfully (exit code 0)
✅ No TypeScript errors related to:
   - `CalendarClient.tsx`
   - `TaskDetailModal.tsx`
   - `TaskTrackerClient.tsx`
   - `SourceTasksClient.tsx`
   - `ReviewQueueClient.tsx`
✅ Lint passes with no errors
✅ Output: "✔ No ESLint warnings or errors"

**Note**: Pre-existing warnings about dynamic server usage in API routes are expected and unrelated to this feature.

---

## Edge Cases to Test

### Edge Case 1: Single-Instance Task (Non-Recurring)
- Open a task that is NOT part of a recurrence group
- **Expected**: No recurrence section should appear in the modal

### Edge Case 2: Quarterly Tasks
- Generate quarterly tasks (should create 4 instances)
- **Expected**: Year view shows tasks in 4 quarters, recurrence timeline shows 4 pills (Q1, Q2, Q3, Q4)

### Edge Case 3: Semi-Annual Tasks
- Generate semi-annual tasks (should create 2 instances)
- **Expected**: Recurrence timeline shows 2 pills

### Edge Case 4: One-Time Tasks
- Generate one-time tasks (Frequency = ONE_TIME)
- **Expected**: Tasks appear in calendar, no recurrence section in modal

### Edge Case 5: Past Month with Overdue Tasks
- Navigate calendar to a past month
- **Expected**: Overdue tasks (not completed) show in red

### Edge Case 6: Clicking Current Instance
- In recurrence timeline, click the current instance (with thick border)
- **Expected**: Nothing happens (cursor should be "default", not "pointer")

### Edge Case 7: Modal Navigation from Task Tracker
- Open a recurring task from Task Tracker (not calendar)
- Click a sibling instance in recurrence timeline
- **Expected**: Modal updates to show the clicked instance

---

## Visual Regression Checklist

Compare the visual appearance before/after the changes:

### Calendar Year View
- [ ] Month cards still have proper spacing and borders
- [ ] Task count is prominent and centered
- [ ] Breakdown text is readable in secondary color
- [ ] "X planned" portion is in muted gray color (#9AA0A6)
- [ ] Hover effect (shadow-lg) still works

### Calendar Month View
- [ ] Task pills have proper color coding
- [ ] Gray PLANNED pills are visually distinct
- [ ] Day cells still have hover effects
- [ ] Today indicator (blue background) is still visible

### Task Detail Modal - Recurrence Section
- [ ] Pills are horizontally scrollable if many instances
- [ ] Current instance has noticeable thicker border
- [ ] Hover effect (shadow-md and scale) is smooth
- [ ] Colors are consistent with the design system
- [ ] Progress summary text is readable

---

## Performance Testing

### Load Test
1. Generate 50+ tasks from multiple sources (mix of frequencies)
2. Navigate to Calendar year view
3. Switch between views (month/quarter/year)
4. Open task modals with large recurrence groups

**Expected**: 
- No lag when rendering calendar
- Modal opens quickly (<500ms)
- Smooth navigation between recurrence instances

---

## Accessibility Testing

1. **Keyboard Navigation**:
   - Tab through recurrence instance pills
   - Press Enter to navigate to an instance
   
2. **Screen Reader**:
   - Verify pill titles are read correctly: "Q1 - TO_DO", "Q2 - COMPLETED", etc.

3. **Color Contrast**:
   - Verify all text colors meet WCAG AA standards
   - PLANNED gray (#9AA0A6) should be readable on white background

---

## Rollback Plan

If any critical issues are found:

1. The changes are isolated to UI components only
2. No database schema changes were made
3. To rollback, revert these files:
   - `src/components/calendar/CalendarClient.tsx`
   - `src/components/tasks/TaskDetailModal.tsx`
   - `src/components/tasks/TaskTrackerClient.tsx`
   - `src/components/sources/SourceTasksClient.tsx`
   - `src/components/reviews/ReviewQueueClient.tsx`

The API already supported `includeAll=true`, so no backend changes are needed for rollback.
