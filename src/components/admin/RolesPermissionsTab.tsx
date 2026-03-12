"use client";

import { useState, useEffect } from "react";
import { Plus, Check, X, Minus, Save } from "lucide-react";
import toast from "react-hot-toast";

type Role = {
  id: string;
  name: string;
  displayName: string;
  description: string;
  isSystem: boolean;
  isActive: boolean;
  permissions: RolePermission[];
};

type RolePermission = {
  id: string;
  roleId: string;
  permissionId: string;
  granted: boolean;
  permission: {
    id: string;
    module: string;
    action: string;
    description: string;
  };
};

type PermissionModule = {
  category: string;
  modules: {
    name: string;
    actions: string[];
  }[];
};

const PERMISSION_STRUCTURE: PermissionModule[] = [
  {
    category: "Core Modules",
    modules: [
      { name: "Dashboard", actions: ["VIEW"] },
      { name: "Sources", actions: ["VIEW", "CREATE", "EDIT", "DELETE"] },
      { name: "Tasks", actions: ["VIEW", "CREATE", "EDIT", "DELETE", "EXPORT"] },
      { name: "Task Execution", actions: ["VIEW", "EDIT", "APPROVE"] },
      { name: "Review Queue", actions: ["VIEW", "APPROVE"] },
      { name: "Findings", actions: ["VIEW", "CREATE", "EDIT", "DELETE"] },
    ],
  },
  {
    category: "Insights",
    modules: [
      { name: "Reports", actions: ["VIEW", "EXPORT"] },
      { name: "Audit Log", actions: ["VIEW", "EXPORT"] },
    ],
  },
  {
    category: "Administration",
    modules: [
      { name: "User Management", actions: ["VIEW", "CREATE", "EDIT", "DELETE", "ADMIN_CONFIG"] },
      { name: "Role Management", actions: ["VIEW", "EDIT", "ADMIN_CONFIG"] },
      { name: "Entity Config", actions: ["VIEW", "EDIT", "ADMIN_CONFIG"] },
      { name: "Team Config", actions: ["VIEW", "CREATE", "EDIT", "ADMIN_CONFIG"] },
      { name: "Workflow Config", actions: ["VIEW", "EDIT", "ADMIN_CONFIG"] },
      { name: "Notification Config", actions: ["VIEW", "EDIT", "ADMIN_CONFIG"] },
    ],
  },
];

