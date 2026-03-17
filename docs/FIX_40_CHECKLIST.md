# FIX 40: Implementation Checklist

**Version-Aware Source Model - Progress Tracker**

**Started**: [DATE]  
**Target Completion**: [DATE]  
**Status**: 🔴 Not Started | 🟡 In Progress | 🟢 Complete

---

## Phase 1: Schema Migration (Days 1-3)

### Step 1.1: Create New Prisma Models
- [ ] Create `SourceMaster` model
- [ ] Create `SourceVersion` model with version chain
- [ ] Create `SourceVersionEntity` junction table
- [ ] Create `SourceItemVersion` model with change tracking
- [ ] Create `TaskTemplate` model (frequency + anchor date)
- [ ] Add enums: `SourceMasterStatus`, `SourceVersionStatus`, `SourceItemChangeType`, `TaskTemplateStatus`
- [ ] Peer review schema design

### Step 1.2: Update Existing Models
- [ ] Add `taskTemplateId` to Task (String, initially nullable)
- [ ] Add `sourceVersionId` to Task (String, initially nullable)
- [ ] Add `sourceItemVersionId` to Task (String, initially nullable)
- [ ] Add `sourceVersionId` to Finding (String, initially nullable)
- [ ] Update Entity model relationships
- [ ] Update Team model relationships
- [ ] Update User model relationships
- [ ] Add temporary migration columns

### Step 1.3: Generate Migration
- [ ] Run `npx prisma migrate dev --create-only`
- [ ] Review generated migration file
- [ ] Add data transformation SQL (see Migration Guide)
- [ ] Add validation queries to migration
- [ ] Test migration on local database
- [ ] Document rollback procedure

**Phase 1 Checklist:**
- [ ] All models created
- [ ] All relationships defined
- [ ] Indexes added for performance
- [ ] Constraints enforce business rules
- [ ] Migration tested locally
- [ ] Rollback tested
- [ ] Team review complete

---

## Phase 2: Data Migration (Days 4-5)

### Step 2.1: Pre-Migration
- [ ] **CRITICAL**: Backup production database
- [ ] Create test database with production data copy
- [ ] Verify backup integrity
- [ ] Document current record counts
- [ ] Prepare rollback script

### Step 2.2: Run Migration
- [ ] Execute migration on test database
- [ ] Verify SourceMaster creation (count matches unique Source.code+teamId)
- [ ] Verify SourceVersion creation (count matches Source count)
- [ ] Verify SourceItemVersion migration
- [ ] Verify TaskTemplate generation
- [ ] Check for orphaned records
- [ ] Validate referential integrity

### Step 2.3: Validation Queries
- [ ] Run all validation queries (see Migration Guide)
- [ ] Check tasks without templates (should be 0 or minimal)
- [ ] Check findings without version references (should be 0)
- [ ] Verify date fields populated correctly
- [ ] Check version chains (supersedesId relationships)
- [ ] Validate active version count (1 per master)

### Step 2.4: Performance Testing
- [ ] Test query performance with new indexes
- [ ] Benchmark task generation speed
- [ ] Test version comparison queries
- [ ] Verify no table locks during reads
- [ ] Load test with concurrent users

**Phase 2 Checklist:**
- [ ] Migration completed successfully
- [ ] All validation queries pass
- [ ] No data loss
- [ ] Performance acceptable
- [ ] Rollback tested
- [ ] Sign-off from DBA

---

## Phase 3: API Layer (Days 6-8)

### Step 3.1: SourceMaster APIs
- [ ] `POST /api/source-masters` - Create
- [ ] `GET /api/source-masters` - List with filters
- [ ] `GET /api/source-masters/:id` - Detail
- [ ] `PUT /api/source-masters/:id` - Update
- [ ] `DELETE /api/source-masters/:id` - Soft delete
- [ ] Add validation schemas
- [ ] Add permission checks
- [ ] Add audit logging
- [ ] Write API tests

### Step 3.2: SourceVersion APIs
- [ ] `POST /api/source-masters/:id/versions` - Create version
- [ ] `GET /api/source-masters/:id/versions` - List versions
- [ ] `GET /api/source-versions/:id` - Detail
- [ ] `PUT /api/source-versions/:id` - Update
- [ ] `DELETE /api/source-versions/:id` - Soft delete
- [ ] `POST /api/source-versions/:id/activate` - Activate version
- [ ] `GET /api/source-versions/:id/compare/:otherId` - Compare
- [ ] Add validation schemas
- [ ] Add permission checks
- [ ] Add audit logging
- [ ] Write API tests

