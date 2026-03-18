# Visual Guide: Controlled Source Editing

## Overview
This guide shows the visual flow for editing sources and managing entity applicability.

---

## Source Card with Edit Button

```
┌──────────────────────────────────────────────────────────────┐
│ [Regulation] [DIEL] [DGL]                                    │
│                                                               │
│ GDPR Data Protection Regulation                              │
│ GDPR-2024                                                     │
│ MFSA — Malta Financial Services Authority                    │
│                                                               │
│ ┌───────────┬───────────┬────────────┐                      │
│ │ Tasks     │ Findings  │ Progress   │                      │
│ │ 142/156   │    3      │    91%     │                      │
│ └───────────┴───────────┴────────────┘                      │
│                                                               │
│ ████████████████████████████░░░ 91%                         │
│                                                               │
│ [ ✏️ ]  [ View Tasks ]  [ + Add Tasks ]                      │
│  Edit                                                         │
└──────────────────────────────────────────────────────────────┘
```

**NEW**: Edit button (pencil icon) opens source editing modal.

---

## Screen 1: Edit Source Metadata & Entities

```
╔══════════════════════════════════════════════════════════════╗
║ Edit Source                                          [X]     ║
║ Update source metadata and applicable entities               ║
╠══════════════════════════════════════════════════════════════╣
║                                                               ║
║ Source Metadata (Safe to edit)                               ║
║ ─────────────────────────────────────────────────────────────║
║                                                               ║
║ Source Name *                                                 ║
║ ┌───────────────────────────────────────────────────────┐   ║
║ │ GDPR Data Protection Regulation                       │   ║
║ └───────────────────────────────────────────────────────┘   ║
║                                                               ║
║ Source Code *              Source Type *                      ║
║ ┌──────────────────┐      ┌──────────────────────────┐      ║
║ │ GDPR-2024        │      │ Regulation           ▼   │      ║
║ └──────────────────┘      └──────────────────────────┘      ║
║                                                               ║
║ Issuing Authority                                             ║
║ ┌───────────────────────────────────────────────────────┐   ║
║ │ MFSA (Malta Financial Services Authority)         ▼   │   ║
║ └───────────────────────────────────────────────────────┘   ║
║                                                               ║
║ Effective Date             Review Date                        ║
║ ┌──────────────────┐      ┌──────────────────────────┐      ║
║ │ 2024-05-25       │      │ 2025-12-31               │      ║
║ └──────────────────┘      └──────────────────────────┘      ║
║                                                               ║
║ ─────────────────────────────────────────────────────────────║
║                                                               ║
║ Applicable Entities * [Changes detected]                      ║
║ Select entities this source applies to                        ║
║                                                               ║
║ ┌──────────────────────────┬──────────────────────────┐     ║
║ │ ✓ [DIEL]                 │ ✓ [DGL]                  │     ║
║ │   Diar iI-Bnedikti       │   Djar Group Ltd         │     ║
║ └──────────────────────────┴──────────────────────────┘     ║
║ ┌──────────────────────────┬──────────────────────────┐     ║
║ │ ✓ [DBVI] [NEW]           │   [FINSERV]              │     ║
║ │   DBVI Holdings          │   Finserv Corp           │     ║
║ └──────────────────────────┴──────────────────────────┘     ║
║                                                               ║
║ ℹ️ 1 entity will be added. You'll see an impact preview     ║
║   before task generation.                                     ║
║                                                               ║
╠══════════════════════════════════════════════════════════════╣
║                               [ Cancel ] [ Save Changes ]    ║
╚══════════════════════════════════════════════════════════════╝
```

### Key UI Elements:

1. **Section Headers**: "Source Metadata (Safe to edit)" clarifies no-impact changes
2. **Required Fields**: Marked with asterisk (*)
3. **Entity Checkboxes**: Visual selection with badges
4. **NEW Badge**: Green badge on newly added entity
5. **Change Summary**: Blue info box at bottom
6. **Clear Actions**: Cancel or Save Changes

---

## Screen 2: Impact Preview (if entities added)

