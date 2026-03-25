# Quick Reference: CMP Source/Task Lifecycle

## Three Critical Scenarios Implemented

### 🎯 Scenario 1: Save Draft with Full Persistence

**User Journey:**
1. User creates source → adds clauses → adds task definitions
2. Clicks "Save draft" → everything persists
3. Redirects to source detail page
4. Task definitions stored as `metadata.pendingTasks` in SourceItem
5. Displays with amber "Pending" badges

**Key Benefit:** No data loss! Users can save work-in-progress without generating tasks.

---

### 🎯 Scenario 2: Incremental Generation on Existing Sources

**User Journey:**
1. Source is ACTIVE with generated tasks
2. User adds new task definition → saved as pending
3. Clicks "Generate N tasks" → only new tasks generate
4. Existing tasks unchanged (status, assignments, evidence preserved)

**Key Benefit:** Add tasks to live sources without duplicating existing work.

**Backend Logic:**
```typescript
// Check if item already exists before creating
let item = await tx.sourceItem.findFirst({
  where: { sourceId, reference: itemData.item.reference }
});

if (!item) {
  item = await tx.sourceItem.create({...});
}
// Then create only NEW tasks
```

---

### 🎯 Scenario 3: Smart Delete of Generated Recurring Tasks

**User Journey:**
1. User clicks delete on a task that has recurrence instances
2. System analyzes all instances:
   - **Preserved**: COMPLETED, IN_PROGRESS, has evidence, has narrative
   - **Deletable**: PLANNED or TO_DO with no work
3. Preview modal shows breakdown
4. User confirms → only deletable instances removed

**Key Benefit:** Never lose work! Protects completed/active tasks while cleaning up unused instances.

**Delete Preview API:**
```bash
DELETE /api/tasks/{id}?preview=true&scope=recurrence
# Returns: { preservedCount, deletableCount, preservedInstances[], deletableInstances[] }

DELETE /api/tasks/{id}?scope=recurrence
# Executes the deletion
```

---

## Visual Indicators

| State | Badge | Color | Meaning |
|-------|-------|-------|---------|
| Pending | "Pending" | Amber | Task definition not yet generated |
| Generated | Status pill | Blue/Green/Red | Actual Task record with status |
| Preserved | Green box | Green | Instances kept during delete |
| Deletable | Red box | Red | Instances removed during delete |

---

## Data Flow

### Draft → Active Flow
```
1. POST /api/sources → Create source (DRAFT)
2. POST /api/sources/items → Create clauses
3. PATCH /api/sources/{id}/items/{itemId} → Save pendingTasks in metadata
4. POST /api/sources/{id}/generate → Generate Task records
5. Source status: DRAFT → ACTIVE
6. Clear metadata.pendingTasks
```

### Incremental Generation Flow
```
1. Source is ACTIVE with generated tasks
2. PATCH /api/sources/{id}/items/{itemId} → Add new pendingTasks
3. POST /api/sources/{id}/generate → Only generate new tasks
4. Clear metadata.pendingTasks for newly generated
5. Existing Task records untouched
```

### Smart Delete Flow
```
1. DELETE /api/tasks/{id}?preview=true&scope=recurrence → Get analysis
2. Frontend shows modal with preserved vs deletable breakdown
3. DELETE /api/tasks/{id}?scope=recurrence → Execute
4. Only deletable instances removed
5. Audit log: TASK_RECURRENCE_DELETED with full details
```

---

## Metadata Structure

### SourceItem.metadata
```json
{
  "pendingTasks": [
    {
      "tempId": "temp-1234567890",
      "name": "Monthly Compliance Check",
      "frequency": "MONTHLY",
      "riskRating": "HIGH",
      "description": "",
      "expectedOutcome": "",
      "responsibleTeamId": "",
      "picId": "",
      "reviewerId": "",
      "quarter": "",
      "startDate": "",
      "dueDate": "",
      "evidenceRequired": false,
      "reviewRequired": true,
      "clickupUrl": "",
      "gdriveUrl": ""
    }
  ]
}
```

**After generation:** `metadata.pendingTasks` → `[]` (cleared)

---

## Component Responsibilities

### SourceCreateClient
- Source details form
- Clauses & tasks builder
- "Save draft" → creates source + items + stores metadata
- "Review & generate" → creates + generates in one flow

### SourceDetailClient
- Displays source info and stats
- Lists clauses with both pending and generated tasks
- Shows generation bar only when `pendingTasks.length > 0`
- Handles incremental generation
- Delete confirmation modal with smart analysis

### ClausesTasksSection
- Clause/task builder component
- Used in creation flow
- Manages local state for new items

---

## Backend Endpoints

| Endpoint | Purpose | Special Params |
|----------|---------|----------------|
| `POST /api/sources` | Create source | Returns draft source |
| `POST /api/sources/items` | Create clause | Takes sourceId |
| `PATCH /api/sources/[id]/items/[itemId]` | Update clause/metadata | Accepts `metadata` field |
| `POST /api/sources/[id]/generate` | Generate tasks | Checks if items exist, only changes DRAFT→ACTIVE |
| `DELETE /api/tasks/[id]` | Delete task(s) | `?preview=true` `?scope=recurrence` |

---

## Testing Checklist

- [ ] Scenario 1: Save draft with 3 clauses, 5 tasks → refresh → data persists
- [ ] Scenario 1: Pending tasks show amber "Pending" badge
- [ ] Scenario 2: Generate initial tasks → add new task → generate → no duplication
- [ ] Scenario 2: Existing task statuses preserved after incremental generation
- [ ] Scenario 3: Delete quarterly task with Q1 completed → Q1 preserved, Q2-Q4 deleted
- [ ] Scenario 3: Delete all-planned task → all instances deleted
- [ ] Scenario 3: Delete one-time task → simple deletion
- [ ] Generation bar only shows when pending tasks exist
- [ ] Source status changes DRAFT → ACTIVE on first generation
- [ ] Audit logs capture all actions

---

## Troubleshooting

**Q: Pending tasks not showing after save draft?**
- Check: `SourceItem.metadata.pendingTasks` in database
- Verify: PATCH endpoint receiving metadata field
- Check: GET /api/sources/[id] includes items.metadata

**Q: Tasks duplicating on incremental generation?**
- Check: Generate endpoint checking if item exists before creating
- Verify: Using `findFirst` before `create` for items

**Q: Delete not working for recurrence groups?**
- Check: Task has `recurrenceGroupId` set
- Verify: Using `?scope=recurrence` query param
- Check: Preview returns correct preserved/deletable counts

**Q: Generation bar not disappearing after generation?**
- Check: `metadata.pendingTasks` cleared after generation
- Verify: PATCH call to clear metadata after successful generation

---

## Performance Notes

- **Metadata storage**: JSON field, indexed by SourceItem
- **Generation**: Transaction ensures atomicity
- **Delete preview**: Single query to get all siblings, no writes
- **Recurrence groups**: Indexed on `recurrenceGroupId` for fast sibling lookup

---

## Security

All operations require:
- ✅ Valid session (NextAuth)
- ✅ Permission check (VIEW/CREATE/EDIT/DELETE)
- ✅ Entity access verification
- ✅ Audit logging

---

**End of Quick Reference**
