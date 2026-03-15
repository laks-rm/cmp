# Fix 36: Comments API Security & Functionality Issues

## Problem

**File:** `src/app/api/comments/route.ts`

The comments API route has several critical security and functionality issues:

### 1. ❌ No Rate Limiting
- Not wrapped with `withApiHandler`
- Vulnerable to comment spam attacks
- No protection against abuse

### 2. ❌ Missing Authorization Check on GET
- GET endpoint checks `TASKS.VIEW` permission but doesn't verify entity access
- User can fetch comments for tasks/findings outside their entity scope
- **CRITICAL SECURITY VULNERABILITY**

### 3. ❌ No Pagination
- Returns ALL comments for a task/finding
- Performance issue for tasks with many comments
- Potential DoS vector (fetch thousands of comments)

### 4. ⚠️ Limited XSS Prevention
- Validation trims and limits length (2000 chars)
- But no explicit HTML sanitization
- Content stored as plain text (good) but needs client-side sanitization on display

### 5. ⚠️ No Soft Delete Support
- Doesn't filter soft-deleted tasks/findings
- Should not allow comments on deleted entities

### 6. ⚠️ Incomplete Audit Logging
- POST logs comment creation ✓
- GET doesn't log access (minor, but useful for security audits)
- No log for comment deletion (DELETE endpoint missing)

---

## Impact

### Security Risks
- **HIGH:** Entity access bypass on GET (users can read comments from other entities)
- **MEDIUM:** Comment spam without rate limiting
- **LOW:** XSS if client doesn't sanitize (needs verification)

### Performance Issues
- **MEDIUM:** Fetching all comments without pagination
- **LOW:** N+1 query potential (already uses include, so mitigated)

### Functionality Gaps
- **MEDIUM:** No comment deletion capability
- **MEDIUM:** No comment editing capability
- **LOW:** No pagination for large comment threads

---

## Solution

### 1. Add Rate Limiting & Concurrent Request Protection

Wrap endpoints with `withApiHandler` or add rate limiting manually:

```typescript
import { hitApiRateLimit } from "@/lib/rate-limit";
import { acquireConcurrentSlot, createConcurrentLimitResponse } from "@/lib/concurrentLimit";

export async function POST(req: NextRequest) {
  let releaseSlot: (() => void) | undefined;
  
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting (prevent spam)
    if (await hitApiRateLimit(session.user.userId)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later.", code: "RATE_LIMIT_EXCEEDED" },
        { status: 429 }
      );
    }

    // Concurrent request limit (prevent abuse)
    releaseSlot = await acquireConcurrentSlot(session.user.userId, {
      maxConcurrent: 10,
      errorMessage: "Too many concurrent comment operations. Please wait.",
    });

    if (!releaseSlot) {
      return createConcurrentLimitResponse();
    }

    // ... rest of POST logic
  } finally {
    if (releaseSlot) releaseSlot();
  }
}
```

### 2. Fix Authorization on GET Endpoint

**CRITICAL FIX:** Verify entity access before returning comments:

```typescript
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requirePermission(session, "TASKS", "VIEW");

    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");
    const findingId = searchParams.get("findingId");

    if (!taskId && !findingId) {
      return NextResponse.json({ error: "Either taskId or findingId is required" }, { status: 400 });
    }

    // ✅ VERIFY ENTITY ACCESS BEFORE FETCHING COMMENTS
    if (taskId) {
      const task = await prisma.task.findUnique({
        where: { id: taskId, deletedAt: null }, // Also check not soft-deleted
        select: { entityId: true },
      });

      if (!task) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      if (!session.user.entityIds.includes(task.entityId)) {
        return NextResponse.json({ error: "Access denied to this task" }, { status: 403 });
      }
    }

    if (findingId) {
      const finding = await prisma.finding.findUnique({
        where: { id: findingId, deletedAt: null }, // Also check not soft-deleted
        select: { entityId: true },
      });

      if (!finding) {
        return NextResponse.json({ error: "Finding not found" }, { status: 404 });
      }

      if (!session.user.entityIds.includes(finding.entityId)) {
        return NextResponse.json({ error: "Access denied to this finding" }, { status: 403 });
      }
    }

    // Now safe to fetch comments
    const comments = await prisma.comment.findMany({
      where: {
        ...(taskId && { taskId }),
        ...(findingId && { findingId }),
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            initials: true,
            avatarColor: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(comments);
  } catch (error) {
    // ... error handling
  }
}
```