```
╔══════════════════════════════════════════════════════════════╗
║ Entity Addition Impact                              [X]     ║
║ Review the impact before generating tasks                    ║
╠══════════════════════════════════════════════════════════════╣
║                                                               ║
║ ┌─────────────────────────────────────────────────────────┐ ║
║ │ ℹ️ Source Updated                                        │ ║
║ │ New entity will be added to source. Tasks can be        │ ║
║ │ generated separately.                                    │ ║
║ └─────────────────────────────────────────────────────────┘ ║
║                                                               ║
║ Newly Added Entities                                          ║
║ ─────────────────────────────────────────────────────────────║
║ [DBVI]                                                        ║
║                                                               ║
║ ┌──────────────┬─────────────────┬──────────────────┐       ║
║ │      25      │       15        │       ~15        │       ║
║ │ Source Items │ Task Templates  │   Total Tasks    │       ║
║ └──────────────┴─────────────────┴──────────────────┘       ║
║                                                               ║
║ ┌─────────────────────────────────────────────────────────┐ ║
║ │ ⚠️ Important                                             │ ║
║ │ • Existing entity task history will NOT be changed       │ ║
║ │ • Tasks will be generated only for newly added entities  │ ║
║ │ • Task generation starts from current/future dates       │ ║
║ │ • You can skip generation and add tasks later            │ ║
║ └─────────────────────────────────────────────────────────┘ ║
║                                                               ║
╠══════════════════════════════════════════════════════════════╣
║              [ Skip Task Generation ] [ ✓ Generate Tasks Now ]║
╚══════════════════════════════════════════════════════════════╝
```

### Impact Preview Elements:

1. **Info Banner**: Confirms source was updated
2. **Entity Badges**: Shows which entities being added
3. **Impact Cards**: Three-column estimate display
4. **Warning Box**: Critical information about impact
5. **Two Action Options**:
   - Skip: Save source without tasks
   - Generate: Proceed with task creation

---

## User Flow Diagram

```
User clicks Edit on source card
         │
         ▼
┌────────────────────────┐
│   Edit Source Modal    │
│                        │
│ • Edit metadata        │
│ • Select entities      │
│ • See changes          │
└────────────────────────┘
         │
         ▼
   User clicks "Save Changes"
         │
         ▼
    Entity changes?
         │
    ┌────┴────┐
    │         │
   No        Yes
    │         │
    ▼         ▼
 Simple    Impact Preview
 Update    Screen
    │         │
    │    ┌────┴────┐
    │    │         │
    │   Skip   Generate
    │    │         │
    └────┴────┬────┘
              │
              ▼
        Source Saved
     Tasks Generated (optional)
              │
              ▼
      Success Message
```

---

## Entity States Visual Legend

### Before Edit:
```
Sources -> Entities Mapping
GDPR   -> [DIEL] [DGL]
```

### During Edit (Adding DBVI):
```
┌──────────────────────────┐
│ ✓ [DIEL]                 │  ← Unchanged (no badge)
│   Existing entity        │
└──────────────────────────┘

┌──────────────────────────┐
│ ✓ [DBVI] [NEW]           │  ← Added (green NEW badge)
│   Newly selected         │
└──────────────────────────┘

┌──────────────────────────┐
│   [FINSERV]              │  ← Not selected
│   Available but unused   │
└──────────────────────────┘
```

### After Save (Without Task Generation):
```
Sources -> Entities Mapping
GDPR   -> [DIEL] [DGL] [DBVI]
           ^      ^      ^
        Tasks   Tasks   NO TASKS YET
```

### After Save (With Task Generation):
```
Sources -> Entities Mapping
GDPR   -> [DIEL] [DGL] [DBVI]
           ^      ^      ^
        Tasks   Tasks   Tasks Generated
     (untouched) (untouched)  (new)
```

---

## Entity Removal Flow

### Removing an Entity:

```
╔══════════════════════════════════════════════════════════════╗
║ Edit Source                                                  ║
╠══════════════════════════════════════════════════════════════╣
║ Applicable Entities * [Changes detected]                     ║
║                                                               ║
║ ┌──────────────────────────┬──────────────────────────┐     ║
║ │ ✓ [DIEL]                 │   [DGL] [REMOVE]         │     ║
║ │   Diar iI-Bnedikti       │   Djar Group Ltd         │     ║
║ └──────────────────────────┴──────────────────────────┘     ║
║                                                               ║
║ ⚠️ 1 entity will be removed. Existing tasks will be         ║
║   preserved.                                                  ║
╚══════════════════════════════════════════════════════════════╝
```

After save, warning toast:
```
┌────────────────────────────────────────────────────┐
│ ⚠️ 42 existing tasks will remain but out of scope  │
└────────────────────────────────────────────────────┘
```

---

## Task Generation Process (Behind the Scenes)

