# Task Field Cleanup - Implementation Summary

## Changes Made

Successfully cleaned up three fields in the expanded task fields panel on the source creation page (`/sources/new`).

### 1. ✅ Removed Quarter Field

**What was removed:**
- Quarter dropdown selector from the UI (lines 1012-1029)
- `QUARTERS` import from the imports section

**What was kept:**
- `quarter` field in `TaskDefinition` type
- Quarter data in generation payload
- Backend quarter auto-assignment logic (unchanged)

**Reasoning:** The generation engine at `/api/sources/[id]/generate/route.ts` automatically assigns quarters based on frequency (Monthly tasks get their month's quarter, Quarterly tasks get Q1-Q4). Users never needed to set this manually.

---

### 2. ✅ Removed Start Date Field

**What was removed:**
- Start Date input field from the UI (lines 1030-1041)

**What was kept:**
- `startDate` field in `TaskDefinition` type
- Start date data in generation payload
- Task activation system in `src/lib/taskActivation.ts` (unchanged)

**Reasoning:** The `PLANNED → TO_DO` activation system already handles when tasks become workable. Due dates are auto-calculated. There's no practical use for a manually-set start date during source creation.

---

### 3. ✅ Made Reviewer Field Conditional

**What changed:**
- Reviewer dropdown now only appears when "Review Required" is checked
- When unchecked, shows a disabled-style placeholder: "Review not required"
- Unchecking "Review Required" automatically clears any previously selected reviewer

**Implementation:**
```tsx
{task.reviewRequired ? (
  <select value={task.reviewerId} ...>
    {/* Reviewer dropdown */}
  </select>
) : (
  <div className="flex h-8 items-center rounded-lg border px-2 text-xs"
       style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-subtle)", color: "var(--text-muted)" }}>
    Review not required
  </div>
)}
```

**Checkbox handler enhanced:**
```tsx
onChange={(e) => {
  onUpdate("reviewRequired", e.target.checked);
  // Clear reviewer selection when review is not required
  if (!e.target.checked && task.reviewerId) {
    onUpdate("reviewerId", "");
  }
}}
```

**Reasoning:** Makes the dependency between the two fields obvious and prevents assigning a reviewer who will never be notified.

---

## Files Modified

- `cmp-app/src/components/sources/ClausesTasksSection.tsx`
  - Removed Quarter field UI (17 lines removed)
  - Removed Start Date field UI (12 lines removed)
  - Made Reviewer field conditional (7 lines added, 12 lines modified)
  - Removed `QUARTERS` from imports
  - Net reduction: ~22 lines

---

## What Was NOT Changed

✅ `TaskDefinition` type - All fields remain in the type definition
✅ Generation API payload - Still sends quarter and startDate if they exist
✅ Task detail modal/page - Separate component, untouched
✅ Backend logic - No API changes
✅ Database schema - No changes

---

## Build Status

✅ Build successful
✅ No linting errors
✅ TypeScript compilation clean
✅ File size: 12.8 kB (slightly reduced from 12.9 kB)

---

## User Experience Improvements

1. **Less cluttered UI** - Two unnecessary fields removed
2. **Clearer field relationships** - Reviewer field's dependency on Review Required is now visually obvious
3. **Prevents confusion** - Users can't set quarters or start dates that will be overridden
4. **Better data integrity** - Reviewer automatically cleared when review is disabled
5. **Consistent behavior** - Matches the system's automated quarter and date assignment logic

---

## Testing Recommendations

1. Create a new source and expand task fields
2. Verify Quarter and Start Date fields are not visible
3. Toggle "Review Required" checkbox on and off
4. Confirm Reviewer dropdown appears/hides correctly
5. Set a reviewer, then uncheck "Review Required" → verify reviewer is cleared
6. Generate tasks and verify backend still receives correct data
7. Check that quarters are still auto-assigned correctly in generated tasks
