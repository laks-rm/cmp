# Fix 32: Enhanced Audit Logging with Before/After Values

## Problem

**Current State:** Audit logs only capture new values, not what changed from

**Example of Incomplete Audit Trail:**
```json
{
  "action": "TASK_PIC_CHANGED",
  "details": {
    "newPicId": "user-456"
    // ❌ Missing: oldPicId - who was it BEFORE?
  }
}
```

**Impact:**
1. **Incomplete Audit Trail:** Cannot reconstruct what actually changed
2. **Compliance Issues:** Regulations require tracking changes (SOX, GDPR, HIPAA)
3. **No Rollback Info:** Cannot reverse changes without old values
4. **Investigation Gaps:** Security incidents hard to trace
5. **Accountability Issues:** Cannot prove what user changed
6. **Historical Reporting:** Cannot generate "state at time X" reports

**Real-World Scenarios:**

**Security Incident:**
```
"Who changed the PIC for Task X to user-malicious?"
"What was the PIC before the change?" 
→ CANNOT ANSWER without old values
```

**Compliance Audit:**
```
"Show me all changes to critical tasks in Q1"
"What was the status before it was changed to COMPLETED?"
→ INCOMPLETE DATA = compliance failure
```

**Rollback Request:**
```
"Revert Task Y to its state before the incident"
→ CANNOT REVERT without knowing old values
```

---

## Solution: Comprehensive Change Tracking

### Enhanced Audit Log Structure

**Before:**
```json
{
  "action": "TASK_UPDATED",
  "details": { "newStatus": "COMPLETED" }
}
```

**After:**
```json
{
  "action": "TASK_UPDATED",
  "details": {
    "changes": [
      {
        "field": "status",
        "oldValue": "IN_PROGRESS",
        "newValue": "COMPLETED",
        "changed": true
      },
      {
        "field": "picId",
        "oldValue": "user-123",
        "newValue": "user-456",
        "changed": true
      }
    ],
    "oldValues": { /* full snapshot */ },
    "newValues": { /* full snapshot */ },
    "changedFields": ["status", "picId"],
    "changeCount": 2
  }
}
```

---

## Implementation

### 1. Enhanced Audit Library ✅

**File:** `src/lib/audit.ts`

**New Features:**
- ✅ `oldValues` / `newValues` parameters
- ✅ `captureChanges()` - Automatically compute what changed
- ✅ `logCreate()` - Helper for creation events
- ✅ `logUpdate()` - Helper for update events with change tracking
- ✅ `logDelete()` - Helper for deletion events
- ✅ `getAuditSnapshot()` - Fetch state before changes
- ✅ `formatChanges()` - Human-readable change descriptions
- ✅ Automatic sensitive data redaction (passwords, etc.)
- ✅ Deep comparison (handles dates, objects, arrays)

### 2. Core Functions

#### logAuditEvent (Enhanced)
```typescript
await logAuditEvent({
  action: "TASK_UPDATED",
  module: "TASKS",
  userId: session.user.userId,
  targetType: "Task",
  targetId: taskId,
  oldValues: oldTask,      // ✅ NEW: Before state
  newValues: updatedTask,  // ✅ NEW: After state
  details: {
    reason: "Status changed by manager"
  }
});
```

#### captureChanges
```typescript
const changes = captureChanges(oldTask, newTask);

// Returns:
[
  {
    field: "status",
    oldValue: "IN_PROGRESS",
    newValue: "COMPLETED",
    changed: true
  },
  {
    field: "dueDate",
    oldValue: "2026-01-15",
    newValue: "2026-01-15",
    changed: false  // No change
  }
]
```

#### Helper Functions
```typescript
// Create
await logCreate("TASKS", "Task", taskId, newTask, userId);

// Update
await logUpdate("TASKS", "Task", taskId, oldTask, newTask, userId);

// Delete
await logDelete("TASKS", "Task", taskId, oldTask, userId, entityId, "Duplicate task");
```

---

## Usage Patterns

### Pattern 1: Simple Update with Tracking

```typescript
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const body = await req.json();
  const taskId = params.id;

  // 1. Fetch old state BEFORE update
  const oldTask = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!oldTask) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 2. Perform update
  const newTask = await prisma.task.update({
    where: { id: taskId },
    data: body,
  });

  // 3. Log with before/after values
  await logUpdate(
    "TASKS",
    "Task",
    taskId,
    oldTask,      // Before
    newTask,      // After
    session.user.userId,
    newTask.entityId
  );

  return NextResponse.json(newTask);
}
```

### Pattern 2: Tracked Fields Only

```typescript
// Only track specific sensitive fields
await logUpdate(
  "TASKS",
  "Task",
  taskId,
  oldTask,
  newTask,
  userId,
  entityId,
  ["status", "picId", "reviewerId"] // Only track these fields
);
```

### Pattern 3: Bulk Operations with Change Tracking

