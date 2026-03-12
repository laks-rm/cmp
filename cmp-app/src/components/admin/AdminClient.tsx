"use client";

import { useState } from "react";
import { Users, Shield, Building2, Users2, Bell } from "lucide-react";
import { UsersAccessTab } from "@/components/admin/UsersAccessTab";
import { RolesPermissionsTab } from "@/components/admin/RolesPermissionsTab";
import { EntitiesTab } from "@/components/admin/EntitiesTab";
import { TeamsWorkflowsTab } from "@/components/admin/TeamsWorkflowsTab";
import { NotificationsTab } from "@/components/admin/NotificationsTab";

type Tab = "users" | "roles" | "entities" | "teams" | "notifications";

const TABS = [
  { id: "users" as const, label: "Users & Access", icon: Users },
  { id: "roles" as const, label: "Roles & Permissions", icon: Shield },
  { id: "entities" as const, label: "Entities", icon: Building2 },
  { id: "teams" as const, label: "Teams & Workflows", icon: Users2 },
  { id: "notifications" as const, label: "Notifications", icon: Bell },
];

export function AdminClient() {
  const [activeTab, setActiveTab] = useState<Tab>("users");

  return (
    <div className="space-y-6 px-6 py-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
          Administration
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Manage users, roles, entities, and system configuration
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b" style={{ borderColor: "var(--border)" }}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors"
              style={{
                borderColor: isActive ? "var(--blue)" : "transparent",
                color: isActive ? "var(--blue)" : "var(--text-secondary)",
                marginBottom: "-1px",
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = "var(--text-secondary)";
              }}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[600px]">
        {activeTab === "users" && <UsersAccessTab />}
        {activeTab === "roles" && <RolesPermissionsTab />}
        {activeTab === "entities" && <EntitiesTab />}
        {activeTab === "teams" && <TeamsWorkflowsTab />}
        {activeTab === "notifications" && <NotificationsTab />}
      </div>
    </div>
  );
}
