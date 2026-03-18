# Quick Reference: Recurrence Group Fix

## Problem
"Error: Not found" when editing recurring task templates in `/sources/{id}/tasks`.

## Root Causes (Two Issues Fixed)

### Issue 1: Missing Recurrence Group IDs
Tasks with non-ADHOC frequency but only 1 instance didn't get a `recurrenceGroupId`.

### Issue 2: Soft-Deleted Tasks Showing in UI ⚠️ CRITICAL
The `/api/tasks` endpoint wasn't filtering out soft-deleted tasks, causing deleted recurrence groups to appear editable.

## Solutions Applied

### 1. Fixed Task Generation Logic (2 files)
- `/api/sources/[id]/generate/route.ts`
- `/api/sources/[id]/generate-for-entities/route.ts`

**Change**: Base `recurrenceGroupId` on frequency, not instance count
```typescript
const isRecurring = taskData.frequency !== 'ADHOC';
const recurrenceGroupId = isRecurring ? uuidv4() : null;
```

### 2. Fixed Task Query to Exclude Soft-Deleted Records ⭐ KEY FIX
- `/api/tasks/route.ts`

**Change**: Added soft-delete filter
```typescript
const where: Prisma.TaskWhereInput = {
  AND: [getEntityFilter(session)],
  deletedAt: null, // Exclude soft-deleted tasks
};
```

### 3. Enhanced Error Handling & Logging
- `/api/tasks/recurrence-group/route.ts` - Better error messages
- `/components/sources/SourceTasksClient.tsx` - Client-side validation

### 4. Data Migration & Diagnostics
```bash
# Fix existing data
npx tsx scripts/fix-recurrence-groups.ts

# Check current state
npx tsx scripts/check-recurrence-groups.ts
```

**Migration Result**: Fixed 5 existing tasks, created 5 recurrence groups. ✅

## Verification
1. Go to `/sources/{sourceId}/tasks`
2. Expand any item with recurring tasks
3. Click "Edit" on a template row
4. Change title/description
5. Save → Should succeed ✅

## Key Insight
**Recurrence identity** = task frequency, not instance count.
A MONTHLY task with 1 instance is still a recurring template.

## Files Changed
- `src/app/api/sources/[id]/generate/route.ts` ✅
- `src/app/api/sources/[id]/generate-for-entities/route.ts` ✅
- `src/app/api/tasks/route.ts` ✅ **CRITICAL - soft-delete filter**
- `src/app/api/tasks/recurrence-group/route.ts` ✅ (enhanced logging)
- `src/components/sources/SourceTasksClient.tsx` ✅
- `scripts/fix-recurrence-groups.ts` (new) ✅
- `scripts/check-recurrence-groups.ts` (new) ✅
- `docs/FIX_RECURRENCE_GROUP_MISSING.md` (new) ✅

## No Further Action Needed
✅ Code fixed (generation + query filtering)
✅ Database migrated
✅ Logging added for debugging
✅ Ready for testing

## Key Lesson
When implementing soft-delete, **audit ALL query endpoints** to ensure they filter `deletedAt: null`!
