# SourceWizard Refactoring Implementation Guide

## Overview

This guide provides a step-by-step approach to refactor the 4,548-line monolithic `SourceWizard.tsx` into a maintainable, modular structure.

**Current State:** ✅ Foundation files created (types.ts, constants.ts)  
**Next Steps:** Create custom hooks, components, and orchestrator

---

## Phase 1: Foundation (✅ COMPLETE)

### Files Created:
- ✅ `types.ts` - All shared TypeScript types
- ✅ `constants.ts` - All constants and configuration

---

## Phase 2: Custom Hooks (TODO)

### 2.1 Create `hooks/useSourceWizard.ts`

**Purpose:** Main state management for the entire wizard

**State to Extract:**
```typescript
// From lines 102-184 of original file
- step, setStep
- loading, setLoading
- createdSourceId, setCreatedSourceId
- sourceType, setSourceType
- sourceName, setSourceName
- sourceCode, setSourceCode
- issuingAuthorityId, setIssuingAuthorityId
- selectedEntityIds, setSelectedEntityIds
- teamId, setTeamId
- defaultFrequency, setDefaultFrequency
- effectiveDate, setEffectiveDate
- reviewDate, setReviewDate
- items, setItems
```

**Implementation Template:**
```typescript
import { useState, useCallback } from "react";
import type { ItemWithTasks, SourceFormData, WizardStep } from "../types";

export function useSourceWizard(existingSource?: any) {
  const [step, setStep] = useState<WizardStep>(existingSource ? 2 : 1);
  const [loading, setLoading] = useState(false);
  const [createdSourceId, setCreatedSourceId] = useState<string | null>(null);
  
  // Form data
  const [formData, setFormData] = useState<SourceFormData>({
    sourceType: existingSource?.sourceType || "REGULATION",
    sourceName: existingSource?.name || "",
    sourceCode: existingSource?.code || "",
    issuingAuthorityId: existingSource?.issuingAuthority?.id || "",
    selectedEntityIds: existingSource?.entities.map((e: any) => e.entity.id) || [],
    teamId: existingSource?.team.id || "",
    defaultFrequency: existingSource?.defaultFrequency || "QUARTERLY",
    effectiveDate: existingSource?.effectiveDate || "",
    reviewDate: existingSource?.reviewDate || "",
  });
  
  const [items, setItems] = useState<ItemWithTasks[]>([]);
  
  const updateFormData = useCallback((updates: Partial<SourceFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);
  
  const addItem = useCallback((item: ItemWithTasks) => {
    setItems((prev) => [...prev, item]);
  }, []);
  
  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((item) => item.tempId !== itemId));
  }, []);
  
  const updateItem = useCallback((itemId: string, updates: Partial<ItemWithTasks>) => {
    setItems((prev) =>
      prev.map((item) => (item.tempId === itemId ? { ...item, ...updates } : item))
    );
  }, []);
  
  const nextStep = useCallback(() => {
    setStep((prev) => Math.min(3, prev + 1) as WizardStep);
  }, []);
  
  const prevStep = useCallback(() => {
    setStep((prev) => Math.max(1, prev - 1) as WizardStep);
  }, []);
  
  return {
    // State
    step,
    loading,
    createdSourceId,
    formData,
    items,
    
    // Actions
    setStep,
    setLoading,
    setCreatedSourceId,
    updateFormData,
    addItem,
    removeItem,
    updateItem,
    setItems,
    nextStep,
    prevStep,
  };
}
```

### 2.2 Create `hooks/useAIExtraction.ts`

**Purpose:** Handle AI document extraction with Anthropic

**State to Extract:**
```typescript
// From lines 146-168
- uploadedFile, setUploadedFile
- isDragging, setIsDragging
- extractionLevel, setExtractionLevel
- taskSuggestion, setTaskSuggestion
- additionalInstructions, setAdditionalInstructions
- isExtracting, setIsExtracting
- extractionProgress, setExtractionProgress
- extractedClauses, setExtractedClauses
```