```typescript
export async function POST(req: NextRequest) {
  const { taskIds, updates } = await req.json();
  
  // Fetch all old states
  const oldTasks = await prisma.task.findMany({
    where: { id: { in: taskIds } },
  });

  // Create lookup map
  const oldTasksMap = new Map(oldTasks.map(t => [t.id, t]));

  // Update in transaction
  const newTasks = await prisma.$transaction(
    taskIds.map((id: string) =>
      prisma.task.update({
        where: { id },
        data: updates,
      })
    )
  );

  // Log changes for each task
  await Promise.all(
    newTasks.map((newTask) => {
      const oldTask = oldTasksMap.get(newTask.id);
      if (oldTask) {
        return logUpdate(
          "TASKS",
          "Task",
          newTask.id,
          oldTask,
          newTask,
          session.user.userId,
          newTask.entityId
        );
      }
    })
  );

  return NextResponse.json({ success: true, updated: newTasks.length });
}
```

### Pattern 4: Soft Delete with Full State

```typescript
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const taskId = params.id;
  
  // Get current state
  const oldTask = await prisma.task.findUnique({
    where: { id: taskId },
    include: { evidence: true, comments: true }, // Include relations
  });

  if (!oldTask) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Soft delete
  const deletedTask = await prisma.task.update({
    where: { id: taskId },
    data: createSoftDeleteData(session.user.userId, "User requested deletion"),
  });

  // Log with full state snapshot
  await logDelete(
    "TASKS",
    "Task",
    taskId,
    oldTask,  // Full state including relations
    session.user.userId,
    oldTask.entityId,
    "User requested deletion",
    true  // softDelete flag
  );

  return NextResponse.json({ success: true });
}
```

### Pattern 5: Specific Field Changes

```typescript
// For actions targeting specific fields
export async function POST(req: NextRequest) {
  const { taskId, newPicId } = await req.json();
  
  const oldTask = await prisma.task.findUnique({ where: { id: taskId } });
  
  const newTask = await prisma.task.update({
    where: { id: taskId },
    data: { picId: newPicId },
  });

  // Audit log automatically captures the specific change
  await logAuditEvent({
    action: "TASK_PIC_CHANGED",
    module: "TASKS",
    userId: session.user.userId,
    targetType: "Task",
    targetId: taskId,
    oldValues: oldTask,
    newValues: newTask,
    // Changes are automatically computed:
    // { field: "picId", oldValue: "user-123", newValue: "user-456" }
  });

  return NextResponse.json(newTask);
}
```

---

## Audit Log Format

### Complete Audit Entry

```json
{
  "id": "audit-uuid",
  "action": "TASK_UPDATED",
  "module": "TASKS",
  "userId": "user-123",
  "entityId": "entity-456",
  "targetType": "Task",
  "targetId": "task-789",
  "details": {
    "changes": [
      {
        "field": "status",
        "oldValue": "IN_PROGRESS",
        "newValue": "COMPLETED",
        "changed": true
      },
      {
        "field": "picId",
        "oldValue": "user-123",
        "newValue": "user-456",
        "changed": true
      },
      {
        "field": "completedAt",
        "oldValue": null,
        "newValue": "2026-03-15T10:30:00.000Z",
        "changed": true
      }
    ],
    "oldValues": {
      "id": "task-789",
      "name": "Complete Audit",
      "status": "IN_PROGRESS",
      "picId": "user-123",
      "completedAt": null,
      "dueDate": "2026-03-15"
    },
    "newValues": {
      "id": "task-789",
      "name": "Complete Audit",
      "status": "COMPLETED",
      "picId": "user-456",
      "completedAt": "2026-03-15T10:30:00.000Z",
      "dueDate": "2026-03-15"
    },
    "changedFields": ["status", "picId", "completedAt"],
    "changeCount": 3
  },
  "ipAddress": "192.168.1.100",
  "createdAt": "2026-03-15T10:30:00.000Z"
}
```

---

## Advanced Features

### 1. Sensitive Data Redaction

Automatically redacts sensitive fields:

```typescript
const oldUser = {
  email: "user@example.com",
  passwordHash: "bcrypt-hash-here",
  name: "John Doe"
};

// Automatically becomes:
{
  email: "user@example.com",
  passwordHash: "[REDACTED]",
  name: "John Doe"
}
```

### 2. Deep Comparison

Handles complex data types:

```typescript
// Dates
oldValue: new Date("2026-01-15")
newValue: new Date("2026-01-20")
→ changed: true

// Arrays
oldValue: ["tag1", "tag2"]
newValue: ["tag1", "tag2", "tag3"]
→ changed: true

// Objects
oldValue: { status: "TO_DO", priority: 1 }
newValue: { status: "IN_PROGRESS", priority: 1 }
→ changed: true
```

### 3. Change Summaries

Human-readable change descriptions:

```typescript
const changes = captureChanges(oldTask, newTask);
const summary = formatChanges(changes);

// Returns: "status: IN_PROGRESS → COMPLETED, picId: user-123 → user-456"
```

