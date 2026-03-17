"use client";

import React, { useState, useEffect } from "react";
import { X, ChevronRight, ChevronLeft, AlertCircle, CheckCircle, Plus, Trash2, ChevronDown, FileText, Table, Upload, Loader } from "lucide-react";
import { EntityBadge } from "@/components/ui/EntityBadge";
import toast from "@/lib/toast";

type Team = {
  id: string;
  name: string;
  approvalRequired: boolean;
  evidenceRequired: boolean;
  narrativeRequired: boolean;
};

type User = {
  id: string;
  name: string;
  email: string;
  teamMemberships?: { teamId: string }[];
};

type Entity = {
  id: string;
  code: string;
  name: string;
};

type IssuingAuthority = {
  id: string;
  name: string;
  abbreviation: string | null;
  country: string | null;
};

type TaskDefinition = {
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
};

type ItemWithTasks = {
  id?: string; // For existing items from DB
  tempId: string; // For new items
  reference: string;
  title: string;
  description: string;
  isInformational: boolean;
  tasks: TaskDefinition[];
  expanded: boolean;
};

type SourceWizardProps = {
  isOpen: boolean;
  onClose: () => void;
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

const SOURCE_TYPES = [
  "REGULATION",
  "INDUSTRY_STANDARD",
  "INTERNAL_AUDIT",
  "BOARD_DIRECTIVE",
  "INTERNAL_POLICY",
  "CONTRACTUAL_OBLIGATION",
  "REGULATORY_GUIDANCE",
];

const FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "BIENNIAL", "ONE_TIME"];
const RISK_RATINGS = ["HIGH", "MEDIUM", "LOW"];
const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];

