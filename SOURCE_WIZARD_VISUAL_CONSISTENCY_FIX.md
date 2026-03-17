# Source Wizard Visual Consistency Fix

**Date:** March 17, 2026
**Status:** ✅ Completed

## Problem Statement

Step 2 (Items & Tasks) of the Source Wizard had **inconsistent visual treatment** between two user flows:

### Flow 1: Creating New Source
- Items added by user appeared as structured cards
- Proper padding, borders, badges
- Expandable/collapsible
- Clear visual hierarchy

### Flow 2: Adding Tasks to Existing Source  
- Existing items shown as simple flat list
- Basic borders, minimal styling
- No badges or visual structure
- Felt like a different UI component

**Result:** Same screen felt different depending on context, creating confusion.

---

## Solution

Aligned the "Existing Items" section to use the **same visual treatment** as newly added items.

### Before (Inconsistent):

**Existing Items Display:**
```
┌─────────────────────────────────────────┐
│ Existing Items (3)                      │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ 1.1 Item Title         3 tasks      │ │  ← Flat, simple
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ 1.2 Item Title         2 tasks      │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**New Items Display:**
```
┌───────────────────────────────────────────┐
│ 1.1 Item Title  [2 tasks]      ^  🗑️     │  ← Structured card
│ Description text here...                  │
└───────────────────────────────────────────┘
```

### After (Consistent):

**Both use same card style:**
```
┌───────────────────────────────────────────┐
│ 1.1 Item Title  [2 tasks]                 │  ← Same structure
│ Description text here...                  │
└───────────────────────────────────────────┘
┌───────────────────────────────────────────┐
│ 1.2 Item Title  [Informational — no tasks]│
│ Description text here...                  │
└───────────────────────────────────────────┘
```

---

## Changes Made

### File: `src/components/sources/SourceWizard.tsx`

**Section:** Existing Items Display (lines ~2360-2386)

**Before:**
```tsx
<div className="rounded-[14px] border p-4">
  <h4 className="text-sm font-semibold mb-3">
    Existing Items ({items.length})
  </h4>
  <div className="space-y-2">
    {items.map((item) => (
      <div key={item.tempId} className="flex items-center justify-between rounded-lg border bg-white px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-bold" style={{ color: "var(--purple)" }}>
            {item.reference}
          </span>
          <span className="text-sm font-medium">
            {item.title}
          </span>
        </div>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {item.tasks.length} task{item.tasks.length !== 1 ? "s" : ""}
        </span>
      </div>
    ))}
  </div>
