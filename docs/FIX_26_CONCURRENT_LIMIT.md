# Fix 26: Concurrent Request Limiting

## Problem

**Issue:** Missing concurrent request limit per user.

**Impact:**
- Users could open 100 browser tabs and make 100 simultaneous requests
- Each request counted separately against rate limit, but all ran concurrently
- Resource exhaustion on server (database connections, memory, CPU)
- Potential for denial-of-service (DoS) through legitimate API abuse
- Expensive operations (AI extraction, bulk operations) could stack up
- Database connection pool could be depleted

**Example Attack Vector:**
```javascript
// User opens 50 tabs and runs this in each:
for (let i = 0; i < 100; i++) {
  fetch('/api/tasks/bulk', {
    method: 'POST',
    // ... bulk update 1000 tasks
  });
}
// Result: 5000 concurrent bulk operations!
```

## Solution

Implemented per-user concurrent request limiting with:

1. **In-memory tracking** of active requests per user
2. **Automatic cleanup** via `finally` blocks
3. **Per-endpoint limits** based on resource intensity
4. **Audit logging** for security monitoring

## Files Modified

### 1. Core Rate Limiting Module
**File:** `src/lib/rate-limit.ts`

**Changes:**
- Added `concurrentRequestsStore` Map to track active requests per user
- Implemented `checkConcurrentLimit()` to validate and increment counter
- Implemented `releaseConcurrentSlot()` to decrement counter with automatic cleanup
- Added `getConcurrentCount()` for monitoring

**Key Functions:**
```typescript
export function checkConcurrentLimit(userId: string, maxConcurrent = 10): boolean
export function releaseConcurrentSlot(userId: string): void
export function getConcurrentCount(userId: string): number
```

### 2. Concurrent Limit Utilities (NEW)
**File:** `src/lib/concurrentLimit.ts`

**Purpose:** High-level utilities for easy integration into API routes.

**Exports:**
- `acquireConcurrentSlot()` - Acquire slot with automatic audit logging
- `createConcurrentLimitResponse()` - Standard 429 response
- `withConcurrentLimit()` - Wrapper for handler functions

**Usage Example:**
```typescript
export async function POST(req: NextRequest) {
  let releaseSlot: (() => void) | undefined;
  
  try {
    const session = await getServerSession(authOptions);
    releaseSlot = await acquireConcurrentSlot(session.user.userId, {
      maxConcurrent: 5,
      errorMessage: "Too many operations in progress.",
    });
    
    if (!releaseSlot) {
      return createConcurrentLimitResponse();
    }

    // ... route logic ...

  } finally {
    releaseSlot?.();  // CRITICAL: Always release
  }
}
```

### 3. API Handler Wrapper
**File:** `src/lib/api.ts`

**Changes:**
- Added concurrent limiting to `withApiHandler()` wrapper
- Check happens BEFORE rate limiting (prevents resource acquisition)
- Automatic cleanup in `finally` block
- Audit logging with action `CONCURRENT_LIMIT_HIT`

**Order of checks:**
1. Authentication
2. **Concurrent limit** (NEW - prevents resource exhaustion)
3. Rate limit (prevents request spam over time)
4. Permission check
5. Handler execution

### 4. Applied to Resource-Intensive Endpoints

#### a. Bulk Operations
**File:** `src/app/api/tasks/bulk/route.ts`
- **Limit:** 5 concurrent requests
- **Reason:** Database intensive, long transactions, workflow validation

#### b. AI Extraction
**File:** `src/app/api/sources/ai-extract/route.ts`
- **Limit:** 2 concurrent requests
- **Reason:** Very expensive API calls ($0.003-0.015 per 1K tokens), high latency

#### c. Task Generation
**File:** `src/app/api/sources/[id]/generate/route.ts`
- **Limit:** 3 concurrent requests
- **Reason:** Creates hundreds of tasks, 2-minute transactions

#### d. File Uploads
**File:** `src/app/api/evidence/route.ts`
- **Limit:** 5 concurrent requests
- **Reason:** I/O intensive, large file handling

## Limits by Endpoint Type

| Endpoint Type | Max Concurrent | Reason |
|--------------|----------------|---------|
| **Bulk Operations** | 5 | Database intensive, transaction heavy |
| **AI Extraction** | 2 | Very expensive API calls, high latency |
| **Task Generation** | 3 | Creates hundreds of tasks, long transactions |
| **File Uploads** | 5 | I/O intensive, storage operations |
| **General API** | 10 | Standard operations (via `withApiHandler`) |

## Response Format

When concurrent limit is exceeded:

**Status:** `429 Too Many Requests`

**Headers:**
```
Retry-After: 5
```

**Body:**
```json
{
  "error": "Too many concurrent requests. Please wait for previous requests to complete.",
  "code": "CONCURRENT_LIMIT_HIT",
  "retryAfter": 5
}
```

## Security Features

### 1. Audit Logging
Every concurrent limit hit is logged:
```typescript
{
  action: "CONCURRENT_LIMIT_HIT",
  module: "SECURITY",
  userId: "user-id",
  details: {
    route: "/api/tasks/bulk",
    currentCount: 10,
    maxConcurrent: 10,
    reason: "Too many simultaneous requests"
  }
}
```

