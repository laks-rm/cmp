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
