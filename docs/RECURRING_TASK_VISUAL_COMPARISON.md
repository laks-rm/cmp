# Visual Comparison: Before vs After

## Before: Instance-Level Editing (Old)

```
Source: GDPR Compliance
├─ Clause 5.1 — Data Processing Requirements
│  ├─ Task: Monthly Data Audit (Instance 1/18) - Jan 2026  [Edit]
│  ├─ Task: Monthly Data Audit (Instance 2/18) - Feb 2026  [Edit]
│  ├─ Task: Monthly Data Audit (Instance 3/18) - Mar 2026  [Edit]
│  ├─ Task: Monthly Data Audit (Instance 4/18) - Apr 2026  [Edit]
│  ├─ Task: Monthly Data Audit (Instance 5/18) - May 2026  [Edit]
│  ... (13 more rows)
```

**Problem**: User must click [Edit] on each row to change team/PIC/metadata.

---

## After: Template-Level Editing (New)

```
Source: GDPR Compliance
├─ Clause 5.1 — Data Processing Requirements
│  ├─ 🔄 Task Template: Monthly Data Audit (18 instances)  [Edit] [View Instances]
│     └─ (When expanded)
│        ├─ #1 - Jan 31, 2026 - Q1 - [TO_DO]
│        ├─ #2 - Feb 28, 2026 - Q1 - [TO_DO]
│        ├─ #3 - Mar 31, 2026 - Q1 - [COMPLETED]
│        ... (15 more instances)
```

**Solution**: User clicks [Edit] on template row to update ALL 18 instances at once.

---

## UI Layout Comparison

### Old Layout (Per-Instance)
```
┌──────────────────────────────────────────────────────────────────┐
│ Task: Monthly Data Audit (1/18)                                  │
│ Status: TO_DO  │ Risk: MEDIUM │ Due: Jan 31 │ Team: Legal       │
│                                                        [Edit] [↔] │
└──────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────┐
│ Task: Monthly Data Audit (2/18)                                  │
│ Status: TO_DO  │ Risk: MEDIUM │ Due: Feb 28 │ Team: Legal       │
│                                                        [Edit] [↔] │
└──────────────────────────────────────────────────────────────────┘
... (16 more identical rows)
```

### New Layout (Template + Instances)
```
┌──────────────────────────────────────────────────────────────────┐
│ 🔄 TEMPLATE: Monthly Data Audit (18 generated instances)         │
│ Risk: MEDIUM │ Frequency: MONTHLY │ First Due: Jan 31, 2026     │
│ Team: Legal  │ PIC: JD  │ Evidence: ✓  │ Review: ✓             │
│                                                [Edit] [👁 View]   │
│                                                                   │
│ ┌─ Generated Instances (expanded) ───────────────────────────┐  │
│ │ #1  [TO_DO]      Due: Jan 31, 2026  Q1                     │  │
│ │ #2  [TO_DO]      Due: Feb 28, 2026  Q1                     │  │
│ │ #3  [COMPLETED]  Due: Mar 31, 2026  Q1                     │  │
│ │ #4  [TO_DO]      Due: Apr 30, 2026  Q2                     │  │
│ │ ... (14 more)                                               │  │
│ └─────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Edit Modal Comparison

### Old: Edit Single Instance
```
┌─────────────────────────────────────┐
│ Edit Task Instance (Jan 2026)      │
├─────────────────────────────────────┤
│ Status:     [TO_DO ▼]              │
│ Risk:       [MEDIUM ▼]             │
│ Due Date:   [2026-01-31]           │
│ Team:       [Legal ▼]              │
│ PIC:        [John Doe ▼]           │
│                                     │
│        [Cancel]  [Save]             │
└─────────────────────────────────────┘
```
**Impact**: Only Jan 2026 instance updated.

### New: Edit Template (All Instances)
```
┌───────────────────────────────────────────┐
│ Edit Recurring Task Template             │
├───────────────────────────────────────────┤
│ Name:        [Monthly Data Audit]        │
│ Description: [Review GDPR compliance...] │
│ Frequency:   [MONTHLY ▼]                 │
│ Risk:        [MEDIUM ▼]                  │
│ First Due:   [2026-01-31]                │
│ Team:        [Legal ▼]                   │
│ PIC:         [John Doe ▼]                │
│ Evidence:    [✓] Required                │
│ Review:      [✓] Required                │
│                                           │
│          [Cancel]  [Save All]             │
└───────────────────────────────────────────┘
```
**Impact**: ALL 18 instances updated with new metadata.

---

## Data Flow

### Old Flow: Edit Single Instance
```
User Action               API Call                     Database
─────────────────────────────────────────────────────────────────
Click Edit (Instance 3)
  ↓