### 3. Add Pagination

```typescript
export async function GET(req: NextRequest) {
  // ... authentication and authorization checks ...

  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const skip = (page - 1) * limit;

  const [comments, totalCount] = await Promise.all([
    prisma.comment.findMany({
      where: {
        ...(taskId && { taskId }),
        ...(findingId && { findingId }),
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            initials: true,
            avatarColor: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
      skip,
      take: limit,
    }),
    prisma.comment.count({
      where: {
        ...(taskId && { taskId }),
        ...(findingId && { findingId }),
      },
    }),
  ]);

  return NextResponse.json({
    comments,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      hasMore: skip + comments.length < totalCount,
    },
  });
}
```

### 4. XSS Prevention

**Server-side:** Already done via validation (trim, max length)

**Client-side:** Must sanitize when displaying:

```typescript
// In React component
import DOMPurify from 'dompurify';

function CommentDisplay({ comment }: { comment: Comment }) {
  return (
    <div 
      dangerouslySetInnerHTML={{ 
        __html: DOMPurify.sanitize(comment.content) 
      }} 
    />
  );
}
```

Or better, display as plain text (already done in most React apps by default):

```typescript
<div>{comment.content}</div> {/* React auto-escapes */}
```

### 5. Add DELETE Endpoint

```typescript
export async function DELETE(req: NextRequest) {
  let releaseSlot: (() => void) | undefined;
  
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting
    if (await hitApiRateLimit(session.user.userId)) {
      return NextResponse.json(
        { error: "Rate limit exceeded", code: "RATE_LIMIT_EXCEEDED" },
        { status: 429 }
      );
    }

    // Concurrent request limit
    releaseSlot = await acquireConcurrentSlot(session.user.userId);
    if (!releaseSlot) {
      return createConcurrentLimitResponse();
    }

    const { searchParams } = new URL(req.url);
    const commentId = searchParams.get("id");

    if (!commentId) {
      return NextResponse.json({ error: "Comment ID required" }, { status: 400 });
    }

    // Fetch comment with entity access check
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        task: { select: { entityId: true } },
        finding: { select: { entityId: true } },
      },
    });

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Verify user can delete (must be author OR have admin permission)
    const isAuthor = comment.authorId === session.user.userId;
    const hasAdminPermission = session.user.permissions.includes("TASKS:DELETE");
    
    if (!isAuthor && !hasAdminPermission) {
      return NextResponse.json(
        { error: "You can only delete your own comments" },
        { status: 403 }
      );
    }

    // Verify entity access
    const entityId = comment.task?.entityId || comment.finding?.entityId;
    if (entityId && !session.user.entityIds.includes(entityId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Delete comment
    await prisma.comment.delete({
      where: { id: commentId },
    });

    // Audit log
    await logAuditEvent({
      action: "COMMENT_DELETED",
      module: "TASKS",
      userId: session.user.userId,
      targetType: comment.taskId ? "Task" : "Finding",
      targetId: comment.taskId || comment.findingId || undefined,
      details: {
        commentId: comment.id,
        deletedByAuthor: isAuthor,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Comment deletion error:", error);
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  } finally {
    if (releaseSlot) releaseSlot();
  }
}
```

---

## Files to Modify

1. **`src/app/api/comments/route.ts`** - Main fixes
2. **`src/lib/validations/evidence.ts`** - Add query validation schema
3. **Client components using comments** - Verify XSS prevention

---

## Testing Checklist

### Security Tests

#### 1. Authorization Bypass Test (GET)
```bash
# User A (entity: DIEL)
curl -H "Cookie: ..." http://localhost:3000/api/comments?taskId=TASK_IN_DGL

# Expected: 403 Forbidden
# Before fix: Returns comments (SECURITY VULNERABILITY)
```

#### 2. Authorization Bypass Test (POST)
```bash
# User A (entity: DIEL)
curl -X POST -H "Cookie: ..." \
  -d '{"content":"test","taskId":"TASK_IN_DGL"}' \
  http://localhost:3000/api/comments

# Expected: 403 Forbidden
# Current: Already blocks correctly ✓
```

