/**
 * Shared TypeScript types for SourceWizard
 * Extracted from monolithic component for reusability
 */

export type Team = {
  id: string;
  name: string;
  approvalRequired: boolean;
  evidenceRequired: boolean;
  narrativeRequired: boolean;
};

export type User = {
  id: string;
  name: string;
  email: string;
  initials?: string;
  avatarColor?: string | null;
};

export type Entity = {
  id: string;
  code: string;
  name: string;
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
  entityId: string;
  responsibleTeamId: string;
  picId: string;
  reviewerId: string;
  frequency: string;
  quarter: string;
  riskRating: string;
  startDate: string;
  dueDate: string;
  testingPeriodStart: string;
  testingPeriodEnd: string;
  evidenceRequired: boolean;
  narrativeRequired: boolean;
  reviewRequired: boolean;
  clickupUrl: string;
  gdriveUrl: string;
};

export type ItemWithTasks = {
  id?: string; // For existing items from DB
  tempId: string; // For new items
  reference: string;
  title: string;
  description: string;
  isInformational: boolean;
  tasks: TaskDefinition[];
  expanded: boolean;
  parentId?: string | null;
  sortOrder?: number;
};

export type InputMethod = "ai-extract" | "spreadsheet" | "one-by-one";

export type ExtractionLevel = "articles-sub" | "articles-only" | "all-clauses" | "numbered-clauses";

export type TaskSuggestion = "full" | "minimal" | "none";

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

export type SpreadsheetRow = {
  id: string;
  reference: string;
  clauseTitle: string;
  description: string;
  taskName: string;
  frequency: string;
  riskRating: string;
  responsibleTeamId: string;
  picId: string;
  reviewerId: string;
  dueDate: string;
  evidenceRequired: boolean;
  reviewRequired: boolean;
  narrativeRequired: boolean;
  isInformational: boolean;
};

export type SourceFormData = {
  sourceType: string;
  sourceName: string;
  sourceCode: string;
  issuingAuthorityId: string;
  selectedEntityIds: string[];
  teamId: string;
  defaultFrequency: string;
  effectiveDate: string;
  reviewDate: string;
};

export type SourceWizardProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  existingSource?: {
    id: string;
    code: string;
    name: string;
    sourceType: string;
    issuingAuthority: {
      id: string;
      name: string;
      abbreviation: string | null;
      country: string | null;
    } | null;
    effectiveDate?: string | null;
    reviewDate?: string | null;
    defaultFrequency: string;
    team: { id: string; name: string; approvalRequired: boolean };
    entities: Array<{ entity: { id: string; code: string; name: string } }>;
  };
};

export type WizardStep = 1 | 2 | 3;

export type ValidationError = {
  field: string;
  message: string;
};
