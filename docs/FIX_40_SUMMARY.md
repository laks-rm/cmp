# FIX 40: Version-Aware Source Model - Implementation Summary

**Date**: 2026-03-17  
**Status**: Design Complete - Ready for Implementation  
**Priority**: High  
**Estimated Effort**: 13-18 days (with parallelization)

---

## Executive Summary

This fix introduces a comprehensive version-aware source management system for CMP that enables regulations, policies, and standards to evolve over time while maintaining complete auditability and operational clarity.

### The Problem We're Solving

Current CMP has critical limitations:
1. Sources are edited in place, losing historical context
2. Frequency is incorrectly associated with sources instead of tasks
3. No systematic way to track regulatory changes over time
4. Historical tasks lose traceability when sources change
5. Risk of generating backdated tasks without proper date validation

### The Solution

A five-level versioning architecture:

```
SourceMaster (regulation family)
  └─ SourceVersion (time-specific version with effectiveDate)
       └─ SourceItemVersion (versioned clauses with change tracking)
            └─ TaskTemplate (operational definition with frequency + anchorDate)
                 └─ Task (generated instances with immutable version snapshots)
```

---

## Key Design Principles

1. ✅ **Frequency belongs to the task (template), not the source**
2. ✅ **Source must be versioned**
3. ✅ **Existing history must be preserved**
4. ✅ **Future tasks should be assessed when source version changes**
5. ✅ **Do not overwrite sources without traceability**
6. ✅ **No backdating: `plannedDate >= max(effectiveDate, anchorDate)`**

---

## Documentation Deliverables

This fix includes four comprehensive documents:

### 1. Design Document
**File**: `docs/FIX_40_VERSION_AWARE_SOURCES.md`

Complete architectural design including:
- Conceptual data model (5 main objects)
- Date and recurrence rules
- Source change workflow
- Task handling on version change
- Implementation phases
- Success criteria
- Risk mitigation

### 2. Schema Design
**File**: `docs/FIX_40_SCHEMA_DESIGN.prisma`

Detailed Prisma schema showing:
- All new models (SourceMaster, SourceVersion, SourceItemVersion, TaskTemplate)
- Updated models (Task, Entity, Team, User, Finding)
- Complete relationships and constraints
- Indexes for performance
- Enums for type safety

### 3. Migration Guide
**File**: `docs/FIX_40_MIGRATION_GUIDE.md`

Step-by-step implementation guide covering:
- 6 implementation phases
- Detailed migration SQL scripts
- Data transformation logic
- API endpoint specifications
- UI component requirements
- Testing strategy
- Rollback procedures
- Timeline estimates

### 4. Quick Reference
**File**: `docs/FIX_40_QUICK_REFERENCE.md`

Developer-friendly reference with:
- Before/after comparisons
- Common operations (code examples)
- Database queries
- TypeScript types
- Common mistakes to avoid
- Troubleshooting guide

---

## Core Architecture Changes

### New Models

#### 1. SourceMaster
- Long-lived regulation/policy family identifier
- Examples: "GDPR", "PCI DSS", "MFSA AML Rules"
- Has many versions

#### 2. SourceVersion
- Time-specific snapshot of a regulation
- Has `effectiveDate` (when it becomes valid)
- Has `expiryDate` (when superseded)
- Tracks supersession chain
- Only ONE active version per master

#### 3. SourceItemVersion
- Individual clauses/articles/controls
- Belongs to a specific version
- Tracks `changeType`: UNCHANGED, MODIFIED, NEW, REMOVED
- Links to equivalent item in previous version

#### 4. TaskTemplate
- **Frequency lives here (not in Source!)**
- Defines operational task characteristics
- Has `anchorDate` for recurrence calculation
- Can be ACTIVE, DRAFT, or RETIRED
- Generates task instances

#### 5. Task (Enhanced)
- Now references `taskTemplateId` (required)
- Now references `sourceVersionId` (required, immutable snapshot)
- Now references `sourceItemVersionId` (required, immutable snapshot)
- Keeps all existing fields and relationships

