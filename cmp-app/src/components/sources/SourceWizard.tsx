"use client";

import { useState, useEffect } from "react";
import { X, ChevronRight, ChevronLeft, AlertCircle, CheckCircle, Plus, Trash2, ChevronDown } from "lucide-react";
import { EntityBadge } from "@/components/ui/EntityBadge";
import toast from "react-hot-toast";

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
  assigneeId: string;
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
  tempId: string;
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
  const [newItemForm, setNewItemForm] = useState({
    reference: "",
    title: "",
    description: "",
    isInformational: false,
    taskName: "",
    taskDescription: "",
    expectedOutcome: "",
    assigneeId: "",
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
    assigneeId: "",
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

  // Auto-generate source code from name
  useEffect(() => {
    if (!existingSource && sourceName && !sourceCode) {
      const generated = generateSourceCode(sourceName);
      setSourceCode(generated);
    }
  }, [sourceName, existingSource, sourceCode]);

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

        await res.json();
        toast.success("Source draft created");
        // Store source ID for later steps
        // For now, just move to step 2
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
              assigneeId: newItemForm.assigneeId,
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
      assigneeId: "",
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

  const handleAddTaskToExistingItem = (itemTempId: string) => {
    // Validation
    if (!newTaskForm.taskName) {
      toast.error("Task name is required");
      return;
    }

    const taskTempId = `task-${Date.now()}-${Math.random()}`;

    const newTask: TaskDefinition = {
      tempId: taskTempId,
      name: newTaskForm.taskName,
      description: newTaskForm.taskDescription,
      expectedOutcome: newTaskForm.expectedOutcome,
      assigneeId: newTaskForm.assigneeId,
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
      assigneeId: "",
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
  const handleBulkAssign = (userId: string) => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        tasks: item.tasks.map((task) =>
          selectedTaskIds.has(task.tempId) ? { ...task, assigneeId: userId } : task
        ),
      }))
    );
    setBulkAssignOpen(false);
    toast.success(`Assigned ${selectedTaskIds.size} task${selectedTaskIds.size !== 1 ? "s" : ""}`);
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
    // TODO: Implement generation logic
    toast.success("Source generation coming soon!");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="relative w-full max-w-6xl rounded-[20px] bg-white shadow-2xl"
        style={{ maxHeight: "90vh", overflow: "hidden" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b p-6" style={{ borderColor: "var(--border)" }}>
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
          <div className="flex items-center justify-center gap-2 border-b px-6 py-4" style={{ borderColor: "var(--border)" }}>
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

        {/* Content */}
        <div className="overflow-y-auto p-6" style={{ maxHeight: "calc(90vh - 200px)" }}>
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
                    onChange={(e) => {
                      setSourceCode(e.target.value.toUpperCase());
                      setSourceCodeError(""); // Clear error on change
                    }}
                    onBlur={handleSourceCodeBlur}
                    placeholder="Auto-generates from name"
                    className="w-full rounded-lg border px-3 py-2 font-mono text-sm outline-none transition-colors focus:border-[var(--blue)]"
                    style={{
                      borderColor: sourceCodeError ? "var(--red)" : "var(--border)",
                      color: "var(--text-primary)",
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
                                    {task.assigneeId
                                      ? users.find((u) => u.id === task.assigneeId)?.name || "Unknown"
                                      : "Unassigned"}
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

                                {/* Assignee, PIC, Reviewer Row */}
                                <div className={selectedTeam?.approvalRequired ? "grid grid-cols-3 gap-4" : "grid grid-cols-2 gap-4"}>
                                  <div>
                                    <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                      Assignee
                                    </label>
                                    <select
                                      value={newTaskForm.assigneeId}
                                      onChange={(e) => setNewTaskForm({ ...newTaskForm, assigneeId: e.target.value })}
                                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                                      style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "white" }}
                                    >
                                      <option value="">Select assignee...</option>
                                      {users.map((user) => (
                                        <option key={user.id} value={user.id}>
                                          {user.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                      PIC
                                    </label>
                                    <select
                                      value={newTaskForm.picId}
                                      onChange={(e) => setNewTaskForm({ ...newTaskForm, picId: e.target.value })}
                                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                                      style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "white" }}
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
                                      assigneeId: "",
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
                                  assigneeId: "",
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

                        {/* Assignee, PIC, Reviewer Row */}
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                              Assignee
                            </label>
                            <select
                              value={newItemForm.assigneeId}
                              onChange={(e) => setNewItemForm({ ...newItemForm, assigneeId: e.target.value })}
                              className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
                              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                            >
                              <option value="">Select assignee...</option>
                              {users.map((user) => (
                                <option key={user.id} value={user.id}>
                                  {user.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                              PIC
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
                          assigneeId: "",
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
                          Assignee
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
                                  color: task.assigneeId ? "var(--text-secondary)" : "var(--amber)",
                                }}
                              >
                                {task.assigneeId
                                  ? users.find((u) => u.id === task.assigneeId)?.name || "Unknown"
                                  : "Unassigned"}
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
                    {/* Bulk Assign */}
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
                        Assign to...
                        <ChevronDown size={14} />
                      </button>
                      {bulkAssignOpen && (
                        <div
                          className="absolute right-0 z-20 mt-1 w-64 rounded-lg border bg-white shadow-lg"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <div className="max-h-60 overflow-y-auto p-2">
                            {users.map((user) => (
                              <button
                                key={user.id}
                                onClick={() => handleBulkAssign(user.id)}
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
                {items.flatMap((item) => item.tasks).some((t) => !t.assigneeId || !t.dueDate) && (
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
                        {items.flatMap((item) => item.tasks).filter((t) => !t.assigneeId).length > 0 && (
                          <li>{items.flatMap((item) => item.tasks).filter((t) => !t.assigneeId).length} task(s) without assignee</li>
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
                  items.flatMap((item) => item.tasks).every((t) => t.assigneeId && t.dueDate) && (
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

        {/* Footer */}
        <div
          className="flex items-center justify-between border-t p-6"
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
