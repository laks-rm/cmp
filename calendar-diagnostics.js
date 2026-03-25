// Diagnostic script to check calendar data
// Run this in browser console on the Calendar page

console.log("=== CALENDAR DIAGNOSTICS ===");

// Check if tasks are fetched
fetch('/api/tasks?includeAll=true&limit=1000')
  .then(res => res.json())
  .then(data => {
    console.log("Total tasks fetched:", data.tasks?.length || 0);
    console.log("Sample tasks (first 3):");
    data.tasks?.slice(0, 3).forEach(task => {
      console.log({
        name: task.name,
        dueDate: task.dueDate,
        plannedDate: task.plannedDate,
        status: task.status,
        entity: task.entity?.code
      });
    });
    
    // Check March 2026 tasks
    const marchTasks = data.tasks?.filter(t => {
      const date = t.plannedDate || t.dueDate;
      if (!date) return false;
      const d = new Date(date);
      return d.getFullYear() === 2026 && d.getMonth() === 2; // March is month 2 (0-indexed)
    });
    console.log("Tasks in March 2026:", marchTasks?.length || 0);
    if (marchTasks?.length > 0) {
      console.log("Sample March task:", marchTasks[0]);
    }
  })
  .catch(err => console.error("Error:", err));
