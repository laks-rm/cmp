# FIX 40: Frequently Asked Questions

**Version-Aware Source Model - FAQ & Design Clarifications**

---

## Conceptual Questions

### Q1: Why do we need source versioning? Can't we just edit the source in place?

**A**: Editing sources in place breaks audit trails and regulatory compliance. Consider:

- **Audit requirement**: "Show me all tasks that were based on GDPR requirements as they existed in June 2025"
- **Without versioning**: We can't answer this. The source was edited, and we lost the historical context.
- **With versioning**: We can show exactly which version of GDPR each task was generated from.

**Real-world scenario**: A regulator asks, "Why didn't you comply with Article 5(1)(f) in Q3 2025?" You need to prove that the requirement didn't exist or was different at that time. Version history provides this proof.

---

### Q2: Why does frequency belong to TaskTemplate instead of Source?

**A**: Frequency is an **operational characteristic**, not a **regulatory characteristic**.

**Example - GDPR Article 5(1)(f)**:
- **Regulation says**: "Data must be processed securely and with appropriate technical measures"
- **Regulation does NOT say**: "You must review this quarterly"
- **Your organization decides**: "We will review our security measures quarterly"

The regulation (Source) describes **WHAT** you must do.  
The task template describes **HOW OFTEN** you do it.

Different entities might interpret the same regulation differently:
- Entity A: Reviews GDPR Art 5(1)(f) **quarterly**
- Entity B: Reviews GDPR Art 5(1)(f) **monthly** (higher risk profile)

Same source, different operational frequencies. Therefore, frequency belongs to TaskTemplate.

---

### Q3: What's the difference between SourceMaster and SourceVersion?

**A**: Think of it like software versioning:

**SourceMaster** = "GDPR" (the regulation family)
- Long-lived identity
- Like saying "Windows" or "iPhone"

**SourceVersion** = "GDPR v2.0 effective 2026-06-01" (specific snapshot)
- Time-specific regulatory text
- Like saying "Windows 11" or "iPhone 15"

When GDPR is amended, we don't replace the SourceMaster. We create a new SourceVersion under it.

```
SourceMaster: "GDPR"
  ├─ SourceVersion: v1.0 (effective 2018-05-25, superseded 2026-06-01)
  ├─ SourceVersion: v2.0 (effective 2026-06-01, superseded 2028-01-01)
  └─ SourceVersion: v3.0 (effective 2028-01-01, active)
```

---

### Q4: Can we have multiple active versions at the same time?

**A**: By default, **NO** - only ONE active version per SourceMaster at any time.

**Reasoning**: Having multiple active versions creates ambiguity:
- Which version do we use for new tasks?
- Which version is "current" for reporting?
- How do we handle conflicts?

**Exception to consider**: If you operate in multiple jurisdictions and GDPR has different effective dates per jurisdiction, you might need multiple active versions. This would require enhancing the design to make versions jurisdiction-specific.

**Current design**: One active version globally. When you activate v2.0, v1.0 automatically becomes SUPERSEDED.

---

### Q5: What happens to tasks that are already in progress when a new version is activated?

**A**: It depends on the task status:

| Task Status | Action |
|------------|--------|
| **COMPLETED** | Keep as-is. Never change. This is historical truth. |
| **IN_PROGRESS** | Do not auto-update. Flag for review if linked item changed. User decides. |
| **PENDING_REVIEW** | Do not auto-update. User decides if review needs re-doing. |
| **TO_DO** (due soon) | Do not auto-update. Flag for review. May need to be updated or cancelled. |
| **PLANNED** (future) | Candidate for regeneration. User reviews impact report and decides. |

**Golden rule**: We never silently change tasks. The impact assessment workflow gives users control.

---

## Technical Questions

### Q6: How do we prevent generating tasks before a source version is effective?

**A**: The task generation logic enforces:

