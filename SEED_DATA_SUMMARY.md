# Seed Data: Historical Tasks with Evidence

## 📊 Overview

Added comprehensive historical data to `prisma/seed.ts` to provide realistic testing data for the CMP application.

---

## 🗃️ Sample Data Created

### **2 Sources:**

1. **MFSA AML/CFT Framework**
   - Code: `MFSA-AML-2026`
   - Type: REGULATION
   - Authority: Malta Financial Services Authority
   - Entities: DIEL, DGL
   - Status: ACTIVE

2. **GDPR Data Protection Requirements**
   - Code: `GDPR-2026`
   - Type: REGULATION
   - Entities: DIEL, DGL, DBVI
   - Status: ACTIVE

### **3 Source Items:**
- Art. 12.3 — Transaction Monitoring Requirements
- Art. 15.1 — Customer Due Diligence
- Art. 32 — Security of Processing (GDPR)

---

## ✅ **5 Tasks with Different Statuses:**

### **Task 1: Q1 2026 Transaction Monitoring Review** (COMPLETED)
- **Entity:** DIEL
- **Status:** COMPLETED ✅
- **Assignee:** Ahmed Khalil
- **PIC:** Sarah Mitchell
- **Reviewer:** Sarah Mitchell
- **Risk:** HIGH
- **Evidence:** 2 files
  - `Q1_2026_Transaction_Monitoring_Report.pdf` (2.4 MB)
  - `Suspicious_Activity_Summary_Q1.xlsx` (85 KB)
- **Narrative:** "Completed comprehensive review of Q1 transaction monitoring. Identified 47 alerts, investigated all cases, and escalated 3 cases to FIAU..."
- **Comments:** 2 (from Ahmed and Sarah)

### **Task 2: Q2 2026 Customer Due Diligence Review** (IN PROGRESS)
- **Entity:** DGL
- **Status:** IN_PROGRESS 🔄
- **Assignee:** Ahmed Khalil
- **PIC:** Sarah Mitchell
- **Reviewer:** Sarah Mitchell
- **Risk:** HIGH
- **Evidence:** 1 file
  - `CDD_Progress_Report_Draft.docx` (145 KB)
- **Narrative:** "Currently reviewing 24 high-risk customer files. Completed 15 so far..."
- **Comments:** 1
- **ClickUp Link:** Yes

### **Task 3: Annual AML Risk Assessment 2025** (COMPLETED)
- **Entity:** DIEL
- **Status:** COMPLETED ✅
- **Assignee:** Sarah Mitchell
- **PIC:** Lakshmi Bichu
- **Reviewer:** Lakshmi Bichu
- **Risk:** HIGH
- **Evidence:** 4 files (largest dataset)
  - `AML_Risk_Assessment_2025_Final.pdf` (4.4 MB)
  - `Risk_Matrix_2025.xlsx` (229 KB)
  - `Board_Approval_Minutes.pdf` (1.2 MB)
  - `Mitigation_Action_Plan.docx` (175 KB)
- **Narrative:** "Comprehensive risk assessment completed covering all business lines. Key findings: increased crypto-related risks..."
- **Comments:** 1
- **Linked Finding:** F-2026-001

### **Task 4: Monthly Sanctions Screening - June 2026** (PENDING REVIEW)
- **Entity:** DGL
- **Status:** PENDING_REVIEW ⏳
- **Assignee:** Ahmed Khalil
- **PIC:** Wa'ed Al-Rashid
- **Reviewer:** Sarah Mitchell
- **Risk:** MEDIUM
- **Evidence:** 2 files
  - `Sanctions_Screening_Report_June_2026.pdf` (871 KB)
  - `False_Positive_Investigation_Notes.pdf` (446 KB)
- **Narrative:** "Completed sanctions screening for June 2026. Processed 15,847 customers and 234,567 transactions..."
- **Comments:** 1

### **Task 5: Q2 2026 Security Assessment** (COMPLETED - GDPR)
- **Entity:** DIEL
- **Status:** COMPLETED ✅
- **Assignee:** Wa'ed Al-Rashid
- **PIC:** Lakshmi Bichu
- **Reviewer:** Lakshmi Bichu
- **Risk:** HIGH
- **Evidence:** 3 files
  - `Security_Assessment_Q2_2026.pdf` (3.3 MB)
  - `Vulnerability_Scan_Results.pdf` (1.2 MB)
  - `Remediation_Plan.xlsx` (87 KB)
- **Narrative:** "Completed comprehensive security assessment. All critical and high-risk items addressed..."
- **Google Drive Link:** Yes

---

## 📎 **Evidence Files (12 Total)**

