# FIX 40: Visual Architecture Diagrams

**Version-Aware Source Model - Visual Reference**

---

## 1. Before vs After Architecture

### BEFORE FIX 40 ❌

```
┌─────────────────────────────────────────┐
│           Source (Flat)                 │
│                                         │
│  - code: "GDPR"                        │
│  - name: "General Data Protection..."  │
│  - effectiveDate: 2025-01-01           │
│  - status: ACTIVE                      │
│                                         │
│  ❌ Edited in place (loses history)   │
│  ❌ No version tracking                │
└───────────────┬─────────────────────────┘
                │
                ├─────────────────────────┐
                ↓                         ↓
        ┌───────────────┐         ┌─────────────┐
        │  SourceItem   │         │    Task     │
        │               │         │             │
        │  - reference  │─────────│  - name     │
        │  - title      │         │  ❌ frequency (WRONG!)
        │  - description│         │  - dueDate  │
        └───────────────┘         └─────────────┘

Problems:
• Frequency in wrong place (Source, not Task)
• No version history
• Regulations can't evolve safely
• Historical tasks lose context
```

### AFTER FIX 40 ✅

```
┌────────────────────────────────────────────────────────────┐
│                  SourceMaster (Family)                     │
│                                                            │
│  - code: "GDPR"                                           │
│  - name: "General Data Protection Regulation"            │
│  - status: ACTIVE                                         │
│                                                            │
│  ✅ Long-lived identity                                   │
│  ✅ Has many versions                                     │
└──────────────────────┬─────────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         ↓             ↓             ↓
   ┌────────┐    ┌────────┐    ┌────────┐
   │  v1.0  │────│  v2.0  │────│  v3.0  │
   │ (old)  │    │(active)│    │(draft) │
   └────────┘    └───┬────┘    └────────┘
                     │
                     │ effectiveDate: 2026-06-01
                     │ status: ACTIVE
                     │
       ┌─────────────┼─────────────┐
       ↓             ↓             ↓
  ┌────────┐   ┌────────┐   ┌────────┐
  │ Item   │   │ Item   │   │ Item   │
  │ Art 5  │   │ Art 6  │   │ Art 7  │
  └───┬────┘   └───┬────┘   └───┬────┘
      │            │            │
      ↓            ↓            ↓
  ┌────────┐   ┌────────┐   ┌────────┐
  │Template│   │Template│   │Template│
  │        │   │        │   │        │
  │ ✅ frequency: QUARTERLY (CORRECT!)      │
  │ ✅ anchorDate: 2026-03-31               │
  └───┬────┘   └───┬────┘   └───┬────┘
      │            │            │
      ↓            ↓            ↓
  ┌────────┐   ┌────────┐   ┌────────┐
  │  Task  │   │  Task  │   │  Task  │
  │Instance│   │Instance│   │Instance│
  │        │   │        │   │        │
  │ ✅ templateId: ref to template         │
  │ ✅ versionId: snapshot of v2.0         │
  │ ✅ plannedDate >= max(effective, anchor)
  └────────┘   └────────┘   └────────┘

Benefits:
✅ Frequency in correct place (Template)
✅ Complete version history
✅ Regulations can evolve safely
✅ Tasks preserve source version context
✅ Change tracking and impact assessment
```

---

## 2. Data Model Relationships