### Step 3.3: SourceItemVersion APIs
- [ ] `POST /api/source-versions/:id/items` - Create item
- [ ] `GET /api/source-versions/:id/items` - List items
- [ ] `GET /api/source-item-versions/:id` - Detail
- [ ] `PUT /api/source-item-versions/:id` - Update
- [ ] `DELETE /api/source-item-versions/:id` - Soft delete
- [ ] Add validation schemas
- [ ] Add permission checks
- [ ] Add audit logging
- [ ] Write API tests

### Step 3.4: TaskTemplate APIs
- [ ] `POST /api/source-item-versions/:id/templates` - Create
- [ ] `GET /api/source-item-versions/:id/templates` - List
- [ ] `GET /api/task-templates/:id` - Detail
- [ ] `PUT /api/task-templates/:id` - Update
- [ ] `DELETE /api/task-templates/:id` - Retire
- [ ] `POST /api/task-templates/:id/generate` - Generate tasks
- [ ] `GET /api/task-templates/:id/preview` - Preview generation
- [ ] Add validation schemas
- [ ] Add permission checks
- [ ] Add audit logging
- [ ] Write API tests

### Step 3.5: Impact Assessment APIs
- [ ] `GET /api/source-versions/:id/impact` - Impact analysis
- [ ] `POST /api/source-versions/:id/migrate-tasks` - Migrate future tasks
- [ ] Add complex query optimization
- [ ] Write API tests

### Step 3.6: Update Existing APIs
- [ ] Update `GET /api/tasks/:id` to include version info
- [ ] Update `POST /api/tasks` to require templateId
- [ ] Update task list to include version filters
- [ ] Maintain backward compatibility where possible
- [ ] Update API documentation

**Phase 3 Checklist:**
- [ ] All new endpoints implemented
- [ ] All endpoints have validation
- [ ] All endpoints have permission checks
- [ ] All endpoints have audit logging
- [ ] API tests written and passing
- [ ] Postman collection updated
- [ ] API documentation complete

---

## Phase 4: Business Logic (Days 9-11)

### Step 4.1: Service Layer
- [ ] Create `SourceMasterService.ts`
  - [ ] createSourceMaster()
  - [ ] getSourceMaster()
  - [ ] updateSourceMaster()
  - [ ] deleteSourceMaster()
  - [ ] listSourceMasters()
- [ ] Create `SourceVersionService.ts`
  - [ ] createVersion()
  - [ ] activateVersion()
  - [ ] compareVersions()
  - [ ] getImpactAssessment()
  - [ ] supersedePreviousVersion()
- [ ] Create `TaskTemplateService.ts`
  - [ ] createTemplate()
  - [ ] updateTemplate()
  - [ ] retireTemplate()
  - [ ] generateTasksFromTemplate()
  - [ ] previewGeneration()
- [ ] Write unit tests for all services

### Step 4.2: Version Activation Logic
- [ ] Create `versionActivation.ts`
- [ ] Implement activation transaction
- [ ] Implement supersession logic
- [ ] Implement impact analysis
- [ ] Add validation rules
- [ ] Add error handling
- [ ] Write unit tests

### Step 4.3: Task Generation Refactor
- [ ] Update `calculateRecurrenceInstances()` to use anchor date
- [ ] Enforce `max(effectiveDate, anchorDate)` rule
- [ ] Update generation to use templates
- [ ] Test with various date combinations
- [ ] Test with all frequency types
- [ ] Verify no backdated tasks

### Step 4.4: Integration
- [ ] Integrate services with API routes
- [ ] Remove inline business logic from routes
- [ ] Update error handling
- [ ] Add transaction boundaries
- [ ] Write integration tests

**Phase 4 Checklist:**
- [ ] All services implemented
- [ ] All business rules enforced
- [ ] Unit tests passing (>80% coverage)
- [ ] Integration tests passing
- [ ] No backdated task generation
- [ ] Activation workflow tested
- [ ] Code review complete

---

## Phase 5: UI Components (Days 12-15)

### Step 5.1: Source Master Components
- [ ] `SourceMasterList.tsx` - List view
- [ ] `SourceMasterCard.tsx` - Card component
- [ ] `SourceMasterDetail.tsx` - Detail view
- [ ] `SourceMasterForm.tsx` - Create/edit form
- [ ] `SourceMasterDeleteModal.tsx` - Confirmation
- [ ] Style with Tailwind
- [ ] Add loading states
- [ ] Add error handling
- [ ] Test responsiveness

