import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MODULES = [
  "DASHBOARD",
  "SOURCES",
  "TASKS",
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
const CORE_MODULES = new Set(["DASHBOARD", "SOURCES", "TASKS", "TASK_EXECUTION", "REVIEW_QUEUE", "FINDINGS", "REPORTS", "AUDIT_LOG"]);

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
  if ((module === "DASHBOARD" || module === "TASKS") && action === "VIEW") {
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