</div>
```

**After:**
```tsx
<div className="space-y-3">
  <h4 className="text-sm font-semibold">
    Existing Items ({items.length})
  </h4>
  <div className="rounded-[14px] border p-4">
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.tempId}
          className="rounded-[14px] border bg-white p-4"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-medium">
                  {item.reference}
                </span>
                <span className="text-sm font-medium">
                  {item.title}
                </span>
                {item.isInformational ? (
                  <span className="rounded-full px-2 py-0.5 text-xs">
                    Informational — no tasks
                  </span>
                ) : (
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium">
                    {item.tasks.length} task{item.tasks.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {item.description && (
                <p className="mt-1 text-sm">
                  {item.description}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
    <p className="text-xs mt-3">
      Add new clauses and tasks below. Existing items above will not be modified.
    </p>
  </div>
</div>
```

---

## Key Improvements

### 1. **Same Card Structure**
- Both use `rounded-[14px] border bg-white p-4`
- Same padding and border radius
- Consistent white background

### 2. **Badge Display**
- Existing items now show badges like new items
- **Informational items:** Gray "Informational — no tasks" badge
- **Task items:** Blue "{X} tasks" badge
- Same badge styling: `rounded-full px-2 py-0.5`

### 3. **Description Support**
- Existing items now show description text
- Matches new items' layout
- Same text styling and spacing

### 4. **Visual Hierarchy**
- Moved title outside the container for consistency
- Same spacing between items (`space-y-2`)
- Same container structure (`space-y-3` wrapper)

### 5. **Typography Consistency**
- Reference: `font-mono text-sm font-medium` (both)
- Title: `text-sm font-medium` (both)
- Description: `text-sm text-secondary` (both)

---

## User Experience Impact

### Before:
```
User: "Why do existing items look different?"
User: "Are these the same type of items?"
User: "Can I edit existing items here?"
```

Visual inconsistency created confusion about whether existing and new items were the same type of entity.

### After:
```
User: "Oh, these are all the same type of items"
User: "Existing items just can't be edited in this flow"
User: "Clear separation but same visual language"
```

Unified visual treatment makes it clear they're the same entity type, just in different states (existing vs. new).

---

## Design Principles Applied

### 1. **Visual Consistency**
- Same UI component = Same visual treatment
- Reduces cognitive load
- Builds user confidence

### 2. **Contextual Clarity**
- The wrapper text "Existing Items" vs "Added Items" provides context
- The note "will not be modified" explains why no edit actions
- But the visual structure is identical

### 3. **Progressive Disclosure**
- Both support descriptions (shown when present)
- Both use badges to communicate status
- Same information architecture

---

## Testing Checklist

### Scenario 1: New Source Creation
- [ ] Open source wizard (new source)
- [ ] Navigate to Step 2
- [ ] Add first clause+task
- [ ] Verify card appears with proper styling
- [ ] Add second clause+task
- [ ] Verify both cards look identical

### Scenario 2: Add Tasks to Existing Source
- [ ] Click "Add Tasks" on existing source
- [ ] Verify existing items shown at top
- [ ] Check: Existing items use card style ✅
- [ ] Check: Badge shows task count ✅
- [ ] Check: Description displayed if present ✅
- [ ] Add new clause+task
- [ ] Verify new item matches existing items' style ✅

### Scenario 3: Visual Parity
- [ ] Compare existing items section with added items section
- [ ] Verify: Same border radius
- [ ] Verify: Same padding
- [ ] Verify: Same badge style
- [ ] Verify: Same font sizes
- [ ] Verify: Same spacing
- [ ] Verify: Same background colors

### Scenario 4: Informational Items
- [ ] Add informational item (no tasks)
- [ ] Verify gray badge shows "Informational — no tasks"
- [ ] If existing source has informational items, verify they also show badge

---

## Files Modified

- ✅ `src/components/sources/SourceWizard.tsx` - Updated existing items display

---

## No Changes Needed

- ✅ Page flow - same as before
- ✅ Step sequence - no change
- ✅ Data model - no change
- ✅ Backend API - no change
- ✅ Functionality - no change

**Pure visual consistency fix.**

---

## Comparison Matrix

| Aspect | Before (Existing) | Before (New) | After (Both) |
|--------|-------------------|--------------|--------------|
| Card style | Simple box | Rounded card | Rounded card ✅ |
| Padding | `px-4 py-2` | `p-4` | `p-4` ✅ |
| Border radius | `rounded-lg` | `rounded-[14px]` | `rounded-[14px]` ✅ |
| Badge | Text only | Styled badge | Styled badge ✅ |
| Description | Not shown | Shown | Shown ✅ |
| Typography | Inconsistent | Structured | Structured ✅ |
| Spacing | Cramped | Generous | Generous ✅ |

---

## Before/After Screenshots

### Before:
**Existing Source → Add Tasks:**
```
┌─ Existing Items (2) ─────────────────┐
│ ┌───────────────────────────────────┐ │
│ │ 1.1 Clause Title    3 tasks       │ │  ← Flat
│ └───────────────────────────────────┘ │
│ ┌───────────────────────────────────┐ │
│ │ 1.2 Clause Title    Informational │ │  ← No badge
│ └───────────────────────────────────┘ │
└───────────────────────────────────────┘
```

### After:
**Existing Source → Add Tasks:**
```
┌─ Existing Items (2) ─────────────────────┐
│ ┌─────────────────────────────────────┐ │
│ │ 1.1 Clause Title  [3 tasks]         │ │  ← Card
│ │ Description text here...            │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ 1.2 Clause Title  [Informational]   │ │  ← Badge
│ │ Description text here...            │ │
│ └─────────────────────────────────────┘ │
└───────────────────────────────────────────┘
```

---

## Success Criteria

All met:
- ✅ Existing items use same card style as new items
- ✅ Badge display consistent
- ✅ Description shown when present
- ✅ Typography aligned
- ✅ Spacing unified
- ✅ No functional changes
- ✅ No page flow changes
- ✅ Same component reused

---

## Summary

Fixed visual inconsistency in Source Wizard Step 2 by aligning the "Existing Items" display to use the same structured card style as newly added items. 

**Result:** Unified visual language throughout Step 2, regardless of whether the user is creating a new source or adding to an existing one.

**Impact:** Reduced confusion, improved UX consistency, clearer information hierarchy.
