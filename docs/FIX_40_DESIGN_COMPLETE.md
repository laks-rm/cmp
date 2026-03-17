# FIX 40: Version-Aware Source Model - Design Complete

## Summary

A comprehensive version-aware source management system has been designed for CMP that enables regulations, policies, and standards to evolve over time while maintaining complete auditability and operational clarity.

## Problem Solved

Current CMP limitations addressed:
- ❌ Sources edited in place, losing historical context
- ❌ Frequency incorrectly associated with sources instead of tasks
- ❌ No systematic way to track regulatory changes
- ❌ Historical tasks lose traceability when sources change
- ❌ Risk of generating backdated tasks

## Solution

A five-level versioning architecture:

```
SourceMaster (regulation family)
  └─ SourceVersion (time-specific version with effectiveDate)
       └─ SourceItemVersion (versioned clauses with change tracking)
            └─ TaskTemplate (operational definition with frequency + anchorDate)
                 └─ Task (generated instances with immutable version snapshots)
```

## Key Design Principles

1. ✅ Frequency belongs to TaskTemplate (not Source)
2. ✅ Source versioning with full history
3. ✅ Existing history preserved
4. ✅ Future tasks reviewed when source changes
5. ✅ No overwriting sources without traceability
6. ✅ No backdating: `plannedDate >= max(effectiveDate, anchorDate)`

## Documentation Deliverables

**8 comprehensive documents created:**

1. **FIX_40_INDEX.md** - Documentation index and reading paths
2. **FIX_40_SUMMARY.md** - Executive overview
3. **FIX_40_VERSION_AWARE_SOURCES.md** - Complete architecture (15,000+ words)
4. **FIX_40_SCHEMA_DESIGN.prisma** - Database model definition
5. **FIX_40_MIGRATION_GUIDE.md** - Step-by-step implementation
6. **FIX_40_QUICK_REFERENCE.md** - Developer code examples
7. **FIX_40_VISUAL_DIAGRAMS.md** - Architecture diagrams
8. **FIX_40_CHECKLIST.md** - Implementation progress tracker
9. **FIX_40_FAQ.md** - 30 common questions answered

**Total**: ~50,000 words, 50+ code examples, 15+ diagrams, 200+ checklist items

## Implementation Timeline

- **Sequential**: 18 days (single team)
- **Parallel**: 13 days (backend + frontend teams)
- **With buffer**: 15-20 days recommended

## Migration Strategy

6 implementation phases:
1. Schema Migration (Days 1-3)
2. Data Migration (Days 4-5)
3. API Layer (Days 6-8)
4. Business Logic (Days 9-11)
5. UI Components (Days 12-15)
6. Testing & Validation (Days 16-18)

## Core Changes

### New Models
- **SourceMaster**: Long-lived regulation family
- **SourceVersion**: Time-specific snapshot with effectiveDate
- **SourceItemVersion**: Versioned clauses with change tracking
- **TaskTemplate**: Operational definition (frequency lives here!)

### Enhanced Models
- **Task**: Now references taskTemplateId, sourceVersionId (immutable snapshots)
- **Finding**: Now references sourceVersionId
- **Entity**, **Team**, **User**: Updated relationships

## Critical Business Rules

### Task Generation Rule
```typescript
earliestValidDate = max(
  sourceVersion.effectiveDate,
  taskTemplate.anchorDate
)
task.plannedDate >= earliestValidDate
```

### Version Activation Rule
- Only ONE active version per SourceMaster
- Previous active version → SUPERSEDED
- Previous version.expiryDate = new version.effectiveDate

### Task Immutability Rule
- Completed tasks NEVER change version reference
- Future tasks reviewed when version changes
- Historical audit trail preserved forever

## Success Criteria

### Technical
✅ All tasks have template references  
✅ All tasks have version references  
✅ No data loss  
✅ Task generation < 5% performance impact  
✅ Complete audit trail  

### Functional
✅ Can create source masters and versions  
✅ Can activate new versions  
✅ Version comparison works  
✅ Impact assessment accurate  
✅ Date rules enforced  

### User
✅ Intuitive workflow  
✅ Clear version timeline  
✅ Actionable impact reports  
✅ No confusion  

## Next Steps

1. **Review** documentation suite
2. **Approve** design
3. **Schedule** implementation sprint
4. **Assign** team resources
5. **Begin** Phase 1 (Schema Migration)

## Documentation Access

All documentation in: `cmp-app/docs/FIX_40_*.md`

**Start here**: `FIX_40_INDEX.md` for reading paths by role

## Files Created

- cmp-app/docs/FIX_40_INDEX.md
- cmp-app/docs/FIX_40_SUMMARY.md
- cmp-app/docs/FIX_40_VERSION_AWARE_SOURCES.md
- cmp-app/docs/FIX_40_SCHEMA_DESIGN.prisma
- cmp-app/docs/FIX_40_MIGRATION_GUIDE.md
- cmp-app/docs/FIX_40_QUICK_REFERENCE.md
- cmp-app/docs/FIX_40_VISUAL_DIAGRAMS.md
- cmp-app/docs/FIX_40_CHECKLIST.md
- cmp-app/docs/FIX_40_FAQ.md

## Files Modified

- cmp-app/README.md (added FIX 40 references)

---

**Status**: ✅ Design Complete - Ready for Implementation  
**Date**: 2026-03-17  
**Version**: 1.0
