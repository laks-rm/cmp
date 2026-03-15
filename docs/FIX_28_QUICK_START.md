# SourceWizard Refactoring - Quick Start Guide

## TL;DR

Refactoring a 4,548-line component into 20+ manageable files.

**Foundation:** ✅ Done (types, constants, utils)  
**Your Job:** Create hooks → components → steps → orchestrator  
**Time:** ~24 hours over 3-4 days  
**Backup:** Old file kept as safety net

---

## Prerequisites

Before starting:
1. ✅ Read `FIX_28_IMPLEMENTATION_GUIDE.md` (comprehensive guide)
2. ✅ Familiarize yourself with the existing SourceWizard.tsx
3. ✅ Ensure you understand React custom hooks
4. ✅ Set up a test environment

---

## Phase-by-Phase Checklist

### Phase 2: Custom Hooks (Start Here!)

**Goal:** Extract stateful logic into reusable hooks

**Order:** Do these in sequence (dependencies):

1. [ ] `hooks/useSourceWizard.ts` (Main state management)
   - Time: 1.5 hours
   - Extract lines 102-184 from original
   - Template provided in implementation guide
   - **Test:** Can initialize state, update form data, manage items

2. [ ] `hooks/useWizardNavigation.ts` (Step navigation)
   - Time: 30 minutes
   - Simple next/prev/goto logic
   - **Test:** Can navigate between steps, validates before progressing

3. [ ] `hooks/useSourceValidation.ts` (Form validation)
   - Time: 1 hour
   - Extract validation logic
   - Template provided in implementation guide
   - **Test:** Validates Step 1 form, validates Step 2 items

4. [ ] `hooks/useAIExtraction.ts` (AI document extraction)
   - Time: 1.5 hours
   - Extract lines 146-168 + AI logic from original
   - Template provided in implementation guide
   - **Test:** Can upload file, trigger extraction, handle results

5. [ ] `hooks/useSpreadsheetParser.ts` (CSV/Excel parsing)
   - Time: 1.5 hours
   - Extract spreadsheet parsing logic from original
   - **Test:** Can parse CSV, handle errors

**Phase 2 Total:** ~6 hours

**Testing After Phase 2:**
```bash
# Create test file: hooks/__tests__/useSourceWizard.test.ts
npm test hooks/useSourceWizard
```

---

### Phase 3: UI Components

**Goal:** Create presentational components (UI only, no logic)

**Order:** Simple → Complex

1. [ ] `components/EntitySelector.tsx`
   - Time: 45 minutes
   - Multi-select dropdown
   - **Test:** Displays entities, handles selection

2. [ ] `components/TeamSelector.tsx`
   - Time: 45 minutes
   - Single-select dropdown
   - **Test:** Displays teams, handles selection

3. [ ] `components/UserSelector.tsx`
   - Time: 45 minutes
   - User picker with search
   - **Test:** Displays users, handles search

4. [ ] `components/SourceInfoForm.tsx`
   - Time: 1.5 hours
   - Form fields for Step 1
   - **Test:** Renders fields, handles input changes

5. [ ] `components/TaskCard.tsx`
   - Time: 1.5 hours
   - Display/edit single task
   - **Test:** Displays task, handles editing

6. [ ] `components/ItemCard.tsx`
   - Time: 2 hours
   - Display/edit single item with tasks
   - **Test:** Displays item, can add/remove tasks

**Phase 3 Total:** ~7 hours

---

### Phase 4: Step Components

**Goal:** Compose UI components with hooks for each wizard step

1. [ ] `steps/BasicInfoStep.tsx`
   - Time: 1.5 hours
   - Uses: SourceInfoForm, EntitySelector, TeamSelector
   - Hooks: useSourceWizard, useSourceValidation
   - **Test:** Renders form, validates on next

2. [ ] `steps/ItemsInputStep.tsx`
   - Time: 2 hours
   - Most complex step
   - Uses: Input method components, ItemCard
   - **Test:** Can add items, handles all input methods

3. [ ] `steps/ReviewStep.tsx`
   - Time: 1.5 hours
   - Summary display + submit
   - **Test:** Displays summary, handles submission

**Phase 4 Total:** ~5 hours

---

### Phase 5: Input Method Components

**Goal:** Create specialized input UIs

1. [ ] `input-methods/ManualInput.tsx`
   - Time: 1 hour
   - Simplest - just a form
   - **Test:** Can add items manually

2. [ ] `input-methods/SpreadsheetInput.tsx`
   - Time: 1.5 hours
   - Uses: useSpreadsheetParser hook
   - **Test:** Can upload and parse spreadsheet

3. [ ] `input-methods/AIExtractInput.tsx`
   - Time: 2 hours
   - Uses: useAIExtraction hook
   - **Test:** Can upload file, trigger extraction

**Phase 5 Total:** ~4.5 hours

---

### Phase 6: Main Orchestrator

**Goal:** Wire everything together

1. [ ] `index.tsx`
   - Time: 2 hours
   - Template provided in implementation guide
   - Renders wizard modal shell
   - Delegates to step components
   - **Test:** All steps work, navigation works

**Phase 6 Total:** ~2 hours

---

### Phase 7: Integration & Testing

**Goal:** Make it production-ready

