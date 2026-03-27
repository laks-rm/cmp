export type Team = {
  id: string;
  name: string;
  approvalRequired: boolean;
  evidenceRequired: boolean;
  narrativeRequired: boolean;
  memberships?: Array<{
    userId: string;
    user: {
      id: string;
      name: string;
    };
  }>;
};

export type User = {
  id: string;
  name: string;
  email: string;
  initials?: string;
  avatarColor?: string;
};

export type Entity = {
  id: string;
  code: string;
  name: string;
};

export type MonitoringArea = {
  id: string;
  name: string;
  description: string | null;
};

export type TaskType = {
  id: string;
  name: string;
  description: string | null;
};

export type IssuingAuthority = {
  id: string;
  name: string;
  abbreviation: string | null;
  country: string | null;
};

export type TaskDefinition = {
  tempId: string;
  name: string;
  description: string;
  expectedOutcome: string;
  responsibleTeamId: string;
  picId: string;
  reviewerId: string;
  frequency: string;
  quarter: string;
  riskRating: string;
  startDate: string;
  dueDate: string;
  evidenceRequired: boolean;
  reviewRequired: boolean;
  clickupUrl: string;
  gdriveUrl: string;
  monitoringAreaId?: string;
  taskTypeId?: string;
  testingPeriodStart?: string;
  testingPeriodEnd?: string;
  expanded?: boolean;
};

export type ItemWithTasks = {
  id?: string;
  tempId: string;
  reference: string;
  title: string;
  description: string;
  isInformational: boolean;
  tasks: TaskDefinition[];
  expanded: boolean;
};

export type ExtractedClause = {
  reference: string;
  title: string;
  description: string;
  isInformational: boolean;
  included: boolean;
  expanded: boolean;
  tasks: Array<{
    id: string;
    name: string;
    frequency: string;
    riskRating: string;
    included: boolean;
  }>;
};

export const SOURCE_TYPES = [
  "REGULATION",
  "INDUSTRY_STANDARD",
  "INTERNAL_AUDIT",
  "BOARD_DIRECTIVE",
  "INTERNAL_POLICY",
  "CONTRACTUAL_OBLIGATION",
  "REGULATORY_GUIDANCE",
] as const;

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  REGULATION: "Regulation",
  INDUSTRY_STANDARD: "Industry Standard",
  INTERNAL_AUDIT: "Internal Audit",
  BOARD_DIRECTIVE: "Board Directive",
  INTERNAL_POLICY: "Internal Policy",
  CONTRACTUAL_OBLIGATION: "Contractual Obligation",
  REGULATORY_GUIDANCE: "Regulatory Guidance",
};

export const ITEM_LABEL_MAP: Record<string, { singular: string; plural: string }> = {
  REGULATION: { singular: "Clause", plural: "Clauses" },
  INDUSTRY_STANDARD: { singular: "Section", plural: "Sections" },
  INTERNAL_AUDIT: { singular: "Finding", plural: "Findings" },
  BOARD_DIRECTIVE: { singular: "Directive", plural: "Directives" },
  INTERNAL_POLICY: { singular: "Policy Item", plural: "Policy Items" },
  CONTRACTUAL_OBLIGATION: { singular: "Obligation", plural: "Obligations" },
  REGULATORY_GUIDANCE: { singular: "Guidance Item", plural: "Guidance Items" },
};

export const FREQUENCIES = [
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "SEMI_ANNUAL",
  "ANNUAL",
  "BIENNIAL",
  "ONE_TIME",
] as const;

export const FREQUENCY_LABELS: Record<string, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  SEMI_ANNUAL: "Semi-Annual",
  ANNUAL: "Annual",
  BIENNIAL: "Biennial",
  ONE_TIME: "One-Time",
};

export const RISK_RATINGS = ["HIGH", "MEDIUM", "LOW"] as const;

export const RISK_COLORS: Record<string, { bg: string; color: string }> = {
  HIGH: { bg: "var(--red-light)", color: "var(--red)" },
  MEDIUM: { bg: "var(--amber-light)", color: "var(--amber)" },
  LOW: { bg: "var(--green-light)", color: "var(--green)" },
};

export const QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;

export const SOURCE_TYPE_COLORS = {
  REGULATION: { bg: "var(--red-light)", color: "var(--red)", label: "Regulation" },
  INDUSTRY_STANDARD: { bg: "var(--blue-light)", color: "var(--blue)", label: "Industry Standard" },
  INTERNAL_AUDIT: { bg: "var(--purple-light)", color: "var(--purple)", label: "Internal Audit" },
  BOARD_DIRECTIVE: { bg: "var(--amber-light)", color: "var(--amber)", label: "Board Directive" },
  INTERNAL_POLICY: { bg: "var(--green-light)", color: "var(--green)", label: "Internal Policy" },
  CONTRACTUAL_OBLIGATION: { bg: "var(--teal-light)", color: "var(--teal)", label: "Contractual Obligation" },
  REGULATORY_GUIDANCE: { bg: "#FFF3E0", color: "#E65100", label: "Regulatory Guidance" },
};

export type InputMethod = "manual" | "ai-extract" | "excel-paste";
export type ViewMode = "by-clause" | "by-task";

export function generateSourceCode(name: string): string {
  const currentYear = new Date().getFullYear();
  const words = name
    .toUpperCase()
    .split(/\s+/)
    .filter((word) => word.length > 2 && !["THE", "AND", "FOR", "WITH"].includes(word));

  if (words.length === 0) {
    return `SRC-${currentYear}`;
  }

  const abbreviation = words
    .slice(0, 3)
    .map((word) => word[0])
    .join("");

  return `${abbreviation}-${currentYear}`;
}
