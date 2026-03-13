"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, UserX, Check, X } from "lucide-react";
import { EntityBadge } from "@/components/ui/EntityBadge";
import { Modal } from "@/components/ui/Modal";
import toast from "@/lib/toast";
import { COMMON_TIMEZONES } from "@/lib/timezones";

type User = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  role: {
    id: string;
    displayName: string;
  };
  teamMemberships: Array<{
    team: {
      id: string;
      name: string;
    };
  }>;
  entityAccess: Array<{
    entity: {
      id: string;
      code: string;
      name: string;
    };
  }>;
};

type Role = {
  id: string;
  name: string;
  displayName: string;
};

type Team = {
  id: string;
  name: string;
};

type Entity = {
  id: string;
  code: string;
  name: string;
};

export function UsersAccessTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    roleId: "",
    teamIds: [] as string[],
    entityIds: [] as string[],
    grantAllEntities: false,
    timezone: "UTC",
  });

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/roles");
      if (res.ok) {
        const data = await res.json();
        setRoles(data);
      }
    } catch (error) {
      console.error("Failed to fetch roles:", error);
    }
  }, []);

  const fetchTeamsAndEntities = useCallback(async () => {
    try {
      const [teamsRes, entitiesRes] = await Promise.all([
        fetch("/api/teams"),
        fetch("/api/entities"),
      ]);

      if (teamsRes.ok) {
        const teamsData = await teamsRes.json();
        setTeams(teamsData);
      }

      if (entitiesRes.ok) {
        const entitiesData = await entitiesRes.json();
        setEntities(entitiesData);
      }
    } catch (error) {
      console.error("Failed to fetch teams/entities:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
    fetchTeamsAndEntities();
  }, [fetchUsers, fetchRoles, fetchTeamsAndEntities]);

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        password: "",
        roleId: user.role.id,
        teamIds: user.teamMemberships.map((tm) => tm.team.id),
        entityIds: user.entityAccess.map((ea) => ea.entity.id),
        grantAllEntities: user.entityAccess.length === entities.length,
        timezone: (user as User & { timezone?: string }).timezone || "UTC",
      });
    } else {
      setEditingUser(null);
      setFormData({
        name: "",
        email: "",
        password: "",
        roleId: "",
        teamIds: [],
        entityIds: [],
        grantAllEntities: false,
        timezone: "UTC",
      });
    }
    setShowUserModal(true);
  };

  const handleCloseModal = () => {
    setShowUserModal(false);
    setEditingUser(null);
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        ...formData,
        entityIds: formData.grantAllEntities ? entities.map((e) => e.id) : formData.entityIds,
      };

      const res = editingUser
        ? await fetch(`/api/admin/users/${editingUser.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save user");
      }

      toast.success(editingUser ? "User updated" : "User created");
      handleCloseModal();
      fetchUsers();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to save user";
      toast.error(message);
    }
  };

  const handleDeactivate = async (userId: string) => {
    if (!confirm("Are you sure you want to deactivate this user?")) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });

      if (!res.ok) throw new Error("Failed to deactivate user");

      toast.success("User deactivated");
      fetchUsers();
    } catch {
      toast.error("Failed to deactivate user");
    }
  };

  const getScope = (user: User): string => {
    if (user.entityAccess.length === entities.length) return "Group-wide";
    if (user.entityAccess.length > 1) return "Multi-entity";
    return "Single entity";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Loading users...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {users.length} user{users.length !== 1 ? "s" : ""} · {users.filter((u) => u.isActive).length} active
        </p>
        <button
          onClick={() => handleOpenModal()}
          className="flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium text-white transition-opacity"
          style={{ backgroundColor: "var(--blue)" }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <Plus size={16} />
          Add User
        </button>
      </div>

      {/* Users Table */}
      <div className="rounded-[14px] border bg-white" style={{ borderColor: "var(--border)" }}>
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border-light)", backgroundColor: "var(--bg-subtle)" }}>
              <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                User
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Teams
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Entity Access
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Scope
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                className="border-t transition-colors hover:bg-[var(--bg-hover)]"
                style={{ borderColor: "var(--border-light)" }}
              >
                <td className="px-4 py-3">
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {user.name}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    {user.email}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className="rounded-full px-2 py-1 text-xs font-medium"
                    style={{ backgroundColor: "var(--purple-light)", color: "var(--purple)" }}
                  >
                    {user.role.displayName}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    {user.teamMemberships.map((tm) => tm.team.name).join(", ") || "—"}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {user.entityAccess.map((ea) => (
                      <EntityBadge key={ea.entity.id} entityCode={ea.entity.code as "DIEL" | "DGL" | "DBVI" | "FINSERV" | "GROUP"} />
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    {getScope(user)}
                  </p>
                </td>
                <td className="px-4 py-3">
                  {user.isActive ? (
                    <span className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--green)" }}>
                      <Check size={14} />
                      Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                      <X size={14} />
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenModal(user)}
                      className="rounded-lg p-1.5 transition-colors"
                      style={{ color: "var(--text-secondary)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <Edit2 size={16} />
                    </button>
                    {user.isActive && (
                      <button
                        onClick={() => handleDeactivate(user.id)}
                        className="rounded-lg p-1.5 transition-colors"
                        style={{ color: "var(--red)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--red-light)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <UserX size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* User Modal */}
      <Modal isOpen={showUserModal} onClose={handleCloseModal} title={editingUser ? "Edit User" : "Add User"}>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Password {editingUser && "(leave blank to keep current)"}
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              placeholder={editingUser ? "Leave blank to keep current" : ""}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Role
            </label>
            <select
              value={formData.roleId}
              onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              <option value="">Select role...</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.displayName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Timezone
            </label>
            <select
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blue)]"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Team Memberships
            </label>
            <div className="space-y-2">
              {teams.map((team) => (
                <label key={team.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.teamIds.includes(team.id)}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        teamIds: e.target.checked
                          ? [...formData.teamIds, team.id]
                          : formData.teamIds.filter((id) => id !== team.id),
                      });
                    }}
                    className="rounded"
                  />
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    {team.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Entity Access
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.grantAllEntities}
                  onChange={(e) => setFormData({ ...formData, grantAllEntities: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm font-medium" style={{ color: "var(--purple)" }}>
                  All Entities (Group-wide)
                </span>
              </label>
              {!formData.grantAllEntities &&
                entities.map((entity) => (
                  <label key={entity.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.entityIds.includes(entity.id)}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          entityIds: e.target.checked
                            ? [...formData.entityIds, entity.id]
                            : formData.entityIds.filter((id) => id !== entity.id),
                        });
                      }}
                      className="rounded"
                    />
                    <EntityBadge entityCode={entity.code as "DIEL" | "DGL" | "DBVI" | "FINSERV" | "GROUP"} />
                    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      {entity.name}
                    </span>
                  </label>
                ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={handleCloseModal}
              className="h-9 rounded-lg border px-4 text-sm font-medium transition-colors"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="h-9 rounded-lg px-4 text-sm font-medium text-white transition-opacity"
              style={{ backgroundColor: "var(--blue)" }}
            >
              {editingUser ? "Update User" : "Create User"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