export function RolesPermissionsTab() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/roles");
      if (!res.ok) throw new Error("Failed to fetch roles");
      const data = await res.json();
      setRoles(data);
      if (data.length > 0 && !selectedRoleId) {
        setSelectedRoleId(data[0].id);
      }
    } catch (error) {
      console.error("Failed to fetch roles:", error);
      toast.error("Failed to load roles");
    } finally {
      setLoading(false);
    }
  };

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  const hasPermission = (module: string, action: string): boolean | null => {
    if (!selectedRole) return null;
    const perm = selectedRole.permissions.find(
      (p) => p.permission.module === module.toUpperCase().replace(/ /g, "_") && p.permission.action === action
    );
    return perm?.granted ?? null;
  };

  const handleTogglePermission = async (module: string, action: string) => {
    if (!selectedRole || selectedRole.isSystem) {
      toast.error("Cannot modify system role permissions");
      return;
    }

    const moduleKey = module.toUpperCase().replace(/ /g, "_");
    const currentValue = hasPermission(module, action);
    const newValue = currentValue === null ? true : !currentValue;

    try {
      setUpdating(true);
      
      // In a real implementation, call the API to update the permission
      toast("Permission update coming soon");

      // Update local state
      setRoles((prev) =>
        prev.map((role) => {
          if (role.id !== selectedRoleId) return role;
          const perm = role.permissions.find(
            (p) => p.permission.module === moduleKey && p.permission.action === action
          );
          if (perm) {
            return {
              ...role,
              permissions: role.permissions.map((p) =>
                p.id === perm.id ? { ...p, granted: newValue } : p
              ),
            };
          }
          return role;
        })
      );
    } catch (error) {
      console.error("Failed to update permission:", error);
      toast.error("Failed to update permission");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-[14px] border bg-white p-12 text-center" style={{ borderColor: "var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Loading roles...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Roles & Permissions
          </h3>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            Configure access permissions for each role
          </p>
        </div>
        <button
          onClick={() => toast("Create Custom Role coming soon")}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity"
          style={{ backgroundColor: "var(--blue)" }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <Plus size={16} />
          Create Custom Role
        </button>
      </div>

      {/* Role Selector Chips */}
      <div className="flex flex-wrap gap-2">
        {roles.map((role) => (
          <button
            key={role.id}
            onClick={() => setSelectedRoleId(role.id)}
            className="rounded-full px-4 py-2 text-sm font-medium transition-colors"
            style={{
              backgroundColor: selectedRoleId === role.id ? "var(--blue)" : "var(--bg-subtle)",
              color: selectedRoleId === role.id ? "white" : "var(--text-secondary)",
            }}
            onMouseEnter={(e) => {
              if (selectedRoleId !== role.id) {
                e.currentTarget.style.backgroundColor = "var(--bg-muted)";
              }
            }}
            onMouseLeave={(e) => {
              if (selectedRoleId !== role.id) {
                e.currentTarget.style.backgroundColor = "var(--bg-subtle)";
              }
            }}
          >
            {role.displayName}
          </button>
        ))}
      </div>

      {/* Role Description Banner */}
      {selectedRole && (
        <div className="rounded-[14px] border bg-white p-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                {selectedRole.displayName}
              </h4>
              <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                {selectedRole.description}
              </p>
              {selectedRole.isSystem && (
                <p className="mt-2 text-xs font-medium" style={{ color: "var(--amber)" }}>
                  System role — permissions cannot be modified
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Permission Matrix */}
      <div className="space-y-6">
        {PERMISSION_STRUCTURE.map((category) => (
          <div key={category.category}>
            <h4 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {category.category}
            </h4>
            <div className="rounded-[14px] border bg-white" style={{ borderColor: "var(--border)" }}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)", minWidth: "180px" }}>
                        Module
                      </th>
                      {["VIEW", "CREATE", "EDIT", "DELETE", "APPROVE", "EXPORT", "ADMIN_CONFIG"].map((action) => (
                        <th key={action} className="px-4 py-3 text-center text-xs font-medium" style={{ color: "var(--text-secondary)", minWidth: "80px" }}>
                          {action.replace("_", " ")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {category.modules.map((module) => (
                      <tr
                        key={module.name}
                        className="transition-colors hover:bg-[var(--bg-hover)]"
                        style={{ borderBottom: "1px solid var(--border-light)" }}
                      >
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            {module.name}
                          </span>
                        </td>
                        {["VIEW", "CREATE", "EDIT", "DELETE", "APPROVE", "EXPORT", "ADMIN_CONFIG"].map((action) => {
                          const isApplicable = module.actions.includes(action);
                          const granted = hasPermission(module.name, action);

                          return (
                            <td key={action} className="px-4 py-3 text-center">
                              {isApplicable ? (
                                <button
                                  onClick={() => handleTogglePermission(module.name, action)}
                                  disabled={updating || selectedRole?.isSystem}
                                  className="flex items-center justify-center rounded-full p-1.5 transition-colors disabled:opacity-50"
                                  style={{
                                    backgroundColor:
                                      granted === true
                                        ? "var(--green-light)"
                                        : granted === false
                                        ? "var(--red-light)"
                                        : "var(--bg-subtle)",
                                    margin: "0 auto",
                                  }}
                                >
                                  {granted === true ? (
                                    <Check size={16} style={{ color: "var(--green)" }} />
                                  ) : granted === false ? (
                                    <X size={16} style={{ color: "var(--red)" }} />
                                  ) : (
                                    <Minus size={16} style={{ color: "var(--text-muted)" }} />
                                  )}
                                </button>
                              ) : (
                                <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                                  —
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Save/Reset Buttons */}
      <div className="flex items-center justify-end gap-3 rounded-[14px] border bg-white p-4" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={() => fetchRoles()}
          className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "white" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "white")}
        >
          Reset
        </button>
        <button
          onClick={() => toast("Save permissions coming soon")}
          disabled={selectedRole?.isSystem}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
          style={{ backgroundColor: "var(--blue)" }}
          onMouseEnter={(e) => !selectedRole?.isSystem && (e.currentTarget.style.opacity = "0.9")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <Save size={16} />
          Save Changes
        </button>
      </div>
    </div>
  );
}