### Step 5.2: Source Version Components
- [ ] `SourceVersionList.tsx` - Timeline view
- [ ] `SourceVersionCard.tsx` - Version card
- [ ] `SourceVersionDetail.tsx` - Detail view
- [ ] `SourceVersionForm.tsx` - Create/edit form
- [ ] `VersionComparisonView.tsx` - Side-by-side compare
- [ ] `VersionActivationWizard.tsx` - Multi-step activation
- [ ] Style with Tailwind
- [ ] Add loading states
- [ ] Add error handling
- [ ] Test responsiveness

### Step 5.3: Task Template Components
- [ ] `TaskTemplateList.tsx` - List view
- [ ] `TaskTemplateCard.tsx` - Template card
- [ ] `TaskTemplateEditor.tsx` - Create/edit form
- [ ] `TemplateGenerationPreview.tsx` - Preview modal
- [ ] `TemplateRetireModal.tsx` - Retirement confirmation
- [ ] Style with Tailwind
- [ ] Add loading states
- [ ] Add error handling
- [ ] Test responsiveness

### Step 5.4: Impact Assessment Components
- [ ] `ImpactAssessmentDashboard.tsx` - Overview
- [ ] `ImpactSummaryCard.tsx` - Summary metrics
- [ ] `AffectedItemsList.tsx` - Item changes list
- [ ] `AffectedTemplatesList.tsx` - Template list
- [ ] `AffectedTasksList.tsx` - Future tasks list
- [ ] Style with Tailwind
- [ ] Add loading states
- [ ] Add error handling

### Step 5.5: Update Existing Components
- [ ] Update `SourceWizard.tsx` to create master+version
- [ ] Update `TaskDetailModal.tsx` to show version info
- [ ] Update `TaskTrackerClient.tsx` with version filter
- [ ] Update breadcrumbs for new screens
- [ ] Update sidebar navigation
- [ ] Add version badges to task cards

### Step 5.6: Polish
- [ ] Add tooltips and help text
- [ ] Add empty states
- [ ] Add loading skeletons
- [ ] Optimize for mobile
- [ ] Add keyboard shortcuts
- [ ] Test accessibility

**Phase 5 Checklist:**
- [ ] All components implemented
- [ ] Consistent with design system
- [ ] Responsive on all devices
- [ ] Loading states implemented
- [ ] Error states handled
- [ ] Accessibility tested
- [ ] User testing complete

---

## Phase 6: Testing & Validation (Days 16-18)

### Step 6.1: Unit Tests
- [ ] SourceMasterService tests
- [ ] SourceVersionService tests
- [ ] TaskTemplateService tests
- [ ] Version activation logic tests
- [ ] Task generation tests
- [ ] Date calculation tests
- [ ] Change detection tests
- [ ] Impact assessment tests
- [ ] Achieve >80% code coverage

### Step 6.2: Integration Tests
- [ ] End-to-end version lifecycle
- [ ] Task generation with dates
- [ ] Version comparison
- [ ] Template retirement
- [ ] Historical data integrity
- [ ] Concurrent user scenarios
- [ ] Performance under load

### Step 6.3: Manual QA
- [ ] Create source master
- [ ] Create version with effective date
- [ ] Add source items
- [ ] Create task templates
- [ ] Generate tasks and verify dates
- [ ] Create second version
- [ ] Compare versions
- [ ] Review impact assessment
- [ ] Activate new version
- [ ] Verify old version superseded
- [ ] Verify historical tasks unchanged
- [ ] Edit task template
- [ ] Retire task template
- [ ] Test soft delete throughout
- [ ] Test audit logging

### Step 6.4: User Acceptance Testing
- [ ] Train test users
- [ ] Provide test scenarios
- [ ] Gather feedback
- [ ] Fix issues found
- [ ] Re-test after fixes
- [ ] Get sign-off

### Step 6.5: Performance Testing
- [ ] Load test version creation
- [ ] Load test task generation
- [ ] Load test version comparison
- [ ] Load test impact assessment
- [ ] Optimize slow queries
- [ ] Add caching where needed
- [ ] Re-test after optimization

### Step 6.6: Security Testing
- [ ] Verify permission checks on all routes
- [ ] Test entity-scoped access
- [ ] Test soft delete security
- [ ] Test audit log integrity
- [ ] Verify input validation
- [ ] Test SQL injection vectors
- [ ] Test XSS vectors

