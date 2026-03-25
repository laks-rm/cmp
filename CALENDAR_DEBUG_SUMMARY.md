# Calendar Debug Summary

## Issue
Calendar shows "0" for all months despite having tasks in the database.

## Root Cause Investigation

### Data Verification ✅
- Confirmed 100+ tasks exist in database
- March 2026 has 12 tasks
- All months in 2026 have tasks
- Tasks have proper `dueDate` and `plannedDate` fields

### Likely Causes

1. **Entity/Team Filter** (Most Likely)
   - Calendar may be filtered to an entity/team with no tasks
   - Check localStorage: `cmp_selected_entity` and `cmp_selected_team`

2. **Date Parsing Issue**
   - Tasks dates are ISO strings
   - Frontend uses `parseISO()` to parse them
   - Added error handling to catch parsing failures

3. **API Response Empty**
   - API requires authentication
   - May be returning empty results due to permissions

## Quick Fix Steps

### Option 1: Clear Filters (Try This First)
Open browser console on Calendar page and run:
```javascript
localStorage.setItem('cmp_selected_entity', 'GROUP');
localStorage.setItem('cmp_selected_team', 'ALL');
location.reload();
```

### Option 2: Check Console Logs
1. Open Calendar page
2. Open browser DevTools console (F12)
3. Look for logs starting with `[Calendar]`
4. Check:
   - How many tasks were fetched
   - What the first few tasks look like
   - Any error messages

### Option 3: Test API Directly
While logged into the app, open browser console and run:
```javascript
fetch('/api/tasks?includeAll=true&limit=10')
  .then(r => r.json())
  .then(d => {
    console.log('Tasks:', d.tasks?.length);
    console.log('Sample:', d.tasks?.slice(0, 2));
  });
```

## Code Changes Made

1. **Enhanced logging in CalendarClient.tsx**:
   - Shows how many tasks fetched
   - Displays sample task dates
   - Shows parsing errors if any

2. **Added error handling**:
   - Try-catch around `parseISO()`
   - Logs parsing failures

3. **Added detailed year view logging**:
   - Shows which tasks match each month
   - Helps identify filter issues

## Next Steps

Please share the console output when you open the Calendar page, and I can provide a more specific fix.
