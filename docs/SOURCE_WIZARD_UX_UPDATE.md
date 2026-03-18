# Source Wizard UX Update - Separation of Concerns

## Summary

Updated the Source Wizard to clarify its purpose as an "add new items" interface and clearly direct users to the dedicated management screen for editing existing task templates.

## Problem

The Source Wizard showed existing items with inline editing capabilities, creating confusion:
- Users thought they could edit task templates (frequency, recurrence) here
- The inline editing actually updated individual task instances, not templates
- Mixed concerns: adding new items vs. managing existing ones
- Conflicted with the dedicated template editing feature just implemented

## Solution: Option 1 - Separation of Concerns

**Source Wizard Purpose**: Add new clauses and tasks only
**Template Management Screen Purpose**: Edit existing task templates and recurrence patterns

### Changes Made

#### 1. Fixed Permission Error
**File**: `src/app/api/tasks/recurrence-group/route.ts`

Changed permission check from `TASKS:UPDATE` to `TASKS:EDIT`:
```typescript
await requirePermission(session, "TASKS", "EDIT");
```

This matches the permission system's actual permission names.

#### 2. Added "Manage Existing Templates" Button
**File**: `src/components/sources/SourceWizard.tsx`

Added prominent button in the Existing Items section header:

```tsx
<button
  onClick={() => {
    window.location.href = `/sources/${existingSource.id}/tasks`;
  }}
  className="..."
  title="Go to dedicated screen for template-level editing"
>
  <EditIcon />
  Manage Existing Templates
</button>
```

**Placement**: Top-right of "Existing Items" section
**Action**: Navigates to `/sources/{id}/tasks` - the dedicated management screen
**Visual**: Blue border/text to indicate primary action

#### 3. Added Clear Context Banner
Added blue information banner above existing items:

```
┌─────────────────────────────────────────────────────────┐
│ ℹ️ Reference Only                                        │
│ Existing items are shown for reference. To edit         │
│ existing task templates (frequency, recurrence,          │
│ metadata), use the "Manage Existing Templates"          │
│ button above.                                            │
│                                                          │
│ This wizard is for adding new clauses and tasks only.   │
└─────────────────────────────────────────────────────────┘
```

#### 4. Updated Helper Text
Replaced ambiguous text at the bottom:

**Before**:
```
Add new clauses and tasks below. Existing items above 
will not be modified unless you explicitly edit them.
```

**After**:
```
📝 Adding New Items

Use the spreadsheet below to add new clauses and tasks 
to this source. Existing items shown above will remain 
unchanged.
```

#### 5. Updated Inline Edit Notice
Changed the notice in the expanded task view:

**Before**:
```
Quick edit fields directly in the table. Frequency and 
due date are locked (already generated). Click edit icon 
for full details and description.
```

**After**:
```
Quick Reference: You can view existing task details here. 
For template-level editing (frequency, recurrence patterns), 
use the "Manage Existing Templates" button above.
```

## User Flow

### Before (Confusing)
```
1. Open "Add Tasks" modal
2. See existing items with inline editing
3. Try to edit frequency → locked
4. Get confused about what can/can't be edited
5. Edit some fields inline (updates instances, not templates)
6. Add new items below
```

### After (Clear)
```
1. Open "Add Tasks" modal
2. See "Reference Only" banner
3. See "Manage Existing Templates" button
4. Either:
   A. Click button → Go to template management screen
   B. Scroll down → Add new items via spreadsheet
```

## Visual Comparison

### Existing Items Section - Before
```
┌─────────────────────────────────────────┐
│ Existing Items (3)                      │
├─────────────────────────────────────────┤
│ • 5.1 Data Processing [2 tasks]         │
│ • 5.2 Storage Requirements [1 task]     │
│ • 5.3 Transfer Rules [3 tasks]          │
└─────────────────────────────────────────┘

Add new clauses and tasks below...
```

