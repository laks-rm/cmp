"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { SourceDetailsSection } from "./SourceDetailsSection";
import { ClausesTasksSection } from "./ClausesTasksSection";
import { GenerationConfirmModal } from "./GenerationConfirmModal";
import type { Team, User, Entity, IssuingAuthority, ItemWithTasks, MonitoringArea, TaskType } from "@/types/source-management";
import { ITEM_LABEL_MAP } from "@/types/source-management";
import toast from "@/lib/toast";

export function SourceCreateClient() {
  const router = useRouter();
  
  // Reference data
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [issuingAuthorities, setIssuingAuthorities] = useState<IssuingAuthority[]>([]);
  const [monitoringAreas, setMonitoringAreas] = useState<MonitoringArea[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  
  // Source details state
  const [detailsMode, setDetailsMode] = useState<"edit" | "collapsed">("edit");
  const [sourceType, setSourceType] = useState("REGULATION");
  const [sourceName, setSourceName] = useState("");
  const [sourceCode, setSourceCode] = useState("");
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const [teamId, setTeamId] = useState("");
  const [issuingAuthorityId, setIssuingAuthorityId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  
  // Clauses and tasks state
  const [items, setItems] = useState<ItemWithTasks[]>([]);
  
  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch reference data
  useEffect(() => {
    fetchTeams();
    fetchUsers();
    fetchEntities();
    fetchIssuingAuthorities();
    fetchMonitoringAreas();
    fetchTaskTypes();
  }, []);

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

  const fetchMonitoringAreas = async () => {
    try {
      const res = await fetch("/api/monitoring-areas");
      if (res.ok) {
        const data = await res.json();
        setMonitoringAreas(data.monitoringAreas);
      }
    } catch (error) {
      console.error("Failed to fetch monitoring areas:", error);
    }
  };

  const fetchTaskTypes = async () => {
    try {
      const res = await fetch("/api/task-types");
      if (res.ok) {
        const data = await res.json();
        setTaskTypes(data.taskTypes);
      }
    } catch (error) {
      console.error("Failed to fetch task types:", error);
    }
  };

  const handleDetailsSave = () => {
    if (!sourceName.trim()) {
      toast.error("Source name is required");
      return;
    }
    if (selectedEntityIds.length === 0) {
      toast.error("Please select at least one entity");
      return;
    }
    if (!teamId) {
      toast.error("Please select a team");
      return;
    }
    
    setDetailsMode("collapsed");
    toast.success("Source details saved");
  };

  const handleDetailsChange = (field: string, value: string | string[]) => {
    switch (field) {
      case "sourceType":
        setSourceType(value as string);
        break;
      case "sourceName":
        setSourceName(value as string);
        break;
      case "sourceCode":
        setSourceCode(value as string);
        break;
      case "selectedEntityIds":
        setSelectedEntityIds(value as string[]);
        break;
      case "teamId":
        setTeamId(value as string);
        break;
      case "issuingAuthorityId":
        setIssuingAuthorityId(value as string);
        break;
      case "effectiveDate":
        setEffectiveDate(value as string);
        break;
      case "reviewDate":
        setReviewDate(value as string);
        break;
    }
  };

  const handleSaveDraft = async () => {
    try {
      // Step 1: Create the source
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
          teamId,
          entityIds: selectedEntityIds,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save draft");
      }

      const source = await res.json();

      // Step 2: Create clauses (SourceItems) and save task definitions in metadata
      if (items.length > 0) {
        for (const item of items) {
          // Create the SourceItem
          const itemRes = await fetch("/api/sources/items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceId: source.id,
              reference: item.reference,
              title: item.title,
              description: item.description || "",
              sortOrder: items.indexOf(item),
            }),
          });

          if (!itemRes.ok) {
            const data = await itemRes.json();
            throw new Error(data.error || "Failed to create clause");
          }

          const createdItem = await itemRes.json();

          // Save task definitions in metadata if there are any
          if (item.tasks.length > 0) {
            const metadataRes = await fetch(`/api/sources/${source.id}/items/${createdItem.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                metadata: {
                  pendingTasks: item.tasks,
                },
              }),
            });

            if (!metadataRes.ok) {
              const data = await metadataRes.json();
              throw new Error(data.error || "Failed to save task definitions");
            }
          }
        }
      }

      toast.success("Draft saved with all clauses and task definitions");
      router.replace(`/sources/${source.id}`);
    } catch (error) {
      console.error("Save draft error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save draft");
    }
  };

  const handleReviewGenerate = () => {
    if (items.length === 0) {
      toast.error("Please add at least one clause");
      return;
    }
    
    const totalTasks = items.reduce((sum, item) => sum + item.tasks.length, 0);
    if (totalTasks === 0) {
      toast.error("Please add at least one task");
      return;
    }
    
    setShowConfirmModal(true);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      // Step 1: Create the source
      const createRes = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: sourceCode,
          name: sourceName,
          sourceType,
          issuingAuthorityId: issuingAuthorityId || null,
          effectiveDate: effectiveDate || null,
          reviewDate: reviewDate || null,
          teamId,
          entityIds: selectedEntityIds,
        }),
      });

      if (!createRes.ok) {
        const data = await createRes.json();
        throw new Error(data.error || "Failed to create source");
      }

      const source = await createRes.json();

      // Step 2: Generate items and tasks
      const generatePayload = {
        items: items.map((item, index) => ({
          item: {
            reference: item.reference,
            title: item.title,
            description: item.description || "",
            parentId: undefined,
            sortOrder: index,
          },
          tasks: item.tasks.flatMap((task) =>
            selectedEntityIds.map((entityId) => ({
              name: task.name,
              description: task.description || "",
              expectedOutcome: task.expectedOutcome || "",
              entityId,
              frequency: task.frequency,
              quarter: task.quarter || undefined,
              riskRating: task.riskRating,
              assigneeId: "",
              responsibleTeamId: task.responsibleTeamId || "",
              picId: task.picId || "",
              reviewerId: task.reviewerId || "",
              startDate: task.startDate || "",
              dueDate: task.dueDate || "",
              testingPeriodStart: task.testingPeriodStart || "",
              testingPeriodEnd: task.testingPeriodEnd || "",
              monitoringAreaId: task.monitoringAreaId || undefined,
              taskTypeId: task.taskTypeId || undefined,
              evidenceRequired: task.evidenceRequired,
              narrativeRequired: false,
              reviewRequired: task.reviewRequired,
              clickupUrl: task.clickupUrl || "",
              gdriveUrl: task.gdriveUrl || "",
            }))
          ),
        })),
      };

      const generateRes = await fetch(`/api/sources/${source.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(generatePayload),
      });

      if (!generateRes.ok) {
        const data = await generateRes.json();
        throw new Error(data.error || "Failed to generate tasks");
      }

      const result = await generateRes.json();
      toast.success(`Generated ${result.tasksCreated} tasks from ${result.itemsCreated} items`);
      router.push(`/sources/${source.id}`);
    } catch (error) {
      console.error("Generation error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate source");
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedEntities = entities.filter((e) => selectedEntityIds.includes(e.id));
  const selectedTeam = teams.find((t) => t.id === teamId);
  const selectedAuthority = issuingAuthorities.find((a) => a.id === issuingAuthorityId);
  const itemLabel = ITEM_LABEL_MAP[sourceType] || { singular: "Clause", plural: "Clauses" };
  const totalTasks = items.reduce((sum, item) => sum + item.tasks.length, 0);
  const totalTasksToGenerate = totalTasks * selectedEntityIds.length;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
          <button
            onClick={() => router.push("/sources")}
            className="transition-colors hover:text-[var(--blue)]"
          >
            Sources
          </button>
          <ChevronRight size={14} />
          <span style={{ color: "var(--text-primary)" }}>New source</span>
        </div>

        {/* Page Title */}
        <h1 className="mb-8 text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
          Create New Source
        </h1>

        {/* Source Details Section */}
        <div className="mb-6">
          <SourceDetailsSection
            mode={detailsMode}
            sourceType={sourceType}
            sourceName={sourceName}
            sourceCode={sourceCode}
            selectedEntityIds={selectedEntityIds}
            teamId={teamId}
            issuingAuthorityId={issuingAuthorityId}
            effectiveDate={effectiveDate}
            reviewDate={reviewDate}
            teams={teams}
            entities={entities}
            issuingAuthorities={issuingAuthorities}
            onSave={handleDetailsSave}
            onCancel={() => setDetailsMode("edit")}
            onChange={handleDetailsChange}
          />
        </div>

        {/* Clauses & Tasks Section */}
        <div className="mb-6">
          <ClausesTasksSection
            sourceType={sourceType}
            items={items}
            onChange={setItems}
            selectedEntities={selectedEntities}
            teams={teams}
            users={users}
            monitoringAreas={monitoringAreas}
            taskTypes={taskTypes}
            disabled={detailsMode === "edit"}
          />
        </div>

        {/* Sticky Bottom Bar */}
        {detailsMode === "collapsed" && (
          <div
            className="fixed bottom-0 left-0 right-0 border-t bg-white shadow-lg"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
              <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  {items.length}
                </span>{" "}
                {items.length === 1 ? itemLabel.singular.toLowerCase() : itemLabel.plural.toLowerCase()},{" "}
                <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  {totalTasks}
                </span>{" "}
                tasks × {" "}
                <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  {selectedEntityIds.length}
                </span>{" "}
                entities = {" "}
                <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  {totalTasksToGenerate}
                </span>{" "}
                tasks to generate
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveDraft}
                  className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  Save draft
                </button>
                <button
                  onClick={handleReviewGenerate}
                  disabled={items.length === 0 || totalTasks === 0}
                  className="rounded-lg px-6 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
                  style={{ backgroundColor: "var(--green)" }}
                >
                  Review & generate
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add bottom padding to account for sticky bar */}
        {detailsMode === "collapsed" && <div className="h-20" />}
      </div>

      {/* Confirmation Modal */}
      <GenerationConfirmModal
        isOpen={showConfirmModal}
        sourceName={sourceName}
        sourceCode={sourceCode}
        sourceType={sourceType}
        selectedEntities={selectedEntities}
        authorityName={selectedAuthority?.abbreviation || selectedAuthority?.name}
        teamName={selectedTeam?.name || ""}
        items={items}
        monitoringAreas={monitoringAreas}
        taskTypes={taskTypes}
        onConfirm={handleGenerate}
        onCancel={() => setShowConfirmModal(false)}
        isGenerating={isGenerating}
      />
    </div>
  );
}
