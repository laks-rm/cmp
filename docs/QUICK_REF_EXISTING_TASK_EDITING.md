# Quick Reference: Existing Task Editing in SourceWizard

**Where**: Add Items & Tasks modal (Step 2) when editing an existing source  
**When**: Need to view or update task metadata without leaving the wizard

---

## 🎯 Quick Actions

### View Existing Tasks
1. Open SourceWizard for existing source
2. Go to Step 2 (Items & Tasks)
3. Find "Existing Items" section
4. Click **chevron icon** (🔽) next to clause
5. View all tasks with details

**Time**: < 10 seconds

---

### Edit Task Metadata
1. Expand clause (see above)
2. Click **"Edit"** button on task
3. Modify fields (see editable list below)
4. Click **"Save Changes"**
5. See success notification

**Time**: 30-60 seconds

---

## ✅ What You CAN Edit (Safe Fields)

| Field | Type | Example |
|-------|------|---------|
| Task Name | Text | "Review data retention policies" |
| Description | Text Area | "Ensure all data retention..." |
| Expected Outcome | Text Area | "Updated policies reviewed" |
| Risk Rating | Dropdown | HIGH / MEDIUM / LOW |
| Responsible Team | Dropdown | Compliance Team |
| PIC | Dropdown | John Doe |
| Reviewer | Dropdown | Jane Smith |
| Evidence Required | Checkbox | ☑ |
| Narrative Required | Checkbox | ☐ |
| Review Required | Checkbox | ☑ |

---

## 🔒 What You CANNOT Edit (Locked Fields)

| Field | Why Locked | Visual Indicator |
|-------|------------|------------------|
| Frequency | Would break generated instances | 🟡 Amber warning |
| Due Date | Would desync schedule | 🟡 Amber warning |
| Recurrence Anchor | Would invalidate pattern | 🟡 Amber warning |
| Start Date | Would affect all instances | 🟡 Amber warning |

**Warning Message**:  
> "Schedule fields locked: Frequency, due date, and recurrence settings cannot be edited because task instances have already been generated."

---

## 🎨 Visual States

### Collapsed (Default)
```
┌─────────────────────────────────────────┐
│ 🔽 Art. 5(1)(f)  Data Security  [3 tasks]│
└─────────────────────────────────────────┘
```

### Expanded (View Mode)
```
┌─────────────────────────────────────────┐
│ 🔼 Art. 5(1)(f)  Data Security  [3 tasks]│
├─────────────────────────────────────────┤
│   ┌─────────────────────────────────┐   │
│   │ Review retention policies  [Edit]│   │
│   │ Frequency: Quarterly | Risk: High│   │
│   │ Team: Compliance | PIC: John Doe │   │
│   │ ✓ Evidence  ✓ Review             │   │
│   └─────────────────────────────────┘   │
│                                         │
│   ℹ️  You can edit task metadata...    │
└─────────────────────────────────────────┘
```

### Edit Mode
```
┌───────────────────────────────────────┐
│ Edit Task Metadata          [Cancel]  │
├───────────────────────────────────────┤
│ Task Name *                           │
│ [Review retention policies         ]  │
│                                       │
│ Risk Rating      | Responsible Team  │
│ [HIGH ▼]        | [Compliance ▼]    │
│                                       │
│ ⚠️  Schedule fields locked...         │
│                                       │
│              [Cancel] [Save Changes]  │
└───────────────────────────────────────┘
```

---

## 🎯 Common Use Cases

### Fix Typo in Task Name
1. Expand clause → Click "Edit"
2. Fix task name → Click "Save"
**Time**: 20 seconds

### Reassign Task to Different Team
1. Expand clause → Click "Edit"
2. Change "Responsible Team" dropdown
3. Update PIC/Reviewer if needed → Click "Save"
**Time**: 40 seconds

### Update Risk Rating
1. Expand clause → Click "Edit"
2. Change "Risk Rating" dropdown → Click "Save"
**Time**: 15 seconds