#### 3. Rate Limiting Test
```bash
# Send 101 requests rapidly
for i in {1..101}; do
  curl -X POST -H "Cookie: ..." \
    -d '{"content":"spam","taskId":"..."}' \
    http://localhost:3000/api/comments
done

# Expected: 429 after 100 requests
# Before fix: No limit (spam vulnerability)
```

#### 4. Soft Delete Test
```bash
# Soft delete a task
curl -X DELETE http://localhost:3000/api/tasks/TASK_ID

# Try to fetch comments
curl http://localhost:3000/api/comments?taskId=TASK_ID

# Expected: 404 Not Found
# Before fix: Returns comments
```

### Functionality Tests

#### 5. Pagination Test
```bash
# Fetch page 1
curl "http://localhost:3000/api/comments?taskId=...&page=1&limit=10"

# Verify response includes pagination metadata
# Expected: { comments: [...], pagination: { page, limit, totalCount, totalPages, hasMore } }
```

#### 6. Delete Own Comment
```bash
# Create comment
COMMENT_ID=$(curl -X POST ... | jq -r '.id')

# Delete own comment
curl -X DELETE "http://localhost:3000/api/comments?id=$COMMENT_ID"

# Expected: 200 OK
```

#### 7. Delete Other's Comment (Non-Admin)
```bash
# User A creates comment
# User B (non-admin) tries to delete
curl -X DELETE "http://localhost:3000/api/comments?id=$COMMENT_ID"

# Expected: 403 Forbidden
```

---

## Priority & Risk

**Priority:** HIGH  
**Risk Level:** CRITICAL (Authorization bypass)  
**Effort:** Medium (3-4 hours)

**Must Fix:**
1. ❌ **Authorization check on GET** (CRITICAL)
2. ❌ **Rate limiting** (HIGH)
3. ❌ **Soft delete check** (MEDIUM)

**Should Fix:**
4. ⚠️ **Pagination** (MEDIUM)
5. ⚠️ **DELETE endpoint** (MEDIUM)

**Nice to Have:**
6. ⚠️ **PATCH endpoint for editing** (LOW)
7. ⚠️ **Audit log for GET** (LOW)

---

## Comparison with Best Practices

| Security Control | Current | Required | Status |
|------------------|---------|----------|--------|
| Authentication | ✅ Yes | ✅ Yes | PASS |
| Authorization (POST) | ✅ Yes | ✅ Yes | PASS |
| **Authorization (GET)** | ❌ **No** | ✅ **Yes** | **FAIL** |
| Rate Limiting | ❌ No | ✅ Yes | FAIL |
| Input Validation | ✅ Yes | ✅ Yes | PASS |
| XSS Prevention (Server) | ✅ Yes | ✅ Yes | PASS |
| XSS Prevention (Client) | ⚠️ Unknown | ✅ Yes | VERIFY |
| Audit Logging | ⚠️ Partial | ✅ Complete | PARTIAL |
| Pagination | ❌ No | ✅ Yes | FAIL |
| Soft Delete Check | ❌ No | ✅ Yes | FAIL |

**Score:** 4/10 (CRITICAL ISSUES PRESENT)

---

## Related Security Fixes

- **Fix 4:** Permission Cache Poisoning (permissions caching issue)
- **Fix 10:** Evidence Upload Missing Authorization Check (similar issue)
- **Fix 26:** No Concurrent Request Limit Per User (spam prevention)

The comments API has the same authorization pattern issues found in other endpoints.

---

## Summary

The comments API route has a **CRITICAL security vulnerability** where the GET endpoint doesn't verify entity access, allowing users to read comments from tasks/findings outside their scope. Additionally, it lacks rate limiting (spam vulnerability), pagination (performance issue), and soft delete checking.

**Immediate Action Required:**
1. Add entity access verification to GET endpoint
2. Implement rate limiting and concurrent request limits
3. Add soft delete checks
4. Implement pagination
5. Add DELETE endpoint with proper authorization

---

**Status:** ❌ Critical Issues Found  
**Next Step:** Implement fixes immediately  
**Priority:** HIGH  
**Security Impact:** CRITICAL
