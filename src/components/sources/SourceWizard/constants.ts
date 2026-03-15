/**
 * Constants for SourceWizard
 * Extracted from monolithic component
 */

export const SOURCE_TYPES = [
  "REGULATION",
  "INDUSTRY_STANDARD",
  "INTERNAL_AUDIT",
  "BOARD_DIRECTIVE",
  "INTERNAL_POLICY",
  "CONTRACTUAL_OBLIGATION",
  "REGULATORY_GUIDANCE",
] as const;

export const FREQUENCIES = [
  "ADHOC",
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "SEMI_ANNUAL",
  "ANNUAL",
  "BIENNIAL",
  "ONE_TIME",
] as const;

export const RISK_RATINGS = ["HIGH", "MEDIUM", "LOW"] as const;

export const QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;

export const SOURCE_TYPE_LABELS: Record<typeof SOURCE_TYPES[number], string> = {
  REGULATION: "Regulation",
  INDUSTRY_STANDARD: "Industry Standard",
  INTERNAL_AUDIT: "Internal Audit",
  BOARD_DIRECTIVE: "Board Directive",
  INTERNAL_POLICY: "Internal Policy",
  CONTRACTUAL_OBLIGATION: "Contractual Obligation",
  REGULATORY_GUIDANCE: "Regulatory Guidance",
};

export const FREQUENCY_LABELS: Record<typeof FREQUENCIES[number], string> = {
  ADHOC: "Ad-Hoc",
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  SEMI_ANNUAL: "Semi-Annual",
  ANNUAL: "Annual",
  BIENNIAL: "Biennial",
  ONE_TIME: "One-Time",
};

export const RISK_RATING_COLORS = {
  HIGH: { bg: "var(--red-light)", color: "var(--red)" },
  MEDIUM: { bg: "var(--amber-light)", color: "var(--amber)" },
  LOW: { bg: "var(--green-light)", color: "var(--green)" },
} as const;

export const EXTRACTION_LEVELS = [
  { value: "articles-sub", label: "Articles & Sub-Articles", description: "Extract both top-level articles and their sub-articles (e.g., Art. 5.1, 5.2)" },
  { value: "articles-only", label: "Articles Only", description: "Extract ONLY top-level articles (e.g., Art. 5, Art. 6)" },
  { value: "all-clauses", label: "All Clauses", description: "Extract ALL numbered clauses regardless of hierarchy" },
  { value: "numbered-clauses", label: "Numbered Clauses Only", description: "Extract only clauses with explicit numbers" },
] as const;

export const TASK_SUGGESTIONS = [
  { value: "full", label: "Full Tasks", description: "Generate complete task details for each clause" },
  { value: "minimal", label: "Minimal Tasks", description: "Generate basic task structure only" },
  { value: "none", label: "No Tasks", description: "Extract clauses only, no task generation" },
] as const;

export const INPUT_METHODS = [
  { 
    value: "ai-extract" as const,
    label: "AI Extraction",
    description: "Upload PDF/Word and let AI extract clauses & tasks",
    icon: "🤖"
  },
  {
    value: "spreadsheet" as const,
    label: "Import Spreadsheet",
    description: "Upload CSV/Excel with pre-structured data",
    icon: "📊"
  },
  {
    value: "one-by-one" as const,
    label: "Manual Entry",
    description: "Add items and tasks manually one by one",
    icon: "✏️"
  },
] as const;

export const ACCEPTED_FILE_TYPES = {
  AI_EXTRACT: [".pdf", ".doc", ".docx", ".txt"],
  SPREADSHEET: [".csv", ".xlsx", ".xls"],
} as const;

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const WIZARD_STEPS = [
  { number: 1, title: "Source Details", description: "Basic information about the compliance source" },
  { number: 2, title: "Items & Tasks", description: "Define requirements and associated tasks" },
  { number: 3, title: "Review & Submit", description: "Review and finalize your source" },
] as const;