```
┌──────────────────────────────────────────────────────────────────┐
│                        ENTITY RELATIONSHIP                        │
└──────────────────────────────────────────────────────────────────┘

        Team                    IssuingAuthority
          │                           │
          │ ownerTeamId               │ issuingAuthorityId
          │                           │
          └───────────┬───────────────┘
                      ↓
              ┌───────────────┐
              │ SourceMaster  │ ← Long-lived identity
              │───────────────│
              │ code          │
              │ name          │
              │ sourceType    │
              │ status        │
              └───────┬───────┘
                      │ 1:N
                      ↓
              ┌───────────────┐
              │ SourceVersion │ ← Time-specific snapshot
              │───────────────│
              │ versionNumber │
              │ effectiveDate │ ← When valid
              │ expiryDate    │ ← When superseded
              │ reviewDate    │
              │ status        │
              │ supersedesId  │ ← Version chain
              └───────┬───────┘
                      │ 1:N
                      ↓
         ┌────────────────────────┐
         │  SourceItemVersion     │ ← Versioned clauses
         │────────────────────────│
         │ reference              │
         │ title                  │
         │ description            │
         │ changeType             │ ← UNCHANGED/MODIFIED/NEW/REMOVED
         │ previousItemId         │ ← Links to prev version
         └────────┬───────────────┘
                  │ 1:N
                  ↓
         ┌────────────────────────┐
         │    TaskTemplate        │ ← Operational definition
         │────────────────────────│
         │ name                   │
         │ ✨ frequency            │ ← Lives here!
         │ ✨ anchorDate          │ ← First occurrence
         │ riskRating             │
         │ evidenceRequired       │
         │ defaultResponsibleTeam │
         │ status                 │
         └────────┬───────────────┘
                  │ 1:N
                  ↓
         ┌────────────────────────┐
         │       Task             │ ← Generated instances
         │────────────────────────│
         │ ✨ taskTemplateId      │ ← Links to template
         │ ✨ sourceVersionId     │ ← Snapshot of version
         │ ✨ sourceItemVersionId │ ← Snapshot of item
         │ name                   │
         │ status                 │
         │ plannedDate            │
         │ dueDate                │
         │ entityId               │
         │ assigneeId             │
         └────────────────────────┘
                  │
                  ↓
         ┌────────────────────────┐
         │   Evidence, Comments   │
         │   Findings, etc.       │
         └────────────────────────┘
```

---

## 3. Version Lifecycle

```
┌──────────────────────────────────────────────────────────────────┐
│                     VERSION LIFECYCLE                             │
└──────────────────────────────────────────────────────────────────┘

Step 1: CREATE NEW VERSION
───────────────────────────
         ┌─────────────┐
         │   v1.0      │
         │  (ACTIVE)   │────────────┐
         └─────────────┘            │
                                    │ User creates v2.0
                                    ↓
                              ┌─────────────┐
                              │   v2.0      │
                              │  (DRAFT)    │
                              │             │
                              │ supersedesId: v1.0
                              └─────────────┘

Step 2: IMPORT/CREATE ITEMS
────────────────────────────
                              ┌─────────────┐
                              │   v2.0      │
                              │  (DRAFT)    │
                              └──────┬──────┘
                                     │
               ┌─────────────────────┼─────────────────────┐
               ↓                     ↓                     ↓
         ┌─────────┐           ┌─────────┐           ┌─────────┐
         │ Art 5   │           │ Art 6   │           │ Art 7   │
         │         │           │         │           │  (NEW)  │
         │UNCHANGED│           │MODIFIED │           │         │
         └─────────┘           └─────────┘           └─────────┘
               │                     │
               │ previousItemId      │ previousItemId
               ↓                     ↓
         ┌─────────┐           ┌─────────┐
         │ Art 5   │           │ Art 6   │
         │ (v1.0)  │           │ (v1.0)  │
         └─────────┘           └─────────┘

Step 3: IMPACT ASSESSMENT
──────────────────────────
                      ┌──────────────────────┐
                      │  Impact Analysis     │
                      │──────────────────────│
                      │ • 1 new item         │
                      │ • 1 modified item    │
                      │ • 0 removed items    │
                      │ • 5 templates need   │
                      │   review             │
                      │ • 23 future tasks    │
                      │   affected           │
                      └──────────────────────┘

Step 4: USER REVIEW & MIGRATE TEMPLATES
────────────────────────────────────────
         For each MODIFIED or NEW item:
         
         ┌──────────────────────┐
         │ Art 6 (MODIFIED)     │
         └──────┬───────────────┘
                │
                ↓
         ┌──────────────────────┐        User decides:
         │ Task Template        │        • Keep template
         │ (linked to v1.0)     │───────▶• Update metadata
         └──────────────────────┘        • Retire template
                                         • Create new template

Step 5: ACTIVATE NEW VERSION
─────────────────────────────
    BEFORE:
         ┌─────────────┐
         │   v1.0      │
         │  (ACTIVE)   │
         └─────────────┘
         
    AFTER:
         ┌─────────────┐            ┌─────────────┐
         │   v1.0      │            │   v2.0      │
         │(SUPERSEDED) │────────────│  (ACTIVE)   │
         │             │            │             │
         │ expiryDate: │            │effectiveDate│
         │ 2026-06-01  │            │ 2026-06-01  │
         └─────────────┘            └─────────────┘

Step 6: FUTURE TASK GENERATION
───────────────────────────────
    All NEW tasks generated from v2.0:
    
         ┌─────────────┐
         │   v2.0      │
         │  (ACTIVE)   │────────┐
         └─────────────┘        │
                                ↓
                         ┌──────────────┐
                         │ New Tasks    │
                         │              │
                         │ versionId:   │
                         │   v2.0       │
                         └──────────────┘
    
    OLD tasks keep v1.0 reference:
    
         ┌─────────────┐
         │   v1.0      │
         │(SUPERSEDED) │────────┐
         └─────────────┘        │
                                ↓
                         ┌──────────────┐
                         │ Old Tasks    │
                         │ (COMPLETED)  │
                         │              │
                         │ versionId:   │
                         │   v1.0       │ ← Never changes!
                         └──────────────┘
```