```
User clicks "Generate Tasks Now"
         │
         ▼
API Call: POST /api/sources/{id}/generate-for-entities
         │
         ▼
┌────────────────────────────────┐
│ 1. Verify entity in source     │
│ 2. Check no existing tasks     │
│ 3. Read task templates         │
│ 4. Calculate instances         │
│ 5. Create tasks (batch)        │
└────────────────────────────────┘
         │
         ▼
Response: "Generated 156 tasks for DBVI"
         │
         ▼
┌────────────────────────────────┐
│ Toast Notification             │
│ ✓ Generated 156 tasks for      │
│   1 entity                      │
└────────────────────────────────┘
```

---

## Comparison: Before vs After

### Before This Feature:

```
Problem: Need to add DBVI to GDPR source

Option 1: Create new source (duplicate)
  ❌ GDPR-DBVI separate source
  ❌ Duplicated clauses/items
  ❌ Management overhead

Option 2: Regenerate entire source
  ❌ Deletes all existing tasks
  ❌ Loses history for DIEL/DGL
  ❌ Disrupts operational workflow

Option 3: Manual task creation
  ❌ Tedious for 156 tasks
  ❌ Error-prone
  ❌ No template consistency
```

### After This Feature:

```
Solution: Edit existing source

1. Click Edit on GDPR source
2. Add DBVI entity
3. Review impact: ~156 tasks
4. Generate tasks for DBVI only

✅ DIEL/DGL history untouched
✅ DBVI gets all required tasks
✅ Single source maintained
✅ Consistent with existing tasks
✅ Full audit trail
```

---

## Error Prevention

### Duplicate Generation Prevention:

```
Scenario: User tries to generate tasks twice

First Time:
  POST /generate-for-entities { entityIds: ["DBVI"] }
  ✓ 200 OK - "Generated 156 tasks"

Second Time:
  POST /generate-for-entities { entityIds: ["DBVI"] }
  ❌ 409 Conflict
  {
    "error": "Tasks already exist for entity",
    "existingTaskCount": 156
  }
```

### Invalid Entity Prevention:

```
Scenario: User tries to generate for entity not in source

Request:
  POST /generate-for-entities { entityIds: ["FINSERV"] }

Response:
  ❌ 400 Bad Request
  {
    "error": "Entity FINSERV not linked to this source"
  }
```

---

## Mobile/Responsive Behavior

Entity selection grid adapts:

```
Desktop (2 columns):
┌──────────────┬──────────────┐
│ ✓ [DIEL]     │ ✓ [DGL]      │
├──────────────┼──────────────┤
│ ✓ [DBVI] NEW │   [FINSERV]  │
└──────────────┴──────────────┘

Mobile (1 column):
┌──────────────────┐
│ ✓ [DIEL]         │
├──────────────────┤
│ ✓ [DGL]          │
├──────────────────┤
│ ✓ [DBVI] NEW     │
├──────────────────┤
│   [FINSERV]      │
└──────────────────┘
```

---

## Color Coding Reference

```
Green      = Success, Added entities
Red        = Warning, Removed entities
Blue       = Information, Source updated
Amber      = Caution, Important notes
Gray       = Neutral, Unchanged items
```

### Entity Badges:
```
[NEW]    = Green background, green text
[REMOVE] = Red background, red text
Normal   = Entity's standard color scheme
```

---

## Success Messages

### Metadata Only Update:
```
Toast: ✓ Source updated successfully
```

### Entity Addition Without Generation:
```
Toast: ✓ Source updated successfully. Tasks not generated.
```

### Entity Addition With Generation:
```
Toast: ✓ Generated 156 tasks for 1 entity
```

### Entity Removal:
```
Toast: ✓ Source updated successfully
Toast: ⚠️ 42 existing tasks remain but are out of scope
```

---

## Quick Actions Cheat Sheet

| Want to...                    | Steps                                      |
|-------------------------------|-------------------------------------------|
| **Change source name**        | Edit → Update name → Save                |
| **Add new entity**            | Edit → Select entity → Save → Review     |
| **Generate tasks for entity** | (After add) → Impact preview → Generate  |
| **Skip task generation**      | (After add) → Impact preview → Skip      |
| **Remove entity**             | Edit → Deselect entity → Save → Confirm |
| **Update dates**              | Edit → Change dates → Save               |
| **Change authority**          | Edit → Select authority → Save           |

---

**Visual Guide Complete**: Users can now safely edit sources with full awareness of downstream impacts.