All evidence files are dummy entries with realistic:
- File names (e.g., `Q1_2026_Transaction_Monitoring_Report.pdf`)
- File sizes (ranging from 85 KB to 4.4 MB)
- MIME types (PDF, Excel, Word)
- Upload timestamps
- Uploader references

**Note:** The actual files don't exist in `/uploads` directory — these are metadata entries only. The app will handle missing files gracefully.

---

## 💬 **Comments (5 Total)**

Sample comments demonstrate:
- Task progress updates
- Review approvals
- Status clarifications
- Collaboration between team members

---

## 🔍 **1 Finding**

**F-2026-001: Inadequate Transaction Monitoring Alert Investigation**
- **Severity:** MEDIUM
- **Status:** IN_PROGRESS
- **Linked to:** Task 1 (Q1 Transaction Monitoring Review)
- **Action Owner:** Sarah Mitchell
- **Root Cause:** "Insufficient staffing during peak period..."
- **Management Response:** "Additional analyst hired. New escalation matrix implemented..."
- **Target Date:** August 31, 2026

---

## 📜 **Audit Log Entries (6 Total)**

Historical audit trail for Task 1 showing:
1. Task created (April 1, 2026)
2. Status changed: TO_DO → IN_PROGRESS (April 2)
3. Evidence uploaded (April 12)
4. Task submitted for review (April 13)
5. Task approved (April 14)
6. Finding created (April 15)

---

## 🎯 **Use Cases Covered**

This seed data enables testing of:

### **Task Tracker:**
- ✅ Filtering by status (Completed, In Progress, Pending Review)
- ✅ Filtering by entity (DIEL, DGL)
- ✅ Filtering by risk rating (HIGH, MEDIUM)
- ✅ Filtering by frequency (QUARTERLY, MONTHLY, ANNUAL)
- ✅ Viewing tasks with different completion states

### **Task Detail Modal:**
- ✅ Viewing completed tasks with full evidence
- ✅ Viewing in-progress tasks with partial evidence
- ✅ Viewing pending review tasks
- ✅ Evidence tab with multiple files
- ✅ Comments tab with threaded discussions
- ✅ History tab with audit trail
- ✅ Narrative section (optional, some tasks have it)
- ✅ External links (ClickUp, Google Drive)

### **Review Queue:**
- ✅ Task 4 appears in review queue for Sarah Mitchell
- ✅ Shows tasks submitted for approval

### **Findings Module:**
- ✅ Finding linked to a completed task
- ✅ Finding with root cause, impact, and management response
- ✅ In-progress finding status

### **Reports:**
- ✅ CMP Extract will show historical task data
- ✅ Completion statistics for sources
- ✅ Evidence counts per task

### **Audit Log:**
- ✅ Historical timeline of task lifecycle
- ✅ User actions tracked with timestamps

---

## 🔧 **To Populate This Data:**

```bash
cd /Users/lakshmibichu/CMP_Project/cmp-app

# Run the updated seed script
npx prisma db seed
```

**Expected Output:**
```
Sample data created successfully:
  - 2 sources (AML, GDPR)
  - 3 source items
  - 5 tasks with various statuses
  - 12 evidence files
  - 5 comments
  - 1 finding
  - 6 audit log entries
Seed completed successfully.
```

---

## 📝 **Important Notes**

1. **Evidence Files Are Metadata Only:**
   - The evidence records reference files in `/uploads/` directory
   - The actual files don't exist (dummy URLs)
   - The app should handle missing files gracefully (show file info but return 404 if downloaded)

2. **Realistic Data:**
   - Task names, descriptions, and narratives are realistic
   - File sizes match typical document sizes
   - Dates are set in 2025-2026 timeframe
   - User assignments reflect typical role responsibilities

3. **Demonstrates Key Features:**
   - Evidence upload functionality
   - Task workflow (TO_DO → IN_PROGRESS → PENDING_REVIEW → COMPLETED)
   - Comments and collaboration
   - Findings linked to tasks
   - Audit trail

4. **Testing Scenarios:**
   - Download evidence files (will return 404, but shows UI works)
   - View completed tasks with full documentation
   - Review pending tasks
   - Filter and search tasks
   - Export reports with historical data

---

## ✨ **Next Steps**

1. ✅ Run `npx prisma db seed` to populate the data
2. ✅ Navigate to Task Tracker to see all 5 tasks
3. ✅ Click on a completed task to view evidence files
4. ✅ Check Review Queue (Sarah Mitchell should see Task 4)
5. ✅ View Findings page (should show F-2026-001)
6. ✅ Check Audit Log to see task lifecycle

---

**Historical data seeded! Your CMP application now has realistic tasks with evidence for comprehensive testing.** 🎉
