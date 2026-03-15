# Fix 29: Soft Delete Implementation

## Problem

**Current State:** All critical entities use hard delete (permanent removal from database)

**Issues:**
1. **Data Loss:** Deleted records are gone forever
2. **Broken Audit Trail:** Cannot track what happened to deleted items
3. **No Recovery:** Cannot undo accidental deletions
4. **Compliance Violations:** Many regulations require data retention
   - GDPR: Right to be forgotten vs. legal retention requirements
   - SOX: 7-year retention of financial records
   - FDA 21 CFR Part 11: Audit trail requirements
5. **Reporting Gaps:** Historical reports break when referenced data is deleted
6. **Relationship Issues:** Cascading deletes can remove related important data

**Example Scenarios:**
```typescript
// User accidentally deletes critical task
await prisma.task.delete({ where: { id: taskId } });
// ☠️ GONE FOREVER - cannot recover

// Admin deletes finding, breaking audit trail
await prisma.finding.delete({ where: { id: findingId } });
// ☠️ All history of this finding lost

// Source deleted, orphaning all associated tasks
await prisma.source.delete({ where: { id: sourceId } });
// ☠️ Audit logs reference non-existent source
```

---

## Solution: Soft Delete Pattern

Instead of removing records from the database, mark them as deleted with a timestamp.

### Schema Changes

Added to **Task**, **Finding**, and **Source** models:

```prisma
// Soft delete fields
deletedAt      DateTime?
deletedBy      String?
deletedReason  String?   @db.Text

// Relations
deletedByUser  User?  @relation("...", fields: [deletedBy], references: [id])

// Indexes for performance
@@index([deletedAt])
@@index([deletedBy])
```

### How It Works

**Before (Hard Delete):**
```sql
DELETE FROM tasks WHERE id = 'task-123';
-- Record permanently removed
```

**After (Soft Delete):**
```sql
UPDATE tasks
SET deleted_at = NOW(),
    deleted_by = 'user-456',
    deleted_reason = 'Duplicate task'
WHERE id = 'task-123';
-- Record preserved with deletion metadata
```

---

## Implementation

### 1. Schema Updated ✅

Three critical models now support soft delete:
- ✅ **Task** - Tasks with all their history
- ✅ **Finding** - Findings and action items
- ✅ **Source** - Compliance sources

Each model has:
- `deletedAt` - Timestamp of deletion (NULL = not deleted)
- `deletedBy` - User ID who deleted it
- `deletedReason` - Optional explanation (for audit purposes)
- Indexes on `deletedAt` and `deletedBy` for performance

### 2. Soft Delete Utility Created ✅

**File:** `src/lib/softDelete.ts`

**Features:**
- Helper functions for soft delete operations
- Prisma middleware (optional) for automatic filtering
- Validation logic (prevent deleting critical records)
- Type-safe utilities

**Key Functions:**

```typescript
// Create soft delete data
createSoftDeleteData(userId: string, reason?: string)

// Restore deleted record
createRestoreData()

// Build where clause with soft delete filter
withSoftDelete(where, { includeDeleted?, onlyDeleted? })

// Check if record is soft deleted
isSoftDeleted(record)

// Validate if record can be deleted
validateCanDelete(model, record)
```

### 3. Usage Patterns

#### Basic Soft Delete

```typescript
// Delete a task (soft delete)
await prisma.task.update({
  where: { id: taskId },
  data: createSoftDeleteData(session.user.userId, "No longer needed"),
});

// Audit log automatically created
await logAuditEvent({
  action: "TASK_DELETED",
  module: "TASKS",
  userId: session.user.userId,
  targetType: "Task",
  targetId: taskId,
  details: { reason: "No longer needed", softDelete: true },
});
```

#### Query Excluding Deleted Records (Default)

```typescript
// Get all non-deleted tasks
const tasks = await prisma.task.findMany({
  where: {
    ...notDeleted,  // Excludes soft-deleted records
    status: "TO_DO",
  },
});

// Or use helper
const tasks = await prisma.task.findMany({
  where: withSoftDelete({ status: "TO_DO" }),
});
```

#### Query Including Deleted Records

```typescript
// Get all tasks including deleted
const allTasks = await prisma.task.findMany({
  where: withSoftDelete(
    { entityId },
    { includeDeleted: true }
  ),
});

// Get ONLY deleted tasks
const deletedTasks = await prisma.task.findMany({
  where: withSoftDelete(
    { entityId },
    { onlyDeleted: true }
  ),
});
```