export function SourceWizard({ isOpen, onClose, existingSource }: SourceWizardProps) {
  const [step, setStep] = useState(existingSource ? 2 : 1);
  const [loading, setLoading] = useState(false);
  const [createdSourceId, setCreatedSourceId] = useState<string | null>(null);

  // Reference data
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [issuingAuthorities, setIssuingAuthorities] = useState<IssuingAuthority[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  // Step 1: Source Details
  const [sourceType, setSourceType] = useState(existingSource?.sourceType || "REGULATION");
  const [sourceName, setSourceName] = useState(existingSource?.name || "");
  const [sourceCode, setSourceCode] = useState(existingSource?.code || "");
  const [sourceCodeError, setSourceCodeError] = useState("");
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [issuingAuthorityId, setIssuingAuthorityId] = useState(existingSource?.issuingAuthority?.id || "");
  const [authoritySearchQuery, setAuthoritySearchQuery] = useState("");
  const [authorityDropdownOpen, setAuthorityDropdownOpen] = useState(false);
  const [showAddAuthorityForm, setShowAddAuthorityForm] = useState(false);
  const [newAuthorityForm, setNewAuthorityForm] = useState({
    name: "",
    abbreviation: "",
    country: "",
  });
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>(
    existingSource?.entities.map((e) => e.entity.id) || []
  );
  const [teamId, setTeamId] = useState(existingSource?.team.id || "");
  const [defaultFrequency, setDefaultFrequency] = useState(existingSource?.defaultFrequency || "QUARTERLY");
  const [effectiveDate, setEffectiveDate] = useState(existingSource?.effectiveDate || "");
  const [reviewDate, setReviewDate] = useState(existingSource?.reviewDate || "");
  const [entityDropdownOpen, setEntityDropdownOpen] = useState(false);

  // Step 2: Items & Tasks
  const [items, setItems] = useState<ItemWithTasks[]>([]);
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [addingTaskToItemId, setAddingTaskToItemId] = useState<string | null>(null);
  
  // Existing task management
  const [expandedExistingItems, setExpandedExistingItems] = useState<Set<string>>(new Set());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskForm, setEditTaskForm] = useState({
    name: "",
    description: "",
    expectedOutcome: "",
    riskRating: "MEDIUM",
    responsibleTeamId: "",
    picId: "",
    reviewerId: "",
    evidenceRequired: false,
    narrativeRequired: false,
    reviewRequired: true,
  });
  
  // Step 2: Input Method Selection
  type InputMethod = "ai-extract" | "spreadsheet" | "one-by-one";
  const [inputMethod, setInputMethod] = useState<InputMethod>("ai-extract");
  
  // Step 2: AI Extract state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [extractionLevel, setExtractionLevel] = useState("articles-sub");
  const [taskSuggestion, setTaskSuggestion] = useState("full");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState<string>("");
  const [extractedClauses, setExtractedClauses] = useState<Array<{
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
  }>>([]);
  
  // Step 2: Spreadsheet state
  type SpreadsheetRow = {
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
    isClauseRow: boolean;
  };
  
  type ClauseGroup = {
    clauseRow: SpreadsheetRow;
    taskRows: SpreadsheetRow[];
  };
  
  const [spreadsheetData, setSpreadsheetData] = useState<SpreadsheetRow[]>([
    {
      id: `row-${Date.now()}-1`,
      reference: "",
      clauseTitle: "",
      description: "",
      taskName: "",
      frequency: "MONTHLY",
      riskRating: "MEDIUM",
      responsibleTeamId: "",
      picId: "",
      reviewerId: "",
      dueDate: "",
      evidenceRequired: selectedTeam?.evidenceRequired || false,
      reviewRequired: selectedTeam?.approvalRequired || true,
      isClauseRow: true,
    },
    {
      id: `row-${Date.now()}-2`,
      reference: "",
      clauseTitle: "",
      description: "",
      taskName: "",
      frequency: "MONTHLY",
      riskRating: "MEDIUM",
      responsibleTeamId: "",
      picId: "",
      reviewerId: "",
      dueDate: "",
      evidenceRequired: selectedTeam?.evidenceRequired || false,
      reviewRequired: selectedTeam?.approvalRequired || true,
      isClauseRow: false,
    },
  ]);
  const [pastedData, setPastedData] = useState("");
  const [groupByClause, setGroupByClause] = useState(true);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());

  // Helper function for positional grouping
  const getClauseGroups = (data: SpreadsheetRow[]): ClauseGroup[] => {
    const groups: ClauseGroup[] = [];
    let currentGroup: ClauseGroup | null = null;
    const ungroupedTasks: SpreadsheetRow[] = [];

    data.forEach((row) => {
      if (row.isClauseRow) {
        // Save current group if exists
        if (currentGroup) {
          groups.push(currentGroup);
        }
        // Start new group
        currentGroup = { clauseRow: row, taskRows: [] };
      } else {
        // Task row
        if (currentGroup) {
          currentGroup.taskRows.push(row);
        } else {
          ungroupedTasks.push(row);
        }
      }
    });

    // Save last group
    if (currentGroup) {
      groups.push(currentGroup);
    }

    // Add ungrouped tasks at the beginning if any
    if (ungroupedTasks.length > 0) {
      groups.unshift({
        clauseRow: {
          id: "ungrouped",
          reference: "",
          clauseTitle: "Ungrouped Tasks",
          description: "",
          taskName: "",
          frequency: "MONTHLY",
          riskRating: "MEDIUM",
          responsibleTeamId: "",
          picId: "",
          reviewerId: "",
          dueDate: "",
          evidenceRequired: false,
          reviewRequired: true,
          isClauseRow: true,
        },
        taskRows: ungroupedTasks,
      });
    }

    return groups;
  };

  // Helper: Format frequency for display
  const formatFrequency = (freq: string) => {
    const map: Record<string, string> = {
      DAILY: "Daily",
      WEEKLY: "Weekly",
      MONTHLY: "Monthly",
      QUARTERLY: "Quarterly",
      SEMI_ANNUAL: "Semi-Annual",
      ANNUAL: "Annual",
      BIENNIAL: "Biennial",
      ONE_TIME: "One-Time",
      ADHOC: "Ad-hoc",
    };
    return map[freq] || freq;
  };

  // Toggle expand/collapse for existing items
  const toggleExistingItem = (itemId: string) => {
    setExpandedExistingItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  // Start editing an existing task
  const startEditingTask = (task: TaskDefinition) => {
    setEditingTaskId(task.tempId);
    setEditTaskForm({
      name: task.name,
      description: task.description,
      expectedOutcome: task.expectedOutcome,
      riskRating: task.riskRating,
      responsibleTeamId: task.responsibleTeamId,
      picId: task.picId,
      reviewerId: task.reviewerId,
      evidenceRequired: task.evidenceRequired,
      narrativeRequired: task.narrativeRequired,
      reviewRequired: task.reviewRequired,
    });
  };

  // Cancel editing
  const cancelEditingTask = () => {
    setEditingTaskId(null);
    setEditTaskForm({
      name: "",
      description: "",
      expectedOutcome: "",
      riskRating: "MEDIUM",
      responsibleTeamId: "",
      picId: "",
      reviewerId: "",
      evidenceRequired: false,
      narrativeRequired: false,
      reviewRequired: true,
    });
  };

  // Save task metadata edits
  const saveTaskEdit = async (taskTempId: string, itemId: string) => {
    if (!existingSource?.id) return;

    // Extract actual task ID from tempId (format: "existing-task-{id}")
    const taskId = taskTempId.replace("existing-task-", "");
    
    setLoading(true);
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editTaskForm.name,
          description: editTaskForm.description || null,
          expectedOutcome: editTaskForm.expectedOutcome || null,
          riskRating: editTaskForm.riskRating,
          responsibleTeamId: editTaskForm.responsibleTeamId || null,
          picId: editTaskForm.picId || null,
          reviewerId: editTaskForm.reviewerId || null,
          evidenceRequired: editTaskForm.evidenceRequired,
          narrativeRequired: editTaskForm.narrativeRequired,
          reviewRequired: editTaskForm.reviewRequired,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update task");
      }

      toast.success("Task updated successfully");
      
      // Refetch items to show updated data
      await fetchExistingItems(existingSource.id);
      
      // Clear edit state
      cancelEditingTask();
    } catch (error) {
      console.error("Failed to update task:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update task");
    } finally {
      setLoading(false);
    }
  };

  // Auto-sync spreadsheet to items array
  useEffect(() => {
    if (inputMethod === "spreadsheet" && spreadsheetData.some(r => r.taskName.trim())) {
      const groups = getClauseGroups(spreadsheetData);
      const newItems: ItemWithTasks[] = groups
        .filter(g => g.taskRows.some(t => t.taskName.trim()))
        .map((group) => ({
          tempId: `temp-${group.clauseRow.id}`,
          reference: group.clauseRow.reference || "TBD",
          title: group.clauseRow.clauseTitle || "Untitled Clause",
          description: group.clauseRow.description || "",
          isInformational: false,
          expanded: false,
          tasks: group.taskRows
            .filter(t => t.taskName.trim())
            .map((task) => ({
              tempId: task.id,
              name: task.taskName,
              description: "",
              expectedOutcome: "",
              responsibleTeamId: task.responsibleTeamId,
              picId: task.picId,
              reviewerId: "",
              frequency: task.frequency,
              quarter: "",
              riskRating: task.riskRating,
              startDate: "",
              dueDate: task.dueDate,
              evidenceRequired: task.evidenceRequired,
              reviewRequired: task.reviewRequired,
              clickupUrl: "",
              gdriveUrl: "",
            })),
        }));
      
      // Only update if there's actual content
      if (newItems.length > 0 && JSON.stringify(newItems) !== JSON.stringify(items)) {
        setItems(newItems);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spreadsheetData, inputMethod]);
  
  const [newItemForm, setNewItemForm] = useState({
    reference: "",
    title: "",
    description: "",
    isInformational: false,
    taskName: "",
    taskDescription: "",
    expectedOutcome: "",
    responsibleTeamId: "",
    picId: "",
    reviewerId: "",
    frequency: defaultFrequency,
    quarter: "",
    riskRating: "MEDIUM",
    startDate: "",
    dueDate: "",
    evidenceRequired: false,
    reviewRequired: true,
    clickupUrl: "",
    gdriveUrl: "",
  });
  const [newTaskForm, setNewTaskForm] = useState({
    taskName: "",
    taskDescription: "",
    expectedOutcome: "",
    responsibleTeamId: "",
    picId: "",
    reviewerId: "",
    frequency: defaultFrequency,
    quarter: "",
    riskRating: "MEDIUM",
    startDate: "",
    dueDate: "",
    evidenceRequired: false,
    reviewRequired: true,
    clickupUrl: "",
    gdriveUrl: "",
  });

  // Step 3: Review (selected items for bulk actions)
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkPICOpen, setBulkPICOpen] = useState(false);
  const [bulkDueDateOpen, setBulkDueDateOpen] = useState(false);
  const [bulkQuarterOpen, setBulkQuarterOpen] = useState(false);
  const [bulkDueDateValue, setBulkDueDateValue] = useState("");

  // Step 4: Generation state
  const [generationPreview, setGenerationPreview] = useState({
    taskDefinitions: 0,
    entities: 0,
    totalTasks: 0,
  });

  // Fetch reference data
  useEffect(() => {
    if (isOpen) {
      fetchTeams();
      fetchUsers();
      fetchEntities();
      fetchIssuingAuthorities();
    }
  }, [isOpen]);

  // Update selected team when teamId changes
  useEffect(() => {
    const team = teams.find((t) => t.id === teamId);
    setSelectedTeam(team || null);
    // Update form defaults based on team
    if (team) {
      setNewItemForm((prev) => ({
        ...prev,
        evidenceRequired: team.evidenceRequired,
        reviewRequired: team.approvalRequired,
      }));
    }
  }, [teamId, teams]);

  // Auto-generate source code from name (always regenerate based on name)
  useEffect(() => {
    if (!existingSource && sourceName) {
      const generated = generateSourceCode(sourceName);
      setSourceCode(generated);
    }
  }, [sourceName, existingSource]);

  const fetchTeams = async () => {
    try {
      const res = await fetch("/api/teams");
      if (res.ok) {
        const data = await res.json();
        setTeams(data);
      }
    } catch (error) {
      console.error("Failed to fetch teams:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  const fetchEntities = async () => {
    try {
      const res = await fetch("/api/entities");
      if (res.ok) {
        const data = await res.json();
        setEntities(data);
      }
    } catch (error) {
      console.error("Failed to fetch entities:", error);
    }
  };

  const fetchIssuingAuthorities = async () => {
    try {
      const res = await fetch("/api/issuing-authorities");
      if (res.ok) {
        const data = await res.json();
        setIssuingAuthorities(data.authorities);
      }
    } catch (error) {
      console.error("Failed to fetch issuing authorities:", error);
    }
  };

  const fetchExistingItems = async (sourceId: string) => {
    try {
      const res = await fetch(`/api/sources/${sourceId}`);
      if (res.ok) {
        const source = await res.json();
        if (source.items && source.items.length > 0) {
          const loadedItems: ItemWithTasks[] = source.items.map((item: {
            id: string;
            reference: string;
            title: string;
            description: string | null;
            isInformational: boolean;
            tasks: Array<{
              id: string;
              name: string;
              description: string | null;
              expectedOutcome: string | null;
              frequency: string;
              quarter: string | null;
              riskRating: string;
              dueDate: string | null;
              startDate: string | null;
              evidenceRequired: boolean;
              reviewRequired: boolean;
              clickupUrl: string | null;
              gdriveUrl: string | null;
              responsibleTeamId: string | null;
              picId: string | null;
              reviewerId: string | null;
            }>;
          }) => ({
            id: item.id,
            tempId: `existing-${item.id}`,
            reference: item.reference,
            title: item.title,
            description: item.description || "",
            isInformational: item.isInformational,
            tasks: item.tasks.map((task) => ({
              tempId: `existing-task-${task.id}`,
              name: task.name,
              description: task.description || "",
              expectedOutcome: task.expectedOutcome || "",
              responsibleTeamId: task.responsibleTeamId || "",
              picId: task.picId || "",
              reviewerId: task.reviewerId || "",
              frequency: task.frequency,
              quarter: task.quarter || "",
              riskRating: task.riskRating,
              startDate: task.startDate || "",
              dueDate: task.dueDate || "",
              evidenceRequired: task.evidenceRequired,
              reviewRequired: task.reviewRequired,
              clickupUrl: task.clickupUrl || "",
              gdriveUrl: task.gdriveUrl || "",
            })),
            expanded: false,
          }));
          setItems(loadedItems);
        }
      }
    } catch (error) {
      console.error("Failed to fetch existing items:", error);
    }
  };

  // Fetch existing items when modal opens with an existing source
  useEffect(() => {
    if (isOpen && existingSource?.id) {
      fetchExistingItems(existingSource.id);
    }
  }, [isOpen, existingSource]);

  const validateSourceCode = async (code: string) => {
    if (!code || !teamId) return;

    setIsValidatingCode(true);
    setSourceCodeError("");

    try {
      const params = new URLSearchParams({
        code: code.toUpperCase(),
        teamId,
      });

      if (existingSource?.id) {
        params.append("excludeId", existingSource.id);
      }

      const res = await fetch(`/api/sources/validate-code?${params}`);
      const data = await res.json();

      if (!data.isAvailable) {
        setSourceCodeError("This code is already in use");
        if (data.suggestedCode) {
          // Auto-apply suggested code
          setSourceCode(data.suggestedCode);
          toast(`Code updated to ${data.suggestedCode} (original was taken)`, {
            icon: "ℹ️",
          });
        }
      }
    } catch (error) {
      console.error("Failed to validate source code:", error);
    } finally {
      setIsValidatingCode(false);
    }
  };

  const generateSourceCode = (name: string): string => {
    const currentYear = new Date().getFullYear();
    const words = name
      .toUpperCase()
      .split(/\s+/)
      .filter((word) => word.length > 2 && !["THE", "AND", "FOR", "WITH"].includes(word));

    if (words.length === 0) return `SRC-${currentYear}`;

    // Take first letters of significant words, max 3
    const abbreviation = words
      .slice(0, 3)
      .map((word) => word[0])
      .join("");

    return `${abbreviation}-${currentYear}`;
  };

  const handleSourceCodeBlur = () => {
    if (!sourceCode && sourceName) {
      setSourceCode(generateSourceCode(sourceName));
    }
    // Validate uniqueness
    if (sourceCode && teamId) {
      validateSourceCode(sourceCode);
    }
  };

  const handleAddNewAuthority = async () => {
    if (!newAuthorityForm.name) {
      toast.error("Authority name is required");
      return;
    }

    try {
      const res = await fetch("/api/issuing-authorities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAuthorityForm),
      });

      if (res.ok) {
        const data = await res.json();
        setIssuingAuthorities([...issuingAuthorities, data.authority]);
        setIssuingAuthorityId(data.authority.id);
        setShowAddAuthorityForm(false);
        setNewAuthorityForm({ name: "", abbreviation: "", country: "" });
        toast.success("Authority added successfully");
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to add authority");
      }
    } catch (error) {
      console.error("Failed to add authority:", error);
      toast.error("Failed to add authority");
    }
  };

  const toggleEntity = (entityId: string) => {
    setSelectedEntityIds((prev) =>
      prev.includes(entityId) ? prev.filter((id) => id !== entityId) : [...prev, entityId]
    );
  };

  const removeEntity = (entityId: string) => {
    setSelectedEntityIds((prev) => prev.filter((id) => id !== entityId));
  };

  // AI Extract handlers
  const handleFileUpload = (file: File) => {
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File size exceeds 50MB limit");
      return;
    }
    
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
    ];
    
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only PDF, DOCX, and TXT files are supported");
      return;
    }
    
    setUploadedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleAIExtract = async () => {
    if (!uploadedFile) {
      toast.error("Please upload a document first");
      return;
    }

    try {
      setIsExtracting(true);
      setExtractionProgress("Reading document...");

      const formData = new FormData();
      formData.append("file", uploadedFile);
      formData.append("extractionLevel", extractionLevel);
      formData.append("taskSuggestion", taskSuggestion);
      formData.append("sourceType", sourceType);
      if (additionalInstructions) {
        formData.append("additionalInstructions", additionalInstructions);
      }

      setTimeout(() => setExtractionProgress("Extracting clauses..."), 2000);
      setTimeout(() => setExtractionProgress("Generating task suggestions..."), 4000);
      setTimeout(() => setExtractionProgress("Assigning risk ratings..."), 6000);

      const res = await fetch("/api/sources/ai-extract", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to extract clauses");
      }

      const result = await res.json();
      
      const formattedClauses = result.data.clauses.map((clause: {
        reference: string;
        title: string;
        description: string;
        isInformational: boolean;
        suggestedTasks: Array<{ name: string; frequency: string; riskRating: string }>;
      }) => ({
        reference: clause.reference,
        title: clause.title,
        description: clause.description,
        isInformational: clause.isInformational,
        included: true,
        expanded: false,
        tasks: clause.suggestedTasks.map((task, idx) => ({
          id: `task-${Date.now()}-${idx}`,
          name: task.name,
          frequency: task.frequency,
          riskRating: task.riskRating,
          included: true,
        })),
      }));

      setExtractedClauses(formattedClauses);
      toast.success(
        `AI extracted ${result.meta.clausesExtracted} clauses with ${result.meta.totalSuggestedTasks} suggested tasks`
      );
    } catch (error) {
      console.error("AI extraction error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to extract clauses");
    } finally {
      setIsExtracting(false);
      setExtractionProgress("");
    }
  };

  const handleApplyExtractedClauses = () => {
    const newItems: ItemWithTasks[] = extractedClauses
      .filter((clause) => clause.included)
      .map((clause) => ({
        tempId: `temp-${Date.now()}-${Math.random()}`,
        reference: clause.reference,
        title: clause.title,
        description: clause.description,
        isInformational: clause.isInformational,
        expanded: false,
        tasks: clause.tasks
          .filter((task) => task.included)
          .map((task) => ({
            tempId: `task-${Date.now()}-${Math.random()}`,
            name: task.name,
            description: "",
            expectedOutcome: "",
            responsibleTeamId: "",
            picId: "",
            reviewerId: "",
            frequency: task.frequency,
            quarter: "",
            riskRating: task.riskRating,
            startDate: "",
            dueDate: "",
            evidenceRequired: selectedTeam?.evidenceRequired || false,
            reviewRequired: selectedTeam?.approvalRequired || true,
            clickupUrl: "",
            gdriveUrl: "",
          })),
      }));

    setItems([...items, ...newItems]);
    toast.success(`Added ${newItems.length} items with extracted tasks`);
  };

  const handleParsePastedData = () => {
    if (!pastedData.trim()) {
      toast.error("Please paste some data first");
      return;
    }

    const rows = pastedData.trim().split("\n");
    const parsedRows: SpreadsheetRow[] = [];

    rows.forEach((row, idx) => {
      const columns = row.split("\t");
      if (columns.length < 3) return;

      const reference = columns[0]?.trim() || "";
      const title = columns[1]?.trim() || "";
      const description = columns[2]?.trim() || "";
      const taskName = columns[3]?.trim() || "";
      const frequency = columns[4]?.trim() || "MONTHLY";
      const riskRating = columns[5]?.trim() || "MEDIUM";
      
      // Parse Evidence Required (column 6) - Y/Yes/TRUE/1 = true, else use team default
      const evidenceCol = columns[6]?.trim().toUpperCase() || "";
      const evidenceRequired = ["Y", "YES", "TRUE", "1"].includes(evidenceCol) 
        ? true 
        : evidenceCol === "" 
          ? (selectedTeam?.evidenceRequired || false)
          : false;
      
      // Parse Review Required (column 7) - Y/Yes/TRUE/1 = true, else use team default
      const reviewCol = columns[7]?.trim().toUpperCase() || "";
      const reviewRequired = ["Y", "YES", "TRUE", "1"].includes(reviewCol) 
        ? true 
        : reviewCol === "" 
          ? (selectedTeam?.approvalRequired || true)
          : false;

      const isNewClause = reference !== "";

      if (taskName) {
        parsedRows.push({
          id: `row-${Date.now()}-${idx}`,
          reference: isNewClause ? reference : "",
          clauseTitle: isNewClause ? title : "",
          description: isNewClause ? description : "",
          taskName,
          frequency: FREQUENCIES.includes(frequency) ? frequency : "MONTHLY",
          riskRating: RISK_RATINGS.includes(riskRating) ? riskRating : "MEDIUM",
          responsibleTeamId: "",
          picId: "",
          reviewerId: "",
          dueDate: "",
          evidenceRequired,
          reviewRequired,
          isClauseRow: isNewClause,
        });
      }
    });

    setSpreadsheetData(parsedRows);
    setPastedData("");
    
    const clauseCount = parsedRows.filter(r => r.isClauseRow).length;
    toast.success(`Parsed ${clauseCount} clauses and ${parsedRows.length} tasks from pasted data`);
  };

  const handleAddClause = () => {
    const clauseRow: SpreadsheetRow = {
      id: `clause-${Date.now()}`,
      reference: "",
      clauseTitle: "",
      description: "",
      taskName: "",
      frequency: defaultFrequency,
      riskRating: "MEDIUM",
      responsibleTeamId: "",
      picId: "",
      reviewerId: "",
      dueDate: "",
      evidenceRequired: selectedTeam?.evidenceRequired || false,
      reviewRequired: selectedTeam?.approvalRequired || true,
      isClauseRow: true,
    };
    const taskRow: SpreadsheetRow = {
      id: `task-${Date.now()}`,
      reference: "",
      clauseTitle: "",
      description: "",
      taskName: "",
      frequency: defaultFrequency,
      riskRating: "MEDIUM",
      responsibleTeamId: "",
      picId: "",
      reviewerId: "",
      dueDate: "",
      evidenceRequired: selectedTeam?.evidenceRequired || false,
      reviewRequired: selectedTeam?.approvalRequired || true,
      isClauseRow: false,
    };
    setSpreadsheetData([...spreadsheetData, clauseRow, taskRow]);
  };

  const handleAddTask = () => {
    // Find the last clause in the data
    let lastClauseIndex = -1;
    for (let i = spreadsheetData.length - 1; i >= 0; i--) {
      if (spreadsheetData[i].isClauseRow) {
        lastClauseIndex = i;
        break;
      }
    }

    if (lastClauseIndex === -1) {
      toast.error("Please add a clause first before adding tasks");
      return;
    }

    // Find where to insert (after the last task of the last clause)
    let insertIndex = lastClauseIndex + 1;
    while (insertIndex < spreadsheetData.length && !spreadsheetData[insertIndex].isClauseRow) {
      insertIndex++;
    }

    const newTask: SpreadsheetRow = {
      id: `task-${Date.now()}`,
      reference: "",
      clauseTitle: "",
      description: "",
      taskName: "",
      frequency: defaultFrequency,
      riskRating: "MEDIUM",
      responsibleTeamId: "",
      picId: "",
      reviewerId: "",
      dueDate: "",
      evidenceRequired: selectedTeam?.evidenceRequired || false,
      reviewRequired: selectedTeam?.approvalRequired || true,
      isClauseRow: false,
    };

    const newData = [
      ...spreadsheetData.slice(0, insertIndex),
      newTask,
      ...spreadsheetData.slice(insertIndex),
    ];
    setSpreadsheetData(newData);
  };

  const handleAddTaskToClause = (clauseId: string) => {
    const clauseIndex = spreadsheetData.findIndex(r => r.id === clauseId);
    if (clauseIndex === -1) return;

    // Find the next clause row or end of array
    let insertIndex = clauseIndex + 1;
    while (insertIndex < spreadsheetData.length && !spreadsheetData[insertIndex].isClauseRow) {
      insertIndex++;
    }

    const newTask: SpreadsheetRow = {
      id: `task-${Date.now()}`,
      reference: "",
      clauseTitle: "",
      description: "",
      taskName: "",
      frequency: defaultFrequency,
      riskRating: "MEDIUM",
      responsibleTeamId: "",
      picId: "",
      reviewerId: "",
      dueDate: "",
      evidenceRequired: selectedTeam?.evidenceRequired || false,
      reviewRequired: selectedTeam?.approvalRequired || true,
      isClauseRow: false,
    };

    const newData = [
      ...spreadsheetData.slice(0, insertIndex),
      newTask,
      ...spreadsheetData.slice(insertIndex),
    ];
    setSpreadsheetData(newData);
  };

  const handleStep1Next = async () => {
    // Validation
    if (!sourceName || !sourceCode || selectedEntityIds.length === 0 || !teamId) {
      toast.error("Please fill all required fields");
      return;
    }

    // Check if source code has validation error
    if (sourceCodeError) {
      toast.error("Please fix the source code error before continuing");
      return;
    }

    // Validate source code one more time before proceeding
    if (teamId) {
      await validateSourceCode(sourceCode);
      // Check again after validation
      if (sourceCodeError) {
        toast.error("Source code is not unique");
        return;
      }
    }

    if (!existingSource) {
      // Create draft source
      try {
        setLoading(true);
        const res = await fetch("/api/sources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: sourceCode,
            name: sourceName,
            sourceType,
            issuingAuthorityId: issuingAuthorityId || null,
            effectiveDate: effectiveDate || null,
            reviewDate: reviewDate || null,
            defaultFrequency,
            teamId,
            entityIds: selectedEntityIds,
            status: "DRAFT",
          }),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Failed to create source");
        }

        const createdSource = await res.json();
        setCreatedSourceId(createdSource.id); // Store the created source ID
        toast.success("Source draft created");
        // Move to step 2
        setStep(2);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to create source";
        toast.error(message);
      } finally {
        setLoading(false);
      }
    } else {
      setStep(2);
    }
  };

  const handleAddItem = () => {
    // Validation
    if (!newItemForm.reference || !newItemForm.title) {
      toast.error("Item reference and title are required");
      return;
    }

    if (!newItemForm.isInformational && !newItemForm.taskName) {
      toast.error("Task name is required (or mark item as informational)");
      return;
    }

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const taskTempId = `task-${Date.now()}-${Math.random()}`;

    const newItem: ItemWithTasks = {
      tempId,
      reference: newItemForm.reference,
      title: newItemForm.title,
      description: newItemForm.description,
      isInformational: newItemForm.isInformational,
      tasks: newItemForm.isInformational
        ? []
        : [
            {
              tempId: taskTempId,
              name: newItemForm.taskName,
              description: newItemForm.taskDescription,
              expectedOutcome: newItemForm.expectedOutcome,
              responsibleTeamId: newItemForm.responsibleTeamId,
              picId: newItemForm.picId,
              reviewerId: newItemForm.reviewerId,
              frequency: newItemForm.frequency,
              quarter: newItemForm.quarter,
              riskRating: newItemForm.riskRating,
              startDate: newItemForm.startDate,
              dueDate: newItemForm.dueDate,
              evidenceRequired: newItemForm.evidenceRequired,
              reviewRequired: newItemForm.reviewRequired,
              clickupUrl: newItemForm.clickupUrl,
              gdriveUrl: newItemForm.gdriveUrl,
            },
          ],
      expanded: false,
    };

    setItems([...items, newItem]);
    setShowAddItemForm(false);

    // Reset form
    setNewItemForm({
      reference: "",
      title: "",
      description: "",
      isInformational: false,
      taskName: "",
      taskDescription: "",
      expectedOutcome: "",
      responsibleTeamId: "",
      picId: "",
      reviewerId: "",
      frequency: defaultFrequency,
      quarter: "",
      riskRating: "MEDIUM",
      startDate: "",
      dueDate: "",
      evidenceRequired: selectedTeam?.evidenceRequired || false,
      reviewRequired: selectedTeam?.approvalRequired || true,
      clickupUrl: "",
      gdriveUrl: "",
    });

    toast.success("Item added");
  };

  const handleDeleteTask = (itemTempId: string, taskTempId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.tempId === itemTempId
          ? { ...item, tasks: item.tasks.filter((t) => t.tempId !== taskTempId) }
          : item
      )
    );
    toast.success("Task removed");
  };

  const handleAddTaskToExistingItem = async (itemTempId: string) => {
    // Validation
    if (!newTaskForm.taskName) {
      toast.error("Task name is required");
      return;
    }

    const item = items.find((i) => i.tempId === itemTempId);
    if (!item) {
      toast.error("Item not found");
      return;
    }

    // If this is an existing item (has id), save directly to DB
    if (item.id && existingSource) {
      try {
        setLoading(true);
        
        // Get entity IDs from the existing source
        const sourceEntityIds = existingSource.entities.map((e) => e.entity.id);
        
        // Create task for each entity
        const taskPromises = sourceEntityIds.map(async (entityId) => {
          const taskData = {
            name: newTaskForm.taskName,
            description: newTaskForm.taskDescription || undefined,
            expectedOutcome: newTaskForm.expectedOutcome || undefined,
            responsibleTeamId: newTaskForm.responsibleTeamId || undefined,
            picId: newTaskForm.picId || undefined,
            reviewerId: newTaskForm.reviewerId || undefined,
            frequency: newTaskForm.frequency,
            quarter: newTaskForm.quarter || undefined,
            riskRating: newTaskForm.riskRating,
            startDate: newTaskForm.startDate || undefined,
            dueDate: newTaskForm.dueDate || undefined,
            evidenceRequired: newTaskForm.evidenceRequired,
            narrativeRequired: false,
            reviewRequired: newTaskForm.reviewRequired,
            clickupUrl: newTaskForm.clickupUrl || undefined,
            gdriveUrl: newTaskForm.gdriveUrl || undefined,
            sourceId: existingSource.id,
            sourceItemId: item.id,
            entityId,
          };

          const res = await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(taskData),
          });

          if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || "Failed to create task");
          }

          return await res.json();
        });

        await Promise.all(taskPromises);
        
        toast.success(`Task added to ${item.reference}`);
        
        // Refresh the items list
        await fetchExistingItems(existingSource.id);
        
        // Reset form
        setAddingTaskToItemId(null);
        setNewTaskForm({
          taskName: "",
          taskDescription: "",
          expectedOutcome: "",
          responsibleTeamId: "",
          picId: "",
          reviewerId: "",
          frequency: defaultFrequency,
          quarter: "",
          riskRating: "MEDIUM",
          startDate: "",
          dueDate: "",
          evidenceRequired: selectedTeam?.evidenceRequired || false,
          reviewRequired: selectedTeam?.approvalRequired || true,
          clickupUrl: "",
          gdriveUrl: "",
        });
      } catch (error) {
        console.error("Failed to add task:", error);
        toast.error(error instanceof Error ? error.message : "Failed to add task");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Otherwise, add to local state for new items
    const taskTempId = `task-${Date.now()}-${Math.random()}`;

    const newTask: TaskDefinition = {
      tempId: taskTempId,
      name: newTaskForm.taskName,
      description: newTaskForm.taskDescription,
      expectedOutcome: newTaskForm.expectedOutcome,
      responsibleTeamId: newTaskForm.responsibleTeamId,
      picId: newTaskForm.picId,
      reviewerId: newTaskForm.reviewerId,
      frequency: newTaskForm.frequency,
      quarter: newTaskForm.quarter,
      riskRating: newTaskForm.riskRating,
      startDate: newTaskForm.startDate,
      dueDate: newTaskForm.dueDate,
      evidenceRequired: newTaskForm.evidenceRequired,
      reviewRequired: newTaskForm.reviewRequired,
      clickupUrl: newTaskForm.clickupUrl,
      gdriveUrl: newTaskForm.gdriveUrl,
    };

    setItems((prev) =>
      prev.map((item) =>
        item.tempId === itemTempId
          ? { ...item, tasks: [...item.tasks, newTask] }
          : item
      )
    );

    // Reset form and close
    setNewTaskForm({
      taskName: "",
      taskDescription: "",
      expectedOutcome: "",
      responsibleTeamId: "",
      picId: "",
      reviewerId: "",
      frequency: defaultFrequency,
      quarter: "",
      riskRating: "MEDIUM",
      startDate: "",
      dueDate: "",
      evidenceRequired: selectedTeam?.evidenceRequired || false,
      reviewRequired: selectedTeam?.approvalRequired || true,
      clickupUrl: "",
      gdriveUrl: "",
    });
    setAddingTaskToItemId(null);

    toast.success("Task added");
  };

  // Bulk action handlers for Step 3
  const handleBulkAssign = (teamId: string) => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        tasks: item.tasks.map((task) =>
          selectedTaskIds.has(task.tempId) ? { ...task, responsibleTeamId: teamId } : task
        ),
      }))
    );
    setBulkAssignOpen(false);
    toast.success(`Set team for ${selectedTaskIds.size} task${selectedTaskIds.size !== 1 ? "s" : ""}`);
  };

  const handleBulkSetPIC = (userId: string) => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        tasks: item.tasks.map((task) =>
          selectedTaskIds.has(task.tempId) ? { ...task, picId: userId } : task
        ),
      }))
    );
    setBulkPICOpen(false);
    toast.success(`Set PIC for ${selectedTaskIds.size} task${selectedTaskIds.size !== 1 ? "s" : ""}`);
  };

  const handleBulkSetDueDate = () => {
    if (!bulkDueDateValue) {
      toast.error("Please select a date");
      return;
    }
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        tasks: item.tasks.map((task) =>
          selectedTaskIds.has(task.tempId) ? { ...task, dueDate: bulkDueDateValue } : task
        ),
      }))
    );
    setBulkDueDateOpen(false);
    setBulkDueDateValue("");
    toast.success(`Set due date for ${selectedTaskIds.size} task${selectedTaskIds.size !== 1 ? "s" : ""}`);
  };

  const handleBulkSetQuarter = (quarter: string) => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        tasks: item.tasks.map((task) =>
          selectedTaskIds.has(task.tempId) ? { ...task, quarter } : task
        ),
      }))
    );
    setBulkQuarterOpen(false);
    toast.success(`Set quarter for ${selectedTaskIds.size} task${selectedTaskIds.size !== 1 ? "s" : ""}`);
  };

  const handleStep2Next = () => {
    if (items.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    // Calculate generation preview
    const taskDefinitions = items.reduce((sum, item) => sum + item.tasks.length, 0);
    const entitiesCount = selectedEntityIds.length;
    const totalTasks = taskDefinitions * entitiesCount;

    setGenerationPreview({
      taskDefinitions,
      entities: entitiesCount,
      totalTasks,
    });

    setStep(3);
  };

  const handleStep3Next = () => {
    setStep(4);
  };

  const handleGenerate = async () => {
    // Validation: check for blocking issues
    const itemsWithoutReferences = items.filter((item) => !item.reference);
    const tasksWithoutNames = items.flatMap((item) => item.tasks.filter((task) => !task.name));

    if (itemsWithoutReferences.length > 0) {
      toast.error(`${itemsWithoutReferences.length} item(s) without a reference. Please fix before generating.`);
      return;
    }

    if (tasksWithoutNames.length > 0) {
      toast.error(`${tasksWithoutNames.length} task(s) without a name. Please fix before generating.`);
      return;
    }

    if (items.length === 0) {
      toast.error("Please add at least one item before generating");
      return;
    }

    const totalTasks = items.reduce((sum, item) => sum + item.tasks.length, 0);
    if (totalTasks === 0) {
      toast.error("Please add at least one task before generating");
      return;
    }

    try {
      setLoading(true);

      // Transform wizard data to API format
      // For each item, create tasks for ALL selected entities
      const apiPayload = {
        items: items
          .filter((item) => !item.isInformational) // Skip informational items
          .map((item) => ({
            item: {
              reference: item.reference,
              title: item.title,
              description: item.description || undefined,
              parentId: undefined,
              sortOrder: 0,
            },
            // For each task definition, create one task per entity
            tasks: item.tasks.flatMap((task) =>
              selectedEntityIds.map((entityId) => ({
                name: task.name,
                description: task.description || undefined,
                expectedOutcome: task.expectedOutcome || undefined,
                entityId, // One task per entity
                frequency: task.frequency,
                quarter: task.quarter || undefined,
                riskRating: task.riskRating,
                responsibleTeamId: task.responsibleTeamId || undefined,
                picId: task.picId || undefined,
                reviewerId: task.reviewerId || undefined,
                startDate: task.startDate || undefined,
                dueDate: task.dueDate || undefined,
                testingPeriodStart: undefined,
                testingPeriodEnd: undefined,
                evidenceRequired: task.evidenceRequired,
                narrativeRequired: selectedTeam?.narrativeRequired || false,
                reviewRequired: task.reviewRequired,
                clickupUrl: task.clickupUrl || undefined,
                gdriveUrl: task.gdriveUrl || undefined,
              }))
            ),
          })),
      };

      const sourceId = existingSource?.id || createdSourceId;
      if (!sourceId) {
        toast.error("Source ID not found");
        return;
      }

      const res = await fetch(`/api/sources/${sourceId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiPayload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to generate tasks");
      }

      const result = await res.json();
      
      toast.success(
        `✓ Successfully generated ${result.tasksCreated} task${result.tasksCreated !== 1 ? "s" : ""} across ${result.itemsCreated} item${result.itemsCreated !== 1 ? "s" : ""}!`
      );

      if (result.warnings && result.warnings.length > 0) {
        result.warnings.forEach((warning: string) => toast(warning, { icon: "⚠️" }));
      }

      // Close wizard and refresh sources list
      onClose();
    } catch (error) {
      console.error("Generation error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate tasks");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="relative flex w-full max-w-6xl flex-col rounded-[20px] bg-white shadow-2xl"
        style={{ maxHeight: "90vh" }}
      >
        {/* Fixed Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b p-6" style={{ borderColor: "var(--border)" }}>
          <div>
            <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
              {existingSource ? "Add Items & Tasks" : "Create Source"}
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              {existingSource ? `Adding to ${existingSource.name}` : "Step " + step + " of 4"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 transition-colors hover:bg-[var(--bg-subtle)]"
            style={{ color: "var(--text-secondary)" }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Step Indicator */}
        {!existingSource && (
          <div className="flex flex-shrink-0 items-center justify-center gap-2 border-b px-6 py-4" style={{ borderColor: "var(--border)" }}>
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium"
                  style={{
                    backgroundColor: step >= s ? "var(--blue)" : "var(--bg-subtle)",
                    color: step >= s ? "white" : "var(--text-muted)",
                  }}
                >
                  {s}
                </div>
                {s < 4 && (
                  <div
                    className="mx-2 h-px w-12"
                    style={{ backgroundColor: step > s ? "var(--blue)" : "var(--border)" }}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Source Details */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Source Type & Name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    Source Type <span style={{ color: "var(--red)" }}>*</span>
                  </label>
                  <select
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  >
                    {SOURCE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    Source Code <span style={{ color: "var(--red)" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={sourceCode}
                    disabled
                    placeholder="Auto-generates from name"
                    className="w-full rounded-lg border px-3 py-2 font-mono text-sm outline-none cursor-not-allowed"
                    style={{
                      borderColor: sourceCodeError ? "var(--red)" : "var(--border)",
                      color: "var(--text-primary)",
                      backgroundColor: "var(--bg-subtle)",
                    }}
                  />
                  {isValidatingCode && (
                    <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                      Validating code...
                    </p>
                  )}
                  {sourceCodeError && (
                    <p className="mt-1 text-xs" style={{ color: "var(--red)" }}>
                      {sourceCodeError}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  Source Name <span style={{ color: "var(--red)" }}>*</span>
                </label>
                <input
                  type="text"
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  placeholder="e.g., MFSA AML/CFT Framework"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              </div>

              {/* Issuing Authority & Applicable Entities */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    Issuing Authority
                  </label>
                  <div className="relative">
                    <button
                      onClick={() => setAuthorityDropdownOpen(!authorityDropdownOpen)}
                      className="flex min-h-[38px] w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm outline-none transition-colors focus:border-[var(--blue)]"
                      style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                    >
                      <span className="flex-1">
                        {issuingAuthorityId ? (
                          (() => {
                            const authority = issuingAuthorities.find((a) => a.id === issuingAuthorityId);
                            if (!authority) return "Select authority...";
                            return authority.abbreviation
                              ? `${authority.abbreviation} — ${authority.name} (${authority.country || "N/A"})`
                              : `${authority.name} (${authority.country || "N/A"})`;
                          })()
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>Select authority...</span>
                        )}
                      </span>
                      <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />
                    </button>

                    {authorityDropdownOpen && (
                      <div
                        className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <div className="border-b p-2" style={{ borderColor: "var(--border)" }}>
                          <input
                            type="text"
                            placeholder="Search authorities..."
                            value={authoritySearchQuery}
                            onChange={(e) => setAuthoritySearchQuery(e.target.value)}
                            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--blue)]"
                            style={{ borderColor: "var(--border)" }}
                          />
                        </div>

                        <div className="max-h-60 overflow-y-auto p-2">
                          {issuingAuthorities
                            .filter((authority) => {
                              const query = authoritySearchQuery.toLowerCase();
                              return (
                                authority.name.toLowerCase().includes(query) ||
                                (authority.abbreviation && authority.abbreviation.toLowerCase().includes(query)) ||
                                (authority.country && authority.country.toLowerCase().includes(query))
                              );
                            })
                            .map((authority) => (
                              <button
                                key={authority.id}
                                onClick={() => {
                                  setIssuingAuthorityId(authority.id);
                                  setAuthorityDropdownOpen(false);
                                  setAuthoritySearchQuery("");
                                }}
                                className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm transition-colors hover:bg-[var(--bg-subtle)]"
                              >
                                <span style={{ color: "var(--text-primary)" }}>
                                  {authority.abbreviation ? (
                                    <>
                                      <span className="font-medium">{authority.abbreviation}</span> —{" "}
                                      {authority.name}{" "}
                                      <span style={{ color: "var(--text-muted)" }}>
                                        ({authority.country || "N/A"})
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      {authority.name}{" "}
                                      <span style={{ color: "var(--text-muted)" }}>
                                        ({authority.country || "N/A"})
                                      </span>
                                    </>
                                  )}
                                </span>
                              </button>
                            ))}

                          {issuingAuthorities.filter((authority) => {
                            const query = authoritySearchQuery.toLowerCase();
                            return (
                              authority.name.toLowerCase().includes(query) ||
                              (authority.abbreviation && authority.abbreviation.toLowerCase().includes(query)) ||
                              (authority.country && authority.country.toLowerCase().includes(query))
                            );
                          }).length === 0 && (
                            <div className="p-2 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                              No authorities found
                            </div>
                          )}
                        </div>

                        {/* Add New Authority Option (Admin only) */}
                        <div className="border-t p-2" style={{ borderColor: "var(--border)" }}>
                          {showAddAuthorityForm ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                placeholder="Authority Name *"
                                value={newAuthorityForm.name}
                                onChange={(e) => setNewAuthorityForm({ ...newAuthorityForm, name: e.target.value })}
                                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--blue)]"
                                style={{ borderColor: "var(--border)" }}
                              />
                              <input
                                type="text"
                                placeholder="Abbreviation (optional)"
                                value={newAuthorityForm.abbreviation}
                                onChange={(e) =>
                                  setNewAuthorityForm({ ...newAuthorityForm, abbreviation: e.target.value })
                                }
                                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--blue)]"
                                style={{ borderColor: "var(--border)" }}
                              />
                              <input
                                type="text"
                                placeholder="Country (optional)"
                                value={newAuthorityForm.country}
                                onChange={(e) =>
                                  setNewAuthorityForm({ ...newAuthorityForm, country: e.target.value })
                                }
                                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--blue)]"
                                style={{ borderColor: "var(--border)" }}
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setShowAddAuthorityForm(false);
                                    setNewAuthorityForm({ name: "", abbreviation: "", country: "" });
                                  }}
                                  className="flex-1 rounded-lg border px-3 py-2 text-sm transition-colors"
                                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={handleAddNewAuthority}
                                  className="flex-1 rounded-lg px-3 py-2 text-sm text-white"
                                  style={{ backgroundColor: "var(--blue)" }}
                                >
                                  Add
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setShowAddAuthorityForm(true)}
                              className="w-full rounded-lg p-2 text-left text-sm transition-colors hover:bg-[var(--bg-subtle)]"
                              style={{ color: "var(--blue)" }}
                            >
                              + Add New Authority
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    Applicable Entities <span style={{ color: "var(--red)" }}>*</span>
                  </label>
                  <div className="relative">
                    <button
                      onClick={() => setEntityDropdownOpen(!entityDropdownOpen)}
                      className="flex min-h-[38px] w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm outline-none transition-colors focus:border-[var(--blue)]"
                      style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                    >
                      <div className="flex flex-1 flex-wrap gap-1">
                        {selectedEntityIds.length === 0 ? (
                          <span style={{ color: "var(--text-muted)" }}>Select entities...</span>
                        ) : (
                          selectedEntityIds.map((entityId) => {
                            const entity = entities.find((e) => e.id === entityId);
                            if (!entity) return null;
                            return (
                              <span
                                key={entityId}
                                className="flex items-center gap-1 rounded px-2 py-0.5 text-xs"
                                style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-primary)" }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeEntity(entityId);
                                }}
                              >
                                {entity.code}
                                <X size={12} className="cursor-pointer hover:opacity-70" />
                              </span>
                            );
                          })
                        )}
                      </div>
                      <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />
                    </button>

                    {entityDropdownOpen && (
                      <div
                        className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <div className="max-h-60 overflow-y-auto p-2">
                          {entities.map((entity) => (
                            <label
                              key={entity.id}
                              className="flex items-center gap-2 rounded-lg p-2 text-sm transition-colors hover:bg-[var(--bg-subtle)]"
                            >
                              <input
                                type="checkbox"
                                checked={selectedEntityIds.includes(entity.id)}
                                onChange={() => toggleEntity(entity.id)}
                                className="rounded"
                              />
                              <EntityBadge entityCode={entity.code as "DIEL" | "DGL" | "DBVI" | "FINSERV" | "GROUP"} />
                              <span style={{ color: "var(--text-secondary)" }}>{entity.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Team & Default Frequency */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    Applicable Team <span style={{ color: "var(--red)" }}>*</span>
                  </label>
                  <select
                    value={teamId}
                    onChange={(e) => setTeamId(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  >
                    <option value="">Select team...</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    Default Frequency
                  </label>
                  <select
                    value={defaultFrequency}
                    onChange={(e) => setDefaultFrequency(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  >
                    {FREQUENCIES.map((freq) => (
                      <option key={freq} value={freq}>
                        {freq.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Effective Date & Review Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    Effective Date
                  </label>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    Review Date
                  </label>
                  <input
                    type="date"
                    value={reviewDate}
                    onChange={(e) => setReviewDate(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Items & Tasks */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Method Selector - Always visible */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                  Choose how to add clauses and tasks
                </h3>

                {/* Two prominent cards */}
                <div className="grid grid-cols-2 gap-4">
                  {/* AI Extract Card */}
                  <button
                    onClick={() => setInputMethod("ai-extract")}
                    className={`rounded-[14px] border-2 p-6 text-left transition-all ${
                      inputMethod === "ai-extract"
                        ? "border-[var(--blue)] bg-[var(--blue-light)]"
                        : "border-[var(--border)] hover:border-[var(--blue-mid)]"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-lg"
                        style={{
                          backgroundColor:
                            inputMethod === "ai-extract" ? "var(--blue)" : "var(--bg-subtle)",
                          color: inputMethod === "ai-extract" ? "white" : "var(--text-secondary)",
                        }}
                      >
                        <FileText size={24} />
                      </div>
                      <div className="flex-1">
                        <h4 className="mb-2 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                          AI Extract from Document
                        </h4>
                        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                          Upload the regulation PDF and AI will extract clauses and suggest monitoring tasks
                          automatically. Best for new regulations.
                        </p>
                      </div>
                    </div>
                  </button>

                  {/* Spreadsheet Card */}
                  <button
                    onClick={() => setInputMethod("spreadsheet")}
                    className={`rounded-[14px] border-2 p-6 text-left transition-all ${
                      inputMethod === "spreadsheet"
                        ? "border-[var(--blue)] bg-[var(--blue-light)]"
                        : "border-[var(--border)] hover:border-[var(--blue-mid)]"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-lg"
                        style={{
                          backgroundColor:
                            inputMethod === "spreadsheet" ? "var(--blue)" : "var(--bg-subtle)",
                          color: inputMethod === "spreadsheet" ? "white" : "var(--text-secondary)",
                        }}
                      >
                        <Table size={24} />
                      </div>
                      <div className="flex-1">
                        <h4 className="mb-2 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                          Spreadsheet View
                        </h4>
                        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                          Add clauses and tasks in a fast table format. Paste from Excel or type directly. Best
                          for 5+ items.
                        </p>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Fallback link */}
                <div className="text-center">
                  <button
                    onClick={() => setInputMethod("one-by-one")}
                    className="text-sm font-medium transition-colors hover:underline"
                    style={{ color: "var(--text-muted)" }}
                  >
                    or add items one by one →
                  </button>
                </div>
              </div>

              {/* AI Extract Method */}
              {inputMethod === "ai-extract" && (
                <div className="space-y-6">
                  {extractedClauses.length === 0 ? (
                    <>
                      {/* Upload Section */}
                      <div>
                        <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          Upload Document
                        </label>
                        {!uploadedFile ? (
                          <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            className={`flex flex-col items-center justify-center rounded-[14px] border-2 border-dashed p-8 transition-colors ${
                              isDragging
                                ? "border-[var(--blue)] bg-[var(--blue-light)]"
                                : "border-[var(--border)] hover:border-[var(--blue-mid)]"
                            }`}
                          >
                            <Upload size={48} style={{ color: "var(--text-muted)" }} />
                            <p className="mt-4 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                              Drop your PDF, DOCX, or TXT file here
                            </p>
                            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                              or click to browse (max 50MB)
                            </p>
                            <input
                              type="file"
                              accept=".pdf,.docx,.doc,.txt"
                              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                              className="mt-4"
                            />
                          </div>
                        ) : (
                          <div
                            className="flex items-center justify-between rounded-lg border p-4"
                            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-subtle)" }}
                          >
                            <div className="flex items-center gap-3">
                              <FileText size={24} style={{ color: "var(--blue)" }} />
                              <div>
                                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                  {uploadedFile.name}
                                </p>
                                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                  {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => setUploadedFile(null)}
                              className="rounded-lg p-2 transition-colors hover:bg-[var(--red-light)]"
                              style={{ color: "var(--red)" }}
                            >
                              <X size={20} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* AI Configuration */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            Extract Level
                          </label>
                          <select
                            value={extractionLevel}
                            onChange={(e) => setExtractionLevel(e.target.value)}
                            className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                          >
                            <option value="articles-sub">Articles & Sub-articles</option>
                            <option value="articles-only">Top-level Articles only</option>
                            <option value="sections">Sections & Clauses</option>
                            <option value="all-paragraphs">All numbered paragraphs</option>
                          </select>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            Task Suggestion
                          </label>
                          <select
                            value={taskSuggestion}
                            onChange={(e) => setTaskSuggestion(e.target.value)}
                            className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                          >
                            <option value="full">Suggest tasks with frequency & risk</option>
                            <option value="tasks-only">Suggest tasks only</option>
                            <option value="clauses-only">Extract clauses only</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          Additional Instructions (optional)
                        </label>
                        <textarea
                          value={additionalInstructions}
                          onChange={(e) => setAdditionalInstructions(e.target.value)}
                          rows={3}
                          placeholder="e.g., Focus on customer due diligence requirements. Skip administrative clauses."
                          className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                        />
                      </div>

                      <button
                        onClick={handleAIExtract}
                        disabled={!uploadedFile || isExtracting}
                        className="flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium text-white transition-opacity disabled:opacity-40"
                        style={{ backgroundColor: "var(--blue)" }}
                      >
                        {isExtracting ? (
                          <>
                            <Loader size={16} className="animate-spin" />
                            {extractionProgress || "Extracting..."}
                          </>
                        ) : (
                          <>
                            Extract with AI
                          </>
                        )}
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Extraction Results */}
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          AI extracted {extractedClauses.length} clauses with{" "}
                          {extractedClauses.reduce((sum, c) => sum + c.tasks.length, 0)} suggested tasks
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const allSelected = extractedClauses.every((c) => c.included);
                              setExtractedClauses((prev) =>
                                prev.map((c) => ({ ...c, included: !allSelected, tasks: c.tasks.map(t => ({ ...t, included: !allSelected })) }))
                              );
                            }}
                            className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors"
                            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                          >
                            {extractedClauses.every((c) => c.included) ? "Deselect All" : "Select All"}
                          </button>
                          <button
                            onClick={() => {
                              setExtractedClauses([]);
                              setUploadedFile(null);
                            }}
                            className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors"
                            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                          >
                            Re-extract
                          </button>
                          <button
                            onClick={handleApplyExtractedClauses}
                            className="rounded-lg px-3 py-1.5 text-sm font-medium text-white"
                            style={{ backgroundColor: "var(--blue)" }}
                          >
                            Apply Selected
                          </button>
                        </div>
                      </div>

                      {/* Extracted Clauses List */}
                      <div className="space-y-3">
                        {extractedClauses.map((clause, idx) => (
                          <div
                            key={idx}
                            className={`rounded-[14px] border p-4 transition-all ${
                              clause.included ? "bg-white" : "border-dashed opacity-50"
                            }`}
                            style={{ borderColor: "var(--border)" }}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={clause.included}
                                onChange={(e) =>
                                  setExtractedClauses((prev) =>
                                    prev.map((c, i) =>
                                      i === idx ? { ...c, included: e.target.checked } : c
                                    )
                                  )
                                }
                                className="mt-1 rounded"
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="rounded px-2 py-0.5 font-mono text-xs font-medium"
                                    style={{ backgroundColor: "var(--purple-light)", color: "var(--purple)" }}
                                  >
                                    {clause.reference}
                                  </span>
                                  <input
                                    type="text"
                                    value={clause.title}
                                    onChange={(e) =>
                                      setExtractedClauses((prev) =>
                                        prev.map((c, i) => (i === idx ? { ...c, title: e.target.value } : c))
                                      )
                                    }
                                    className="flex-1 border-b border-transparent text-sm font-medium outline-none hover:border-[var(--border)] focus:border-[var(--blue)]"
                                    style={{ color: "var(--text-primary)" }}
                                  />
                                  <span
                                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                                    style={{ backgroundColor: "var(--blue-light)", color: "var(--blue)" }}
                                  >
                                    {clause.tasks.filter(t => t.included).length} tasks
                                  </span>
                                </div>
                                
                                {clause.expanded && (
                                  <div className="mt-3 space-y-2">
                                    <textarea
                                      value={clause.description}
                                      onChange={(e) =>
                                        setExtractedClauses((prev) =>
                                          prev.map((c, i) =>
                                            i === idx ? { ...c, description: e.target.value } : c
                                          )
                                        )
                                      }
                                      rows={3}
                                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--blue)]"
                                      style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                                    />
                                    
                                    {clause.tasks.map((task, taskIdx) => (
                                      <div
                                        key={task.id}
                                        className="flex items-center gap-3 rounded-lg border p-3"
                                        style={{ borderColor: "var(--border-light)", backgroundColor: "var(--bg-subtle)" }}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={task.included}
                                          onChange={(e) =>
                                            setExtractedClauses((prev) =>
                                              prev.map((c, i) =>
                                                i === idx
                                                  ? {
                                                      ...c,
                                                      tasks: c.tasks.map((t, ti) =>
                                                        ti === taskIdx ? { ...t, included: e.target.checked } : t
                                                      ),
                                                    }
                                                  : c
                                              )
                                            )
                                          }
                                          className="rounded"
                                        />
                                        <input
                                          type="text"
                                          value={task.name}
                                          onChange={(e) =>
                                            setExtractedClauses((prev) =>
                                              prev.map((c, i) =>
                                                i === idx
                                                  ? {
                                                      ...c,
                                                      tasks: c.tasks.map((t, ti) =>
                                                        ti === taskIdx ? { ...t, name: e.target.value } : t
                                                      ),
                                                    }
                                                  : c
                                              )
                                            )
                                          }
                                          className="flex-1 border-b border-transparent text-sm outline-none hover:border-[var(--border)] focus:border-[var(--blue)]"
                                          style={{ color: "var(--text-primary)", backgroundColor: "transparent" }}
                                        />
                                        <select
                                          value={task.frequency}
                                          onChange={(e) =>
                                            setExtractedClauses((prev) =>
                                              prev.map((c, i) =>
                                                i === idx
                                                  ? {
                                                      ...c,
                                                      tasks: c.tasks.map((t, ti) =>
                                                        ti === taskIdx ? { ...t, frequency: e.target.value } : t
                                                      ),
                                                    }
                                                  : c
                                              )
                                            )
                                          }
                                          className="rounded border px-2 py-1 text-xs"
                                          style={{ borderColor: "var(--border)" }}
                                        >
                                          {FREQUENCIES.map((f) => (
                                            <option key={f} value={f}>
                                              {f.replace(/_/g, " ")}
                                            </option>
                                          ))}
                                        </select>
                                        <select
                                          value={task.riskRating}
                                          onChange={(e) =>
                                            setExtractedClauses((prev) =>
                                              prev.map((c, i) =>
                                                i === idx
                                                  ? {
                                                      ...c,
                                                      tasks: c.tasks.map((t, ti) =>
                                                        ti === taskIdx ? { ...t, riskRating: e.target.value } : t
                                                      ),
                                                    }
                                                  : c
                                              )
                                            )
                                          }
                                          className="rounded border px-2 py-1 text-xs"
                                          style={{ borderColor: "var(--border)" }}
                                        >
                                          {RISK_RATINGS.map((r) => (
                                            <option key={r} value={r}>
                                              {r}
                                            </option>
                                          ))}
                                        </select>
                                        <button
                                          onClick={() =>
                                            setExtractedClauses((prev) =>
                                              prev.map((c, i) =>
                                                i === idx
                                                  ? { ...c, tasks: c.tasks.filter((_, ti) => ti !== taskIdx) }
                                                  : c
                                              )
                                            )
                                          }
                                          className="rounded p-1 transition-colors hover:bg-[var(--red-light)]"
                                          style={{ color: "var(--red)" }}
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                
                                <button
                                  onClick={() =>
                                    setExtractedClauses((prev) =>
                                      prev.map((c, i) => (i === idx ? { ...c, expanded: !c.expanded } : c))
                                    )
                                  }
                                  className="mt-2 flex items-center gap-1 text-xs font-medium transition-colors"
                                  style={{ color: "var(--blue)" }}
                                >
                                  <ChevronDown
                                    size={14}
                                    style={{
                                      transform: clause.expanded ? "rotate(180deg)" : "rotate(0deg)",
                                      transition: "transform 0.2s",
                                    }}
                                  />
                                  {clause.expanded ? "Collapse" : "Expand"}
                                </button>
                              </div>
                              
                              <button
                                onClick={() =>
                                  setExtractedClauses((prev) => prev.filter((_, i) => i !== idx))
                                }
                                className="rounded-lg p-1 transition-colors hover:bg-[var(--red-light)]"
                                style={{ color: "var(--red)" }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Spreadsheet Method */}
              {inputMethod === "spreadsheet" && (
                <div className="space-y-6">
                  {/* Existing Items Section - Only shown when adding to existing source */}
                  {existingSource && items.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        Existing Items ({items.length})
                      </h4>
                      <div className="rounded-[14px] border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-subtle)" }}>
                        <div className="space-y-2">
                          {items.map((item) => {
                            const isExpanded = expandedExistingItems.has(item.id || item.tempId);
                            
                            return (
                              <div
                                key={item.tempId}
                                className="rounded-[14px] border bg-white p-4"
                                style={{ borderColor: "var(--border)" }}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3">
                                      {/* Expand/Collapse Button */}
                                      {!item.isInformational && item.tasks.length > 0 && (
                                        <button
                                          onClick={() => toggleExistingItem(item.id || item.tempId)}
                                          className="rounded-lg p-1 transition-colors hover:bg-[var(--bg-subtle)]"
                                          style={{ color: "var(--text-secondary)" }}
                                        >
                                          <ChevronDown
                                            size={16}
                                            className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                          />
                                        </button>
                                      )}
                                      
                                      <span
                                        className="font-mono text-sm font-medium"
                                        style={{ color: "var(--text-primary)" }}
                                      >
                                        {item.reference}
                                      </span>
                                      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                        {item.title}
                                      </span>
                                      {item.isInformational ? (
                                        <span
                                          className="rounded-full px-2 py-0.5 text-xs"
                                          style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-muted)" }}
                                        >
                                          Informational — no tasks
                                        </span>
                                      ) : (
                                        <span
                                          className="rounded-full px-2 py-0.5 text-xs font-medium"
                                          style={{ backgroundColor: "var(--blue-light)", color: "var(--blue)" }}
                                        >
                                          {item.tasks.length} task{item.tasks.length !== 1 ? "s" : ""}
                                        </span>
                                      )}
                                    </div>
                                    {item.description && (
                                      <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                                        {item.description}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Expanded Task List */}
                                {isExpanded && item.tasks.length > 0 && (
                                  <div className="mt-4 space-y-3 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                                    {item.tasks.map((task) => {
                                      const isEditing = editingTaskId === task.tempId;
                                      
                                      return (
                                        <div
                                          key={task.tempId}
                                          className="rounded-lg border p-3"
                                          style={{ 
                                            borderColor: "var(--border)", 
                                            backgroundColor: isEditing ? "var(--blue-light)" : "var(--bg-subtle)" 
                                          }}
                                        >
                                          {isEditing ? (
                                            /* Edit Mode */
                                            <div className="space-y-3">
                                              <div className="flex items-center justify-between">
                                                <h5 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                                  Edit Task Metadata
                                                </h5>
                                                <button
                                                  onClick={cancelEditingTask}
                                                  className="text-xs" 
                                                  style={{ color: "var(--text-muted)" }}
                                                >
                                                  Cancel
                                                </button>
                                              </div>

                                              {/* Editable Fields */}
                                              <div className="grid grid-cols-2 gap-3">
                                                <div className="col-span-2">
                                                  <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                                                    Task Name <span style={{ color: "var(--red)" }}>*</span>
                                                  </label>
                                                  <input
                                                    type="text"
                                                    value={editTaskForm.name}
                                                    onChange={(e) => setEditTaskForm({ ...editTaskForm, name: e.target.value })}
                                                    className="w-full rounded-lg border px-3 py-2 text-sm"
                                                    style={{ borderColor: "var(--border)" }}
                                                  />
                                                </div>

                                                <div className="col-span-2">
                                                  <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                                                    Description
                                                  </label>
                                                  <textarea
                                                    value={editTaskForm.description}
                                                    onChange={(e) => setEditTaskForm({ ...editTaskForm, description: e.target.value })}
                                                    className="w-full rounded-lg border px-3 py-2 text-sm"
                                                    style={{ borderColor: "var(--border)" }}
                                                    rows={2}
                                                  />
                                                </div>

                                                <div>
                                                  <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                                                    Risk Rating
                                                  </label>
                                                  <select
                                                    value={editTaskForm.riskRating}
                                                    onChange={(e) => setEditTaskForm({ ...editTaskForm, riskRating: e.target.value })}
                                                    className="w-full rounded-lg border px-3 py-2 text-sm"
                                                    style={{ borderColor: "var(--border)" }}
                                                  >
                                                    {RISK_RATINGS.map((rating) => (
                                                      <option key={rating} value={rating}>
                                                        {rating}
                                                      </option>
                                                    ))}
                                                  </select>
                                                </div>

                                                <div>
                                                  <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                                                    Responsible Team
                                                  </label>
                                                  <select
                                                    value={editTaskForm.responsibleTeamId}
                                                    onChange={(e) => setEditTaskForm({ ...editTaskForm, responsibleTeamId: e.target.value })}
                                                    className="w-full rounded-lg border px-3 py-2 text-sm"
                                                    style={{ borderColor: "var(--border)" }}
                                                  >
                                                    <option value="">None</option>
                                                    {teams.map((team) => (
                                                      <option key={team.id} value={team.id}>
                                                        {team.name}
                                                      </option>
                                                    ))}
                                                  </select>
                                                </div>

                                                <div>
                                                  <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                                                    PIC
                                                  </label>
                                                  <select
                                                    value={editTaskForm.picId}
                                                    onChange={(e) => setEditTaskForm({ ...editTaskForm, picId: e.target.value })}
                                                    className="w-full rounded-lg border px-3 py-2 text-sm"
                                                    style={{ borderColor: "var(--border)" }}
                                                  >
                                                    <option value="">None</option>
                                                    {users.map((user) => (
                                                      <option key={user.id} value={user.id}>
                                                        {user.name}
                                                      </option>
                                                    ))}
                                                  </select>
                                                </div>

                                                <div>
                                                  <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                                                    Reviewer
                                                  </label>
                                                  <select
                                                    value={editTaskForm.reviewerId}
                                                    onChange={(e) => setEditTaskForm({ ...editTaskForm, reviewerId: e.target.value })}
                                                    className="w-full rounded-lg border px-3 py-2 text-sm"
                                                    style={{ borderColor: "var(--border)" }}
                                                  >
                                                    <option value="">None</option>
                                                    {users
                                                      .filter((u) => 
                                                        u.teamMemberships?.some((tm) => tm.teamId === editTaskForm.responsibleTeamId)
                                                      )
                                                      .map((user) => (
                                                        <option key={user.id} value={user.id}>
                                                          {user.name}
                                                        </option>
                                                      ))}
                                                  </select>
                                                </div>
                                              </div>

                                              {/* Checkboxes */}
                                              <div className="flex flex-wrap gap-4">
                                                <label className="flex items-center gap-2 text-xs">
                                                  <input
                                                    type="checkbox"
                                                    checked={editTaskForm.evidenceRequired}
                                                    onChange={(e) => setEditTaskForm({ ...editTaskForm, evidenceRequired: e.target.checked })}
                                                    className="rounded"
                                                  />
                                                  <span style={{ color: "var(--text-primary)" }}>Evidence Required</span>
                                                </label>
                                                <label className="flex items-center gap-2 text-xs">
                                                  <input
                                                    type="checkbox"
                                                    checked={editTaskForm.narrativeRequired}
                                                    onChange={(e) => setEditTaskForm({ ...editTaskForm, narrativeRequired: e.target.checked })}
                                                    className="rounded"
                                                  />
                                                  <span style={{ color: "var(--text-primary)" }}>Narrative Required</span>
                                                </label>
                                                <label className="flex items-center gap-2 text-xs">
                                                  <input
                                                    type="checkbox"
                                                    checked={editTaskForm.reviewRequired}
                                                    onChange={(e) => setEditTaskForm({ ...editTaskForm, reviewRequired: e.target.checked })}
                                                    className="rounded"
                                                  />
                                                  <span style={{ color: "var(--text-primary)" }}>Review Required</span>
                                                </label>
                                              </div>

                                              {/* Locked Fields Notice */}
                                              <div className="rounded-lg border p-2" style={{ borderColor: "var(--amber)", backgroundColor: "var(--amber-light)" }}>
                                                <div className="flex gap-2">
                                                  <AlertCircle size={14} style={{ color: "var(--amber)" }} className="flex-shrink-0 mt-0.5" />
                                                  <p className="text-xs" style={{ color: "var(--amber-dark)" }}>
                                                    <strong>Schedule fields locked:</strong> Frequency, due date, and recurrence settings cannot be edited because task instances have already been generated.
                                                  </p>
                                                </div>
                                              </div>

                                              {/* Action Buttons */}
                                              <div className="flex justify-end gap-2">
                                                <button
                                                  onClick={cancelEditingTask}
                                                  className="rounded-lg border px-3 py-1.5 text-sm font-medium"
                                                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                                                >
                                                  Cancel
                                                </button>
                                                <button
                                                  onClick={() => saveTaskEdit(task.tempId, item.id || item.tempId)}
                                                  disabled={loading || !editTaskForm.name.trim()}
                                                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-white"
                                                  style={{ 
                                                    backgroundColor: loading || !editTaskForm.name.trim() ? "var(--text-muted)" : "var(--blue)",
                                                    cursor: loading || !editTaskForm.name.trim() ? "not-allowed" : "pointer"
                                                  }}
                                                >
                                                  {loading ? "Saving..." : "Save Changes"}
                                                </button>
                                              </div>
                                            </div>
                                          ) : (
                                            /* View Mode */
                                            <div className="space-y-2">
                                              <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                  <div className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
                                                    {task.name}
                                                  </div>
                                                  {task.description && (
                                                    <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                                                      {task.description}
                                                    </p>
                                                  )}
                                                </div>
                                                <button
                                                  onClick={() => startEditingTask(task)}
                                                  className="ml-2 rounded-lg px-2 py-1 text-xs font-medium transition-colors"
                                                  style={{ 
                                                    color: "var(--blue)", 
                                                    backgroundColor: "transparent",
                                                    border: "1px solid var(--blue)"
                                                  }}
                                                >
                                                  Edit
                                                </button>
                                              </div>

                                              {/* Task Metadata Display */}
                                              <div className="flex flex-wrap gap-2">
                                                {/* Read-only Schedule Fields */}
                                                <span className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: "white", border: "1px solid var(--border)" }}>
                                                  <strong>Frequency:</strong> {formatFrequency(task.frequency)}
                                                </span>
                                                <span className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: "white", border: "1px solid var(--border)" }}>
                                                  <strong>Risk:</strong> {task.riskRating}
                                                </span>
                                                {task.dueDate && (
                                                  <span className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: "white", border: "1px solid var(--border)" }}>
                                                    <strong>Due:</strong> {new Date(task.dueDate).toLocaleDateString()}
                                                  </span>
                                                )}
                                                {task.responsibleTeamId && (
                                                  <span className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: "white", border: "1px solid var(--border)" }}>
                                                    <strong>Team:</strong> {teams.find((t) => t.id === task.responsibleTeamId)?.name || "Unknown"}
                                                  </span>
                                                )}
                                                {task.picId && (
                                                  <span className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: "white", border: "1px solid var(--border)" }}>
                                                    <strong>PIC:</strong> {users.find((u) => u.id === task.picId)?.name || "Unknown"}
                                                  </span>
                                                )}
                                              </div>

                                              {/* Requirements Indicators */}
                                              {(task.evidenceRequired || task.narrativeRequired || task.reviewRequired) && (
                                                <div className="flex gap-2 text-xs">
                                                  {task.evidenceRequired && (
                                                    <span className="flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                                                      <CheckCircle size={12} />
                                                      Evidence
                                                    </span>
                                                  )}
                                                  {task.narrativeRequired && (
                                                    <span className="flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                                                      <CheckCircle size={12} />
                                                      Narrative
                                                    </span>
                                                  )}
                                                  {task.reviewRequired && (
                                                    <span className="flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                                                      <CheckCircle size={12} />
                                                      Review
                                                    </span>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}

                                    {/* Info Note */}
                                    <div className="mt-3 rounded-lg border p-2" style={{ borderColor: "var(--blue)", backgroundColor: "var(--blue-light)" }}>
                                      <div className="flex gap-2">
                                        <AlertCircle size={14} style={{ color: "var(--blue)" }} className="flex-shrink-0 mt-0.5" />
                                        <p className="text-xs" style={{ color: "var(--blue-dark)" }}>
                                          You can edit task metadata (name, description, assignments, etc.). Schedule-critical fields remain locked to protect already-generated task instances.
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
                          Add new clauses and tasks below. Existing items above will not be modified unless you explicitly edit them.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Paste from Excel Section */}
                  <div className="rounded-[14px] border p-6" style={{ borderColor: "var(--border)", backgroundColor: "white" }}>
                    <h4 className="mb-4 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                      Paste from Excel
                    </h4>
                    <p className="mb-3 flex items-start gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                      <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                      <span>
                        Copy rows from Excel and paste here. Expected columns: Reference | Title | Description | Task Name | Frequency | Risk Rating
                      </span>
                    </p>
                    <p className="mb-3 text-xs" style={{ color: "var(--text-muted)" }}>
                      Paste tab-separated data from Excel. Each row becomes a clause. If Task Name column exists, tasks are created automatically.
                    </p>
                    <textarea
                      value={pastedData}
                      onChange={(e) => setPastedData(e.target.value)}
                      rows={5}
                      placeholder="Paste tab-separated data from Excel here..."
                      className="w-full rounded-lg border px-3 py-2 font-mono text-sm outline-none transition-colors focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue-light)]"
                      style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "var(--bg-subtle)" }}
                    />
                    <button
                      onClick={handleParsePastedData}
                      disabled={!pastedData.trim()}
                      className="mt-3 h-10 rounded-lg px-4 text-sm font-medium text-white transition-opacity disabled:opacity-40"
                      style={{ backgroundColor: "var(--blue)" }}
                    >
                      Parse Pasted Data
                    </button>
                  </div>

                  {/* Spreadsheet Table - Always Visible */}
                  <>
                    {/* Toolbar */}
                    <div className="flex items-center justify-between rounded-lg border px-4 py-3" style={{ borderColor: "var(--border)", backgroundColor: "white" }}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                          Items & Tasks
                        </span>
                        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                          · {spreadsheetData.filter(r => r.isClauseRow).length} clauses, {(() => {
                            const taskCount = spreadsheetData.filter(r => !r.isClauseRow).length;
                            return `${taskCount} task${taskCount !== 1 ? "s" : ""}`;
                          })()}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleAddClause}
                          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--bg-subtle)]"
                          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                        >
                          <Plus size={14} />
                          Add Clause
                        </button>
                        <button
                          onClick={handleAddTask}
                          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--bg-subtle)]"
                          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                        >
                          <Plus size={14} />
                          Add Task
                        </button>
                        <div className="flex items-center gap-2">
                          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                            Group by clause
                          </span>
                          <button
                            onClick={() => setGroupByClause(!groupByClause)}
                            className={`relative h-5 w-9 rounded-full transition-colors ${
                              groupByClause ? "bg-[var(--blue)]" : "bg-[var(--border)]"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                                groupByClause ? "translate-x-4" : "translate-x-0.5"
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto rounded-[14px] border" style={{ borderColor: "var(--border)", backgroundColor: "white" }}>
                      <style>{`
                        .spreadsheet-cell {
                          border: none;
                          background: transparent;
                          outline: none;
                          width: 100%;
                          padding: 8px 12px;
                          font-size: 13px;
                          transition: background-color 0.15s;
                        }
                        .spreadsheet-cell:hover:not(:disabled) {
                          background-color: var(--bg-subtle);
                        }
                        .spreadsheet-cell:focus {
                          background-color: white;
                          border: 1px solid var(--blue);
                          box-shadow: 0 0 0 2px var(--blue-light);
                          border-radius: 4px;
                        }
                        .spreadsheet-cell:disabled {
                          opacity: 0.3;
                          cursor: not-allowed;
                        }
                        .spreadsheet-row:hover {
                          background-color: var(--bg-hover);
                        }
                        .spreadsheet-row:hover .delete-button {
                          opacity: 1;
                        }
                        .delete-button {
                          opacity: 0;
                          transition: opacity 0.15s;
                        }
                        .clause-header-row {
                          background: linear-gradient(135deg, var(--blue-light) 0%, var(--blue-mid) 100%);
                          border-bottom: 2px solid var(--blue);
                        }
                      `}</style>
                      <table className="w-full border-collapse">
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-subtle)" }}>
                            <th style={{ width: "30px", padding: "10px 8px", textAlign: "center" }}>
                              <input 
                                type="checkbox" 
                                className="rounded"
                                checked={selectedRows.size === spreadsheetData.length && spreadsheetData.length > 0}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedRows(new Set(spreadsheetData.map(r => r.id)));
                                  } else {
                                    setSelectedRows(new Set());
                                  }
                                }}
                              />
                            </th>
                            {!groupByClause && (
                              <>
                                <th style={{ minWidth: "100px", padding: "10px 12px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                  Reference
                                </th>
                                <th style={{ minWidth: "200px", padding: "10px 12px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                  Clause Title
                                </th>
                              </>
                            )}
                            <th style={{ minWidth: "240px", padding: "10px 12px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                              Task Name
                            </th>
                            <th style={{ minWidth: "100px", padding: "10px 12px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                              Frequency
                            </th>
                            <th style={{ minWidth: "80px", padding: "10px 12px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                              Risk
                            </th>
                            <th style={{ minWidth: "120px", padding: "10px 12px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                              DEPT / TEAM
                            </th>
                            <th style={{ minWidth: "120px", padding: "10px 12px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                              PIC
                            </th>
                            <th style={{ minWidth: "110px", padding: "10px 12px", textAlign: "left", fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                              Due Date
                            </th>
                            <th style={{ width: "60px", padding: "10px 8px", textAlign: "center", fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                              EVID
                            </th>
                            {selectedTeam?.approvalRequired && (
                              <th style={{ width: "60px", padding: "10px 8px", textAlign: "center", fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                REV
                              </th>
                            )}
                            <th style={{ width: "40px", padding: "10px 8px" }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupByClause ? (
                            // Grouped view with clause headers
                            getClauseGroups(spreadsheetData).map((group) => (
                              <React.Fragment key={group.clauseRow.id}>
                                {/* Clause Header Row */}
                                <tr className="clause-header-row">
                                  <td colSpan={selectedTeam?.approvalRequired ? 10 : 9} style={{ padding: "10px 12px" }}>
                                    <div className="flex items-center justify-between">
                                      <div className="flex flex-1 items-center gap-3">
                                        <input
                                          type="text"
                                          value={group.clauseRow.reference}
                                          onChange={(e) =>
                                            setSpreadsheetData((prev) =>
                                              prev.map((r) =>
                                                r.id === group.clauseRow.id ? { ...r, reference: e.target.value } : r
                                              )
                                            )
                                          }
                                          placeholder="e.g., Art. 5"
                                          className="w-24 rounded border-0 bg-white/80 px-2 py-1 font-mono text-sm font-bold outline-none focus:ring-2 focus:ring-white"
                                          style={{ color: "var(--purple)" }}
                                        />
                                        <span style={{ color: "var(--blue)", fontWeight: 500 }}>—</span>
                                        <input
                                          type="text"
                                          value={group.clauseRow.clauseTitle}
                                          onChange={(e) =>
                                            setSpreadsheetData((prev) =>
                                              prev.map((r) =>
                                                r.id === group.clauseRow.id ? { ...r, clauseTitle: e.target.value } : r
                                              )
                                            )
                                          }
                                          placeholder="e.g., Customer Due Diligence Requirements"
                                          className="flex-1 rounded border-0 bg-white/80 px-2 py-1 text-sm font-semibold outline-none focus:ring-2 focus:ring-white"
                                          style={{ color: "var(--blue)" }}
                                        />
                                        <button
                                          onClick={() => {
                                            const newSet = new Set(expandedDescriptions);
                                            if (newSet.has(group.clauseRow.id)) {
                                              newSet.delete(group.clauseRow.id);
                                            } else {
                                              newSet.add(group.clauseRow.id);
                                            }
                                            setExpandedDescriptions(newSet);
                                          }}
                                          className="text-xs font-medium transition-opacity hover:opacity-70"
                                          style={{ color: "var(--blue)" }}
                                        >
                                          📝 {group.clauseRow.description ? "Description ✓" : "Add description"}
                                        </button>
                                        <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: "white", color: "var(--blue)" }}>
                                          {(() => {
                                            const taskRowCount = group.taskRows.length;
                                            return taskRowCount === 1 ? "1 task row" : `${taskRowCount} task rows`;
                                          })()}
                                        </span>
                                      </div>
                                      {group.clauseRow.id !== "ungrouped" && (
                                        <button
                                          onClick={() =>
                                            setSpreadsheetData((prev) =>
                                              prev.filter((r) => r.id !== group.clauseRow.id && !group.taskRows.some(t => t.id === r.id))
                                            )
                                          }
                                          className="ml-2 rounded p-1 transition-colors hover:bg-white/30"
                                          style={{ color: "var(--red)" }}
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>

                                {/* Description Row */}
                                {expandedDescriptions.has(group.clauseRow.id) && (
                                  <tr style={{ backgroundColor: "var(--bg-subtle)" }}>
                                    <td colSpan={8} style={{ padding: "12px" }}>
                                      <textarea
                                        value={group.clauseRow.description}
                                        onChange={(e) =>
                                          setSpreadsheetData((prev) =>
                                            prev.map((r) =>
                                              r.id === group.clauseRow.id ? { ...r, description: e.target.value } : r
                                            )
                                          )
                                        }
                                        placeholder="Paste or type the full regulation clause text here..."
                                        className="w-full rounded border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue-light)]"
                                        style={{ borderColor: "var(--border)", color: "var(--text-primary)", minHeight: "80px", resize: "vertical" }}
                                      />
                                    </td>
                                  </tr>
                                )}

                                {/* Task Rows */}
                                {group.taskRows.map((row) => (
                                  <tr key={row.id} className="spreadsheet-row" style={{ borderBottom: "1px solid var(--border-light)" }}>
                                    <td style={{ padding: "4px 8px", textAlign: "center" }}>
                                      <input
                                        type="checkbox"
                                        checked={selectedRows.has(row.id)}
                                        onChange={(e) => {
                                          const newSet = new Set(selectedRows);
                                          if (e.target.checked) {
                                            newSet.add(row.id);
                                          } else {
                                            newSet.delete(row.id);
                                          }
                                          setSelectedRows(newSet);
                                        }}
                                        className="rounded"
                                      />
                                    </td>
                                    <td style={{ padding: 0 }}>
                                      <input
                                        type="text"
                                        value={row.taskName}
                                        onChange={(e) =>
                                          setSpreadsheetData((prev) =>
                                            prev.map((r) => (r.id === row.id ? { ...r, taskName: e.target.value } : r))
                                          )
                                        }
                                        placeholder="e.g., Monthly CDD completion review"
                                        className="spreadsheet-cell"
                                        style={{ color: "var(--text-primary)" }}
                                      />
                                    </td>
                                    <td style={{ padding: "4px" }}>
                                      <select
                                        value={row.frequency}
                                        onChange={(e) =>
                                          setSpreadsheetData((prev) =>
                                            prev.map((r) => (r.id === row.id ? { ...r, frequency: e.target.value } : r))
                                          )
                                        }
                                        className="w-full rounded border px-2 py-1.5 text-xs outline-none transition-colors focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue-light)]"
                                        style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                                      >
                                        {FREQUENCIES.map((f) => (
                                          <option key={f} value={f}>
                                            {f.replace(/_/g, " ")}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td style={{ padding: "4px" }}>
                                      <select
                                        value={row.riskRating}
                                        onChange={(e) =>
                                          setSpreadsheetData((prev) =>
                                            prev.map((r) => (r.id === row.id ? { ...r, riskRating: e.target.value } : r))
                                          )
                                        }
                                        className="w-full rounded border px-2 py-1.5 text-xs outline-none transition-colors focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue-light)]"
                                        style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                                      >
                                        {RISK_RATINGS.map((rating) => (
                                          <option key={rating} value={rating}>
                                            {rating}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td style={{ padding: "4px" }}>
                                      <select
                                        value={row.responsibleTeamId}
                                        onChange={(e) =>
                                          setSpreadsheetData((prev) =>
                                            prev.map((r) => (r.id === row.id ? { ...r, responsibleTeamId: e.target.value } : r))
                                          )
                                        }
                                        className="w-full rounded border px-2 py-1.5 text-xs outline-none transition-colors focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue-light)]"
                                        style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                                      >
                                        <option value="">None</option>
                                        {teams.map((team) => (
                                          <option key={team.id} value={team.id}>
                                            {team.name}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td style={{ padding: "4px" }}>
                                      <select
                                        value={row.picId}
                                        onChange={(e) =>
                                          setSpreadsheetData((prev) =>
                                            prev.map((r) => (r.id === row.id ? { ...r, picId: e.target.value } : r))
                                          )
                                        }
                                        className="w-full rounded border px-2 py-1.5 text-xs outline-none transition-colors focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue-light)]"
                                        style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                                      >
                                        <option value="">None</option>
                                        {users.map((user) => (
                                          <option key={user.id} value={user.id}>
                                            {user.name}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td style={{ padding: "4px" }}>
                                      <input
                                        type="date"
                                        value={row.dueDate}
                                        onChange={(e) =>
                                          setSpreadsheetData((prev) =>
                                            prev.map((r) => (r.id === row.id ? { ...r, dueDate: e.target.value } : r))
                                          )
                                        }
                                        className="w-full rounded border px-2 py-1.5 text-xs outline-none transition-colors focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue-light)]"
                                        style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                                      />
                                    </td>
                                    {/* Evidence Required Toggle */}
                                    <td style={{ padding: "4px 8px", textAlign: "center" }}>
                                      <button
                                        onClick={() =>
                                          setSpreadsheetData((prev) =>
                                            prev.map((r) => (r.id === row.id ? { ...r, evidenceRequired: !r.evidenceRequired } : r))
                                          )
                                        }
                                        className="rounded-full p-1 transition-colors hover:bg-[var(--green-light)]"
                                        style={{ color: row.evidenceRequired ? "var(--green)" : "var(--text-muted)" }}
                                        title={row.evidenceRequired ? "Evidence Required" : "No Evidence Required"}
                                      >
                                        {row.evidenceRequired ? <CheckCircle size={16} /> : <span style={{ fontSize: "16px" }}>—</span>}
                                      </button>
                                    </td>
                                    {/* Review Required Toggle */}
                                    {selectedTeam?.approvalRequired && (
                                      <td style={{ padding: "4px 8px", textAlign: "center" }}>
                                        <button
                                          onClick={() =>
                                            setSpreadsheetData((prev) =>
                                              prev.map((r) => (r.id === row.id ? { ...r, reviewRequired: !r.reviewRequired } : r))
                                            )
                                          }
                                          className="rounded-full p-1 transition-colors hover:bg-[var(--blue-light)]"
                                          style={{ color: row.reviewRequired ? "var(--blue)" : "var(--text-muted)" }}
                                          title={row.reviewRequired ? "Review Required" : "No Review Required"}
                                        >
                                          {row.reviewRequired ? <CheckCircle size={16} /> : <span style={{ fontSize: "16px" }}>—</span>}
                                        </button>
                                      </td>
                                    )}
                                    <td style={{ padding: "4px 8px", textAlign: "center" }}>
                                      <button
                                        onClick={() =>
                                          setSpreadsheetData((prev) => prev.filter((r) => r.id !== row.id))
                                        }
                                        className="delete-button rounded p-1 transition-colors hover:bg-[var(--red-light)]"
                                        style={{ color: "var(--red)" }}
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}

                                {/* Add Task Link */}
                                {group.clauseRow.id !== "ungrouped" && (
                                  <tr style={{ backgroundColor: "var(--bg-subtle)" }}>
                                    <td colSpan={selectedTeam?.approvalRequired ? 10 : 9} style={{ padding: "6px 12px" }}>
                                      <button
                                        onClick={() => handleAddTaskToClause(group.clauseRow.id)}
                                        className="flex items-center gap-1 text-xs font-medium transition-colors hover:underline"
                                        style={{ color: "var(--blue)" }}
                                      >
                                        <Plus size={12} />
                                        Add task to this clause
                                      </button>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            ))
                          ) : (
                            // Flat view
                            spreadsheetData.map((row) => (
                              <tr key={row.id} className="spreadsheet-row" style={{ borderBottom: "1px solid var(--border-light)" }}>
                                <td style={{ padding: "4px 8px", textAlign: "center" }}>
                                  <input
                                    type="checkbox"
                                    checked={selectedRows.has(row.id)}
                                    onChange={(e) => {
                                      const newSet = new Set(selectedRows);
                                      if (e.target.checked) {
                                        newSet.add(row.id);
                                      } else {
                                        newSet.delete(row.id);
                                      }
                                      setSelectedRows(newSet);
                                    }}
                                    className="rounded"
                                  />
                                </td>
                                <td style={{ padding: 0 }}>
                                  <input
                                    type="text"
                                    value={row.reference}
                                    disabled={!row.isClauseRow}
                                    onChange={(e) =>
                                      setSpreadsheetData((prev) =>
                                        prev.map((r) => (r.id === row.id ? { ...r, reference: e.target.value } : r))
                                      )
                                    }
                                    placeholder={row.isClauseRow ? "e.g., Art. 5" : ""}
                                    className="spreadsheet-cell font-mono font-bold"
                                    style={{ color: "var(--purple)" }}
                                  />
                                </td>
                                <td style={{ padding: 0 }}>
                                  <input
                                    type="text"
                                    value={row.clauseTitle}
                                    disabled={!row.isClauseRow}
                                    onChange={(e) =>
                                      setSpreadsheetData((prev) =>
                                        prev.map((r) => (r.id === row.id ? { ...r, clauseTitle: e.target.value } : r))
                                      )
                                    }
                                    placeholder={row.isClauseRow ? "e.g., Customer Due Diligence Requirements" : ""}
                                    className="spreadsheet-cell"
                                    style={{ fontWeight: 500, color: "var(--text-primary)" }}
                                  />
                                </td>
                                <td style={{ padding: 0 }}>
                                  <input
                                    type="text"
                                    value={row.taskName}
                                    onChange={(e) =>
                                      setSpreadsheetData((prev) =>
                                        prev.map((r) => (r.id === row.id ? { ...r, taskName: e.target.value } : r))
                                      )
                                    }
                                    placeholder="e.g., Monthly CDD completion review"
                                    className="spreadsheet-cell"
                                    style={{ color: "var(--text-primary)" }}
                                  />
                                </td>
                                <td style={{ padding: "4px" }}>
                                  <select
                                    value={row.frequency}
                                    onChange={(e) =>
                                      setSpreadsheetData((prev) =>
                                        prev.map((r) => (r.id === row.id ? { ...r, frequency: e.target.value } : r))
                                      )
                                    }
                                    className="w-full rounded border px-2 py-1.5 text-xs outline-none transition-colors focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue-light)]"
                                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                                  >
                                    {FREQUENCIES.map((f) => (
                                      <option key={f} value={f}>
                                        {f.replace(/_/g, " ")}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td style={{ padding: "4px" }}>
                                  <select
                                    value={row.riskRating}
                                    onChange={(e) =>
                                      setSpreadsheetData((prev) =>
                                        prev.map((r) => (r.id === row.id ? { ...r, riskRating: e.target.value } : r))
                                      )
                                    }
                                    className="w-full rounded border px-2 py-1.5 text-xs outline-none transition-colors focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue-light)]"
                                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                                  >
                                    {RISK_RATINGS.map((rating) => (
                                      <option key={rating} value={rating}>
                                        {rating}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td style={{ padding: "4px" }}>
                                  <select
                                    value={row.responsibleTeamId}
                                    onChange={(e) =>
                                      setSpreadsheetData((prev) =>
                                        prev.map((r) => (r.id === row.id ? { ...r, responsibleTeamId: e.target.value } : r))
                                      )
                                    }
                                    className="w-full rounded border px-2 py-1.5 text-xs outline-none transition-colors focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue-light)]"
                                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                                  >
                                    <option value="">None</option>
                                    {teams.map((team) => (
                                      <option key={team.id} value={team.id}>
                                        {team.name}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td style={{ padding: "4px" }}>
                                  <select
                                    value={row.picId}
                                    onChange={(e) =>
                                      setSpreadsheetData((prev) =>
                                        prev.map((r) => (r.id === row.id ? { ...r, picId: e.target.value } : r))
                                      )
                                    }
                                    className="w-full rounded border px-2 py-1.5 text-xs outline-none transition-colors focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue-light)]"
                                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                                  >
                                    <option value="">None</option>
                                    {users.map((user) => (
                                      <option key={user.id} value={user.id}>
                                        {user.name}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td style={{ padding: "4px" }}>
                                  <input
                                    type="date"
                                    value={row.dueDate}
                                    onChange={(e) =>
                                      setSpreadsheetData((prev) =>
                                        prev.map((r) => (r.id === row.id ? { ...r, dueDate: e.target.value } : r))
                                      )
                                    }
                                    className="w-full rounded border px-2 py-1.5 text-xs outline-none transition-colors focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue-light)]"
                                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                                  />
                                </td>
                                {/* Evidence Required Toggle */}
                                <td style={{ padding: "4px 8px", textAlign: "center" }}>
                                  <button
                                    onClick={() =>
                                      setSpreadsheetData((prev) =>
                                        prev.map((r) => (r.id === row.id ? { ...r, evidenceRequired: !r.evidenceRequired } : r))
                                      )
                                    }
                                    className="rounded-full p-1 transition-colors hover:bg-[var(--green-light)]"
                                    style={{ color: row.evidenceRequired ? "var(--green)" : "var(--text-muted)" }}
                                    title={row.evidenceRequired ? "Evidence Required" : "No Evidence Required"}
                                  >
                                    {row.evidenceRequired ? <CheckCircle size={16} /> : <span style={{ fontSize: "16px" }}>—</span>}
                                  </button>
                                </td>
                                {/* Review Required Toggle */}
                                {selectedTeam?.approvalRequired && (
                                  <td style={{ padding: "4px 8px", textAlign: "center" }}>
                                    <button
                                      onClick={() =>
                                        setSpreadsheetData((prev) =>
                                          prev.map((r) => (r.id === row.id ? { ...r, reviewRequired: !r.reviewRequired } : r))
                                        )
                                      }
                                      className="rounded-full p-1 transition-colors hover:bg-[var(--blue-light)]"
                                      style={{ color: row.reviewRequired ? "var(--blue)" : "var(--text-muted)" }}
                                      title={row.reviewRequired ? "Review Required" : "No Review Required"}
                                    >
                                      {row.reviewRequired ? <CheckCircle size={16} /> : <span style={{ fontSize: "16px" }}>—</span>}
                                    </button>
                                  </td>
                                )}
                                <td style={{ padding: "4px 8px", textAlign: "center" }}>
                                  <button
                                    onClick={() =>
                                      setSpreadsheetData((prev) => prev.filter((r) => r.id !== row.id))
                                    }
                                    className="delete-button rounded p-1 transition-colors hover:bg-[var(--red-light)]"
                                    style={{ color: "var(--red)" }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Info Message - only for spreadsheet view */}
                    {inputMethod === "spreadsheet" && (
                      <div className="flex items-start gap-2 rounded-lg border p-3" style={{ borderColor: "var(--blue-mid)", backgroundColor: "var(--blue-light)" }}>
                        <AlertCircle size={16} className="mt-0.5 flex-shrink-0" style={{ color: "var(--blue)" }} />
                        <p className="text-xs" style={{ color: "var(--text-primary)" }}>
                          <strong>Auto-syncing:</strong> Data entered here automatically feeds into Steps 3 &amp; 4. No need to click &quot;Apply&quot;.
                        </p>
                      </div>
                    )}
                  </>
                </div>
              )}

              {/* One-by-One Method (existing form) */}
              {inputMethod === "one-by-one" && (
                <div className="space-y-6">
                  {/* Existing Items List */}
                  {items.length > 0 && (
                <div className="space-y-3">
                  {items.map((item) => (
                    <div
                      key={item.tempId}
                      className="rounded-[14px] border bg-white p-4"
                      style={{ borderColor: "var(--border)" }}
                    >
                      {/* Item Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span
                              className="font-mono text-sm font-medium"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {item.reference}
                            </span>
                            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                              {item.title}
                            </span>
                            {item.isInformational ? (
                              <span
                                className="rounded-full px-2 py-0.5 text-xs"
                                style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-muted)" }}
                              >
                                Informational — no tasks
                              </span>
                            ) : (
                              <span
                                className="rounded-full px-2 py-0.5 text-xs font-medium"
                                style={{ backgroundColor: "var(--blue-light)", color: "var(--blue)" }}
                              >
                                {item.tasks.length} task{item.tasks.length !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                              {item.description}
                            </p>
                          )}
                        </div>

                        <button
                          onClick={() =>
                            setItems((prev) =>
                              prev.map((i) =>
                                i.tempId === item.tempId ? { ...i, expanded: !i.expanded } : i
                              )
                            )
                          }
                          className="rounded-lg p-1 transition-colors hover:bg-[var(--bg-subtle)]"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          <ChevronDown
                            size={20}
                            style={{
                              transform: item.expanded ? "rotate(180deg)" : "rotate(0deg)",
                              transition: "transform 0.2s",
                            }}
                          />
                        </button>
                      </div>

                      {/* Tasks List */}
                      {item.expanded && !item.isInformational && (
                        <div className="mt-4 space-y-2 border-t pt-4" style={{ borderColor: "var(--border-light)" }}>
                          {item.tasks.map((task) => (
                            <div
                              key={task.tempId}
                              className="flex items-start justify-between rounded-lg p-3"
                              style={{ backgroundColor: "var(--bg-subtle)" }}
                            >
                              <div className="flex-1">
                                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                  {task.name}
                                </p>
                                <div className="mt-1 flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                                  <span>
                                    {task.responsibleTeamId
                                      ? teams.find((t) => t.id === task.responsibleTeamId)?.name || "Unknown"
                                      : "No team assigned"}
                                  </span>
                                  <span>•</span>
                                  <span>{task.frequency.replace(/_/g, " ")}</span>
                                  {task.quarter && (
                                    <>
                                      <span>•</span>
                                      <span>{task.quarter}</span>
                                    </>
                                  )}
                                  <span>•</span>
                                  <span>{task.riskRating}</span>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteTask(item.tempId, task.tempId)}
                                className="rounded-lg p-1 transition-colors hover:bg-[var(--red-light)]"
                                style={{ color: "var(--red)" }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}

                          {/* Add Another Task Link */}
                          {addingTaskToItemId === item.tempId ? (
                            <div className="mt-4 space-y-4 rounded-lg border p-4" style={{ borderColor: "var(--blue-mid)", backgroundColor: "var(--blue-light)" }}>
                              <h4 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                                Add Task to {item.reference}
                              </h4>

                              {/* Task Form Fields */}
                              <div className="space-y-4">
                                <div>
                                  <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                    Task Name <span style={{ color: "var(--red)" }}>*</span>
                                  </label>
                                  <input
                                    type="text"
                                    value={newTaskForm.taskName}
                                    onChange={(e) => setNewTaskForm({ ...newTaskForm, taskName: e.target.value })}
                                    placeholder="e.g., Monthly Transaction Monitoring Review"
                                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                                    style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "white" }}
                                  />
                                </div>

                                <div>
                                  <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                    Task Description
                                  </label>
                                  <textarea
                                    value={newTaskForm.taskDescription}
                                    onChange={(e) => setNewTaskForm({ ...newTaskForm, taskDescription: e.target.value })}
                                    rows={2}
                                    placeholder="Optional task description"
                                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                                    style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "white" }}
                                  />
                                </div>

                                <div>
                                  <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                    Expected Outcome
                                  </label>
                                  <textarea
                                    value={newTaskForm.expectedOutcome}
                                    onChange={(e) => setNewTaskForm({ ...newTaskForm, expectedOutcome: e.target.value })}
                                    rows={2}
                                    placeholder="What should be achieved when this task is completed"
                                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                                    style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "white" }}
                                  />
                                </div>

                                {/* Department/Team Responsible, PIC, Reviewer Row */}
                                <div className={selectedTeam?.approvalRequired ? "grid grid-cols-3 gap-4" : "grid grid-cols-2 gap-4"}>
                                  <div>
                                    <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                      Department / Team Responsible <span style={{ color: "var(--red)" }}>*</span>
                                    </label>
                                    <select
                                      value={newTaskForm.responsibleTeamId}
                                      onChange={(e) => setNewTaskForm({ ...newTaskForm, responsibleTeamId: e.target.value })}
                                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                                      style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "white" }}
                                    >
                                      <option value="">Select team...</option>
                                      {teams.map((team) => (
                                        <option key={team.id} value={team.id}>
                                          {team.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                      Person in Charge (PIC) <span className="text-xs text-gray-500">(Optional)</span>
                                    </label>
                                    <select
                                      value={newTaskForm.picId}
                                      onChange={(e) => setNewTaskForm({ ...newTaskForm, picId: e.target.value })}
                                      disabled={!newTaskForm.responsibleTeamId}
                                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)] disabled:cursor-not-allowed disabled:opacity-50"
                                      style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "white" }}
                                    >
                                      <option value="">Select PIC (Optional)</option>
                                      {users
                                        .filter((user) => {
                                          if (!newTaskForm.responsibleTeamId) return false;
                                          return user.teamMemberships?.some((m: { teamId: string }) => m.teamId === newTaskForm.responsibleTeamId);
                                        })
                                        .map((user) => (
                                          <option key={user.id} value={user.id}>
                                            {user.name}
                                          </option>
                                        ))}
                                    </select>
                                  </div>

                                  {selectedTeam?.approvalRequired && (
                                    <div>
                                      <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                        Reviewer
                                      </label>
                                      <select
                                        value={newTaskForm.reviewerId}
                                        onChange={(e) => setNewTaskForm({ ...newTaskForm, reviewerId: e.target.value })}
                                        className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                                        style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "white" }}
                                      >
                                        <option value="">Select reviewer...</option>
                                        {users.map((user) => (
                                          <option key={user.id} value={user.id}>
                                            {user.name}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                </div>

                                {/* Frequency, Risk, Quarter Row */}
                                <div className="grid grid-cols-3 gap-4">
                                  <div>
                                    <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                      Frequency
                                    </label>
                                    <select
                                      value={newTaskForm.frequency}
                                      onChange={(e) => setNewTaskForm({ ...newTaskForm, frequency: e.target.value })}
                                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                                      style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "white" }}
                                    >
                                      {FREQUENCIES.map((freq) => (
                                        <option key={freq} value={freq}>
                                          {freq.replace(/_/g, " ")}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                      Risk Rating
                                    </label>
                                    <select
                                      value={newTaskForm.riskRating}
                                      onChange={(e) => setNewTaskForm({ ...newTaskForm, riskRating: e.target.value })}
                                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                                      style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "white" }}
                                    >
                                      {RISK_RATINGS.map((rating) => (
                                        <option key={rating} value={rating}>
                                          {rating}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                      Quarter
                                    </label>
                                    <select
                                      value={newTaskForm.quarter}
                                      onChange={(e) => setNewTaskForm({ ...newTaskForm, quarter: e.target.value })}
                                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                                      style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "white" }}
                                    >
                                      <option value="">Auto (from due date)</option>
                                      {QUARTERS.map((q) => (
                                        <option key={q} value={q}>
                                          {q}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                {/* Start Date, Due Date Row */}
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                      Start Date
                                    </label>
                                    <input
                                      type="date"
                                      value={newTaskForm.startDate}
                                      onChange={(e) => setNewTaskForm({ ...newTaskForm, startDate: e.target.value })}
                                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                                      style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "white" }}
                                    />
                                  </div>

                                  <div>
                                    <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                      Due Date
                                    </label>
                                    <input
                                      type="date"
                                      value={newTaskForm.dueDate}
                                      onChange={(e) => setNewTaskForm({ ...newTaskForm, dueDate: e.target.value })}
                                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                                      style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "white" }}
                                    />
                                  </div>
                                </div>

                                {/* Toggles Row */}
                                <div className={selectedTeam?.approvalRequired ? "grid grid-cols-2 gap-4" : "grid grid-cols-1"}>
                                  <div>
                                    <label className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={newTaskForm.evidenceRequired}
                                        onChange={(e) =>
                                          setNewTaskForm({ ...newTaskForm, evidenceRequired: e.target.checked })
                                        }
                                        className="rounded"
                                      />
                                      <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                                        Evidence Required
                                      </span>
                                    </label>
                                  </div>

                                  {selectedTeam?.approvalRequired && (
                                    <div>
                                      <label className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={newTaskForm.reviewRequired}
                                          onChange={(e) =>
                                            setNewTaskForm({ ...newTaskForm, reviewRequired: e.target.checked })
                                          }
                                          className="rounded"
                                        />
                                        <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                                          Review Required
                                        </span>
                                      </label>
                                    </div>
                                  )}
                                </div>

                                {/* External Links Row */}
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                      ClickUp Link
                                    </label>
                                    <input
                                      type="url"
                                      value={newTaskForm.clickupUrl}
                                      onChange={(e) => setNewTaskForm({ ...newTaskForm, clickupUrl: e.target.value })}
                                      placeholder="https://..."
                                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                                      style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "white" }}
                                    />
                                  </div>

                                  <div>
                                    <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                      Google Drive Link
                                    </label>
                                    <input
                                      type="url"
                                      value={newTaskForm.gdriveUrl}
                                      onChange={(e) => setNewTaskForm({ ...newTaskForm, gdriveUrl: e.target.value })}
                                      placeholder="https://..."
                                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                                      style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "white" }}
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Form Actions */}
                              <div className="flex justify-end gap-3 pt-2">
                                <button
                                  onClick={() => {
                                    setAddingTaskToItemId(null);
                                    setNewTaskForm({
                                      taskName: "",
                                      taskDescription: "",
                                      expectedOutcome: "",
                                      responsibleTeamId: "",
                                      picId: "",
                                      reviewerId: "",
                                      frequency: defaultFrequency,
                                      quarter: "",
                                      riskRating: "MEDIUM",
                                      startDate: "",
                                      dueDate: "",
                                      evidenceRequired: selectedTeam?.evidenceRequired || false,
                                      reviewRequired: selectedTeam?.approvalRequired || true,
                                      clickupUrl: "",
                                      gdriveUrl: "",
                                    });
                                  }}
                                  className="h-9 rounded-lg border px-4 text-sm font-medium transition-colors"
                                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "white" }}
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleAddTaskToExistingItem(item.tempId)}
                                  className="h-9 rounded-lg px-4 text-sm font-medium text-white transition-opacity"
                                  style={{ backgroundColor: "var(--blue)" }}
                                >
                                  Add Task
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setAddingTaskToItemId(item.tempId);
                                setNewTaskForm({
                                  taskName: "",
                                  taskDescription: "",
                                  expectedOutcome: "",
                                  responsibleTeamId: "",
                                  picId: "",
                                  reviewerId: "",
                                  frequency: defaultFrequency,
                                  quarter: "",
                                  riskRating: "MEDIUM",
                                  startDate: "",
                                  dueDate: "",
                                  evidenceRequired: selectedTeam?.evidenceRequired || false,
                                  reviewRequired: selectedTeam?.approvalRequired || true,
                                  clickupUrl: "",
                                  gdriveUrl: "",
                                });
                              }}
                              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--bg-subtle)]"
                              style={{ color: "var(--blue)" }}
                            >
                              <Plus size={16} />
                              Add Another Task
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add Item Form */}
              {!showAddItemForm ? (
                <button
                  onClick={() => setShowAddItemForm(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-[14px] border-2 border-dashed p-6 text-sm font-medium transition-colors hover:bg-[var(--bg-subtle)]"
                  style={{ borderColor: "var(--border)", color: "var(--blue)" }}
                >
                  <Plus size={20} />
                  Add Item
                </button>
              ) : (
                <div className="rounded-[14px] border bg-white p-6" style={{ borderColor: "var(--border)" }}>
                  <h3 className="mb-4 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                    Add New Item
                  </h3>

                  {/* Section A: Item Details */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          Reference <span style={{ color: "var(--red)" }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={newItemForm.reference}
                          onChange={(e) => setNewItemForm({ ...newItemForm, reference: e.target.value })}
                          placeholder="e.g., Art. 12.3"
                          className="w-full rounded-lg border px-3 py-2 font-mono text-sm outline-none transition-colors focus:border-[var(--blue)]"
                          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          Title <span style={{ color: "var(--red)" }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={newItemForm.title}
                          onChange={(e) => setNewItemForm({ ...newItemForm, title: e.target.value })}
                          placeholder="e.g., Transaction Monitoring Requirements"
                          className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        Description
                      </label>
                      <textarea
                        value={newItemForm.description}
                        onChange={(e) => setNewItemForm({ ...newItemForm, description: e.target.value })}
                        rows={2}
                        placeholder="Optional description of this clause or requirement"
                        className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                        style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={newItemForm.isInformational}
                          onChange={(e) =>
                            setNewItemForm({ ...newItemForm, isInformational: e.target.checked })
                          }
                          className="rounded"
                        />
                        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          Informational only — no monitoring tasks needed
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Section B: First Task (only if not informational) */}
                  {!newItemForm.isInformational && (
                    <>
                      <div className="my-6 flex items-center gap-3">
                        <div className="h-px flex-1" style={{ backgroundColor: "var(--border)" }} />
                        <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                          Monitoring Task
                        </span>
                        <div className="h-px flex-1" style={{ backgroundColor: "var(--border)" }} />
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            Task Name <span style={{ color: "var(--red)" }}>*</span>
                          </label>
                          <input
                            type="text"
                            value={newItemForm.taskName}
                            onChange={(e) => setNewItemForm({ ...newItemForm, taskName: e.target.value })}
                            placeholder="e.g., Monthly Transaction Monitoring Review"
                            className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            Task Description
                          </label>
                          <textarea
                            value={newItemForm.taskDescription}
                            onChange={(e) => setNewItemForm({ ...newItemForm, taskDescription: e.target.value })}
                            rows={2}
                            placeholder="Optional task description"
                            className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            Expected Outcome
                          </label>
                          <textarea
                            value={newItemForm.expectedOutcome}
                            onChange={(e) => setNewItemForm({ ...newItemForm, expectedOutcome: e.target.value })}
                            rows={2}
                            placeholder="What should be achieved when this task is completed"
                            className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                          />
                        </div>

                        {/* Department/Team Responsible, PIC, Reviewer Row */}
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                              Department / Team Responsible
                            </label>
                            <select
                              value={newItemForm.responsibleTeamId}
                              onChange={(e) => setNewItemForm({ ...newItemForm, responsibleTeamId: e.target.value })}
                              className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                            >
                              <option value="">Select team...</option>
                              {teams.map((team) => (
                                <option key={team.id} value={team.id}>
                                  {team.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                              Person in Charge (PIC)
                            </label>
                            <select
                              value={newItemForm.picId}
                              onChange={(e) => setNewItemForm({ ...newItemForm, picId: e.target.value })}
                              className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                            >
                              <option value="">Select PIC...</option>
                              {users.map((user) => (
                                <option key={user.id} value={user.id}>
                                  {user.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {selectedTeam?.approvalRequired && (
                            <div>
                              <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                Reviewer
                              </label>
                              <select
                                value={newItemForm.reviewerId}
                                onChange={(e) => setNewItemForm({ ...newItemForm, reviewerId: e.target.value })}
                                className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                              >
                                <option value="">Select reviewer...</option>
                                {users.map((user) => (
                                  <option key={user.id} value={user.id}>
                                    {user.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>

                        {/* Frequency, Risk, Quarter Row */}
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                              Frequency
                            </label>
                            <select
                              value={newItemForm.frequency}
                              onChange={(e) => setNewItemForm({ ...newItemForm, frequency: e.target.value })}
                              className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                            >
                              {FREQUENCIES.map((freq) => (
                                <option key={freq} value={freq}>
                                  {freq.replace(/_/g, " ")}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                              Risk Rating
                            </label>
                            <select
                              value={newItemForm.riskRating}
                              onChange={(e) => setNewItemForm({ ...newItemForm, riskRating: e.target.value })}
                              className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                            >
                              {RISK_RATINGS.map((rating) => (
                                <option key={rating} value={rating}>
                                  {rating}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                              Quarter
                            </label>
                            <select
                              value={newItemForm.quarter}
                              onChange={(e) => setNewItemForm({ ...newItemForm, quarter: e.target.value })}
                              className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                            >
                              <option value="">Auto (from due date)</option>
                              {QUARTERS.map((q) => (
                                <option key={q} value={q}>
                                  {q}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Start Date, Due Date Row */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                              Start Date
                            </label>
                            <input
                              type="date"
                              value={newItemForm.startDate}
                              onChange={(e) => setNewItemForm({ ...newItemForm, startDate: e.target.value })}
                              className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                              Due Date
                            </label>
                            <input
                              type="date"
                              value={newItemForm.dueDate}
                              onChange={(e) => setNewItemForm({ ...newItemForm, dueDate: e.target.value })}
                              className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                            />
                          </div>
                        </div>

                        {/* Toggles Row */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={newItemForm.evidenceRequired}
                                onChange={(e) =>
                                  setNewItemForm({ ...newItemForm, evidenceRequired: e.target.checked })
                                }
                                className="rounded"
                              />
                              <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                                Evidence Required
                              </span>
                            </label>
                          </div>

                          {selectedTeam?.approvalRequired && (
                            <div>
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={newItemForm.reviewRequired}
                                  onChange={(e) =>
                                    setNewItemForm({ ...newItemForm, reviewRequired: e.target.checked })
                                  }
                                  className="rounded"
                                />
                                <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                                  Review Required
                                </span>
                              </label>
                            </div>
                          )}
                        </div>

                        {/* External Links Row */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                              ClickUp Link
                            </label>
                            <input
                              type="url"
                              value={newItemForm.clickupUrl}
                              onChange={(e) => setNewItemForm({ ...newItemForm, clickupUrl: e.target.value })}
                              placeholder="https://..."
                              className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                              Google Drive Link
                            </label>
                            <input
                              type="url"
                              value={newItemForm.gdriveUrl}
                              onChange={(e) => setNewItemForm({ ...newItemForm, gdriveUrl: e.target.value })}
                              placeholder="https://..."
                              className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Form Actions */}
                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      onClick={() => {
                        setShowAddItemForm(false);
                        setNewItemForm({
                          reference: "",
                          title: "",
                          description: "",
                          isInformational: false,
                          taskName: "",
                          taskDescription: "",
                          expectedOutcome: "",
                          responsibleTeamId: "",
                          picId: "",
                          reviewerId: "",
                          frequency: defaultFrequency,
                          quarter: "",
                          riskRating: "MEDIUM",
                          startDate: "",
                          dueDate: "",
                          evidenceRequired: selectedTeam?.evidenceRequired || false,
                          reviewRequired: selectedTeam?.approvalRequired || true,
                          clickupUrl: "",
                          gdriveUrl: "",
                        });
                      }}
                      className="h-10 rounded-lg border px-4 text-sm font-medium transition-colors"
                      style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddItem}
                      className="h-10 rounded-lg px-4 text-sm font-medium text-white transition-opacity"
                      style={{ backgroundColor: "var(--blue)" }}
                    >
                      {newItemForm.isInformational ? "Add Item" : "Add Item & Task"}
                    </button>
                  </div>
                </div>
              )}
                </div>
              )}

              {/* Shared Items Display - only for one-by-one mode */}
              {items.length > 0 && inputMethod === "one-by-one" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      Added Items ({items.length})
                    </h4>
                  </div>
                  
                  {items.map((item) => (
                    <div
                      key={item.tempId}
                      className="rounded-[14px] border bg-white p-4"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span
                              className="font-mono text-sm font-medium"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {item.reference}
                            </span>
                            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                              {item.title}
                            </span>
                            {item.isInformational ? (
                              <span
                                className="rounded-full px-2 py-0.5 text-xs"
                                style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-muted)" }}
                              >
                                Informational — no tasks
                              </span>
                            ) : (
                              <span
                                className="rounded-full px-2 py-0.5 text-xs font-medium"
                                style={{ backgroundColor: "var(--blue-light)", color: "var(--blue)" }}
                              >
                                {item.tasks.length} task{item.tasks.length !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                              {item.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setItems((prev) =>
                                prev.map((i) =>
                                  i.tempId === item.tempId ? { ...i, expanded: !i.expanded } : i
                                )
                              )
                            }
                            className="rounded-lg p-1 transition-colors hover:bg-[var(--bg-subtle)]"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            <ChevronDown
                              size={20}
                              style={{
                                transform: item.expanded ? "rotate(180deg)" : "rotate(0deg)",
                                transition: "transform 0.2s",
                              }}
                            />
                          </button>
                          <button
                            onClick={() => setItems((prev) => prev.filter((i) => i.tempId !== item.tempId))}
                            className="rounded-lg p-1 transition-colors hover:bg-[var(--red-light)]"
                            style={{ color: "var(--red)" }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {item.expanded && !item.isInformational && (
                        <div className="mt-4 space-y-2 border-t pt-4" style={{ borderColor: "var(--border-light)" }}>
                          {item.tasks.map((task) => (
                            <div
                              key={task.tempId}
                              className="flex items-start justify-between rounded-lg p-3"
                              style={{ backgroundColor: "var(--bg-subtle)" }}
                            >
                              <div className="flex-1">
                                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                  {task.name}
                                </p>
                                <div className="mt-1 flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                                  <span>
                                    {task.responsibleTeamId
                                      ? teams.find((t) => t.id === task.responsibleTeamId)?.name || "Unknown"
                                      : "No team assigned"}
                                  </span>
                                  <span>•</span>
                                  <span>{task.frequency.replace(/_/g, " ")}</span>
                                  {task.quarter && (
                                    <>
                                      <span>•</span>
                                      <span>{task.quarter}</span>
                                    </>
                                  )}
                                  <span>•</span>
                                  <span>{task.riskRating}</span>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteTask(item.tempId, task.tempId)}
                                className="rounded-lg p-1 transition-colors hover:bg-[var(--red-light)]"
                                style={{ color: "var(--red)" }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Applicable Entities Info Bar */}
              <div
                className="flex items-center gap-2 rounded-lg p-3"
                style={{ backgroundColor: "var(--blue-light)" }}
              >
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  Applicable to:
                </span>
                <div className="flex gap-1">
                  {selectedEntityIds.map((entityId) => {
                    const entity = entities.find((e) => e.id === entityId);
                    if (!entity) return null;
                    return <EntityBadge key={entityId} entityCode={entity.code as "DIEL" | "DGL" | "DBVI" | "FINSERV" | "GROUP"} />;
                  })}
                </div>
              </div>

              {/* Review Table */}
              <div className="rounded-[14px] border bg-white" style={{ borderColor: "var(--border)" }}>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b" style={{ borderColor: "var(--border-light)", backgroundColor: "var(--bg-subtle)" }}>
                        <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                          <input type="checkbox" className="rounded" />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                          Item Ref
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                          Task Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                          Team
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                          PIC
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                          Frequency
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                          Risk
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                          Quarter
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                          Due Date
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                          Evidence
                        </th>
                        {selectedTeam?.approvalRequired && (
                          <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                            Review
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {items.flatMap((item) =>
                        item.tasks.map((task) => (
                          <tr
                            key={task.tempId}
                            className="border-t transition-colors hover:bg-[var(--bg-hover)]"
                            style={{
                              borderColor: "var(--border-light)",
                              backgroundColor: !task.dueDate ? "var(--amber-light)" : "transparent",
                            }}
                          >
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                className="rounded"
                                checked={selectedTaskIds.has(task.tempId)}
                                onChange={(e) => {
                                  const newSet = new Set(selectedTaskIds);
                                  if (e.target.checked) {
                                    newSet.add(task.tempId);
                                  } else {
                                    newSet.delete(task.tempId);
                                  }
                                  setSelectedTaskIds(newSet);
                                }}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-mono text-sm" style={{ color: "var(--text-primary)" }}>
                                {item.reference}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                                {task.name}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className="text-sm"
                                style={{
                                  color: task.responsibleTeamId ? "var(--text-secondary)" : "var(--amber)",
                                }}
                              >
                                {task.responsibleTeamId
                                  ? teams.find((t) => t.id === task.responsibleTeamId)?.name || "Unknown"
                                  : "Not assigned"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                                {task.picId ? users.find((u) => u.id === task.picId)?.name || "—" : "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                                {task.frequency.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className="rounded-full px-2 py-0.5 text-xs font-medium"
                                style={{
                                  backgroundColor:
                                    task.riskRating === "HIGH"
                                      ? "var(--red-light)"
                                      : task.riskRating === "MEDIUM"
                                      ? "var(--amber-light)"
                                      : "var(--green-light)",
                                  color:
                                    task.riskRating === "HIGH"
                                      ? "var(--red)"
                                      : task.riskRating === "MEDIUM"
                                      ? "var(--amber)"
                                      : "var(--green)",
                                }}
                              >
                                {task.riskRating}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                                {task.quarter || "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                                {task.dueDate || "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {task.evidenceRequired && <CheckCircle size={16} style={{ color: "var(--green)", margin: "0 auto" }} />}
                            </td>
                            {selectedTeam?.approvalRequired && (
                              <td className="px-4 py-3 text-center">
                                {task.reviewRequired && <CheckCircle size={16} style={{ color: "var(--blue)", margin: "0 auto" }} />}
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bulk Actions Bar */}
              {selectedTaskIds.size > 0 && (
                <div
                  className="flex items-center justify-between rounded-lg p-4"
                  style={{ backgroundColor: "var(--blue-light)", borderColor: "var(--blue-mid)" }}
                >
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {selectedTaskIds.size} task{selectedTaskIds.size !== 1 ? "s" : ""} selected
                  </span>
                  <div className="flex gap-2">
                    {/* Bulk Set Responsible Team */}
                    <div className="relative">
                      <button
                        onClick={() => {
                          setBulkAssignOpen(!bulkAssignOpen);
                          setBulkPICOpen(false);
                          setBulkDueDateOpen(false);
                          setBulkQuarterOpen(false);
                        }}
                        className="flex h-9 items-center gap-1.5 rounded-lg border px-4 text-sm font-medium transition-colors"
                        style={{ borderColor: "var(--border)", backgroundColor: "white", color: "var(--text-secondary)" }}
                      >
                        Set Team...
                        <ChevronDown size={14} />
                      </button>
                      {bulkAssignOpen && (
                        <div
                          className="absolute right-0 z-20 mt-1 w-64 rounded-lg border bg-white shadow-lg"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <div className="max-h-60 overflow-y-auto p-2">
                            {teams.map((team) => (
                              <button
                                key={team.id}
                                onClick={() => handleBulkAssign(team.id)}
                                className="w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--bg-subtle)]"
                                style={{ color: "var(--text-primary)" }}
                              >
                                {team.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bulk Set PIC */}
                    <div className="relative">
                      <button
                        onClick={() => {
                          setBulkPICOpen(!bulkPICOpen);
                          setBulkAssignOpen(false);
                          setBulkDueDateOpen(false);
                          setBulkQuarterOpen(false);
                        }}
                        className="flex h-9 items-center gap-1.5 rounded-lg border px-4 text-sm font-medium transition-colors"
                        style={{ borderColor: "var(--border)", backgroundColor: "white", color: "var(--text-secondary)" }}
                      >
                        Set PIC...
                        <ChevronDown size={14} />
                      </button>
                      {bulkPICOpen && (
                        <div
                          className="absolute right-0 z-20 mt-1 w-64 rounded-lg border bg-white shadow-lg"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <div className="max-h-60 overflow-y-auto p-2">
                            {users.map((user) => (
                              <button
                                key={user.id}
                                onClick={() => handleBulkSetPIC(user.id)}
                                className="w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--bg-subtle)]"
                                style={{ color: "var(--text-primary)" }}
                              >
                                {user.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bulk Set Due Date */}
                    <div className="relative">
                      <button
                        onClick={() => {
                          setBulkDueDateOpen(!bulkDueDateOpen);
                          setBulkAssignOpen(false);
                          setBulkPICOpen(false);
                          setBulkQuarterOpen(false);
                        }}
                        className="flex h-9 items-center gap-1.5 rounded-lg border px-4 text-sm font-medium transition-colors"
                        style={{ borderColor: "var(--border)", backgroundColor: "white", color: "var(--text-secondary)" }}
                      >
                        Set Due Date...
                        <ChevronDown size={14} />
                      </button>
                      {bulkDueDateOpen && (
                        <div
                          className="absolute right-0 z-20 mt-1 w-72 rounded-lg border bg-white p-4 shadow-lg"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            Select due date
                          </label>
                          <input
                            type="date"
                            value={bulkDueDateValue}
                            onChange={(e) => setBulkDueDateValue(e.target.value)}
                            className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                            style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "white" }}
                          />
                          <div className="mt-3 flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setBulkDueDateOpen(false);
                                setBulkDueDateValue("");
                              }}
                              className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors"
                              style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "white" }}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleBulkSetDueDate}
                              className="rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-opacity"
                              style={{ backgroundColor: "var(--blue)" }}
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bulk Set Quarter */}
                    <div className="relative">
                      <button
                        onClick={() => {
                          setBulkQuarterOpen(!bulkQuarterOpen);
                          setBulkAssignOpen(false);
                          setBulkPICOpen(false);
                          setBulkDueDateOpen(false);
                        }}
                        className="flex h-9 items-center gap-1.5 rounded-lg border px-4 text-sm font-medium transition-colors"
                        style={{ borderColor: "var(--border)", backgroundColor: "white", color: "var(--text-secondary)" }}
                      >
                        Set Quarter...
                        <ChevronDown size={14} />
                      </button>
                      {bulkQuarterOpen && (
                        <div
                          className="absolute right-0 z-20 mt-1 w-40 rounded-lg border bg-white shadow-lg"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <div className="p-2">
                            {QUARTERS.map((q) => (
                              <button
                                key={q}
                                onClick={() => handleBulkSetQuarter(q)}
                                className="w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--bg-subtle)]"
                                style={{ color: "var(--text-primary)" }}
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Generate */}
          {step === 4 && (
            <div className="space-y-6">
              {/* Preview */}
              <div className="rounded-[14px] border bg-white p-6" style={{ borderColor: "var(--border)" }}>
                <h3 className="mb-4 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                  Generation Preview
                </h3>
                <div className="flex items-center justify-center gap-3 py-8">
                  <div className="text-center">
                    <div className="text-4xl font-bold" style={{ color: "var(--blue)" }}>
                      {generationPreview.taskDefinitions}
                    </div>
                    <div className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                      Task Definitions
                    </div>
                  </div>

                  <span className="text-3xl" style={{ color: "var(--text-muted)" }}>
                    ×
                  </span>

                  <div className="text-center">
                    <div className="text-4xl font-bold" style={{ color: "var(--purple)" }}>
                      {generationPreview.entities}
                    </div>
                    <div className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                      Entities
                    </div>
                  </div>

                  <span className="text-3xl" style={{ color: "var(--text-muted)" }}>
                    =
                  </span>

                  <div className="text-center">
                    <div className="text-4xl font-bold" style={{ color: "var(--green)" }}>
                      {generationPreview.totalTasks}
                    </div>
                    <div className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                      Total Tasks
                    </div>
                  </div>
                </div>
              </div>

              {/* Validation Summary */}
              <div className="space-y-3">
                {/* Blocking Issues */}
                {items.some((item) => !item.reference || (!item.isInformational && item.tasks.some((t) => !t.name))) && (
                  <div
                    className="flex items-start gap-3 rounded-lg border p-4"
                    style={{ borderColor: "var(--red)", backgroundColor: "var(--red-light)" }}
                  >
                    <AlertCircle size={20} style={{ color: "var(--red)", flexShrink: 0, marginTop: 2 }} />
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: "var(--red)" }}>
                        Blocking Issues — Cannot Proceed
                      </p>
                      <ul className="mt-2 list-inside list-disc space-y-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                        {items.filter((item) => !item.reference).length > 0 && (
                          <li>{items.filter((item) => !item.reference).length} item(s) without a reference</li>
                        )}
                        {items.flatMap((item) => item.tasks.filter((t) => !t.name)).length > 0 && (
                          <li>{items.flatMap((item) => item.tasks.filter((t) => !t.name)).length} task(s) without a name</li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Warnings */}
                {items.flatMap((item) => item.tasks).some((t) => !t.responsibleTeamId || !t.dueDate) && (
                  <div
                    className="flex items-start gap-3 rounded-lg border p-4"
                    style={{ borderColor: "var(--amber)", backgroundColor: "var(--amber-light)" }}
                  >
                    <AlertCircle size={20} style={{ color: "var(--amber)", flexShrink: 0, marginTop: 2 }} />
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: "var(--amber)" }}>
                        Warnings — Can Proceed
                      </p>
                      <ul className="mt-2 list-inside list-disc space-y-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                        {items.flatMap((item) => item.tasks).filter((t) => !t.responsibleTeamId).length > 0 && (
                          <li>{items.flatMap((item) => item.tasks).filter((t) => !t.responsibleTeamId).length} task(s) without responsible team</li>
                        )}
                        {items.flatMap((item) => item.tasks).filter((t) => !t.dueDate).length > 0 && (
                          <li>{items.flatMap((item) => item.tasks).filter((t) => !t.dueDate).length} task(s) without due date</li>
                        )}
                        {items.filter((item) => item.isInformational).length > 0 && (
                          <li>{items.filter((item) => item.isInformational).length} informational item(s) with no tasks</li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Success State */}
                {!items.some((item) => !item.reference || (!item.isInformational && item.tasks.some((t) => !t.name))) &&
                  items.flatMap((item) => item.tasks).every((t) => t.responsibleTeamId && t.dueDate) && (
                    <div
                      className="flex items-start gap-3 rounded-lg border p-4"
                      style={{ borderColor: "var(--green)", backgroundColor: "var(--green-light)" }}
                    >
                      <CheckCircle size={20} style={{ color: "var(--green)", flexShrink: 0, marginTop: 2 }} />
                      <div className="flex-1">
                        <p className="text-sm font-medium" style={{ color: "var(--green)" }}>
                          Ready to Generate
                        </p>
                        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                          All tasks have required fields. You can proceed with generation.
                        </p>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          )}
        </div>

        {/* Fixed Footer */}
        <div
          className="flex flex-shrink-0 items-center justify-between border-t p-6"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            onClick={step === 1 ? onClose : () => setStep(step - 1)}
            className="flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            <ChevronLeft size={16} />
            {step === 1 ? "Cancel" : "Back"}
          </button>

          {step < 4 ? (
            <button
              onClick={step === 1 ? handleStep1Next : step === 2 ? handleStep2Next : handleStep3Next}
              disabled={loading}
              className="flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium text-white transition-opacity disabled:opacity-40"
              style={{ backgroundColor: "var(--blue)" }}
            >
              {step === 1 && loading ? "Saving..." : "Next"}
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium text-white transition-opacity disabled:opacity-40"
              style={{ backgroundColor: "var(--green)" }}
            >
              {loading ? "Generating..." : "Generate Tasks"}
              <CheckCircle size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
