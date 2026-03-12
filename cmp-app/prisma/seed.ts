import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MODULES = [
  "DASHBOARD",
  "SOURCES",
  "TASKS",
  "CALENDAR",
  "TASK_EXECUTION",
  "REVIEW_QUEUE",
  "FINDINGS",
  "REPORTS",
  "AUDIT_LOG",
  "USER_MANAGEMENT",
  "ROLE_MANAGEMENT",
  "ENTITY_CONFIG",
  "TEAM_CONFIG",
  "WORKFLOW_CONFIG",
  "NOTIFICATION_CONFIG",
] as const;

const ACTIONS = ["VIEW", "CREATE", "EDIT", "DELETE", "APPROVE", "EXPORT", "ADMIN_CONFIG"] as const;

const ADMIN_MODULES = new Set(["USER_MANAGEMENT", "ROLE_MANAGEMENT", "ENTITY_CONFIG", "TEAM_CONFIG", "WORKFLOW_CONFIG", "NOTIFICATION_CONFIG"]);
const CORE_MODULES = new Set(["DASHBOARD", "SOURCES", "TASKS", "CALENDAR", "TASK_EXECUTION", "REVIEW_QUEUE", "FINDINGS", "REPORTS", "AUDIT_LOG"]);

function managerGrant(module: string, action: string): boolean {
  if (action === "ADMIN_CONFIG") {
    return false;
  }
  if (action === "DELETE" && ADMIN_MODULES.has(module)) {
    return false;
  }
  return ["VIEW", "CREATE", "EDIT", "APPROVE", "EXPORT", "DELETE"].includes(action);
}

function analystGrant(module: string, action: string): boolean {
  if (action === "VIEW" && module !== "ROLE_MANAGEMENT" && module !== "ENTITY_CONFIG" && module !== "TEAM_CONFIG" && module !== "WORKFLOW_CONFIG" && module !== "NOTIFICATION_CONFIG") {
    return true;
  }
  if (module === "TASK_EXECUTION" && (action === "CREATE" || action === "EDIT")) {
    return true;
  }
  if (module === "REPORTS" && action === "EXPORT") {
    return true;
  }
  return false;
}

function executorGrant(module: string, action: string): boolean {
  if ((module === "DASHBOARD" || module === "TASKS" || module === "CALENDAR") && action === "VIEW") {
    return true;
  }
  if (module === "TASK_EXECUTION" && action === "EDIT") {
    return true;
  }
  return false;
}

function viewerGrant(module: string, action: string): boolean {
  if (action === "VIEW" && CORE_MODULES.has(module)) {
    return true;
  }
  if (module === "REPORTS" && action === "EXPORT") {
    return true;
  }
  return false;
}