#### Restore Deleted Record

```typescript
// Restore a soft-deleted task
await prisma.task.update({
  where: { id: taskId },
  data: createRestoreData(),
});

// Audit log
await logAuditEvent({
  action: "TASK_RESTORED",
  module: "TASKS",
  userId: session.user.userId,
  targetType: "Task",
  targetId: taskId,
  details: { restoredFrom: "soft_delete" },
});
```

#### Permanent Delete (Admin Only)

```typescript
// Hard delete after retention period (e.g., 7 years)
// Only for compliance purposes, requires admin privileges
const sevenYearsAgo = new Date();
sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);

await prisma.task.deleteMany({
  where: {
    deletedAt: { lt: sevenYearsAgo },
  },
});
```

---

## API Route Updates (TODO)

### Task Deletion Route

**File:** `src/app/api/tasks/[id]/route.ts`

```typescript
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "TASKS", "DELETE");

    const taskId = params.id;

    // Fetch task with relations to validate
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        evidence: true,
        entity: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Verify entity access
    if (!session.user.entityIds.includes(task.entityId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Validate can delete
    const validationError = validateCanDelete("task", task);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Soft delete the task
    await prisma.task.update({
      where: { id: taskId },
      data: createSoftDeleteData(
        session.user.userId,
        "Deleted via UI"
      ),
    });

    // Audit log
    await logAuditEvent({
      action: "TASK_DELETED",
      module: "TASKS",
      userId: session.user.userId,
      entityId: task.entityId,
      targetType: "Task",
      targetId: taskId,
      details: {
        taskName: task.name,
        status: task.status,
        softDelete: true,
      },
    });

    return NextResponse.json({ success: true, message: "Task deleted successfully" });
  } catch (error) {
    console.error("Task deletion error:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
```

### Task Restore Route (NEW)

**File:** `src/app/api/tasks/[id]/restore/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { createRestoreData, isSoftDeleted } from "@/lib/softDelete";
import { logAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "TASKS", "EDIT");

    const taskId = params.id;

    // Fetch deleted task
    const task = await prisma.task.findUnique({
      where: { id: taskId, deletedAt: { not: null } },
      include: { entity: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found or not deleted" }, { status: 404 });
    }

    if (!isSoftDeleted(task)) {
      return NextResponse.json({ error: "Task is not deleted" }, { status: 400 });
    }

    // Verify entity access
    if (!session.user.entityIds.includes(task.entityId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Restore the task
    await prisma.task.update({
      where: { id: taskId },
      data: createRestoreData(),
    });

    // Audit log
    await logAuditEvent({
      action: "TASK_RESTORED",
      module: "TASKS",
      userId: session.user.userId,
      entityId: task.entityId,
      targetType: "Task",
      targetId: taskId,
      details: {
        taskName: task.name,
        deletedAt: task.deletedAt,
        deletedBy: task.deletedBy,
      },
    });

    return NextResponse.json({ success: true, message: "Task restored successfully" });
  } catch (error) {
    console.error("Task restore error:", error);
    return NextResponse.json({ error: "Failed to restore task" }, { status: 500 });
  }
}
```

---

## UI Updates (TODO)

### 1. Delete Confirmation Modal

Add confirmation modal with reason input:

```typescript
// components/ui/DeleteConfirmationModal.tsx
export function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  requireReason = true,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  title: string;
  message: string;
  requireReason?: boolean;
}) {
  const [reason, setReason] = useState("");

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2>{title}</h2>
      <p>{message}</p>
      
      {requireReason && (
        <div>
          <label>Reason for deletion (optional)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this is being deleted..."
            maxLength={500}
          />
        </div>
      )}

      <div className="actions">
        <button onClick={onClose}>Cancel</button>
        <button onClick={() => onConfirm(reason)}>Delete</button>
      </div>
    </Modal>
  );
}
```

### 2. Deleted Items View

Add tab/filter to view deleted items:

```typescript
// Show deleted items toggle
const [showDeleted, setShowDeleted] = useState(false);

// Fetch with filter
const tasks = await fetchApi<Task[]>(`/api/tasks?showDeleted=${showDeleted}`);

// UI indicator for deleted items
{task.deletedAt && (
  <div className="deleted-badge">
    Deleted {formatDistanceToNow(new Date(task.deletedAt))} ago
    by {task.deletedByUser?.name}
    {task.deletedReason && <span>: {task.deletedReason}</span>}
    <button onClick={() => handleRestore(task.id)}>Restore</button>
  </div>
)}
```

