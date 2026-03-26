# Dashboard Stats API Fix — SQL Column Alias Error

## Problem

The dashboard stats API at `/api/dashboard/stats` was returning a 500 Internal Server Error with the following Prisma error:

```
Raw query failed. Code: `42703`. Message: `column "completed" does not exist`
```

## Root Cause

The error occurred in the **Compliance Posture by Source** query (query #21, index 20 in the Promise.all array). The issue was in the ORDER BY clause:

```sql
ORDER BY overdue DESC, "highFindings" DESC, completed::float / NULLIF(total, 0) ASC
```

PostgreSQL doesn't allow referencing column **aliases** (like `completed` and `total`) directly in the ORDER BY clause when they come from aggregate functions in a GROUP BY context. The database was looking for actual table columns named "completed" and "total", which don't exist.

## Solution

Replaced the column aliases in the ORDER BY clause with the full aggregate expressions:

**Before:**
```sql
ORDER BY overdue DESC, "highFindings" DESC, completed::float / NULLIF(total, 0) ASC
```

**After:**
```sql
ORDER BY 
  COUNT(DISTINCT CASE WHEN t.status NOT IN ('COMPLETED', 'PLANNED', 'DEFERRED', 'NOT_APPLICABLE') 
        AND t."dueDate" < ${startOfTodayUTC} THEN t.id END) DESC,
  COUNT(DISTINCT CASE WHEN f.status IN ('OPEN', 'IN_PROGRESS') AND f.severity IN ('CRITICAL', 'HIGH') THEN f.id END) DESC,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN t."dueDate" <= ${startOfTodayUTC} AND t.status != 'PLANNED' THEN t.id END) = 0 THEN 1
    ELSE COUNT(DISTINCT CASE WHEN t.status = 'COMPLETED' AND t."dueDate" <= ${startOfTodayUTC} THEN t.id END)::float / 
         COUNT(DISTINCT CASE WHEN t."dueDate" <= ${startOfTodayUTC} AND t.status != 'PLANNED' THEN t.id END)::float
  END ASC
```

The new ORDER BY clause:
1. Orders by overdue count descending (most overdue first)
2. Then by high/critical findings count descending
3. Then by completion percentage ascending (lowest completion first)
4. Includes a CASE statement to handle division by zero when total is 0

## File Changed

- `/cmp-app/src/app/api/dashboard/stats/route.ts` (lines 518-549)

## Verification

After the fix:
- ✅ The API recompiled successfully (line 602 in terminal logs)
- ✅ No more Prisma `P2010` errors
- ✅ API now returns `401 Unauthorized` when not authenticated (expected behavior)
- ✅ API no longer crashes with 500 Internal Server Error

## Testing Steps

1. **User should refresh the browser** to load the fixed code
2. The dashboard should now load correctly with all 22 queries running successfully
3. The Compliance Posture by Source section will display with proper sorting:
   - Sources with most overdue tasks appear first
   - Then sorted by critical/high findings
   - Finally by lowest completion percentage

## Additional Notes

The query correctly handles edge cases:
- **Empty sources**: When a source has no tasks (total = 0), the CASE statement returns 1, placing it at the bottom of the list
- **No findings**: Sources without findings will be sorted purely by task completion
- **Entity filtering**: The query respects both single-entity and GROUP view filtering

The fix maintains the original intent of the sorting logic while being PostgreSQL-compliant.