### Existing Items Section - After
```
┌─────────────────────────────────────────────────────┐
│ Existing Items (3)    [📝 Manage Existing Templates]│
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────┐ │
│ │ ℹ️ Reference Only                               │ │
│ │ Existing items shown for reference.            │ │
│ │ To edit templates, use button above.           │ │
│ │ This wizard is for ADDING NEW items only.     │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ • 5.1 Data Processing [2 tasks]                    │
│ • 5.2 Storage Requirements [1 task]                │
│ • 5.3 Transfer Rules [3 tasks]                     │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 📝 Adding New Items                     │
│ Use spreadsheet below to add new        │
│ clauses and tasks.                      │
└─────────────────────────────────────────┘
```

## Benefits

### 1. Clear Mental Model
- **Source Wizard** = Add new items
- **Management Screen** = Edit existing templates

### 2. No Feature Conflicts
- Wizard doesn't try to be a template editor
- Template editing stays in dedicated screen where it belongs
- Each screen has a clear, focused purpose

### 3. Proper Template Editing
- Users edit templates at the template level (not instance level)
- Frequency changes regenerate instances correctly
- Recurrence patterns managed properly

### 4. Better Discoverability
- Prominent "Manage Existing Templates" button
- Clear signposting for where to do what
- Users can't miss the right tool for the job

### 5. Reduced Confusion
- No ambiguous inline editing that updates instances
- No locked fields that users can't understand
- Clear expectations set upfront

## Technical Details

### Navigation
Uses `window.location.href` for navigation to ensure clean page reload:

```typescript
window.location.href = `/sources/${existingSource.id}/tasks`;
```

**Why not `useRouter`?**
- Ensures fresh data load
- Closes modal completely
- Clean transition between modes
- Avoids stale state issues

### Styling
Reuses existing design system variables:
- `var(--blue)` for primary action
- `var(--blue-light)` for info banners
- `var(--border)` for borders
- Consistent with app-wide patterns

### Accessibility
- Clear button labels
- Title attributes for tooltips
- Color contrast maintained
- Icon + text for clarity

## Testing Checklist

- [x] Permission error fixed (`TASKS:EDIT` works)
- [x] Button navigates to correct URL
- [x] Information banners display correctly
- [x] Helper text is clear and accurate
- [x] No linter errors
- [x] Visual hierarchy is clear
- [x] Responsive on mobile (button wraps gracefully)

## User Education

### What Users Should Know

**For Adding New Tasks**:
1. Open source
2. Click "Add Tasks" button
3. Use spreadsheet/paste/AI extract methods
4. Submit to generate new items

**For Editing Existing Templates**:
1. Open source
2. Click "Add Tasks" button (shows existing items)
3. Click "Manage Existing Templates" button
4. Edit templates in dedicated management screen

### Help Text in UI

Three clear messages guide users:

1. **Button**: "Manage Existing Templates" (with edit icon)
2. **Banner**: "Reference Only - use button above for editing"
3. **Footer**: "Use spreadsheet below to add new clauses and tasks"

## Future Enhancements

Potential improvements (not in current scope):

1. **Rename Button**: "Add Tasks" → "Add New Tasks" for clarity
2. **Modal Title**: Add context "(Add New)" when existingSource
3. **Quick Action**: "Edit existing templates?" link in empty state
4. **Tooltip**: Hover info on button explaining template vs instance editing
5. **Keyboard Shortcut**: Quick navigation between screens

## Related Features

- **Source Editing**: Edit source metadata and entities (separate feature)
- **Template Editing**: Edit recurring task templates (management screen)
- **Task Tracker**: View and update task instances (execution focus)
- **Source Wizard**: Add new clauses and tasks (creation focus)

Each feature has a clear, distinct purpose.

---

**Status**: ✅ Complete
**Risk**: 🟢 Low (no breaking changes, only UX clarification)
**User Impact**: ✅ Positive (reduced confusion, clearer navigation)