**Phase 6 Checklist:**
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Manual QA complete
- [ ] UAT sign-off received
- [ ] Performance acceptable
- [ ] Security audit passed
- [ ] No critical bugs

---

## Deployment

### Pre-Deployment
- [ ] **CRITICAL**: Final production database backup
- [ ] Deploy to staging environment
- [ ] Run smoke tests on staging
- [ ] Run full test suite on staging
- [ ] Load test on staging
- [ ] Verify backup/restore on staging
- [ ] Get stakeholder approval

### Deployment
- [ ] Schedule maintenance window
- [ ] Notify users of downtime
- [ ] Deploy to production
- [ ] Run migration
- [ ] Verify migration success
- [ ] Run validation queries
- [ ] Start application
- [ ] Verify application health

### Post-Deployment
- [ ] Smoke test critical workflows
- [ ] Monitor error logs
- [ ] Monitor performance metrics
- [ ] Monitor database load
- [ ] Check audit logs
- [ ] Verify backup automation
- [ ] User communication (migration complete)

### Documentation
- [ ] Update API documentation
- [ ] Create user guide for version management
- [ ] Create video tutorials
- [ ] Update README
- [ ] Create FAQ document
- [ ] Create troubleshooting guide

### Cleanup (After 1 Week Stable)
- [ ] Drop temporary migration columns
- [ ] Drop legacy Source table
- [ ] Drop legacy SourceEntity table
- [ ] Drop legacy SourceItem table
- [ ] Create final migration for cleanup
- [ ] Verify no references to old tables
- [ ] Final backup after cleanup

**Deployment Checklist:**
- [ ] Deployed to staging
- [ ] Staging verified
- [ ] Deployed to production
- [ ] Production verified
- [ ] Users trained
- [ ] Documentation complete
- [ ] Cleanup complete

---

## Success Metrics

### Technical Metrics
- [ ] Migration completed in < 10 minutes
- [ ] Task generation < 5% slower than before
- [ ] Version list loads in < 500ms
- [ ] Impact assessment < 2 seconds
- [ ] All tests passing
- [ ] Code coverage > 80%
- [ ] No data loss
- [ ] No orphaned records

### Functional Metrics
- [ ] Can create source masters
- [ ] Can create versions
- [ ] Can activate versions
- [ ] Version comparison works
- [ ] Impact assessment accurate
- [ ] Task generation respects date rules
- [ ] Historical tasks unchanged
- [ ] Template management works
- [ ] Soft delete works

### User Metrics
- [ ] Users can complete version workflow without help
- [ ] Version timeline is clear
- [ ] Impact report is actionable
- [ ] No confusion about concepts
- [ ] Positive user feedback
- [ ] Support tickets < 5 in first week

---

## Risk Mitigation

### High Priority Risks
- [ ] **Data Loss**: Backup before migration, test rollback
- [ ] **Performance**: Load testing, query optimization, indexes
- [ ] **User Confusion**: Training, documentation, intuitive UI
- [ ] **Template Errors**: Comprehensive testing, validation, previews
- [ ] **Version Conflicts**: Unique constraints, transaction boundaries

### Monitoring
- [ ] Set up alerts for errors
- [ ] Monitor query performance
- [ ] Track user adoption
- [ ] Monitor support tickets
- [ ] Weekly review for first month

---

## Sign-Off

### Phase Sign-Offs
- [ ] Phase 1: Schema Migration - **Signed off by**: __________ **Date**: __________
- [ ] Phase 2: Data Migration - **Signed off by**: __________ **Date**: __________
- [ ] Phase 3: API Layer - **Signed off by**: __________ **Date**: __________
- [ ] Phase 4: Business Logic - **Signed off by**: __________ **Date**: __________
- [ ] Phase 5: UI Components - **Signed off by**: __________ **Date**: __________
- [ ] Phase 6: Testing - **Signed off by**: __________ **Date**: __________

### Final Sign-Off
- [ ] Product Owner: __________ **Date**: __________
- [ ] Technical Lead: __________ **Date**: __________
- [ ] QA Lead: __________ **Date**: __________
- [ ] Security Review: __________ **Date**: __________

---

## Notes & Issues

### Blockers
_List any blockers preventing progress_

### Decisions
_Document key decisions made during implementation_

### Changes from Design
_Note any deviations from original design_

### Lessons Learned
_Capture insights for future projects_

---

**Last Updated**: [DATE]  
**Status**: [🔴 Not Started | 🟡 In Progress | 🟢 Complete]