---

## 4. Task Generation Date Rules

```
┌──────────────────────────────────────────────────────────────────┐
│                  TASK GENERATION DATE LOGIC                       │
└──────────────────────────────────────────────────────────────────┘

Given:
  SourceVersion.effectiveDate = 2026-06-01
  TaskTemplate.anchorDate     = 2026-03-31
  TaskTemplate.frequency      = QUARTERLY

RULE: No task before max(effectiveDate, anchorDate)

┌────────────────────────────────────────────────────────────────┐
│                         TIMELINE                               │
└────────────────────────────────────────────────────────────────┘

2026-01-01          2026-03-31          2026-06-01          2026-09-30
    │                   │                   │                   │
    │   anchorDate ────►│                   │                   │
    │                   │   effectiveDate ──►│                   │
    │                   │                   │                   │
    ├───────────────────┼───────────────────┼───────────────────┤
    │                   │                   │                   │
    │    ❌ No tasks    │    ❌ No tasks    │  ✅ First task    │
    │    (before        │    (before        │     generated     │
    │     anchor)       │     effective)    │     here          │
    │                   │                   │                   │
    └───────────────────┴───────────────────┴───────────────────┘

Calculation:
  earliestValidDate = max(2026-03-31, 2026-06-01)
                    = 2026-06-01
  
  First task:  2026-06-01 ✅
  Second task: 2026-09-01 ✅ (quarterly)
  Third task:  2026-12-01 ✅ (quarterly)

If anchorDate > effectiveDate:
  Example: anchor = 2026-07-01, effective = 2026-06-01
  earliestValidDate = max(2026-07-01, 2026-06-01) = 2026-07-01
  First task: 2026-07-01 ✅

This prevents backdated tasks!
```

---

## 5. Version Status State Machine

```
┌──────────────────────────────────────────────────────────────────┐
│                  VERSION STATUS TRANSITIONS                       │
└──────────────────────────────────────────────────────────────────┘

                     ┌─────────┐
                     │  DRAFT  │ ← Initial state
                     └────┬────┘
                          │
                          │ User activates
                          ↓
                     ┌─────────┐
                     │ ACTIVE  │ ← Only ONE active per master
                     └────┬────┘
                          │
                          │ New version activated
                          ↓
                  ┌──────────────┐
                  │  SUPERSEDED  │ ← Previous version
                  └──────┬───────┘
                          │
                          │ Manual archive
                          ↓
                     ┌─────────┐
                     │ARCHIVED │ ← Historical record
                     └─────────┘

Rules:
• Only ONE ACTIVE version per SourceMaster at any time
• When new version → ACTIVE, previous ACTIVE → SUPERSEDED
• SUPERSEDED versions retain expiryDate = new version's effectiveDate
• ARCHIVED is for cleanup/decommissioning (rare)
```

