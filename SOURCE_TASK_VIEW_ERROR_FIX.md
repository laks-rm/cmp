# Source Task Management View - Error Fix

**Date:** March 17, 2026  
**Issue:** "Failed to load source tasks" error when viewing `/sources/[id]/tasks`

## Problem Identified

The initial implementation had issues with:
1. **API response structure mismatch** - Expected flat Source object, but API returns nested structure with items and tasks
2. **Parallel fetch failure** - If any API call failed, entire load failed with generic error
3. **Poor error reporting** - Single catch block masked which specific API was failing

## Solution Applied

### 1. **Sequential Fetch with Granular Error Handling**

Changed from:
```typescript
// Old: Parallel fetch - any failure breaks everything
const [sourceData, tasksData, teamsData, usersData] = await Promise.all([...]);
```

To:
```typescript
// New: Sequential with individual try-catch
try {
  const sourceData = await fetchApi(`/api/sources/${sourceId}`);
} catch (error) {
  console.error("Failed to fetch source:", error);
  toast.error(`Failed to load source: ${error.message}`);
  return; // Exit early - can't continue without source
}

try {
  const tasksData = await fetchApi(`/api/tasks?sourceId=${sourceId}`);
} catch (error) {
  console.error("Failed to fetch tasks:", error);
  toast.error(`Failed to load tasks: ${error.message}`);
  // Continue anyway - show source without tasks
}
```

### 2. **Extract Data from Nested API Response**

The `/api/sources/[id]` endpoint returns:
```typescript
{
  id, code, name, sourceType, team, entities,
  items: [{ id, reference, title, ... }],  // Nested!
  // ... other fields
}
```

We now extract what we need:
```typescript
const source: Source = {
  id: sourceData.id,
  code: sourceData.code,
  name: sourceData.name,
  sourceType: sourceData.sourceType,
  team: sourceData.team,
  entities: sourceData.entities,
};
const itemsData: SourceItem[] = sourceData.items || [];
```

### 3. **Graceful Degradation**

- **Source fetch fails** → Show error, stop loading
- **Tasks fetch fails** → Show error, but display source info
- **Teams/users fetch fails** → Continue, editing disabled but view works

### 4. **Better Error Messages**

Each error now shows:
- Which specific resource failed
- The actual error message from API
- Console logs for debugging

## Testing the Fix

### Test Case 1: Normal Flow (All APIs Work)
```
1. Navigate to /sources/[id]/tasks
2. Source loads ✅
3. Items extracted ✅
4. Tasks loaded ✅
5. Teams/users loaded ✅
6. View renders with all features ✅
```

### Test Case 2: Tasks API Fails
```
1. Navigate to /sources/[id]/tasks
2. Source loads ✅
3. Items extracted ✅
4. Tasks fetch fails → Show error toast ⚠️
5. Teams/users loaded ✅
6. View renders with source info, no tasks ⚠️
```

### Test Case 3: Teams API Fails
```
1. Navigate to /sources/[id]/tasks
2. Source loads ✅
3. Items extracted ✅
4. Tasks loaded ✅
5. Teams/users fetch fails (silent) ⚠️
6. View renders, but editing disabled ⚠️
```

## Debugging Steps

If error persists:

### 1. Check Console Logs
Look for specific error messages:
```
Failed to fetch source: [error message]
Failed to fetch tasks: [error message]
Failed to fetch teams/users: [error message]
```

### 2. Test API Endpoints Directly

**Source:**
```bash
curl http://localhost:3000/api/sources/[id] \
  -H "Cookie: [session-cookie]"
```

**Tasks:**
```bash
curl "http://localhost:3000/api/tasks?sourceId=[id]" \
  -H "Cookie: [session-cookie]"
```

**Teams:**
```bash
curl http://localhost:3000/api/teams \
  -H "Cookie: [session-cookie]"
```

**Users:**
```bash
curl http://localhost:3000/api/users/reviewers \
  -H "Cookie: [session-cookie]"
```

### 3. Check Permissions

Error might be 403 Forbidden if:
- User doesn't have `SOURCES.VIEW` permission
- User doesn't have entity access to the source
- User doesn't have `TASKS.READ` permission

### 4. Check Source ID

Verify the source ID in URL actually exists:
```typescript
// Should return 404 if not found
GET /api/sources/[invalid-id]
```

### 5. Check Database

```sql
-- Verify source exists
SELECT id, code, name FROM "Source" WHERE id = '[source-id]';

-- Verify user has entity access
SELECT * FROM "UserEntityAccess" 
WHERE "userId" = '[user-id]' 
AND "entityId" IN (
  SELECT "entityId" FROM "SourceEntity" WHERE "sourceId" = '[source-id]'
);

-- Check if tasks exist
SELECT COUNT(*) FROM "Task" WHERE "sourceId" = '[source-id]';

-- Check if items exist
SELECT COUNT(*) FROM "SourceItem" WHERE "sourceId" = '[source-id]';
```

## Common Issues & Fixes

### Issue: "Source not found" (404)
**Cause:** Invalid source ID in URL  
**Fix:** Double-check source ID, verify source exists in database

### Issue: "Access denied" (403)
**Cause:** User lacks entity access  
**Fix:** Grant user access to at least one entity linked to the source

### Issue: "Unauthorized" (401)
**Cause:** Session expired  
**Fix:** User will be auto-redirected to /login

### Issue: Tasks show empty but source loads
**Cause:** No tasks generated yet  
**Fix:** Expected behavior - click "Add Tasks" to generate

### Issue: Items show "Loading..." in groups
**Cause:** Source response missing `items` array  
**Fix:** Verify `/api/sources/[id]` includes items relation

## Files Modified

- `src/components/sources/SourceTasksClient.tsx`
  - Added granular error handling
  - Extract data from nested response
  - Graceful degradation for non-critical failures

## Next Steps

If you still see "Failed to load source tasks":
1. Check browser console for specific error
2. Check network tab for failing request
3. Test API endpoint directly with curl
4. Verify permissions in database
5. Check server logs for backend errors

The error message should now tell you **which specific API is failing** rather than generic "failed to load".