### 2. Console Warnings
```
Concurrent request limit exceeded: {
  userId: "user-123",
  current: 10,
  maxConcurrent: 10,
  timestamp: "2026-03-15T10:30:00.000Z"
}
```

### 3. User Isolation
- Counters are per-user (not global)
- One user cannot affect another user's quota
- Prevents denial of service attacks

### 4. Automatic Cleanup
- `finally` blocks ensure slots are ALWAYS released
- Prevents slot leakage on errors/exceptions
- Memory-safe (Map automatically cleans up zero-count entries)

## Testing

### Manual Testing

1. **Test concurrent limit hit:**
```bash
# Terminal 1-5: Start 5 requests simultaneously
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/tasks/bulk \
    -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
    -H "X-Idempotency-Key: test-$i" \
    -d '{"taskIds":["id1"],"action":"assign","assigneeId":"user1"}' &
done

# Terminal 6: This should get 429
curl -X POST http://localhost:3000/api/tasks/bulk \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -H "X-Idempotency-Key: test-6" \
  -d '{"taskIds":["id1"],"action":"assign","assigneeId":"user1"}'
```

2. **Test cleanup (slots released after completion):**
```bash
# Wait for first batch to complete
sleep 5

# This should succeed now
curl -X POST http://localhost:3000/api/tasks/bulk \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -H "X-Idempotency-Key: test-7" \
  -d '{"taskIds":["id1"],"action":"assign","assigneeId":"user1"}'
```

3. **Test error cleanup (slots released even on error):**
```bash
# Send invalid request (should error but still release slot)
curl -X POST http://localhost:3000/api/tasks/bulk \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -H "X-Idempotency-Key: test-8" \
  -d '{"invalid":"data"}'

# Verify slot was released
# Check server logs for cleanup
```

### Load Testing

```bash
# Install hey (HTTP load testing tool)
brew install hey

# Test concurrent requests (should see 429s)
hey -n 100 -c 20 -m POST \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -H "X-Idempotency-Key: load-test" \
  -d '{"taskIds":["id1"],"action":"assign","assigneeId":"user1"}' \
  http://localhost:3000/api/tasks/bulk
```

## Monitoring

### Check Current Usage
```typescript
import { getConcurrentCount } from "@/lib/rate-limit";

const currentCount = getConcurrentCount(userId);
console.log(`User ${userId} has ${currentCount} active requests`);
```

### Query Audit Logs
```sql
-- Find users hitting concurrent limits frequently
SELECT 
  "userId",
  COUNT(*) as hit_count,
  MAX("createdAt") as last_hit
FROM "AuditLog"
WHERE action = 'CONCURRENT_LIMIT_HIT'
  AND "createdAt" > NOW() - INTERVAL '1 day'
GROUP BY "userId"
ORDER BY hit_count DESC;
```

## Performance Impact

### Memory Usage
- **Per User:** 8 bytes (integer counter) + 36 bytes (UUID key) = ~44 bytes
- **For 1000 active users:** ~44 KB
- **Negligible impact**

### CPU Overhead
- Map lookup: O(1)
- Map set: O(1)
- **Negligible impact** (<1ms per request)

### Benefits
- Prevents database connection pool exhaustion
- Prevents memory spikes from concurrent large responses
- Protects expensive third-party API calls (Anthropic)
- Prevents transaction timeouts from queue buildup

## Deployment Checklist

- [x] Core limiting functions implemented
- [x] Applied to resource-intensive endpoints
- [x] Audit logging configured
- [x] Documentation updated (README.md)
- [x] No linter errors
- [ ] Test in staging environment
- [ ] Monitor concurrent limit hits in production
- [ ] Adjust limits based on real-world usage

## Configuration

To adjust limits for specific endpoints, modify the `maxConcurrent` parameter:

```typescript
releaseSlot = await acquireConcurrentSlot(session.user.userId, {
  maxConcurrent: 3,  // Adjust this value
  errorMessage: "Custom error message",
});
```

**Recommended starting values:**
- **AI/LLM operations:** 2-3
- **Bulk database operations:** 3-5
- **File operations:** 5-10
- **General API:** 10-20

**Adjust based on:**
- Server resources (CPU, memory, database connections)
- Endpoint execution time
- Business requirements
- Observed usage patterns

## Future Enhancements

1. **Redis-based tracking** for horizontal scaling
2. **Per-endpoint telemetry** (average concurrent usage)
3. **Dynamic limits** based on system load
4. **User-tier based limits** (premium users get higher limits)
5. **Queue system** for expensive operations (vs immediate rejection)

## Related Fixes

- **Fix 4:** Permission cache poisoning (removed in-memory cache)
- **Fix 9:** Idempotency for bulk operations
- **Fix 14:** AI extraction content limits
- **Fix 26:** Concurrent request limiting (THIS FIX)

All four work together to prevent resource exhaustion and ensure system stability.

---

**Status:** ✅ Complete  
**Tested:** Manual testing complete  
**Risk Level:** Low (graceful degradation, automatic cleanup)  
**Performance Impact:** Negligible (<1ms overhead per request)
