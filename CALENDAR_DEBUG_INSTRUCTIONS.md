// CALENDAR DEBUGGING GUIDE
// Copy and run these commands in your browser console while on the Calendar page

// 1. Check localStorage filters
console.log("=== STORED FILTERS ===");
console.log("Selected Entity:", localStorage.getItem("cmp_selected_entity"));
console.log("Selected Team:", localStorage.getItem("cmp_selected_team"));

// 2. Clear filters and reload
console.log("\n=== TO RESET FILTERS ===");
console.log("Run these commands:");
console.log("localStorage.setItem('cmp_selected_entity', 'GROUP');");
console.log("localStorage.setItem('cmp_selected_team', 'ALL');");
console.log("location.reload();");

// 3. Check what tasks the calendar has
console.log("\n=== TO CHECK CALENDAR TASKS ===");
console.log("After page loads, look for logs starting with '[Calendar]'");
console.log("They will show how many tasks were fetched");