---

## 6. Change Type Classification

```
┌──────────────────────────────────────────────────────────────────┐
│                 SOURCE ITEM CHANGE TYPES                          │
└──────────────────────────────────────────────────────────────────┘

When creating v2.0 from v1.0, each item is classified:

┌──────────────┐
│ UNCHANGED    │ ← Same content as previous version
└──────────────┘
   Example: Article 5(1)(a) - identical text
   
   Action: Copy item, link via previousItemId
   Template: Keep as-is, no review needed
   Future tasks: Continue as-is

┌──────────────┐
│  MODIFIED    │ ← Changed from previous version
└──────────────┘
   Example: Article 6 - retention period changed from 5 to 7 years
   
   Action: Create new item, link via previousItemId
   Template: Flag for review, user decides if updates needed
   Future tasks: Flag for review

┌──────────────┐
│     NEW      │ ← Didn't exist in previous version
└──────────────┘
   Example: Article 9a - new requirement added
   
   Action: Create new item, no previousItemId
   Template: User creates new templates
   Future tasks: Generate new tasks

┌──────────────┐
│   REMOVED    │ ← Existed before but removed
└──────────────┘
   Example: Article 12 - repealed
   
   Action: Don't create in new version (exists in old version only)
   Template: Retire templates linked to removed item
   Future tasks: Cancel or reassign

┌─────────────────────────────────────────────────────────────────┐
│                 IMPACT ASSESSMENT SUMMARY                        │
├─────────────────────────────────────────────────────────────────┤
│ Items:                                                          │
│   • 45 unchanged                                                │
│   • 12 modified                                                 │
│   • 5 new                                                       │
│   • 2 removed                                                   │
│                                                                 │
│ Templates needing review: 17                                    │
│   • 12 linked to MODIFIED items                                │
│   • 2 linked to REMOVED items                                  │
│   • 3 affected by entity scope change                          │
│                                                                 │
│ Future tasks affected: 156                                      │
│   • 89 PLANNED (due date > effectiveDate)                      │
│   • 67 TO_DO (due soon)                                        │
│                                                                 │
│ Entities impacted: 8                                            │
│   • DIEL, DGL, DBVI, FINSERV, DSM, DTC, DBI, DIOM             │
│                                                                 │
│ Recommended actions:                                            │
│   1. Review 17 task templates                                  │
│   2. Update metadata where needed                              │
│   3. Retire 2 templates (removed items)                        │
│   4. Create 5 new templates (new items)                        │
│   5. Regenerate 89 PLANNED tasks                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Complete System Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                   COMPLETE WORKFLOW                               │
└──────────────────────────────────────────────────────────────────┘

1. INITIAL SETUP (v1.0)
   ────────────────────
   User → Create SourceMaster
        → Create SourceVersion v1.0 (DRAFT)
        → Add SourceItemVersions
        → Create TaskTemplates (frequency here!)
        → Generate Tasks from templates
        → Activate v1.0
   
   Result: v1.0 ACTIVE, tasks being worked on

2. REGULATION CHANGES
   ───────────────────
   External: New regulation published (e.g., GDPR amendments)
   
   User → Create SourceVersion v2.0 (DRAFT)
        → supersedesId = v1.0
        → effectiveDate = 2026-06-01
   
3. IMPORT NEW REGULATION TEXT
   ──────────────────────────
   User → Import/create SourceItemVersions for v2.0
        → System classifies each as UNCHANGED/MODIFIED/NEW/REMOVED
        → Links to previous items via previousItemId
   
4. IMPACT ASSESSMENT
   ─────────────────
   System → Analyzes v1.0 vs v2.0
          → Identifies affected templates (linked to MODIFIED/REMOVED)
          → Counts future tasks (PLANNED, TO_DO after effectiveDate)
          → Lists entities impacted
          → Generates recommendation report
   
   User → Reviews impact report
        → For each MODIFIED item:
            * Review linked templates
            * Update metadata if needed
            * Keep/modify/retire template
        → For each REMOVED item:
            * Retire linked templates
            * Cancel or reassign future tasks
        → For each NEW item:
            * Create new templates
            * Define frequency + anchor date
   
5. ACTIVATE NEW VERSION
   ────────────────────
   User → Clicks "Activate v2.0"
   
   System → Sets v2.0.status = ACTIVE
          → Sets v1.0.status = SUPERSEDED
          → Sets v1.0.expiryDate = v2.0.effectiveDate
          → Logs audit events
   
6. ONGOING OPERATIONS
   ──────────────────
   System → Generates NEW tasks from v2.0 templates
          → Uses ACTIVE templates only
          → Respects max(effectiveDate, anchorDate) rule
   
   Historical tasks:
          → Keep v1.0 reference (immutable)
          → Audit trail preserved
   
   Future tasks:
          → User-reviewed and updated as needed
          → Some cancelled, some kept, some regenerated

┌─────────────────────────────────────────────────────────────────┐
│                           KEY RULES                              │
├─────────────────────────────────────────────────────────────────┤
│ 1. Frequency belongs to TaskTemplate (not Source)              │
│ 2. Only ONE ACTIVE version per SourceMaster                     │
│ 3. Tasks lock to version at creation (immutable)               │
│ 4. No tasks before max(effectiveDate, anchorDate)              │
│ 5. Completed tasks NEVER change version reference              │
│ 6. Future tasks reviewed when version changes                  │
│ 7. Templates can be ACTIVE, DRAFT, or RETIRED                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Auditability & Traceability

```
┌──────────────────────────────────────────────────────────────────┐
│                    AUDIT TRAIL EXAMPLE                            │
└──────────────────────────────────────────────────────────────────┘

