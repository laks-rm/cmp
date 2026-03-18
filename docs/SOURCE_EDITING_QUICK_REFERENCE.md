# Source Editing Quick Reference

## TL;DR

Edit existing sources safely. Add/remove entities. Optionally generate tasks for new entities. Historical data always preserved.

---

## Quick Actions

### Edit Source Metadata
```
1. Click Edit button (pencil icon) on source card
2. Update name, code, dates, authority
3. Click "Save Changes"
4. Done ✓
```

### Add Entity to Source (Skip Task Generation)
```
1. Click Edit button
2. Check entity checkbox
3. Note green "NEW" badge
4. Click "Save Changes"
5. Impact preview appears
6. Click "Skip Task Generation"
7. Source updated, no tasks created yet
```

### Add Entity to Source (With Task Generation)
```
1. Click Edit button
2. Check entity checkbox
3. Click "Save Changes"
4. Impact preview appears
5. Review estimate (~156 tasks)
6. Click "Generate Tasks Now"
7. Tasks created for new entity only
```

### Remove Entity from Source
```
1. Click Edit button
2. Uncheck entity checkbox
3. Note red "REMOVE" badge
4. Click "Save Changes"
5. Read warning about existing tasks
6. Confirm save
7. Historical tasks preserved
```

---

## API Endpoints

### Update Source
```bash
PATCH /api/sources/{sourceId}
Content-Type: application/json

{
  "name": "Updated Name",
  "entityIds": ["entity1", "entity2", "entity3"]
}

# Response includes impactSummary if entities added
```

### Generate Tasks for Entities
```bash
POST /api/sources/{sourceId}/generate-for-entities
Content-Type: application/json

{
  "entityIds": ["new-entity-uuid"]
}

# Returns task count and warnings
```

---

## Response Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Source updated |
| 400 | Invalid request | Check input |
| 401 | Not authenticated | Log in |
| 403 | Access denied | Check permissions |
| 404 | Not found | Check source ID |
| 409 | Conflict | Tasks already exist |

---

## Important Rules

### Always Safe
✅ Edit source name
✅ Edit source code
✅ Change source type
✅ Update authority
✅ Change dates
✅ Add entity (with preview)
✅ Remove entity (with warning)

### Never Happens
❌ Automatic task regeneration
❌ Historical data deletion
❌ Surprise task creation
❌ Silent entity removal
❌ Backdated task instances
❌ Duplicate task generation

---

## Flags & Badges

| Badge | Color | Meaning |
|-------|-------|---------|
| NEW | Green | Entity being added |
| REMOVE | Red | Entity being removed |
| Changes detected | Amber | Entity list modified |

---

## Impact Preview Fields

```
┌────────────────────────────────┐
│ Source Items      │ 25         │  ← Clauses in source
│ Task Templates    │ 15         │  ← Unique task types
│ Total Tasks       │ ~15        │  ← Estimate per entity
└────────────────────────────────┘
```

Formula: `Total Tasks = Task Templates × Entities Added`

---

## Error Messages

### "Tasks already exist for entity"
**Meaning**: Can't regenerate tasks
**Action**: Tasks already created for this entity

### "Entity not linked to source"
**Meaning**: Invalid entity selection
**Action**: Add entity to source first

### "No task templates found"
**Meaning**: Source has no tasks yet
**Action**: Use source wizard to generate initial tasks

### "Access denied"
**Meaning**: No permission for entity
**Action**: Request entity access from admin

---

## Audit Log Events

| Event | Logged Data |
|-------|-------------|
| SOURCE_METADATA_UPDATED | Changed fields |
| SOURCE_ENTITY_ADDED | Entity IDs, impact |
| SOURCE_ENTITY_REMOVED | Entity IDs, warning |
| TASKS_GENERATED_FOR_ENTITIES | Task count, entities |

View in: Admin Panel → Audit Logs

---

## Keyboard Shortcuts

None currently. Use mouse/touch.

---

## Mobile Usage

Entity selection grid stacks vertically on mobile:
```
Desktop: 2 columns
Mobile:  1 column
```

Impact preview remains scrollable.

---

## Best Practices

✅ **DO**:
- Review impact preview carefully
- Skip generation if unsure
- Read warnings before confirming
- Check audit logs regularly

❌ **DON'T**:
- Add entity without reviewing impact
- Ignore warnings about removed entities
- Generate tasks multiple times
- Remove entities carelessly

---

## Common Scenarios

### New Entity Joins Company
```
Problem: DBVI needs GDPR compliance
Solution: Edit GDPR → Add DBVI → Generate Tasks
Result: DBVI gets all GDPR tasks
```

### Entity Leaves Company
```
Problem: DGL sold, no longer in group
Solution: Edit GDPR → Remove DGL → Save
Result: Historical tasks preserved, DGL out of scope
```

### Update Source Information
```
Problem: Wrong effective date
Solution: Edit → Update date → Save
Result: Date changed, no other impact
```

### Prepare for Future Entity
```
Problem: FINSERV starting next month
Solution: Edit → Add FINSERV → Skip Generation
Result: Entity linked, tasks can be generated later
```

---

## Troubleshooting

### Modal Won't Open
- Check permissions (need SOURCES:EDIT)
- Refresh page
- Check browser console

### Impact Preview Not Appearing
- Ensure entity was added (not just metadata change)
- Check that entity is different from existing

### Tasks Not Generating
- Verify entity has no existing tasks
- Check task templates exist (from other entities)
- Review error message carefully

### Duplicate Error (409)
- Tasks already generated for this entity
- Use Task Tracker to view existing tasks
- No action needed

---

## Performance Tips

- Edit form loads: < 200ms
- Save metadata: < 150ms
- Generate 150 tasks: < 500ms

Large sources (500+ tasks) may take longer but should complete within 2 seconds.

---

## Related Features

- **Source Wizard**: Create new sources with tasks
- **Task Tracker**: View and manage task instances
- **Task Template Editing**: Change recurrence/frequency
- **Source Task Management**: Validate/edit task metadata

---

## Security Notes

- All changes logged in audit trail
- Entity access validated on every request
- No bypass of permission system
- Session-based authentication required

---

## FAQ

**Q: Will editing a source affect tasks?**
A: Only if you add entities AND choose to generate tasks.

**Q: Can I undo an edit?**
A: Not automatically. Re-edit to revert changes.

**Q: What happens to completed tasks when I remove an entity?**
A: They remain in the system, just out of source scope.

**Q: Can I edit multiple sources at once?**
A: No, edit one at a time.

**Q: How do I know if tasks were generated successfully?**
A: Success toast shows task count. Check Task Tracker to verify.

**Q: Can I change task frequency here?**
A: No, use Task Template Editing for that.

**Q: What if I add the wrong entity?**
A: Edit again, remove the entity. If tasks generated, they remain but can be soft-deleted.

---

## Support

Issues? Check:
1. Browser console for errors
2. Audit log for event history
3. Task Tracker for task status
4. Admin panel for permissions

---

**Quick Reference Complete** - Edit sources safely with full control and awareness.