1. [ ] Update `SourcesClient.tsx` import
2. [ ] Test all workflows:
   - [ ] Create new source (AI extraction)
   - [ ] Create new source (spreadsheet)
   - [ ] Create new source (manual)
   - [ ] Edit existing source
   - [ ] Validation errors
   - [ ] API integration
3. [ ] Use React DevTools Profiler to verify performance
4. [ ] Fix any issues
5. [ ] Rename old file: `SourceWizardOld.tsx`
6. [ ] Deploy to staging
7. [ ] Monitor for issues

**Phase 7 Total:** ~4 hours

---

## Daily Schedule (Suggested)

### Day 1: Hooks (6 hours)
- Morning: useSourceWizard, useWizardNavigation
- Afternoon: useSourceValidation, useAIExtraction
- Evening: useSpreadsheetParser

### Day 2: Components (7 hours)
- Morning: EntitySelector, TeamSelector, UserSelector
- Afternoon: SourceInfoForm, TaskCard
- Evening: ItemCard

### Day 3: Steps & Input Methods (9.5 hours)
- Morning: BasicInfoStep, ReviewStep
- Afternoon: ItemsInputStep
- Evening: All input method components

### Day 4: Orchestrator & Testing (6 hours)
- Morning: Create index.tsx
- Afternoon: Integration testing
- Evening: Final testing, deploy

**Total:** ~28.5 hours (with buffer)

---

## Testing Checklist

After each phase, verify:

### Phase 2 (Hooks):
- [ ] useState initializes correctly
- [ ] State updates work
- [ ] No memory leaks
- [ ] Dependencies array correct

### Phase 3 (Components):
- [ ] Props passed correctly
- [ ] Events fire
- [ ] UI renders properly
- [ ] No console errors

### Phase 4 (Steps):
- [ ] Step navigation works
- [ ] Validation triggers
- [ ] Data flows correctly

### Phase 5 (Input Methods):
- [ ] File uploads work
- [ ] Parsing works
- [ ] Error handling works

### Phase 6 (Orchestrator):
- [ ] All steps render
- [ ] Data persists across steps
- [ ] Submit works

### Phase 7 (Integration):
- [ ] End-to-end flows work
- [ ] Performance improved
- [ ] No regressions

---

## Common Pitfalls & Solutions

### Pitfall 1: Circular Dependencies
**Problem:** Components import each other  
**Solution:** Use composition, pass callbacks down

### Pitfall 2: Prop Drilling
**Problem:** Passing props through many levels  
**Solution:** Use Context API or custom hooks

### Pitfall 3: State Not Syncing
**Problem:** Updates don't reflect in UI  
**Solution:** Use useCallback for functions, check dependencies

### Pitfall 4: Performance Regression
**Problem:** Component rerenders too much  
**Solution:** Use React.memo, useMemo, useCallback

### Pitfall 5: Lost Functionality
**Problem:** Something from old version missing  
**Solution:** Compare old/new side-by-side, use checklist

---

## Quick Commands

```bash
# Create a new hook
touch src/components/sources/SourceWizard/hooks/useSourceWizard.ts

# Create a new component
touch src/components/sources/SourceWizard/components/ItemCard.tsx

# Run tests
npm test SourceWizard

# Check file size
wc -l src/components/sources/SourceWizard/**/*.ts*

# Find old fetch calls (to replace with API client)
grep -n "fetch(" src/components/sources/SourceWizard/**/*.tsx

# Verify no linter errors
npm run lint
```

---

## Help & Resources

### Documentation:
- `FIX_28_IMPLEMENTATION_GUIDE.md` - Detailed guide with code templates
- `FIX_28_SUMMARY.md` - Overview and benefits
- `FIX_28_SOURCE_WIZARD_REFACTOR.md` - Architecture and strategy

### Code Templates:
- All in `FIX_28_IMPLEMENTATION_GUIDE.md`
- Copy/paste and customize

### Foundation Files (Already Done):
- `types.ts` - All TypeScript types
- `constants.ts` - All constants
- `utils.ts` - Utility functions

### Original File:
- `src/components/sources/SourceWizard.tsx` (4,548 lines)
- Reference this for logic extraction

---

## When You're Stuck

1. **Read the implementation guide** - Has templates for everything
2. **Check the original file** - See how it was done before
3. **Test incrementally** - Don't write 500 lines before testing
4. **Ask for help** - Share progress, get feedback
5. **Take breaks** - This is a marathon, not a sprint

---

## Definition of Done

✅ All 20 files created  
✅ No file exceeds 400 lines  
✅ All tests passing  
✅ No linter errors  
✅ Performance improved (verified with Profiler)  
✅ All original functionality works  
✅ Deployed to staging  
✅ No critical bugs in 48 hours  
✅ Old file deleted

---

## Success Looks Like

**Before:**
```
SourceWizard.tsx: 4,548 lines
- Impossible to maintain
- Cannot test
- Slow to modify
```

**After:**
```
SourceWizard/
├── 20 focused files
├── Average 177 lines per file
├── Fully tested
├── 95% faster rerenders
├── Easy to modify
└── Reusable components/hooks
```

---

**Good luck! You're making the codebase significantly better. 🚀**

**Questions?** Check the implementation guide or ask the team.
