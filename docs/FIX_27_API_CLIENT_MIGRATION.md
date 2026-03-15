# Fix 27: Replace Direct Fetch with API Client

## Problem

**Issue:** 19 components use `fetch()` directly instead of the centralized API client.

**Impact:**
- Inconsistent error handling across components
- No automatic retry logic for transient failures
- Manual error message handling (duplicated code)
- No request interceptors (harder to add auth tokens, headers)
- No type safety for responses
- Difficult to add global request/response transforms
- Missing 429 handling for concurrent limits

**Example Anti-Pattern:**
```typescript
// Bad: Manual error handling, no retries, no type safety
const res = await fetch('/api/tasks');
if (!res.ok) {
  toast.error("Failed to load tasks");
  return;
}
const data = await res.json();
```

## Solution

Enhanced the API client (`src/lib/api-client.ts`) with:

1. **Automatic retry logic** for transient failures (408, 429, 500, 502, 503, 504)
2. **Respect Retry-After headers** for 429 responses
3. **Type-safe responses** with TypeScript generics
4. **Consistent error handling** with automatic toast notifications
5. **Helper methods** (`get`, `post`, `put`, `patch`, `del`)
6. **Configurable options** (showErrorToast, retries, retryDelay)

**Good Pattern:**
```typescript
// Good: Type-safe, automatic error handling, retry logic
import { fetchApi } from '@/lib/api-client';

const data = await fetchApi<{ tasks: Task[]; pagination: { total: number } }>('/api/tasks');
// Errors are automatically handled with toast notifications
// Retries happen automatically for transient failures
// Type-safe response
```

## Enhanced API Client Features

### New Options

```typescript
interface FetchApiOptions extends RequestInit {
  showErrorToast?: boolean;      // Show error toasts (default: true)
  retries?: number;               // Retry attempts (default: 0)
  retryDelay?: number;            // Delay between retries (default: 1000ms)
  retryOn?: number[];             // Status codes to retry (default: [408, 429, 500, 502, 503, 504])
  parseJson?: boolean;            // Auto-parse JSON (default: true)
}
```

### Helper Methods

```typescript
// Simplified methods for common operations
await get<Task[]>('/api/tasks');
await post<Task>('/api/tasks', { name: 'New Task' });
await put<Task>('/api/tasks/123', { status: 'COMPLETED' });
await patch<Task>('/api/tasks/123', { status: 'IN_PROGRESS' });
await del<void>('/api/tasks/123');
```

### Retry Logic

- Automatically retries on: 408 (Timeout), 429 (Rate Limit), 500, 502, 503, 504
- Respects `Retry-After` header for 429 responses
- Exponential backoff configurable
- Network errors also retry if configured

### 429 Handling

Now distinguishes between rate limiting and concurrent limiting:

```typescript
case 429:
  if (errorCode === "CONCURRENT_LIMIT_HIT") {
    toast.error("Too many concurrent requests. Please wait a moment.");
  } else {
    toast.error("Too many requests. Please slow down.");
  }
  break;
```

## Files Refactored

### 1. ✅ TaskTrackerClient.tsx
**Location:** `src/components/tasks/TaskTrackerClient.tsx`

**Changes:**
- Added `import { fetchApi } from "@/lib/api-client"`
- Replaced 3 `fetch()` calls with `fetchApi()`
- Removed manual error handling (now automatic)
- Added type safety to responses

**Before/After:**
```typescript
// Before
const res = await fetch(`/api/tasks?${params.toString()}`);
const data = await res.json();

// After
const data = await fetchApi<{ tasks: Task[]; pagination: { total: number } }>(`/api/tasks?${params.toString()}`);
```

### 2. ⏳ TaskDetailModal.tsx (PENDING)
**Location:** `src/components/tasks/TaskDetailModal.tsx`

**Expected changes:**
- Import `fetchApi`
- Replace fetch calls for task details, evidence, comments
- Add type safety

### 3. ⏳ CalendarClient.tsx (PENDING)
**Location:** `src/components/calendar/CalendarClient.tsx`

### 4. ⏳ NotificationBell.tsx (PENDING)
**Location:** `src/components/layout/NotificationBell.tsx`

### 5. ⏳ Admin Components (PENDING)
- `src/components/admin/TeamsWorkflowsTab.tsx`
- `src/components/admin/EntitiesTab.tsx`
- `src/components/admin/RolesPermissionsTab.tsx`
- `src/components/admin/UsersAccessTab.tsx`
- `src/components/admin/ErrorDetailModal.tsx`
- `src/components/admin/ErrorLogsClient.tsx`

### 6. ⏳ Other Components (PENDING)
- `src/components/audit-log/AuditLogClient.tsx`
- `src/components/findings/FindingsClient.tsx`
- `src/components/findings/FindingDetailModal.tsx`
- `src/components/findings/FindingModal.tsx`
- `src/components/sources/SourcesClient.tsx`
- `src/components/sources/SourceWizard.tsx`
- `src/components/reports/ReportsClient.tsx`
- `src/components/reviews/ReviewQueueClient.tsx`

### 7. ⏳ Error Logger (PENDING)
**Location:** `src/lib/errorLogger.ts`
- Special case: needs `parseJson: false` for blob responses

## Migration Pattern

### Simple GET Request

```typescript
// Before
const res = await fetch('/api/tasks');
if (!res.ok) {
  toast.error("Failed to load tasks");
  return;
}
const tasks = await res.json();

// After
import { fetchApi } from '@/lib/api-client';
const tasks = await fetchApi<Task[]>('/api/tasks');
```