async function main(): Promise<void> {
  const entities = await Promise.all([
    prisma.entity.upsert({
      where: { code: "DIEL" },
      update: {},
      create: {
        code: "DIEL",
        name: "Deriv Investments (Europe) Limited",
        shortName: "Deriv Investments",
        jurisdiction: "Malta",
        regulator: "MFSA",
      },
    }),
    prisma.entity.upsert({
      where: { code: "DGL" },
      update: {},
      create: {
        code: "DGL",
        name: "Deriv (GX) Limited",
        shortName: "Deriv GX",
        jurisdiction: "Labuan, Malaysia",
        regulator: "Labuan FSA",
      },
    }),
    prisma.entity.upsert({
      where: { code: "DBVI" },
      update: {},
      create: {
        code: "DBVI",
        name: "Deriv (BVI) Ltd",
        shortName: "Deriv BVI",
        jurisdiction: "British Virgin Islands",
        regulator: "BVI FSC",
      },
    }),
    prisma.entity.upsert({
      where: { code: "FINSERV" },
      update: {},
      create: {
        code: "FINSERV",
        name: "Deriv Finserv Ltd",
        shortName: "Deriv Finserv",
        jurisdiction: "Mauritius",
        regulator: "FSC Mauritius",
      },
    }),
  ]);

  const teams = await Promise.all([
    prisma.team.upsert({
      where: { name: "Compliance" },
      update: {},
      create: {
        name: "Compliance",
        description: "Regulatory compliance oversight team",
        approvalRequired: true,
        evidenceRequired: false,
        narrativeRequired: false,
        statusFlow: ["TO_DO", "IN_PROGRESS", "PENDING_REVIEW", "COMPLETED"],
      },
    }),
    prisma.team.upsert({
      where: { name: "CompOps" },
      update: {},
      create: {
        name: "CompOps",
        description: "Operational compliance execution team",
        approvalRequired: false,
        evidenceRequired: false,
        narrativeRequired: false,
        statusFlow: ["TO_DO", "IN_PROGRESS", "COMPLETED"],
      },
    }),
    prisma.team.upsert({
      where: { name: "Internal Audit" },
      update: {},
      create: {
        name: "Internal Audit",
        description: "Independent assurance and control testing team",
        approvalRequired: true,
        evidenceRequired: true,
        narrativeRequired: true,
        statusFlow: ["TO_DO", "IN_PROGRESS", "PENDING_REVIEW", "COMPLETED"],
      },
    }),
  ]);

  // ── Issuing Authorities ──
  const issuingAuthorities = await Promise.all([
    prisma.issuingAuthority.upsert({
      where: { name: "Malta Financial Services Authority" },
      update: {},
      create: {
        name: "Malta Financial Services Authority",
        abbreviation: "MFSA",
        country: "Malta",
      },
    }),
    prisma.issuingAuthority.upsert({
      where: { name: "European Securities and Markets Authority" },
      update: {},
      create: {
        name: "European Securities and Markets Authority",
        abbreviation: "ESMA",
        country: "EU",
      },
    }),
    prisma.issuingAuthority.upsert({
      where: { name: "European Commission" },
      update: {},
      create: {
        name: "European Commission",
        abbreviation: null,
        country: "EU",
      },
    }),
    prisma.issuingAuthority.upsert({
      where: { name: "Information and Data Protection Commissioner" },
      update: {},
      create: {
        name: "Information and Data Protection Commissioner",
        abbreviation: "IDPC",
        country: "Malta",
      },
    }),
    prisma.issuingAuthority.upsert({
      where: { name: "Guernsey Financial Services Commission" },
      update: {},
      create: {
        name: "Guernsey Financial Services Commission",
        abbreviation: "GFSC",
        country: "Guernsey",
      },
    }),
    prisma.issuingAuthority.upsert({
      where: { name: "Financial Services Commission (BVI)" },
      update: {},
      create: {
        name: "Financial Services Commission (BVI)",
        abbreviation: "FSC BVI",
        country: "British Virgin Islands",
      },
    }),
    prisma.issuingAuthority.upsert({
      where: { name: "Labuan Financial Services Authority" },
      update: {},
      create: {
        name: "Labuan Financial Services Authority",
        abbreviation: "Labuan FSA",
        country: "Malaysia",
      },
    }),
    prisma.issuingAuthority.upsert({
      where: { name: "Financial Action Task Force" },
      update: {},
      create: {
        name: "Financial Action Task Force",
        abbreviation: "FATF",
        country: "International",
      },
    }),
    prisma.issuingAuthority.upsert({
      where: { name: "European Banking Authority" },
      update: {},
      create: {
        name: "European Banking Authority",
        abbreviation: "EBA",
        country: "EU",
      },
    }),
    prisma.issuingAuthority.upsert({
      where: { name: "Payment Card Industry Security Standards Council" },
      update: {},
      create: {
        name: "Payment Card Industry Security Standards Council",
        abbreviation: "PCI SSC",
        country: "International",
      },
    }),
  ]);

  const roles = await Promise.all([
    prisma.role.upsert({
      where: { name: "SUPER_ADMIN" },
      update: {},
      create: {
        name: "SUPER_ADMIN",
        displayName: "Super Admin",
        description: "Full platform administration and global access",
      },
    }),
    prisma.role.upsert({
      where: { name: "MANAGER" },
      update: {},
      create: {
        name: "MANAGER",
        displayName: "Manager",
        description: "Team management, approvals, and oversight permissions",
      },
    }),
    prisma.role.upsert({
      where: { name: "ANALYST" },
      update: {},
      create: {
        name: "ANALYST",
        displayName: "Analyst",
        description: "Analysis and task execution support",
      },
    }),
    prisma.role.upsert({
      where: { name: "EXECUTOR" },
      update: {},
      create: {
        name: "EXECUTOR",
        displayName: "Executor",
        description: "Task execution-focused role",
      },
    }),
    prisma.role.upsert({
      where: { name: "VIEWER" },
      update: {},
      create: {
        name: "VIEWER",
        displayName: "Viewer",
        description: "Read-only access with limited exports",
      },
    }),
  ]);

  const permissions = [];
  for (const module of MODULES) {
    for (const action of ACTIONS) {
      const permission = await prisma.permission.upsert({
        where: { module_action: { module, action } },
        update: {},
        create: {
          module,
          action,
          description: `${action} access for ${module}`,
        },
      });
      permissions.push(permission);
    }
  }

  for (const role of roles) {
    for (const permission of permissions) {
      let granted = false;
      if (role.name === "SUPER_ADMIN") {
        granted = true;
      } else if (role.name === "MANAGER") {
        granted = managerGrant(permission.module, permission.action);
      } else if (role.name === "ANALYST") {
        granted = analystGrant(permission.module, permission.action);
      } else if (role.name === "EXECUTOR") {
        granted = executorGrant(permission.module, permission.action);
      } else if (role.name === "VIEWER") {
        granted = viewerGrant(permission.module, permission.action);
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: { granted },
        create: {
          roleId: role.id,
          permissionId: permission.id,
          granted,
        },
      });
    }
  }

  const passwordHash = await bcrypt.hash("password123", 12);
  const roleByName = Object.fromEntries(roles.map((role) => [role.name, role]));
  const teamByName = Object.fromEntries(teams.map((team) => [team.name, team]));
  const entityByCode = Object.fromEntries(entities.map((entity) => [entity.code, entity]));

  const users = [
    {
      email: "lakshmi.bichu@cmp.local",
      name: "Lakshmi Bichu",
      initials: "LB",
      role: "SUPER_ADMIN",
      teamNames: teams.map((t) => t.name),
      entityCodes: entities.map((e) => e.code),
      avatarColor: "from-purple-500 to-indigo-600",
    },
    {
      email: "gary.roberts@cmp.local",
      name: "Gary Roberts",
      initials: "GR",
      role: "SUPER_ADMIN",
      teamNames: teams.map((t) => t.name),
      entityCodes: entities.map((e) => e.code),
      avatarColor: "from-blue-500 to-cyan-500",
    },
    {
      email: "sarah.mitchell@cmp.local",
      name: "Sarah Mitchell",
      initials: "SM",
      role: "MANAGER",
      teamNames: ["Compliance"],
      entityCodes: ["DIEL", "DGL"],
      avatarColor: "from-emerald-500 to-teal-600",
    },
    {
      email: "waed.alrashid@cmp.local",
      name: "Wa'ed Al-Rashid",
      initials: "WR",
      role: "MANAGER",
      teamNames: ["CompOps"],
      entityCodes: ["DIEL", "DGL", "DBVI"],
      avatarColor: "from-orange-500 to-amber-600",
    },
    {
      email: "ahmed.khalil@cmp.local",
      name: "Ahmed Khalil",
      initials: "AK",
      role: "ANALYST",
      teamNames: ["Compliance"],
      entityCodes: ["DIEL"],
      avatarColor: "from-rose-500 to-pink-600",
    },
    {
      email: "reem.khalil@cmp.local",
      name: "Reem Khalil",
      initials: "RK",
      role: "EXECUTOR",
      teamNames: ["CompOps"],
      entityCodes: ["DIEL"],
      avatarColor: "from-slate-500 to-slate-700",
    },
  ];

  for (const seedUser of users) {
    const user = await prisma.user.upsert({
      where: { email: seedUser.email },
      update: {
        name: seedUser.name,
        initials: seedUser.initials,
        roleId: roleByName[seedUser.role].id,
        passwordHash,
        avatarColor: seedUser.avatarColor,
        isActive: true,
      },
      create: {
        email: seedUser.email,
        name: seedUser.name,
        initials: seedUser.initials,
        roleId: roleByName[seedUser.role].id,
        passwordHash,
        avatarColor: seedUser.avatarColor,
        isActive: true,
      },
    });

    for (const teamName of seedUser.teamNames) {
      await prisma.teamMembership.upsert({
        where: {
          userId_teamId: {
            userId: user.id,
            teamId: teamByName[teamName].id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          teamId: teamByName[teamName].id,
        },
      });
    }

    for (const entityCode of seedUser.entityCodes) {
      await prisma.userEntityAccess.upsert({
        where: {
          userId_entityId: {
            userId: user.id,
            entityId: entityByCode[entityCode].id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          entityId: entityByCode[entityCode].id,
        },
      });
    }
  }

  // ── Sample Sources, Tasks, and Evidence (Historical Data) ──
  console.log("Creating sample sources and tasks with evidence...");

  // Get the MFSA authority
  const mfsaAuthority = await prisma.issuingAuthority.findUnique({
    where: { name: "Malta Financial Services Authority" },
  });

  // Create a sample source: MFSA AML/CFT Framework
  // Delete existing if it exists
  const existingAmlSource = await prisma.source.findFirst({
    where: { code: "MFSA-AML-2026", teamId: teamByName["Compliance"].id },
  });
  if (existingAmlSource) {
    await prisma.source.delete({ where: { id: existingAmlSource.id } });
  }

  const amlSource = await prisma.source.create({
    data: {
      code: "MFSA-AML-2026",
      name: "MFSA AML/CFT Framework",
      sourceType: "REGULATION",
      issuingAuthorityId: mfsaAuthority?.id || null,
      effectiveDate: new Date("2024-01-01"),
      reviewDate: new Date("2024-12-31"),
      status: "ACTIVE",
      teamId: teamByName["Compliance"].id,
      entities: {
        create: [
          { entityId: entityByCode["DIEL"].id },
          { entityId: entityByCode["DGL"].id },
        ],
      },
    },
  });

  // Create source items for AML source
  const amlItem1 = await prisma.sourceItem.create({
    data: {
      sourceId: amlSource.id,
      reference: "Art. 12.3",
      title: "Transaction Monitoring Requirements",
      description: "Implement ongoing transaction monitoring system to detect unusual or suspicious activity",
      sortOrder: 1,
      status: "ACTIVE",
    },
  });

  const amlItem2 = await prisma.sourceItem.create({
    data: {
      sourceId: amlSource.id,
      reference: "Art. 15.1",
      title: "Customer Due Diligence",
      description: "Conduct enhanced due diligence for high-risk customers",
      sortOrder: 2,
      status: "ACTIVE",
    },
  });

  // Get users for task assignment
  const lakshmi = await prisma.user.findUnique({ where: { email: "lakshmi.bichu@cmp.local" } });
  const sarah = await prisma.user.findUnique({ where: { email: "sarah.mitchell@cmp.local" } });
  const ahmed = await prisma.user.findUnique({ where: { email: "ahmed.khalil@cmp.local" } });
  const waed = await prisma.user.findUnique({ where: { email: "waed.alrashid@cmp.local" } });

  if (!lakshmi || !sarah || !ahmed || !waed) {
    throw new Error("Required users not found in database");
  }

  // Create tasks with various statuses and evidence
  
  // Task 1: Completed task with evidence (DIEL)
  const task1 = await prisma.task.create({
    data: {
      name: "Q1 2026 Transaction Monitoring Review",
      description: "Review transaction monitoring alerts and suspicious activity reports for Q1 2026",
      expectedOutcome: "All alerts investigated, documented, and appropriate actions taken",
      status: "COMPLETED",
      riskRating: "HIGH",
      frequency: "QUARTERLY",
      quarter: "Q1",
      dueDate: new Date("2026-04-15"),
      startDate: new Date("2026-04-01"),
      completedAt: new Date("2026-04-14"),
      submittedAt: new Date("2026-04-13"),
      reviewedAt: new Date("2026-04-14"),
      evidenceRequired: true,
      reviewRequired: true,
      narrative: "Completed comprehensive review of Q1 transaction monitoring. Identified 47 alerts, investigated all cases, and escalated 3 cases to FIAU. All documentation filed in compliance system.",
      sourceId: amlSource.id,
      sourceItemId: amlItem1.id,
      entityId: entityByCode["DIEL"].id,
      assigneeId: ahmed.id,
      picId: sarah.id,
      reviewerId: sarah.id,
    },
  });

  // Add evidence for task 1
  await prisma.evidence.create({
    data: {
      taskId: task1.id,
      fileName: "Q1_2026_Transaction_Monitoring_Report.pdf",
      fileUrl: "/uploads/q1-2026-transaction-monitoring.pdf",
      fileSize: 2458624, // ~2.4 MB
      mimeType: "application/pdf",
      uploadedById: ahmed.id,
    },
  });

  await prisma.evidence.create({
    data: {
      taskId: task1.id,
      fileName: "Suspicious_Activity_Summary_Q1.xlsx",
      fileUrl: "/uploads/suspicious-activity-summary-q1.xlsx",
      fileSize: 87452,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      uploadedById: ahmed.id,
    },
  });

  // Task 2: In progress task with partial evidence (DGL)
  const task2 = await prisma.task.create({
    data: {
      name: "Q2 2026 Customer Due Diligence Review",
      description: "Enhanced due diligence for high-risk customer segment",
      expectedOutcome: "All high-risk customers reviewed, risk assessments updated",
      status: "IN_PROGRESS",
      riskRating: "HIGH",
      frequency: "QUARTERLY",
      quarter: "Q2",
      dueDate: new Date("2026-07-15"),
      startDate: new Date("2026-07-01"),
      evidenceRequired: true,
      reviewRequired: true,
      narrative: "Currently reviewing 24 high-risk customer files. Completed 15 so far. No major issues identified yet.",
      sourceId: amlSource.id,
      sourceItemId: amlItem2.id,
      entityId: entityByCode["DGL"].id,
      assigneeId: ahmed.id,
      picId: sarah.id,
      reviewerId: sarah.id,
      clickupUrl: "https://app.clickup.com/t/abc123",
    },
  });

  await prisma.evidence.create({
    data: {
      taskId: task2.id,
      fileName: "CDD_Progress_Report_Draft.docx",
      fileUrl: "/uploads/cdd-progress-draft.docx",
      fileSize: 145230,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      uploadedById: ahmed.id,
    },
  });

  // Task 3: Completed task with multiple evidence files (DIEL)
  const task3 = await prisma.task.create({
    data: {
      name: "Annual AML Risk Assessment 2025",
      description: "Conduct comprehensive AML/CFT risk assessment for the organization",
      expectedOutcome: "Complete risk assessment report identifying key ML/TF risks and mitigation measures",
      status: "COMPLETED",
      riskRating: "HIGH",
      frequency: "ANNUAL",
      dueDate: new Date("2025-12-31"),
      startDate: new Date("2025-11-01"),
      completedAt: new Date("2025-12-28"),
      submittedAt: new Date("2025-12-27"),
      reviewedAt: new Date("2025-12-28"),
      evidenceRequired: true,
      reviewRequired: true,
      narrative: "Comprehensive risk assessment completed covering all business lines. Key findings: increased crypto-related risks, enhanced controls recommended for PEP handling, updated risk appetite statement approved by Board.",
      sourceId: amlSource.id,
      sourceItemId: amlItem1.id,
      entityId: entityByCode["DIEL"].id,
      assigneeId: sarah.id,
      picId: lakshmi.id,
      reviewerId: lakshmi.id,
    },
  });

  await prisma.evidence.createMany({
    data: [
      {
        taskId: task3.id,
        fileName: "AML_Risk_Assessment_2025_Final.pdf",
        fileUrl: "/uploads/aml-risk-assessment-2025.pdf",
        fileSize: 4582945,
        mimeType: "application/pdf",
        uploadedById: sarah.id,
      },
      {
        taskId: task3.id,
        fileName: "Risk_Matrix_2025.xlsx",
        fileUrl: "/uploads/risk-matrix-2025.xlsx",
        fileSize: 234567,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        uploadedById: sarah.id,
      },
      {
        taskId: task3.id,
        fileName: "Board_Approval_Minutes.pdf",
        fileUrl: "/uploads/board-approval-minutes.pdf",
        fileSize: 1245678,
        mimeType: "application/pdf",
        uploadedById: sarah.id,
      },
      {
        taskId: task3.id,
        fileName: "Mitigation_Action_Plan.docx",
        fileUrl: "/uploads/mitigation-action-plan.docx",
        fileSize: 178945,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        uploadedById: sarah.id,
      },
    ],
  });

  // Task 4: Pending review task with evidence (DGL)
  const task4 = await prisma.task.create({
    data: {
      name: "Monthly Sanctions Screening - June 2026",
      description: "Screen all customers and transactions against updated sanctions lists",
      expectedOutcome: "All screening complete, no matches found or matches resolved",
      status: "PENDING_REVIEW",
      riskRating: "MEDIUM",
      frequency: "MONTHLY",
      dueDate: new Date("2026-07-05"),
      startDate: new Date("2026-07-01"),
      submittedAt: new Date("2026-07-04"),
      evidenceRequired: true,
      reviewRequired: true,
      narrative: "Completed sanctions screening for June 2026. Processed 15,847 customers and 234,567 transactions. 2 potential matches identified and investigated - both resolved as false positives.",
      sourceId: amlSource.id,
      sourceItemId: amlItem1.id,
      entityId: entityByCode["DGL"].id,
      assigneeId: ahmed.id,
      picId: waed.id,
      reviewerId: sarah.id,
    },
  });

  await prisma.evidence.createMany({
    data: [
      {
        taskId: task4.id,
        fileName: "Sanctions_Screening_Report_June_2026.pdf",
        fileUrl: "/uploads/sanctions-report-june-2026.pdf",
        fileSize: 892345,
        mimeType: "application/pdf",
        uploadedById: ahmed.id,
      },
      {
        taskId: task4.id,
        fileName: "False_Positive_Investigation_Notes.pdf",
        fileUrl: "/uploads/false-positive-notes.pdf",
        fileSize: 456789,
        mimeType: "application/pdf",
        uploadedById: ahmed.id,
      },
    ],
  });

  // Add comments to some tasks
  await prisma.comment.createMany({
    data: [
      {
        taskId: task1.id,
        authorId: ahmed.id,
        content: "Completed initial review of all alerts. 3 cases require escalation to FIAU.",
      },
      {
        taskId: task1.id,
        authorId: sarah.id,
        content: "Reviewed and approved. Excellent work on the detailed investigation notes. Filing is complete.",
      },
      {
        taskId: task2.id,
        authorId: ahmed.id,
        content: "Making good progress. 15 out of 24 files reviewed. Expecting to complete by July 10th.",
      },
      {
        taskId: task3.id,
        authorId: lakshmi.id,
        content: "Comprehensive assessment. Please ensure the mitigation action plan is distributed to all department heads.",
      },
      {
        taskId: task4.id,
        authorId: ahmed.id,
        content: "Submitted for review. Both potential matches have been thoroughly investigated and documented.",
      },
    ],
  });

  // Create a finding linked to one of the tasks
  await prisma.finding.create({
    data: {
      reference: "F-2026-001",
      title: "Inadequate Transaction Monitoring Alert Investigation",
      description: "During Q1 review, identified 5 transaction monitoring alerts that were not adequately investigated within required timeframes.",
      severity: "MEDIUM",
      status: "IN_PROGRESS",
      rootCause: "Insufficient staffing during peak period and lack of clear escalation procedures for complex cases.",
      impact: "Potential regulatory breach and missed opportunity to identify suspicious activity.",
      managementResponse: "Additional analyst hired. New escalation matrix implemented. Enhanced training provided to all compliance analysts.",
      targetDate: new Date("2026-08-31"),
      sourceId: amlSource.id,
      taskId: task1.id,
      entityId: entityByCode["DIEL"].id,
      actionOwnerId: sarah.id,
      raisedById: lakshmi.id,
    },
  });

  // Create another source: GDPR Compliance
  const existingGdprSource = await prisma.source.findFirst({
    where: { code: "GDPR-2026", teamId: teamByName["Compliance"].id },
  });
  if (existingGdprSource) {
    await prisma.source.delete({ where: { id: existingGdprSource.id } });
  }

  const gdprSource = await prisma.source.create({
    data: {
      code: "GDPR-2026",
      name: "GDPR Data Protection Requirements",
      sourceType: "REGULATION",
      effectiveDate: new Date("2024-01-01"),
      status: "ACTIVE",
      teamId: teamByName["Compliance"].id,
      entities: {
        create: [
          { entityId: entityByCode["DIEL"].id },
          { entityId: entityByCode["DGL"].id },
          { entityId: entityByCode["DBVI"].id },
        ],
      },
    },
  });

  const gdprItem = await prisma.sourceItem.create({
    data: {
      sourceId: gdprSource.id,
      reference: "Art. 32",
      title: "Security of Processing",
      description: "Implement appropriate technical and organizational measures to ensure security",
      sortOrder: 1,
      status: "ACTIVE",
    },
  });

  // GDPR Task: Completed with evidence
  const gdprTask = await prisma.task.create({
    data: {
      name: "Q2 2026 Security Assessment",
      description: "Quarterly assessment of technical and organizational security measures",
      expectedOutcome: "Security controls validated, vulnerabilities identified and remediated",
      status: "COMPLETED",
      riskRating: "HIGH",
      frequency: "QUARTERLY",
      quarter: "Q2",
      dueDate: new Date("2026-07-01"),
      startDate: new Date("2026-06-15"),
      completedAt: new Date("2026-06-30"),
      submittedAt: new Date("2026-06-29"),
      reviewedAt: new Date("2026-06-30"),
      evidenceRequired: true,
      reviewRequired: true,
      narrative: "Completed comprehensive security assessment. All critical and high-risk items addressed. 3 medium-risk items remain open with remediation plan in place.",
      sourceId: gdprSource.id,
      sourceItemId: gdprItem.id,
      entityId: entityByCode["DIEL"].id,
      assigneeId: waed.id,
      picId: lakshmi.id,
      reviewerId: lakshmi.id,
      gdriveUrl: "https://drive.google.com/file/d/xyz789",
    },
  });

  await prisma.evidence.createMany({
    data: [
      {
        taskId: gdprTask.id,
        fileName: "Security_Assessment_Q2_2026.pdf",
        fileUrl: "/uploads/security-assessment-q2-2026.pdf",
        fileSize: 3456789,
        mimeType: "application/pdf",
        uploadedById: waed.id,
      },
      {
        taskId: gdprTask.id,
        fileName: "Vulnerability_Scan_Results.pdf",
        fileUrl: "/uploads/vulnerability-scan-results.pdf",
        fileSize: 1234567,
        mimeType: "application/pdf",
        uploadedById: waed.id,
      },
      {
        taskId: gdprTask.id,
        fileName: "Remediation_Plan.xlsx",
        fileUrl: "/uploads/remediation-plan.xlsx",
        fileSize: 89456,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        uploadedById: waed.id,
      },
    ],
  });

  // Audit log entries for the completed tasks
  await prisma.auditLog.createMany({
    data: [
      {
        action: "TASK_CREATED",
        module: "TASKS",
        userId: sarah.id,
        entityId: entityByCode["DIEL"].id,
        targetType: "Task",
        targetId: task1.id,
        details: { taskName: task1.name },
        createdAt: new Date("2026-04-01"),
      },
      {
        action: "TASK_STATUS_CHANGED",
        module: "TASKS",
        userId: ahmed.id,
        entityId: entityByCode["DIEL"].id,
        targetType: "Task",
        targetId: task1.id,
        details: { oldStatus: "TO_DO", newStatus: "IN_PROGRESS" },
        createdAt: new Date("2026-04-02"),
      },
      {
        action: "EVIDENCE_UPLOADED",
        module: "TASKS",
        userId: ahmed.id,
        entityId: entityByCode["DIEL"].id,
        targetType: "Task",
        targetId: task1.id,
        details: { fileName: "Q1_2026_Transaction_Monitoring_Report.pdf" },
        createdAt: new Date("2026-04-12"),
      },
      {
        action: "TASK_SUBMITTED_FOR_REVIEW",
        module: "TASKS",
        userId: ahmed.id,
        entityId: entityByCode["DIEL"].id,
        targetType: "Task",
        targetId: task1.id,
        details: { reviewerId: sarah.id },
        createdAt: new Date("2026-04-13"),
      },
      {
        action: "TASK_APPROVED",
        module: "TASKS",
        userId: sarah.id,
        entityId: entityByCode["DIEL"].id,
        targetType: "Task",
        targetId: task1.id,
        details: { taskName: task1.name },
        createdAt: new Date("2026-04-14"),
      },
      {
        action: "FINDING_CREATED",
        module: "FINDINGS",
        userId: lakshmi.id,
        entityId: entityByCode["DIEL"].id,
        targetType: "Finding",
        targetId: "F-2026-001",
        details: { reference: "F-2026-001", title: "Inadequate Transaction Monitoring Alert Investigation" },
        createdAt: new Date("2026-04-15"),
      },
    ],
  });

  console.log("Sample data created successfully:");
  console.log(`  - 2 sources (AML, GDPR)`);
  console.log(`  - 3 source items`);
  console.log(`  - 5 tasks with various statuses`);
  console.log(`  - 12 evidence files`);
  console.log(`  - 5 comments`);
  console.log(`  - 1 finding`);
  console.log(`  - 6 audit log entries`);

  console.log("Seed completed successfully.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
