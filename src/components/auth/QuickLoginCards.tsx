"use client";

import { signIn } from "next-auth/react";
import { useState, useEffect } from "react";
import toast from "@/lib/toast";

type DevUser = {
  name: string;
  role: string;
  entityAccess: string;
  team: string;
  initials: string;
  avatarColor: string;
  email: string;
};

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  "Super Admin": { bg: "var(--purple-light)", color: "var(--purple)" },
  Manager: { bg: "var(--blue-light)", color: "var(--blue)" },
  Analyst: { bg: "var(--teal-light)", color: "var(--teal)" },
  Executor: { bg: "var(--amber-light)", color: "var(--amber)" },
};

const AVATAR_COLORS = [
  "from-purple-500 to-indigo-600",
  "from-blue-500 to-cyan-500",
  "from-emerald-500 to-teal-600",
  "from-orange-500 to-amber-600",
  "from-rose-500 to-pink-600",
  "from-slate-500 to-slate-700",
];

export function QuickLoginCards() {
  const [users, setUsers] = useState<DevUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch("/api/auth/quick-login-users");
        if (res.ok) {
          const data = await res.json();
          const formattedUsers = data.map((u: {
              name: string;
              email: string;
              initials: string;
              avatarColor: string | null;
              role: { displayName: string };
              teamMemberships: Array<{ team: { name: string } }>;
              entityAccess: Array<{ entity: { code: string } }>;
            }, idx: number) => ({
              name: u.name,
              email: u.email,
              initials: u.initials,
              avatarColor: u.avatarColor || AVATAR_COLORS[idx % AVATAR_COLORS.length],
              role: u.role.displayName,
              team: u.teamMemberships.map((tm) => tm.team.name).join(", ") || "No team",
              entityAccess: u.entityAccess.length === 0
                ? "No access"
                : u.entityAccess.map((ea) => ea.entity.code).join(", "),
            }));
          setUsers(formattedUsers);
        }
      } catch (error) {
        console.error("Failed to fetch users:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

  async function handleQuickLogin(email: string) {
    try {
      console.log("Attempting quick login for:", email);

      const result = await signIn("credentials", {
        email: email,
        password: "password123",
        redirect: false,
        callbackUrl: "/",
      });

      console.log("Sign in result:", result);

      if (result?.error) {
        console.error("Login error:", result.error);
        toast.error("Quick login failed: " + result.error);
        return;
      }

      if (result?.ok) {
        toast.success("Signed in successfully");
        console.log("Redirecting to dashboard...");
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Login exception:", error);
      toast.error("Login failed - check console for details");
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-[14px] border bg-white p-4"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="h-11 w-11 rounded-full bg-gray-200"></div>
              <div className="h-5 w-20 rounded-full bg-gray-200"></div>
            </div>
            <div className="mb-2 h-5 w-3/4 rounded bg-gray-200"></div>
            <div className="space-y-1">
              <div className="h-3 w-full rounded bg-gray-200"></div>
              <div className="h-3 w-2/3 rounded bg-gray-200"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {users.map((user) => {
        const roleConfig = ROLE_COLORS[user.role] || { bg: "var(--bg-subtle)", color: "var(--text-secondary)" };
        return (
          <button
            key={user.email}
            type="button"
            className="group rounded-[14px] border bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--blue)] hover:shadow-md"
            style={{ borderColor: "var(--border)" }}
            onClick={() => handleQuickLogin(user.email)}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white ${user.avatarColor}`}>{user.initials}</div>
              <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ backgroundColor: roleConfig.bg, color: roleConfig.color }}>
                {user.role}
              </span>
            </div>
            <p className="mb-2 font-semibold" style={{ color: "var(--text-primary)" }}>
              {user.name}
            </p>
            <div className="space-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
              <p>Entities: {user.entityAccess}</p>
              <p>Team: {user.team}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