Question: "Which version of GDPR was this task based on?"

Task #12345
├─ name: "Review data retention policies"
├─ status: COMPLETED
├─ completedAt: 2026-08-15
├─ taskTemplateId: "abc-123"  ←────┐
├─ sourceVersionId: "ver-v20" ←──┐ │
└─ sourceItemVersionId: "itm-789"←┤│
                                  │││
                                  ││└──────┐
                                  │└───────┼────────┐
                                  │        │        │
                                  ↓        ↓        ↓
                        ┌─────────────────────────────────┐
                        │ SourceVersion v2.0              │
                        │─────────────────────────────────│
                        │ versionNumber: "2.0"            │
                        │ effectiveDate: 2026-06-01       │
                        │ changeSummary: "Updated..."     │
                        └─────────────────────────────────┘
                                    │
                                    ↓
                        ┌─────────────────────────────────┐
                        │ SourceItemVersion               │
                        │─────────────────────────────────│
                        │ reference: "Art 5(1)(f)"        │
                        │ title: "Integrity and conf..."  │
                        │ changeType: MODIFIED            │
                        └─────────────────────────────────┘
                                    │
                                    ↓
                        ┌─────────────────────────────────┐
                        │ TaskTemplate                    │
                        │─────────────────────────────────│
                        │ name: "Review data retention..."│
                        │ frequency: QUARTERLY            │
                        │ anchorDate: 2026-03-31          │
                        └─────────────────────────────────┘

Answer: "GDPR v2.0 (effective 2026-06-01), Article 5(1)(f)"

Complete audit trail preserved forever!
```

---

## Summary

This visual guide shows the complete architecture of the version-aware source model. Key takeaways:

1. ✅ **Frequency moves to TaskTemplate** (correct domain)
2. ✅ **Sources are versioned** with full history
3. ✅ **Tasks lock to version at creation** (immutable)
4. ✅ **Change tracking** with UNCHANGED/MODIFIED/NEW/REMOVED
5. ✅ **Impact assessment** before version activation
6. ✅ **Date rules** prevent backdated tasks
7. ✅ **Complete auditability** with traceability

**Ready for implementation!**