### POST with Data

```typescript
// Before
const res = await fetch('/api/tasks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'New Task' }),
});
if (!res.ok) {
  toast.error("Failed to create task");
  return;
}
const task = await res.json();

// After
import { post } from '@/lib/api-client';
const task = await post<Task>('/api/tasks', { name: 'New Task' });
```

### PATCH/PUT

```typescript
// Before
const res = await fetch(`/api/tasks/${id}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'COMPLETED' }),
});
if (!res.ok) {
  toast.error("Failed to update task");
  return;
}

// After
import { patch } from '@/lib/api-client';
await patch<Task>(`/api/tasks/${id}`, { status: 'COMPLETED' });
```

### DELETE

```typescript
// Before
const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
if (!res.ok) {
  toast.error("Failed to delete task");
  return;
}

// After
import { del } from '@/lib/api-client';
await del<void>(`/api/tasks/${id}`);
```

### With Retry Logic

```typescript
// For expensive/slow operations that may timeout
const data = await fetchApi<Data>('/api/expensive-operation', {
  retries: 3,
  retryDelay: 2000,
});
```

### Silent Errors (No Toast)

```typescript
// For polling or background operations
const status = await fetchApi<Status>('/api/status', {
  showErrorToast: false,
});
```

### FormData/File Uploads

```typescript
// File uploads still need manual fetch (no JSON body)
const formData = new FormData();
formData.append('file', file);

const res = await fetch('/api/upload', {
  method: 'POST',
  body: formData, // Don't stringify!
});

if (!res.ok) {
  toast.error("Upload failed");
  return;
}

const result = await res.json();
```

## Benefits

### 1. **Consistent Error Handling**
- All API errors show appropriate toast notifications
- 401 errors auto-redirect to login
- 429 errors show concurrent vs rate limit messages
- No duplicated error handling code

### 2. **Automatic Retries**
- Transient failures (timeouts, 5xx errors) retry automatically
- Respects server `Retry-After` headers
- Configurable retry attempts and delays

### 3. **Type Safety**
- TypeScript generics ensure response types match expectations
- Compile-time checking for API contracts
- Better IDE autocomplete

### 4. **Network Error Handling**
- Automatic detection of network failures
- User-friendly "check your connection" messages
- Retry logic for intermittent connectivity

### 5. **Code Reduction**
- Removes ~10-15 lines of boilerplate per API call
- Eliminates duplicate error handling logic
- Cleaner, more readable component code

### 6. **Future Extensibility**
- Easy to add global request interceptors (auth tokens, tracking)
- Easy to add global response transforms (camelCase conversion)
- Easy to add request/response logging
- Easy to add metrics/analytics

## Testing

### Manual Testing

1. **Test successful requests:**
```bash
# Should work normally
curl http://localhost:3000/api/tasks
```

2. **Test error handling:**
```bash
# 404 - should show "Resource not found" toast
curl http://localhost:3000/api/tasks/invalid-id

# 429 - should show rate limit toast
# (trigger by making many rapid requests)
```

3. **Test retry logic:**
```bash
# Temporarily break the server to test retries
# Should see console warnings about retries
```

4. **Test network errors:**
```bash
# Disconnect network, try to load page
# Should show "Network error. Please check your connection."
```

### Code Review Checklist

For each component refactored:
- [ ] Import `fetchApi` (or helper methods) added
- [ ] All `fetch()` calls replaced
- [ ] Manual error handling removed (except special cases)
- [ ] Response types added with TypeScript generics
- [ ] Manual toast errors removed (automatic now)
- [ ] FormData uploads still use manual `fetch` (correct)
- [ ] No linter errors introduced

## Deployment Checklist

- [x] API client enhanced with retry logic
- [x] Helper methods added (get, post, put, patch, del)
- [x] 429 handling improved for concurrent limits
- [x] TaskTrackerClient.tsx refactored
- [ ] Refactor remaining 18 components
- [ ] Test all refactored components
- [ ] Monitor error rates in production
- [ ] Adjust retry settings based on real-world usage

## Performance Impact

### Positive Impacts
- **Fewer failed requests** due to automatic retries
- **Better user experience** with consistent error messages
- **Reduced server load** from respecting Retry-After headers
- **Fewer support tickets** from clear error messages

### Considerations
- **Retry overhead** - Failed requests take longer (configurable)
- **Network traffic** - Retries increase traffic slightly (only for failures)

**Recommendation:** Start with conservative retry settings (1-2 retries) and adjust based on metrics.

## Future Enhancements

1. **Request Caching** - Cache GET requests with TTL
2. **Request Deduplication** - Prevent duplicate simultaneous requests
3. **Optimistic Updates** - Update UI before server response
4. **Request Queue** - Queue requests during offline mode
5. **Metrics/Telemetry** - Track API performance and error rates
6. **AbortController** - Cancel requests when component unmounts

## Related Fixes

- **Fix 26:** Concurrent request limiting (now properly handled in API client)
- **Fix 9:** Idempotency for bulk operations
- **Fix 27:** Direct fetch replacement (THIS FIX)

---

**Status:** 🚧 In Progress (1/19 components refactored)  
**Priority:** High (improves reliability and maintainability)  
**Risk Level:** Low (backward compatible, gradual rollout)  
**Estimated Time:** 2-3 hours for all 19 components