```typescript
earliestValidDate = max(
  sourceVersion.effectiveDate,
  taskTemplate.anchorDate
)

// Only generate tasks where:
task.plannedDate >= earliestValidDate
```

**Example**:
- Source effective date: 2026-06-01
- Template anchor date: 2026-03-31
- Earliest valid task: 2026-06-01 (the max of the two)

This prevents generating a task for March 31 when the regulation isn't even effective until June 1.

---

### Q7: What is `anchorDate` in TaskTemplate?

**A**: The `anchorDate` is the **first occurrence date** for a recurring task series.

**Example - Quarterly task**:
- Anchor date: 2026-03-31
- Frequency: QUARTERLY
- Generated instances:
  - 2026-03-31 (anchor)
  - 2026-06-30 (+3 months)
  - 2026-09-30 (+3 months)
  - 2026-12-31 (+3 months)

The anchor preserves day-of-month consistency. If you want quarterly tasks on the last day of the quarter, set anchor to 2026-03-31. All future instances will be generated on the last day of their respective quarters.

---

### Q8: Can I change a TaskTemplate after tasks have been generated?

**A**: Yes, but carefully:

**Safe changes** (don't affect existing tasks):
- Description, expectedOutcome (documentation)
- Default assignments (only affect NEW tasks)
- Metadata

**Risky changes** (may cause confusion):
- Frequency (existing tasks keep old frequency, new tasks use new frequency)
- Anchor date (doesn't affect existing tasks, but changes future recurrence)
- Risk rating (existing tasks keep old rating)

**Rule**: Changes to a template only affect **NEW** tasks generated after the change. Existing tasks are snapshots and don't update.

**Best practice**: If you need to make major changes, consider retiring the old template and creating a new one.

---

### Q9: What happens if I retire a TaskTemplate?

**A**: When you retire a template:

1. Template status → RETIRED
2. Template stops generating new tasks
3. Existing tasks from that template remain unchanged
4. Template remains visible (soft delete) for audit purposes

**You should retire a template when**:
- The regulatory requirement is removed
- The control activity is no longer needed
- You want to replace it with a different approach

---

### Q10: How do we handle hierarchical source items (like nested regulations)?

**A**: SourceItemVersion supports hierarchical structure via `parentId`:

```
SourceVersion: GDPR v2.0
  ├─ SourceItemVersion: "Article 5" (parent)
  │    ├─ SourceItemVersion: "Article 5(1)" (parent)
  │    │    ├─ SourceItemVersion: "Article 5(1)(a)" (leaf)
  │    │    ├─ SourceItemVersion: "Article 5(1)(b)" (leaf)
  │    │    └─ SourceItemVersion: "Article 5(1)(f)" (leaf)
  │    └─ SourceItemVersion: "Article 5(2)" (leaf)
  └─ SourceItemVersion: "Article 6" (parent)
```

Task templates are typically created at the **leaf level** (e.g., "Article 5(1)(f)"), but you can create them at any level.

---

## Workflow Questions

### Q11: How do I create a new regulation from scratch?

**A**: Follow these steps:

1. **Create SourceMaster**
   - Code: "GDPR"
   - Name: "General Data Protection Regulation"
   - Type: REGULATION
   - Owner Team: Compliance

2. **Create SourceVersion**
   - Version number: "1.0"
   - Effective date: 2018-05-25
   - Status: DRAFT

3. **Add SourceItemVersions**
   - Reference: "Art 5(1)(a)"
   - Title: "Lawfulness, fairness and transparency"
   - Description: Full text...
   - Change type: NEW

4. **Create TaskTemplates**
   - Linked to specific items
   - Define frequency (QUARTERLY, ANNUAL, etc.)
   - Set anchor date
   - Define risk rating and requirements

5. **Generate Tasks**
   - System generates task instances from templates
   - Respects effective date and anchor date
   - Creates recurrence series

6. **Activate Version**
   - Set version status to ACTIVE
   - Tasks become actionable

---

### Q12: How do I update an existing regulation?

**A**: Follow the version creation workflow:

1. **Create New Version**
   - Under same SourceMaster
   - Version number: "2.0"
   - Effective date: When new version takes effect
   - Supersedes: Link to previous version
   - Status: DRAFT

2. **Import/Create Items**
   - For each item, classify as:
     - UNCHANGED: Copy from previous, link via previousItemId
     - MODIFIED: New item with changes, link via previousItemId
     - NEW: Brand new item, no previousItemId
     - REMOVED: Don't create (exists in old version only)

3. **Review Impact**
   - System analyzes affected templates
   - System counts future tasks needing attention
   - Review impact report

4. **Update Templates**
   - For MODIFIED items: Review and update templates if needed
   - For REMOVED items: Retire templates
   - For NEW items: Create new templates

5. **Activate New Version**
   - System sets new version to ACTIVE
   - System sets old version to SUPERSEDED
   - Future task generation uses new version

---

### Q13: How do I compare two versions?

**A**: Use the version comparison endpoint:

```
GET /api/source-versions/{v1_id}/compare/{v2_id}
```

**Response includes**:
- Summary: X unchanged, Y modified, Z new, W removed
- Side-by-side item comparison
- Change highlights
- Affected templates
- Affected future tasks

**UI shows**:
- Timeline view with both versions
- Item-by-item comparison
- Color coding: green (new), yellow (modified), red (removed), gray (unchanged)
- Links to affected templates and tasks

---

### Q14: What is an "impact assessment"?

**A**: When you create a new version, the impact assessment analyzes:

1. **Item Changes**
   - How many items unchanged/modified/new/removed
   - Which specific items changed

2. **Template Impact**
   - Which templates are linked to changed items
   - How many templates need review
   - Which templates should be retired

3. **Task Impact**
   - How many future tasks are affected
   - Breakdown by status (PLANNED, TO_DO)
   - Which entities are impacted

4. **Recommendations**
   - Specific actions to take
   - Priority order
   - Risk assessment

**This report guides your decision-making** before activating the new version.

---

### Q15: Can I preview task generation before committing?

**A**: Yes! The template preview endpoint shows:

```
GET /api/task-templates/{id}/preview?entityIds=A,B,C
```

**Shows**:
- How many tasks will be generated
- Planned dates for each task
- Which entities will get tasks
- Frequency application
- No actual tasks created

**Use this to**:
- Verify date calculations
- Check entity applicability
- Validate frequency logic
- Catch errors before generation

---

## Migration Questions

### Q16: What happens to my existing data during migration?

**A**: The migration transforms existing data:

**Before migration**:
- Source (flat) → 100 records
- SourceItem → 500 records
- Task → 2000 records

**After migration**:
- SourceMaster → ~80-90 records (unique code+team combinations)
- SourceVersion → 100 records (1 version per old Source)
- SourceItemVersion → 500 records (renamed, enhanced)
- TaskTemplate → ~300-400 records (generated from Task groupings)
- Task → 2000 records (enhanced with template/version references)

**No data is lost**. Everything is transformed and enhanced.

---

### Q17: How long will the migration take?

**A**: Depends on data volume:

| Records | Estimated Time |
|---------|---------------|
| < 1,000 tasks | 1-2 minutes |
| 1,000-10,000 tasks | 2-5 minutes |
| 10,000-50,000 tasks | 5-10 minutes |
| > 50,000 tasks | 10+ minutes |

**Most deployments**: < 5 minutes

**Factors affecting time**:
- Database server performance
- Number of indexes to build
- Concurrent load during migration

---

### Q18: Can I roll back the migration if something goes wrong?

**A**: **Yes**, if done within the maintenance window:

1. **Immediate rollback** (within 1 hour):
   - Restore from pre-migration backup
   - Revert code deployment
   - No data loss

2. **Delayed rollback** (after users create data):
   - More complex - need to preserve new data
   - May need manual reconciliation
   - Contact DBA

**Best practice**: Thorough testing on staging before production.

---

### Q19: How are TaskTemplates generated from existing Tasks?

**A**: Migration groups tasks by similarity:

**Grouping criteria**:
- Same sourceItemId
- Same name
- Same frequency
- Same entityId

**For each group**:
- Create ONE template
- Derive anchorDate from earliest plannedDate
- Link all tasks in group to this template

**Example**:
- Tasks: "Review GDPR compliance" (Q1 2025, Q2 2025, Q3 2025, Q4 2025)
- Frequency: QUARTERLY
- Creates: 1 template with anchor = Q1 2025 date
- Links: All 4 tasks to this template

**Edge case**: If a task can't be matched, a fallback template is created.

---

## Best Practices Questions

### Q20: What's the recommended versioning scheme?

**A**: Use semantic versioning or year-based:

**Semantic** (for internal policies):
- 1.0, 1.1, 1.2 (minor updates)
- 2.0 (major revision)

**Year-based** (for regulations):
- 2025.1 (first update in 2025)
- 2025.2 (second update in 2025)
- 2026.1 (first update in 2026)

**Label-based** (for standards):
- v4.0 (matches official standard version)
- PCI DSS 4.0, PCI DSS 4.0.1

**Choose one scheme per SourceMaster and stick with it**.

---

### Q21: How often should I create new versions?

**A**: Create a new version when:

✅ **Regulation is officially updated** (external change)  
✅ **Material change to requirements** (not just typo fixes)  
✅ **Effective date changes** (if significant)  
✅ **New requirements added** (material addition)  
✅ **Requirements removed** (material deletion)  

❌ **DON'T create new version for**:
- Typo corrections
- Formatting changes
- Metadata updates
- Clarifications that don't change meaning

**General rule**: If it affects how tasks should be performed, create a new version. If it's just documentation cleanup, update in place (if version is still DRAFT).

---

### Q22: Should I create templates for every source item?

**A**: No, only for items that require **operational tasks**.

**Create template if**:
- Requires periodic review
- Requires evidence collection
- Requires attestation
- Requires testing

**Don't create template if**:
- Purely informational (definitions, glossary)
- Covered by another item's template
- Not applicable to your organization

**Example - GDPR**:
- Article 5(1)(f): ✅ Create template (security requirement, needs periodic review)
- Article 4 (definitions): ❌ No template needed (just reference material)

---

### Q23: How do I handle regulations that apply to only some entities?

**A**: Use the `applicableEntities` field in TaskTemplate:

**Option 1**: Entity-specific templates
```typescript
Template 1: "Review GDPR - DIEL"
- applicableEntities: ["DIEL"]

Template 2: "Review GDPR - DGL"  
- applicableEntities: ["DGL"]
```

**Option 2**: Shared template with entity filter
```typescript
Template: "Review GDPR"
- applicableEntities: ["DIEL", "DGL", "DBVI"]
- Excluded: ["FINSERV"] (different regulation)
```

**Option 3**: All entities (default)
```typescript
Template: "Review GDPR"
- applicableEntities: null (or all entity IDs)
```

---

### Q24: What's the difference between reviewDate and effectiveDate?

**A**: Completely different purposes:

**effectiveDate** (SourceVersion):
- When the regulation **takes legal effect**
- External date (from regulator)
- Used for task generation date logic
- Example: GDPR effective date = 2018-05-25

**reviewDate** (SourceVersion):
- When **you should review the source/version** internally
- Internal operational date
- Not used for task generation
- Example: "Review our GDPR policy annually" → reviewDate = 2027-01-01

**Analogy**:
- effectiveDate = "When the law becomes active"
- reviewDate = "When we should check if we're still compliant"

---

### Q25: Can I delete a source version?

**A**: Yes, via **soft delete**, but with caveats:

**You CAN delete if**:
- Version is DRAFT (never activated)
- No tasks have been generated from it
- No external references exist

**You SHOULD NOT delete if**:
- Version was ever ACTIVE
- Tasks exist referencing this version
- Audit trail would be broken

**Process**:
- Soft delete sets `deletedAt`, `deletedBy`, `deletedReason`
- Record remains in database
- Hidden from normal queries
- Preserves referential integrity

**Best practice**: Use ARCHIVED status instead of deletion for superseded versions.

---

## Troubleshooting Questions

### Q26: Why are some of my tasks not generating?

**Check these common issues**:

1. **Template status**: Is template ACTIVE?
2. **Effective date**: Is `sourceVersion.effectiveDate` in the future?
3. **Anchor date**: Is `template.anchorDate` in the future?
4. **Entity applicability**: Is entity in `applicableEntities`?
5. **Responsible team**: Is `defaultResponsibleTeamId` set?

**Debug query**:
```sql
SELECT 
  tt.id,
  tt.name,
  tt.status,
  sv.effectiveDate,
  tt.anchorDate
FROM "TaskTemplate" tt
JOIN "SourceItemVersion" siv ON tt."sourceItemVersionId" = siv.id
JOIN "SourceVersion" sv ON siv."sourceVersionId" = sv.id
WHERE tt.id = '<template-id>';
```

---

### Q27: I see tasks generated before the source effective date. Why?

**This should not happen** if the system is working correctly.

**Investigation steps**:
1. Check task's `plannedDate` vs `sourceVersion.effectiveDate`
2. Check if task was created before migration (may not have version reference)
3. Check if `calculateRecurrenceInstances()` is enforcing max() rule
4. Check if manual task creation bypassed validation

**Report as a bug** if found - this violates a core design principle.

---

### Q28: Why can't I activate my new version?

**Common blockers**:

1. **Another version already ACTIVE**
   - Only one active version allowed per SourceMaster
   - Deactivate old version first (or use activation workflow)

2. **Missing items**
   - New version has no SourceItemVersions
   - Add at least one item

3. **Effective date in past**
   - Can't activate version with past effective date without impact review
   - Set future effective date

4. **Permission denied**
   - User lacks SOURCES:UPDATE permission
   - Contact admin

---

### Q29: My impact assessment shows 0 affected tasks. Is that correct?

**Possible reasons**:

1. **All items marked UNCHANGED**
   - If nothing changed, impact is zero ✅

2. **No future tasks exist**
   - All tasks completed or due before new effectiveDate ✅

3. **Effective date far in future**
   - Future tasks not yet generated ✅

4. **Templates retired**
   - All templates from old version already retired ✅

5. **Bug in impact analysis**
   - Check logs, verify manually ❌

**Most common**: Items marked unchanged when they should be modified. Review changeType classifications.

---

### Q30: Can I change a task's version reference after creation?

**No, and you shouldn't want to**. This would break audit integrity.

**The version reference is a historical snapshot**:
- Shows which version of the regulation the task was based on
- Immutable for audit purposes
- Changing it would falsify history

**If the regulation changed**:
- Create new version
- Generate new tasks from new version
- Old tasks keep old version reference

**If task is wrong**:
- Delete and regenerate
- New task will get current active version

---

## Need More Help?

- **Design Document**: `docs/FIX_40_VERSION_AWARE_SOURCES.md`
- **Migration Guide**: `docs/FIX_40_MIGRATION_GUIDE.md`
- **Quick Reference**: `docs/FIX_40_QUICK_REFERENCE.md`
- **Visual Diagrams**: `docs/FIX_40_VISUAL_DIAGRAMS.md`
- **Implementation Checklist**: `docs/FIX_40_CHECKLIST.md`

---

**Last Updated**: 2026-03-17  
**Version**: 1.0