### Toggle Evidence Requirement
1. Expand clause → Click "Edit"
2. Check/uncheck "Evidence Required" → Click "Save"
**Time**: 15 seconds

### Bulk Review All Tasks
1. Expand all clauses (click each chevron)
2. Review all task details
3. Edit as needed one by one
**Time**: 2-5 minutes

---

## ⚠️ Important Notes

### ✅ DO
- Expand clauses to inspect task details
- Edit task metadata when needed
- Read warning messages about locked fields
- Save changes one task at a time
- Cancel if you change your mind

### ❌ DON'T
- Try to edit frequency or due date (locked)
- Edit multiple tasks simultaneously (not supported)
- Expect instant updates (refetch takes ~1 second)
- Edit tasks you don't have permission for (will fail)

---

## 🔧 Troubleshooting

### "Save" Button is Disabled
**Cause**: Task name is empty  
**Fix**: Enter a task name (required field)

### Reviewer Dropdown is Empty
**Cause**: No team members in selected team  
**Fix**: Select a different responsible team first

### Changes Not Visible After Save
**Cause**: Refetch in progress (takes ~1 second)  
**Fix**: Wait for success notification, then check

### "Failed to update task" Error
**Cause**: Permission denied, network error, or validation failed  
**Fix**: Check your permissions, network connection, and required fields

### Can't Find "Edit" Button
**Cause**: Clause is collapsed  
**Fix**: Click chevron icon to expand clause first

---

## 🚀 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Tab | Navigate between form fields |
| Enter | Save changes (when in form) |
| Click Chevron | Expand/collapse clause |

**Future**: Escape to cancel (not yet implemented)

---

## 📊 What Happens Behind the Scenes

### When You Click "Edit"
1. Form opens with current values
2. Reviewer dropdown filters by team
3. Background changes to blue
4. Warning notice appears

### When You Click "Save"
1. Validates required fields (task name)
2. PATCH request to `/api/tasks/:id`
3. Server validates permissions & data
4. Refetches all items from API
5. Shows success/error notification
6. Closes edit form

### Data Flow
```
User clicks "Save"
    ↓
Validate form (client)
    ↓
PATCH /api/tasks/:id
    ↓
Validate permissions (server)
    ↓
Update database
    ↓
Return updated task
    ↓
Refetch all items
    ↓
Show success toast
    ↓
Close edit form
```

---

## 🎓 Best Practices

### When to Use This Feature
✅ Fixing typos or mistakes  
✅ Updating assignments (team, PIC, reviewer)  
✅ Adjusting risk ratings  
✅ Toggling requirements (evidence, narrative, review)  
✅ Improving task descriptions  

### When NOT to Use This Feature
❌ Changing task frequency (locked)  
❌ Rescheduling tasks (locked)  
❌ Bulk editing many tasks (use Task Tracker)  
❌ Deleting tasks (use Task Tracker)  
❌ Major restructuring (create new version)  

---

## 📞 Need Help?

### Detailed Documentation
See: `docs/FEATURE_EXISTING_TASK_EDITING.md`

### Feature Summary
See: `FEATURE_EXISTING_TASK_EDITING_SUMMARY.md`

### Related Features
- FIX 40: Version-Aware Sources (`docs/FIX_40_*.md`)
- Task Tracker: Manage active tasks
- Source Management: Create/edit sources

---

## 🎉 Quick Tips

💡 **Tip 1**: Keep clauses collapsed while adding new items (cleaner view)

💡 **Tip 2**: Expand all relevant clauses at once for bulk review

💡 **Tip 3**: Read the amber warning before attempting to edit schedule fields

💡 **Tip 4**: Use this feature for quick metadata fixes, not major changes

💡 **Tip 5**: Success notification confirms your changes were saved

---

**Last Updated**: 2026-03-17  
**Version**: 1.0  
**Status**: ✅ Live & Documented