### 4. Audit Snapshots

Get state before changes:

```typescript
// Before making changes, get snapshot
const snapshot = await getAuditSnapshot(
  prisma.task,
  { id: taskId },
  { include: { entity: true, pic: true } }
);

// Make changes...

// Log with snapshot
await logUpdate("TASKS", "Task", taskId, snapshot, newTask, userId);
```

---

## Query Patterns

### Find All Changes to a Record

```typescript
const taskHistory = await prisma.auditLog.findMany({
  where: {
    targetType: "Task",
    targetId: taskId,
  },
  orderBy: { createdAt: "desc" },
});

// Reconstruct timeline:
taskHistory.forEach((log) => {
  const changes = log.details.changes;
  console.log(`${log.createdAt}: ${log.action}`);
  changes.forEach((change) => {
    console.log(`  ${change.field}: ${change.oldValue} → ${change.newValue}`);
  });
});
```

### Find Who Changed a Specific Field

```typescript
const picChanges = await prisma.auditLog.findMany({
  where: {
    targetType: "Task",
    targetId: taskId,
    details: {
      path: ["changedFields"],
      array_contains: "picId",
    },
  },
  include: { user: true },
});
```

### Generate Change Report

```typescript
const changes = await prisma.auditLog.findMany({
  where: {
    entityId,
    createdAt: {
      gte: startDate,
      lte: endDate,
    },
  },
  include: { user: true },
});

const report = changes.map((log) => ({
  date: log.createdAt,
  user: log.user.name,
  action: log.action,
  changes: log.details.changes,
  summary: formatChanges(log.details.changes),
}));
```

---

## Benefits

### Before (No Old Values)
```json
{
  "action": "TASK_PIC_CHANGED",
  "details": { "newPicId": "user-456" }
}
```
❌ Cannot answer: "Who was the PIC before?"  
❌ Cannot reconstruct: Previous state  
❌ Cannot revert: No old value to restore  

### After (With Old Values)
```json
{
  "action": "TASK_PIC_CHANGED",
  "details": {
    "changes": [{
      "field": "picId",
      "oldValue": "user-123",
      "newValue": "user-456",
      "changed": true
    }]
  }
}
```
✅ Can answer: "user-123 was the PIC before"  
✅ Can reconstruct: Full change history  
✅ Can revert: Restore oldValue  

### Impact Summary

| Capability | Before | After |
|-----------|--------|-------|
| **Compliance** | ❌ Incomplete trail | ✅ Full trail |
| **Investigation** | ❌ Missing context | ✅ Complete context |
| **Rollback** | ❌ Impossible | ✅ Possible |
| **Historical Reports** | ❌ Cannot generate | ✅ Can generate |
| **Accountability** | ❌ Partial | ✅ Complete |

---

## Migration

### Updating Existing Code

**Before:**
```typescript
await prisma.task.update({ where: { id }, data: updates });

await logAuditEvent({
  action: "TASK_UPDATED",
  module: "TASKS",
  userId,
  targetId: id,
  details: updates,  // Only new values
});
```

**After:**
```typescript
const oldTask = await prisma.task.findUnique({ where: { id } });
const newTask = await prisma.task.update({ where: { id }, data: updates });

await logUpdate("TASKS", "Task", id, oldTask, newTask, userId);
// Or
await logAuditEvent({
  action: "TASK_UPDATED",
  module: "TASKS",
  userId,
  targetId: id,
  oldValues: oldTask,  // ✅ Added
  newValues: newTask,  // ✅ Added
});
```

---

## Testing

```typescript
describe("Enhanced Audit Logging", () => {
  it("captures before and after values", async () => {
    const oldTask = { id: "1", status: "TO_DO", picId: "user-1" };
    const newTask = { id: "1", status: "COMPLETED", picId: "user-2" };

    await logUpdate("TASKS", "Task", "1", oldTask, newTask, "user-admin");

    const log = await prisma.auditLog.findFirst({
      where: { targetId: "1" },
      orderBy: { createdAt: "desc" },
    });

    expect(log.details.changes).toHaveLength(2);
    expect(log.details.changes[0].field).toBe("status");
    expect(log.details.changes[0].oldValue).toBe("TO_DO");
    expect(log.details.changes[0].newValue).toBe("COMPLETED");
  });

  it("only logs fields that actually changed", async () => {
    const oldTask = { id: "1", status: "TO_DO", name: "Task" };
    const newTask = { id: "1", status: "TO_DO", name: "Task" };

    const changes = captureChanges(oldTask, newTask);
    const changedFields = changes.filter((c) => c.changed);

    expect(changedFields).toHaveLength(0);
  });
});
```

---

**Status:** ✅ Complete  
**Priority:** Critical (compliance, security, accountability)  
**Risk:** Low (additive change, backward compatible)  
**Impact:** Complete audit trail for compliance and security