Edit Status = COMPLETED
  ↓
                    → PATCH /api/tasks/{taskId}
                          { status: "COMPLETED" }
  ↓                                            ↓
                                         UPDATE Task
                                         WHERE id = {taskId}
```
**Result**: Only instance 3 updated. User must repeat 17 more times.

### New Flow: Edit Template
```
User Action                API Call                      Database
────────────────────────────────────────────────────────────────────
Click Edit (Template)
  ↓
Edit Team = "Compliance"
Edit PIC = "Jane Smith"
  ↓
                    → PATCH /api/tasks/recurrence-group
                          {
                            recurrenceGroupId: "abc-123",
                            updates: {
                              responsibleTeamId: "compliance-id",
                              picId: "jane-id"
                            }
                          }
  ↓                                                      ↓
                                                   UPDATE Task
                                                   WHERE recurrenceGroupId = "abc-123"
                                                   SET responsibleTeamId = ...
                                                       picId = ...
```
**Result**: All 18 instances updated in single transaction.

---

## Frequency Change Flow

When user changes MONTHLY → QUARTERLY:

```
1. Soft Delete Old Instances
   ┌──────────────────────────────────┐
   │ Monthly instances (18)           │
   │ Jan, Feb, Mar, Apr, May...       │
   │ ─────────────────────────────────│
   │ Status: deletedAt = now()        │
   │ Reason: "Recurrence updated"     │
   └──────────────────────────────────┘

2. Generate New Instances
   ┌──────────────────────────────────┐
   │ Quarterly instances (8)          │
   │ Mar, Jun, Sep, Dec (2 years)     │
   │ ─────────────────────────────────│
   │ recurrenceGroupId: NEW UUID      │
   │ Status: PLANNED                  │
   └──────────────────────────────────┘

3. Return Summary
   {
     "success": true,
     "newRecurrenceGroupId": "xyz-789",
     "instanceCount": 8,
     "message": "Regenerated successfully"
   }
```

---

## Key Benefits

| Aspect | Before | After |
|--------|--------|-------|
| **Clicks to update recurring task** | 18+ clicks (1 per instance) | 1 click (edit template) |
| **Visual clarity** | 18 repetitive rows | 1 template + expandable detail |
| **Frequency changes** | Not possible | Supported with regeneration |
| **Risk of inconsistency** | High (might miss instances) | Zero (atomic update) |
| **Screen real estate** | 18 rows minimum | 1 row + optional expansion |
| **User mental model** | "Why so many duplicates?" | "One task, multiple occurrences" |

---

## Implementation Highlight

The key innovation is **grouping logic**:

```typescript
// Group tasks by recurrenceGroupId
const recurrenceGroups = new Map<string, Task[]>();
tasks.forEach((task) => {
  if (task.recurrenceGroupId) {
    if (!recurrenceGroups.has(task.recurrenceGroupId)) {
      recurrenceGroups.set(task.recurrenceGroupId, []);
    }
    recurrenceGroups.get(task.recurrenceGroupId)!.push(task);
  }
});

// Create template from first instance
recurrenceGroups.forEach((instances, groupId) => {
  const template = {
    recurrenceGroupId: groupId,
    name: instances[0].name,
    frequency: instances[0].frequency,
    // ... other metadata from first instance
    instanceCount: instances.length,
    instances: instances.sort((a, b) => a.recurrenceIndex - b.recurrenceIndex)
  };
});
```

This transforms **N task rows** into **1 template** + **expandable N instances**.