### 3. Restore Action

Add restore button for deleted items:

```typescript
async function handleRestore(taskId: string) {
  try {
    await fetchApi(`/api/tasks/${taskId}/restore`, { method: "POST" });
    toast.success("Task restored successfully");
    refetch();
  } catch (error) {
    console.error("Restore failed:", error);
  }
}
```

---

## Benefits

### 1. Data Recovery
- ❌ Before: Accidental deletion = permanent data loss
- ✅ After: Can restore deleted items with full history

### 2. Audit Trail
- ❌ Before: Deletion breaks audit logs (references missing records)
- ✅ After: Full audit trail preserved, can see who deleted what and why

### 3. Compliance
- ❌ Before: Immediate deletion violates retention requirements
- ✅ After: Records retained as required by regulations

### 4. Reporting
- ❌ Before: Historical reports fail when data is deleted
- ✅ After: Reports can include deleted items if needed

### 5. Safety
- ❌ Before: One click = permanent deletion
- ✅ After: Soft delete + confirmation + reason = safer operations

---

## Migration Strategy

### Phase 1: Schema Migration ✅
```bash
npx prisma db push
# or
npx prisma migrate dev --name add-soft-delete
```

### Phase 2: Update API Routes (TODO)
- [ ] Update `DELETE` endpoints to use soft delete
- [ ] Add `restore` endpoints
- [ ] Update query filters to exclude deleted by default

### Phase 3: Update UI (TODO)
- [ ] Add deletion reason input
- [ ] Add "Show Deleted" toggle
- [ ] Add restore functionality
- [ ] Add visual indicators for deleted items

### Phase 4: Data Cleanup (Future)
- [ ] Create cron job for permanent deletion after retention period
- [ ] Admin tool to view/manage deleted items
- [ ] Bulk restore functionality

---

## Configuration

### Retention Periods

Configure retention periods in environment variables:

```env
# .env
SOFT_DELETE_RETENTION_DAYS=2555  # 7 years for compliance
SOFT_DELETE_RETENTION_TASKS=365  # 1 year for tasks
SOFT_DELETE_RETENTION_FINDINGS=2555  # 7 years for findings
SOFT_DELETE_RETENTION_SOURCES=2555  # 7 years for sources
```

### Permanent Deletion Cron Job

```typescript
// src/app/api/cron/cleanup-deleted/route.ts
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const retentionDays = parseInt(process.env.SOFT_DELETE_RETENTION_DAYS || "2555");
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  // Permanently delete old soft-deleted records
  const deletedTasks = await prisma.task.deleteMany({
    where: {
      deletedAt: { lt: cutoffDate },
    },
  });

  const deletedFindings = await prisma.finding.deleteMany({
    where: {
      deletedAt: { lt: cutoffDate },
    },
  });

  const deletedSources = await prisma.source.deleteMany({
    where: {
      deletedAt: { lt: cutoffDate },
    },
  });

  return NextResponse.json({
    success: true,
    deleted: {
      tasks: deletedTasks.count,
      findings: deletedFindings.count,
      sources: deletedSources.count,
    },
  });
}
```

---

## Testing Checklist

- [ ] Can soft delete a task
- [ ] Soft-deleted tasks don't appear in normal queries
- [ ] Can restore a soft-deleted task
- [ ] Audit logs created for delete and restore
- [ ] Cannot delete task with evidence
- [ ] Cannot delete open critical finding
- [ ] Cannot delete source with active tasks
- [ ] Deletion reason is stored
- [ ] "Show Deleted" toggle works
- [ ] Permanent deletion after retention period works

---

## Future Enhancements

1. **Cascade Soft Delete** - When deleting source, soft delete all related tasks
2. **Soft Delete History** - Track multiple delete/restore cycles
3. **Scheduled Deletion** - Set deletion date in future
4. **Bulk Operations** - Soft delete/restore multiple items
5. **Admin Dashboard** - View all deleted items across system
6. **Export Deleted Data** - Export before permanent deletion
7. **Soft Delete for More Models** - Comments, Evidence, etc.

---

**Status:** 🚧 Schema Complete, Implementation in Progress  
**Priority:** High (compliance, data safety)  
**Risk:** Low (additive change, backward compatible)  
**Impact:** Major improvement to data safety and compliance
