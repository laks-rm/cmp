# Quick Reference: Recurring Task Template Editing

## Overview
Edit recurring task metadata at the template level instead of editing each monthly/weekly occurrence individually.

---

## What Changed?

### Before
- Recurring tasks showed as **individual rows** (e.g., one row per month for MONTHLY tasks)
- You had to edit **each row separately** to change team, PIC, or other metadata
- No way to change frequency without regenerating the entire source

### Now
- Recurring tasks show as **one template row**
- Edit the template to **update all instances at once**
- Can **change frequency** and regenerate instances
- Can **view individual instances** as expandable detail

---

## How to Use

### 1. View Template
When you open a source with recurring tasks:
```
✅ You see: ONE row per recurring task (with 🔄 icon)
❌ You don't see: 18 duplicate rows for a monthly task
```

### 2. Edit Template Metadata
Click **[Edit]** on the template row to update:
- ✏️ Task name and description
- 📊 Risk rating
- 📅 Frequency (changes recurrence pattern)
- 📅 First due date (shifts all instances)
- 👥 Responsible team
- 👤 Default PIC
- ✓ Evidence/Review flags

**All instances update instantly.**

### 3. View Generated Instances
Click **[👁 View Instances]** to expand and see:
- Instance number (#1, #2, #3...)
- Status badge (TO_DO, COMPLETED, etc.)
- Due date
- Quarter

**Instances are read-only** — edit the template to change them.

---

## Common Tasks

### Change the Team/PIC for All Instances
1. Click **[Edit]** on template row
2. Change "Team" dropdown
3. Change "PIC" dropdown
4. Click **[Save]**

✅ **Result**: All instances now have new team/PIC

### Change Risk Rating
1. Click **[Edit]** on template row
2. Change "Risk" dropdown (HIGH/MEDIUM/LOW)
3. Click **[Save]**

✅ **Result**: All instances updated to new risk rating

### Change Frequency (e.g., MONTHLY → QUARTERLY)
1. Click **[Edit]** on template row
2. Change "Frequency" dropdown
3. Click **[Save]**

⚠️ **Warning**: This regenerates instances:
- Old instances are archived
- New instances created with new pattern
- Status resets to PLANNED

### Change First Due Date (Shift Schedule)
1. Click **[Edit]** on template row
2. Change "First Due Date" picker
3. Click **[Save]**

✅ **Result**: All instances shift forward/backward to maintain spacing

---

## Visual Guide

### Template Row Layout
```
┌─────────────────────────────────────────────────────────────────┐
│ 🔄 Monthly Compliance Review (18 instances)                     │
│ MEDIUM │ MONTHLY │ DIEL │ Jan 31 │ Legal │ JD │ E R │ [Edit] [👁] │
└─────────────────────────────────────────────────────────────────┘
     ↑         ↑        ↑       ↑       ↑      ↑    ↑       ↑    ↑
   Icon    Frequency  Entity  First   Team   PIC  Flags  Actions
```

### Expanded Instances
```
Generated Instances:
  #1  [TO_DO]      Due: Jan 31, 2026  Q1
  #2  [TO_DO]      Due: Feb 28, 2026  Q1
  #3  [COMPLETED]  Due: Mar 31, 2026  Q1
  #4  [TO_DO]      Due: Apr 30, 2026  Q2
  ...
```

---

## Frequency Options

| Frequency | Example Pattern | Instance Count |
|-----------|----------------|----------------|
| DAILY | Every day for 30 days | 30 |
| WEEKLY | Every week for 30 days | 4-5 |
| MONTHLY | Every month for 18 months | 18 |
| QUARTERLY | Every 3 months for 2 years | 8 |
| SEMI_ANNUAL | Every 6 months for 2 years | 4 |
| ANNUAL | Every year for 3 years | 3 |
| BIENNIAL | Every 2 years for 6 years | 3 |
| ONE_TIME | Single task | 1 |
| ADHOC | As needed | 1 |

---

## FAQs

### Q: Can I edit an individual instance instead of the template?
**A**: Currently, no. Template-level editing ensures consistency. If you need to override a specific instance, you can:
1. Change its status/progress in the Task Tracker
2. Assign a different person to that instance
3. Mark it as completed/deferred individually

### Q: What happens to completed instances when I change the template?
**A**: Completed instances retain their status. Only metadata (team, PIC, risk, flags) updates.

### Q: What if I change frequency? Will I lose completed instances?
**A**: Old instances (including completed ones) are archived (soft-deleted), not permanently deleted. You can still view them in audit logs.

### Q: How do I know if a task is recurring?
**A**: Look for:
- 🔄 icon next to task name
- "N instances" badge
- Template row appears in source task management view

### Q: Can I stop a recurring task?
**A**: Yes. Change frequency to "ONE_TIME" or soft-delete the entire recurrence group.

---

## Differences from Task Tracker View

| Feature | Source Task Management | Task Tracker |
|---------|----------------------|--------------|
| **Purpose** | Template/metadata editing | Instance execution |
| **Shows** | Template rows + instances | Individual task instances |
| **Edit** | Template metadata | Instance status/progress |
| **Recurring tasks** | Grouped by template | Listed individually |
| **Use when** | Setting up/modifying tasks | Doing the actual work |

---

## Best Practices

✅ **DO**:
- Edit the template to change team/PIC/risk for all instances
- Use "View Instances" to check generated schedule
- Change frequency when rolling out new compliance cadence

❌ **DON'T**:
- Try to edit individual instances in source view (use Task Tracker)
- Change frequency frequently (disrupts instance history)
- Forget to set team before activating tasks

---

## Keyboard Shortcuts

None currently, but you can tab through form fields when editing.

---

## Troubleshooting

### "No tasks found"
- Check filters (status/entity) — templates are hidden if all instances filtered out
- Verify source has generated tasks (click "Generate Tasks" button)

### "Access denied"
- You may not have permission to edit tasks for that entity
- Contact admin to grant entity access

### "Template not updating"
- Check network errors in browser console
- Verify you clicked [Save] not [Cancel]
- Refresh page to see latest data

---

## Related Features

- **Task Generation**: Create recurring tasks when setting up source
- **Task Activation**: Planned instances auto-activate based on date
- **Rolling Generation**: DAILY/WEEKLY tasks generate new instances automatically

---

## Need Help?

- View full implementation docs: `RECURRING_TASK_TEMPLATE_EDITING.md`
- Visual comparison guide: `RECURRING_TASK_VISUAL_COMPARISON.md`
- Contact: compliance-team@example.com
