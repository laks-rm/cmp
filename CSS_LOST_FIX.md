# CSS "Lost" Issue - Quick Fix

## Problem
The new `/sources/[id]/tasks` page appears but CSS seems broken or "lost"

## Root Causes & Solutions

### 1. **Dev Server Needs Restart** (Most Common)
Next.js hot-reload doesn't always pick up new dynamic routes properly.

**Solution:**
```bash
# Stop dev server (Ctrl+C)
cd /Users/lakshmibichu/CMP_Project/cmp-app
npm run dev
```

Then refresh the page in browser.

### 2. **Double Padding Removed**
The layout already provides padding (`<main className="flex-1 p-6">`), so we removed the extra wrapper.

**Before:**
```typescript
return (
  <div className="p-6">  // ❌ Double padding!
    <SourceTasksClient sourceId={params.id} />
  </div>
);
```

**After:**
```typescript
return <SourceTasksClient sourceId={params.id} />;  // ✅ Clean
```

### 3. **Hard Refresh Browser**
Sometimes browser caches old CSS.

**Solution:**
- Mac: `Cmd + Shift + R`
- Windows/Linux: `Ctrl + Shift + R`
- Or open Dev Tools → Network tab → Check "Disable cache"

### 4. **Check Console for Errors**
Open browser DevTools (F12) and check:
- Console tab for JavaScript errors
- Network tab for failed CSS/asset loads
- Look for 404s or CORS errors

## Expected Appearance

Once working, you should see:

```
┌─────────────────────────────────────────────┐
│ ← [Source Name] TST-2026                    │
│   DIEL DGL                                  │
│   Task validation and metadata management   │
│                      [Task Tracker View] →  │
├─────────────────────────────────────────────┤
│ Stats: Total | Completed | In Progress | HR │
├─────────────────────────────────────────────┤
│ Filters: [Status ▼] [Entity ▼] [Clear]     │
├─────────────────────────────────────────────┤
│ ▼ 1.1 — Clause Title               5/12 ✓  │
│   ├─ Task 1  [TO_DO] [HIGH] DGL...         │
│   ├─ Task 2  [PLANNED] [MED] DGL...        │
│   └─ ...                                    │
└─────────────────────────────────────────────┘
```

With:
- Blue/purple/green colored badges
- Rounded borders
- Proper spacing
- Hover effects on buttons

## If Still Broken After Restart

### Check File Exists:
```bash
cat "src/app/(dashboard)/sources/[id]/tasks/page.tsx"
```

Should output:
```typescript
import { SourceTasksClient } from "@/components/sources/SourceTasksClient";

export default function SourceTasksPage({ params }: { params: { id: string } }) {
  return <SourceTasksClient sourceId={params.id} />;
}
```

### Check Component Exists:
```bash
ls -la src/components/sources/SourceTasksClient.tsx
```

Should exist and be ~875 lines.

### Check Route Registration:
Navigate to `http://localhost:3000/sources/[your-source-id]/tasks`

If you see "404 | This page could not be found" → Dev server needs restart

If you see content but unstyled → Check browser console for errors

### Nuclear Option - Clear Next.js Cache:
```bash
cd /Users/lakshmibichu/CMP_Project/cmp-app
rm -rf .next
npm run dev
```

## Most Likely Solution

**Just restart the dev server!** 🔄

New dynamic routes `[id]` require a restart to be properly registered in Next.js routing system.