**Implementation Template:**
```typescript
import { useState, useCallback } from "react";
import { fetchApi } from "@/lib/api-client";
import toast from "@/lib/toast";
import type { ExtractedClause, ExtractionLevel, TaskSuggestion } from "../types";

export function useAIExtraction(sourceType: string) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [extractionLevel, setExtractionLevel] = useState<ExtractionLevel>("articles-sub");
  const [taskSuggestion, setTaskSuggestion] = useState<TaskSuggestion>("full");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState("");
  const [extractedClauses, setExtractedClauses] = useState<ExtractedClause[]>([]);

  const handleExtract = useCallback(async () => {
    if (!uploadedFile) {
      toast.error("Please upload a file first");
      return;
    }

    try {
      setIsExtracting(true);
      setExtractionProgress("Uploading document...");

      const formData = new FormData();
      formData.append("file", uploadedFile);
      formData.append("sourceType", sourceType);
      formData.append("extractionLevel", extractionLevel);
      formData.append("taskSuggestion", taskSuggestion);
      if (additionalInstructions) {
        formData.append("additionalInstructions", additionalInstructions);
      }

      setExtractionProgress("AI is analyzing the document...");

      // Note: fetchApi doesn't work with FormData, use manual fetch
      const res = await fetch("/api/sources/ai-extract", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Extraction failed");
      }

      const result = await res.json();

      setExtractionProgress("Processing results...");

      // Transform API response to match component state
      const transformedClauses = result.clauses.map((clause: any) => ({
        ...clause,
        included: true,
        expanded: false,
        tasks: clause.suggestedTasks?.map((task: any, idx: number) => ({
          id: `${clause.reference}-task-${idx}`,
          ...task,
          included: true,
        })) || [],
      }));

      setExtractedClauses(transformedClauses);
      toast.success(`Extracted ${transformedClauses.length} clauses`);
    } catch (error) {
      console.error("Extraction error:", error);
      toast.error(error instanceof Error ? error.message : "Extraction failed");
    } finally {
      setIsExtracting(false);
      setExtractionProgress("");
    }
  }, [uploadedFile, sourceType, extractionLevel, taskSuggestion, additionalInstructions]);

  const reset = useCallback(() => {
    setUploadedFile(null);
    setIsDragging(false);
    setExtractedClauses([]);
    setExtractionProgress("");
  }, []);

  return {
    uploadedFile,
    setUploadedFile,
    isDragging,
    setIsDragging,
    extractionLevel,
    setExtractionLevel,
    taskSuggestion,
    setTaskSuggestion,
    additionalInstructions,
    setAdditionalInstructions,
    isExtracting,
    extractionProgress,
    extractedClauses,
    setExtractedClauses,
    handleExtract,
    reset,
  };
}
```

### 2.3 Create `hooks/useSpreadsheetParser.ts`

**Purpose:** Parse CSV/Excel files

**Implementation:** Extract CSV parsing logic from original file (lines ~200-400)

### 2.4 Create `hooks/useSourceValidation.ts`

**Purpose:** Validate form data before submission

**Implementation Template:**
```typescript
import { useCallback } from "react";
import type { SourceFormData, ItemWithTasks, ValidationError } from "../types";

export function useSourceValidation() {
  const validateStep1 = useCallback((formData: SourceFormData): ValidationError[] => {
    const errors: ValidationError[] = [];

    if (!formData.sourceName.trim()) {
      errors.push({ field: "sourceName", message: "Source name is required" });
    }

    if (!formData.sourceCode.trim()) {
      errors.push({ field: "sourceCode", message: "Source code is required" });
    }

    if (formData.selectedEntityIds.length === 0) {
      errors.push({ field: "entities", message: "At least one entity must be selected" });
    }

    if (!formData.teamId) {
      errors.push({ field: "teamId", message: "Responsible team is required" });
    }

    return errors;
  }, []);

  const validateStep2 = useCallback((items: ItemWithTasks[]): ValidationError[] => {
    const errors: ValidationError[] = [];

    if (items.length === 0) {
      errors.push({ field: "items", message: "At least one item is required" });
    }

    items.forEach((item, idx) => {
      if (!item.reference.trim()) {
        errors.push({ field: `item-${idx}-reference`, message: `Item ${idx + 1}: Reference is required` });
      }

      if (!item.title.trim()) {
        errors.push({ field: `item-${idx}-title`, message: `Item ${idx + 1}: Title is required` });
      }

      if (!item.isInformational && item.tasks.length === 0) {
        errors.push({ field: `item-${idx}-tasks`, message: `Item ${idx + 1}: At least one task is required` });
      }
    });

    return errors;
  }, []);

  return {
    validateStep1,
    validateStep2,
  };
}
```