---

## Critical Business Rules

### Task Generation Rule

```typescript
For each task instance:
  earliestValidDate = max(
    sourceVersion.effectiveDate,
    taskTemplate.anchorDate
  )
  
  task.plannedDate >= earliestValidDate
```

This prevents:
- Tasks being generated before a regulation is effective
- Tasks being generated before their operational anchor date
- Backdating issues

### Version Activation Rule

```typescript
When activating a new source version:
  1. Only ONE version can be ACTIVE per SourceMaster
  2. Previous ACTIVE version → SUPERSEDED
  3. Previous version.expiryDate = new version.effectiveDate
  4. New version → ACTIVE
```

This ensures:
- Clear version lineage
- No ambiguity about which version is current
- Historical records are preserved

### Task Immutability Rule

```typescript
When a task is created:
  task.sourceVersionId = snapshot of version at creation
  task.taskTemplateId = template that generated it
  
When a source version changes:
  IF task.status == "COMPLETED":
    // NEVER change version reference
    // Historical truth must be preserved
  ELSE IF task.status IN ["PLANNED", "TO_DO"]:
    // User review required
    // Decide: keep, cancel, or regenerate
```

This ensures:
- Audit integrity
- Historical traceability
- Controlled impact of regulatory changes

---

## Migration Strategy

### Phase 1: Schema (Days 1-3)
- Create new models in Prisma
- Add temporary columns to existing models
- Generate migration file
- Add data transformation SQL

### Phase 2: Data Migration (Days 4-5)
- Backup database
- Transform Source → SourceMaster + SourceVersion
- Transform SourceItem → SourceItemVersion
- Generate TaskTemplates from existing Tasks
- Link Tasks to Templates and Versions
- Validate migration success

### Phase 3: API Layer (Days 6-8)
- Create new API routes for all new models
- Update existing routes to include version info
- Implement versioning and impact assessment endpoints

### Phase 4: Business Logic (Days 9-11)
- Create service layer (SourceMasterService, SourceVersionService, TaskTemplateService)
- Refactor task generation to use templates
- Implement version activation logic
- Implement impact assessment

### Phase 5: UI Components (Days 12-15)
- Source Master list and detail screens
- Version timeline and comparison views
- Task Template management UI
- Version activation wizard
- Update existing task screens

### Phase 6: Testing (Days 16-18)
- Unit tests for all business logic
- Integration tests for workflows
- Manual QA checklist
- Performance testing
- Migration validation

---

## Implementation Checklist

### Prerequisites
- [ ] Review and approve design documents
- [ ] Stakeholder sign-off
- [ ] Database backup procedures verified
- [ ] Development environment setup
- [ ] Testing environment prepared

### Phase 1: Schema
- [ ] Create new Prisma models
- [ ] Update existing models
- [ ] Generate migration file
- [ ] Add data transformation SQL
- [ ] Test on local database
- [ ] Peer review schema

### Phase 2: Data Migration
- [ ] Backup production database
- [ ] Run migration on test database
- [ ] Validate data transformation
- [ ] Check for orphaned records
- [ ] Verify referential integrity
- [ ] Performance test with production data volume

### Phase 3: API Layer
- [ ] Implement SourceMaster CRUD
- [ ] Implement SourceVersion CRUD
- [ ] Implement TaskTemplate CRUD
- [ ] Implement version comparison
- [ ] Implement impact assessment
- [ ] Update Task APIs
- [ ] API documentation

### Phase 4: Business Logic
- [ ] SourceMasterService
- [ ] SourceVersionService
- [ ] TaskTemplateService
- [ ] Version activation logic
- [ ] Task generation refactor
- [ ] Impact assessment logic

### Phase 5: UI
- [ ] Source Master screens
- [ ] Version management screens
- [ ] Task Template screens
- [ ] Update existing task screens
- [ ] Version comparison UI
- [ ] Impact assessment dashboard

