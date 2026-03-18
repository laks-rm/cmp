import { addDays } from "date-fns";

/**
 * Generates user initials from a name with robust error handling
 * 
 * @param name - The user's full name
 * @returns Two-character initials (uppercase)
 * 
 * @example
 * generateInitials("John Doe") // "JD"
 * generateInitials("Alice") // "AL"
 * generateInitials("A") // "A?"
 * generateInitials("") // "??"
 * generateInitials("  ") // "??"
 * generateInitials("John Paul Smith") // "JS" (first + last)
 */
export function generateInitials(name: string): string {
  const cleaned = name.trim();
  
  // Handle empty or whitespace-only names
  if (!cleaned) {
    return "??";
  }
  
  // Split by any whitespace
  const parts = cleaned.split(/\s+/).filter(part => part.length > 0);
  
  if (parts.length === 0) {
    return "??";
  }
  
  if (parts.length > 1) {
    // Multiple parts: Use first letter of first part + first letter of last part
    const firstInitial = parts[0][0] || "?";
    const lastInitial = parts[parts.length - 1][0] || "?";
    return (firstInitial + lastInitial).toUpperCase();
  } else {
    // Single part: Use first two characters, pad with ? if needed
    const singlePart = parts[0];
    const firstChar = singlePart[0] || "?";
    const secondChar = singlePart[1] || "?";
    return (firstChar + secondChar).toUpperCase();
  }
}

export type RecurrenceInstance = {
  index: number;
  totalCount: number | null;
  plannedDate: Date;
  quarter: string | null;
};

/**
 * Calculate recurrence instances starting from the user-entered due date.
 * The baseDueDate is treated as the FIRST instance and recurrence anchor.
 * No backdated instances are generated.
 * 
 * @param frequency - Task frequency (MONTHLY, QUARTERLY, etc.)
 * @param baseDueDate - User-entered due date (becomes first instance)
 * @param sourceEffectiveDate - Source effective date (lower bound)
 * @returns Array of recurrence instances
 */
export function calculateRecurrenceInstances(
  frequency: string,
  baseDueDate: Date | null,
  sourceEffectiveDate: Date | null = null
): RecurrenceInstance[] {
  const now = new Date();
  const instances: RecurrenceInstance[] = [];

  // Determine the anchor date (first instance)
  // Must be on or after source effective date
  let anchorDate: Date;
  if (baseDueDate) {
    anchorDate = new Date(baseDueDate);
  } else {
    // No due date provided - use source effective date or current date
    anchorDate = sourceEffectiveDate ? new Date(sourceEffectiveDate) : now;
  }

  // Enforce source effective date as lower bound
  if (sourceEffectiveDate) {
    const effectiveDate = new Date(sourceEffectiveDate);
    if (anchorDate < effectiveDate) {
      anchorDate = effectiveDate;
    }
  }

  switch (frequency) {
    case "ADHOC": {
      instances.push({
        index: 1,
        totalCount: 1,
        plannedDate: anchorDate,
        quarter: null,
      });
      break;
    }

    case "ONE_TIME": {
      instances.push({
        index: 1,
        totalCount: 1,
        plannedDate: anchorDate,
        quarter: null,
      });
      break;
    }

    case "ANNUAL": {
      for (let year = 0; year < 3; year++) {
        const instanceDate = addYears(anchorDate, year);
        instances.push({
          index: year + 1,
          totalCount: 3,
          plannedDate: instanceDate,
          quarter: null,
        });
      }
      break;
    }

    case "BIENNIAL": {
      for (let i = 0; i < 3; i++) {
        const instanceDate = addYears(anchorDate, i * 2);
        instances.push({
          index: i + 1,
          totalCount: 3,
          plannedDate: instanceDate,
          quarter: null,
        });
      }
      break;
    }

    case "SEMI_ANNUAL": {
      for (let i = 0; i < 4; i++) {
        const instanceDate = addMonths(anchorDate, i * 6);
        const month = instanceDate.getMonth();
        const halfYear = month < 6 ? "H1" : "H2";
        instances.push({
          index: i + 1,
          totalCount: 4,
          plannedDate: instanceDate,
          quarter: halfYear,
        });
      }
      break;
    }

    case "QUARTERLY": {
      const anchorDay = anchorDate.getDate();
      
      for (let i = 0; i < 8; i++) {
        let instanceDate = addMonths(anchorDate, i * 3);
        
        const targetMonth = instanceDate.getMonth();
        const targetYear = instanceDate.getFullYear();
        const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
        
        if (anchorDay > lastDayOfTargetMonth) {
          instanceDate = new Date(targetYear, targetMonth, lastDayOfTargetMonth);
        } else {
          instanceDate = new Date(targetYear, targetMonth, anchorDay);
        }
        
        const month = instanceDate.getMonth();
        const quarter = `Q${Math.floor(month / 3) + 1}`;
        
        instances.push({
          index: i + 1,
          totalCount: 8,
          plannedDate: instanceDate,
          quarter,
        });
      }
      break;
    }

    case "MONTHLY": {
      const anchorDay = anchorDate.getDate();
      
      for (let i = 0; i < 18; i++) {
        let instanceDate = addMonths(anchorDate, i);
        
        const targetMonth = instanceDate.getMonth();
        const targetYear = instanceDate.getFullYear();
        const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
        
        if (anchorDay > lastDayOfTargetMonth) {
          instanceDate = new Date(targetYear, targetMonth, lastDayOfTargetMonth);
        } else {
          instanceDate = new Date(targetYear, targetMonth, anchorDay);
        }
        
        const month = instanceDate.getMonth();
        const quarter = `Q${Math.floor(month / 3) + 1}`;
        
        instances.push({
          index: i + 1,
          totalCount: 18,
          plannedDate: instanceDate,
          quarter,
        });
      }
      break;
    }

    case "WEEKLY": {
      const thirtyDaysOut = addDays(anchorDate, 30);
      let currentDate = new Date(anchorDate);
      let weekIndex = 1;

      while (currentDate <= thirtyDaysOut) {
        const month = currentDate.getMonth();
        const quarter = `Q${Math.floor(month / 3) + 1}`;
        instances.push({
          index: weekIndex,
          totalCount: null,
          plannedDate: new Date(currentDate),
          quarter,
        });
        currentDate = addDays(currentDate, 7);
        weekIndex++;
      }
      break;
    }

    case "DAILY": {
      for (let day = 0; day < 30; day++) {
        const dueDate = addDays(anchorDate, day);
        const month = dueDate.getMonth();
        const quarter = `Q${Math.floor(month / 3) + 1}`;
        instances.push({
          index: day + 1,
          totalCount: null,
          plannedDate: dueDate,
          quarter,
        });
      }
      break;
    }

    default: {
      instances.push({
        index: 1,
        totalCount: 1,
        plannedDate: anchorDate,
        quarter: null,
      });
      break;
    }
  }

  return instances;
}

// Helper functions for date arithmetic
function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const targetMonth = result.getMonth() + months;
  result.setMonth(targetMonth);
  return result;
}