### 2.5 Create `hooks/useWizardNavigation.ts`

**Purpose:** Handle step navigation with validation

---

## Phase 3: Presentational Components (TODO)

### 3.1 Create `components/SourceInfoForm.tsx`

**Purpose:** Form for basic source information (Step 1)

**Props:**
```typescript
type SourceInfoFormProps = {
  formData: SourceFormData;
  updateFormData: (updates: Partial<SourceFormData>) => void;
  teams: Team[];
  entities: Entity[];
  issuingAuthorities: IssuingAuthority[];
  errors?: ValidationError[];
};
```

**Responsibilities:**
- Render form fields
- Handle input changes
- Display validation errors
- NO business logic

### 3.2 Create `components/ItemCard.tsx`

**Purpose:** Display and edit a single item

**Props:**
```typescript
type ItemCardProps = {
  item: ItemWithTasks;
  onUpdate: (updates: Partial<ItemWithTasks>) => void;
  onDelete: () => void;
  onAddTask: () => void;
  teams: Team[];
  users: User[];
  entities: Entity[];
};
```

### 3.3 Create `components/TaskCard.tsx`

**Purpose:** Display and edit a single task

### 3.4 Create `components/EntitySelector.tsx`

**Purpose:** Multi-select entity picker

### 3.5 Create `components/TeamSelector.tsx`

**Purpose:** Team dropdown selector

### 3.6 Create `components/UserSelector.tsx`

**Purpose:** User picker with search

---

## Phase 4: Step Components (TODO)

### 4.1 Create `steps/BasicInfoStep.tsx`

**Purpose:** Step 1 - Source details

**Props:**
```typescript
type BasicInfoStepProps = {
  formData: SourceFormData;
  updateFormData: (updates: Partial<SourceFormData>) => void;
  teams: Team[];
  entities: Entity[];
  issuingAuthorities: IssuingAuthority[];
  onNext: () => void;
  onCancel: () => void;
};
```

**Responsibilities:**
- Render SourceInfoForm
- Handle "Next" button click
- Validate before progressing

### 4.2 Create `steps/ItemsInputStep.tsx`

**Purpose:** Step 2 - Items and tasks input

**Responsibilities:**
- Show input method selector
- Render appropriate input method component
- Manage items list
- Handle "Back" and "Next" navigation

### 4.3 Create `steps/ReviewStep.tsx`

**Purpose:** Step 3 - Final review and submit

**Responsibilities:**
- Display summary of all data
- Handle final submission
- Show loading state during API call

---

## Phase 5: Input Method Components (TODO)

### 5.1 Create `input-methods/AIExtractInput.tsx`

**Purpose:** AI extraction UI

**Implementation:** Use `useAIExtraction` hook

### 5.2 Create `input-methods/SpreadsheetInput.tsx`

**Purpose:** CSV/Excel import UI

**Implementation:** Use `useSpreadsheetParser` hook

### 5.3 Create `input-methods/ManualInput.tsx`

**Purpose:** Manual entry UI

---

## Phase 6: Main Orchestrator (TODO)

### 6.1 Create `index.tsx`

**Purpose:** Wire everything together