### Phase 6: Testing
- [ ] Unit tests (>80% coverage)
- [ ] Integration tests
- [ ] E2E tests for critical workflows
- [ ] Performance tests
- [ ] Manual QA
- [ ] User acceptance testing

### Deployment
- [ ] Deploy to staging
- [ ] Smoke tests
- [ ] Deploy to production
- [ ] Monitor for errors
- [ ] User training
- [ ] Documentation published

---

## Success Criteria

### Technical Success
✅ All existing tasks have template references  
✅ All existing tasks have version references  
✅ No orphaned records  
✅ Migration completes in < 10 minutes  
✅ No data loss  
✅ Task generation < 5% performance impact  
✅ All tests passing  

### Functional Success
✅ Can create source masters and versions  
✅ Can activate new versions  
✅ Version comparison works accurately  
✅ Impact assessment identifies affected tasks  
✅ Task generation respects date rules  
✅ Historical tasks preserve version references  
✅ Template retirement prevents new tasks  

### User Success
✅ Intuitive version creation workflow  
✅ Clear version timeline visualization  
✅ Actionable impact reports  
✅ Easy template management  
✅ No user confusion about versions  
✅ Faster source updates with confidence  

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Data loss during migration | Low | Critical | Mandatory backups, staged rollout, rollback plan |
| Performance issues | Medium | High | Indexes, query optimization, load testing |
| User confusion | High | Medium | Training, documentation, intuitive UI |
| Template matching errors | Medium | High | Fallback templates, manual review option |
| Version conflicts | Low | High | Unique constraints, transaction boundaries |
| Integration breaks | Medium | Medium | API versioning, backward compatibility |

---

## Timeline

### Sequential (single team)
- **Total**: 18 days
- **Phases**: Run phases 1-6 sequentially

### Parallel (backend + frontend teams)
- **Backend** (Phases 1-4): 10 days
- **Frontend** (Phase 5, starts after Phase 3): 4 days  
- **Testing** (Phase 6): 3 days
- **Total**: 13 days

### With buffer (recommended)
- **15-20 days** for unforeseen issues and iterations

---

## Next Steps

1. **Review** this summary and all supporting documents
2. **Discuss** with stakeholders and team
3. **Approve** design and get sign-off
4. **Schedule** implementation sprint
5. **Assign** team members to phases
6. **Begin** Phase 1 (Schema Migration)

---

## Questions for Stakeholders

Before implementation, please clarify:

1. **Version Import**: Should we support importing versions from external documents (PDF, Word)?
2. **Approval Workflow**: Do we need approval workflow for version activation?
3. **Template Inheritance**: Should templates automatically inherit from previous version?
4. **Retention Policy**: How long should we retain superseded versions?
5. **Bulk Operations**: Do we need bulk template update operations?
6. **Multi-jurisdiction**: Should we support multiple active versions for different jurisdictions?

---

## Support & Documentation

### For Implementation Team

- **Design**: `docs/FIX_40_VERSION_AWARE_SOURCES.md` (full architecture)
- **Schema**: `docs/FIX_40_SCHEMA_DESIGN.prisma` (data model)
- **Migration**: `docs/FIX_40_MIGRATION_GUIDE.md` (step-by-step)
- **Reference**: `docs/FIX_40_QUICK_REFERENCE.md` (developer guide)

### For End Users

- Create after implementation:
  - User guide for version management
  - Video tutorials
  - FAQ document
  - Training materials

---

## Conclusion

This version-aware source model represents a significant architectural improvement to CMP. It addresses critical auditability requirements, aligns frequency with the correct domain object (task, not source), and provides a robust framework for managing regulatory changes over time.

The design is conservative and pragmatic:
- Preserves all existing data
- Maintains backward compatibility during migration
- Provides clear rollback strategy
- Focuses on audit integrity and traceability

**The system is ready for implementation.**

---

**Prepared by**: AI Assistant  
**Date**: 2026-03-17  
**Version**: 1.0  
**Status**: Ready for Review