**Implementation Template:**
```typescript
"use client";

import React from "react";
import { X } from "lucide-react";
import { useSourceWizard } from "./hooks/useSourceWizard";
import { BasicInfoStep } from "./steps/BasicInfoStep";
import { ItemsInputStep } from "./steps/ItemsInputStep";
import { ReviewStep } from "./steps/ReviewStep";
import type { SourceWizardProps } from "./types";
import { WIZARD_STEPS } from "./constants";

export function SourceWizard({ isOpen, onClose, existingSource }: SourceWizardProps) {
  const wizardState = useSourceWizard(existingSource);
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-6xl max-h-[90vh] bg-white rounded-[14px] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
              {existingSource ? "Edit Source" : "New Compliance Source"}
            </h2>
            <div className="flex items-center gap-3 mt-2">
              {WIZARD_STEPS.map((step, idx) => (
                <div key={step.number} className="flex items-center">
                  <div
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                      wizardState.step === step.number
                        ? "bg-[var(--blue)] text-white font-medium"
                        : wizardState.step > step.number
                        ? "bg-[var(--green-light)] text-[var(--green)] font-medium"
                        : "bg-gray-100 text-[var(--text-muted)]"
                    }`}
                  >
                    <span>{step.number}</span>
                    <span>{step.title}</span>
                  </div>
                  {idx < WIZARD_STEPS.length - 1 && (
                    <div className="w-8 h-[2px] bg-gray-200 mx-1" />
                  )}
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {wizardState.step === 1 && (
            <BasicInfoStep
              {...wizardState}
              onNext={wizardState.nextStep}
              onCancel={onClose}
            />
          )}
          {wizardState.step === 2 && (
            <ItemsInputStep
              {...wizardState}
              onBack={wizardState.prevStep}
              onNext={wizardState.nextStep}
            />
          )}
          {wizardState.step === 3 && (
            <ReviewStep
              {...wizardState}
              onBack={wizardState.prevStep}
              onSubmit={() => {
                // Handle submission
                onClose();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## Phase 7: Integration and Testing

### 7.1 Update Import in SourcesClient.tsx

```typescript
// Old
// import { SourceWizard } from "@/components/sources/SourceWizard";

// New
import { SourceWizard } from "@/components/sources/SourceWizard";
// (index.tsx auto-imports from directory)
```

### 7.2 Keep Old File as Backup

```bash
mv src/components/sources/SourceWizard.tsx src/components/sources/SourceWizardOld.tsx
```

### 7.3 Test All Functionality

- [ ] Step 1: Source details form
- [ ] Step 2: AI extraction
- [ ] Step 2: Spreadsheet import
- [ ] Step 2: Manual entry
- [ ] Step 3: Review and submit
- [ ] Edit existing source
- [ ] Validation errors
- [ ] API integration

---

## Migration Checklist

- [ ] Phase 1: Foundation files (types, constants) ✅
- [ ] Phase 2: Custom hooks (5 hooks)
- [ ] Phase 3: Presentational components (6 components)
- [ ] Phase 4: Step components (3 steps)
- [ ] Phase 5: Input method components (3 methods)
- [ ] Phase 6: Main orchestrator (index.tsx)
- [ ] Phase 7: Integration and testing
- [ ] Delete old monolithic file

---

## Estimated Effort

| Phase | Files | Est. Hours | Priority |
|-------|-------|------------|----------|
| Phase 1 | 2 | 0.5h | ✅ Done |
| Phase 2 | 5 | 4h | High |
| Phase 3 | 6 | 6h | High |
| Phase 4 | 3 | 4h | High |
| Phase 5 | 3 | 4h | Medium |
| Phase 6 | 1 | 2h | High |
| Phase 7 | - | 4h | Critical |
| **Total** | **20** | **24.5h** | |

**Recommendation:** Spread over 3-4 days with thorough testing at each phase.

---

## Success Criteria

- ✅ No file exceeds 400 lines
- ✅ All components follow single responsibility principle
- ✅ Custom hooks properly extract stateful logic
- ✅ No circular dependencies
- ✅ All functionality preserved
- ✅ Performance improved (use React DevTools Profiler)
- ✅ No linter errors
- ✅ Comprehensive testing completed
