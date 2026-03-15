"use client";

import { signIn } from "next-auth/react";
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

const DEV_USERS: DevUser[] = [
  {
    name: "Lakshmi Bichu",
    role: "Super Admin",
    entityAccess: "All Entities",
    team: "All Teams",
    initials: "LB",
    avatarColor: "from-purple-500 to-indigo-600",
    email: "lakshmi.bichu@cmp.local",
  },
  {
    name: "Gary Roberts",
    role: "Super Admin",
    entityAccess: "All Entities",
    team: "All Teams",
    initials: "GR",
    avatarColor: "from-blue-500 to-cyan-500",
    email: "gary.roberts@cmp.local",
  },
  {
    name: "Sarah Mitchell",
    role: "Manager",
    entityAccess: "DIEL, DGL",
    team: "Compliance",
    initials: "SM",
    avatarColor: "from-emerald-500 to-teal-600",
    email: "sarah.mitchell@cmp.local",
  },
  {
    name: "Wa'ed Al-Rashid",
    role: "Manager",
    entityAccess: "DIEL, DGL, DBVI",
    team: "CompOps",
    initials: "WR",
    avatarColor: "from-orange-500 to-amber-600",
    email: "waed.alrashid@cmp.local",
  },
  {
    name: "Ahmed Khalil",
    role: "Analyst",
    entityAccess: "DIEL",
    team: "Compliance",
    initials: "AK",
    avatarColor: "from-rose-500 to-pink-600",
    email: "ahmed.khalil@cmp.local",
  },
  {
    name: "Reem Khalil",
    role: "Executor",
    entityAccess: "DIEL",
    team: "CompOps",
    initials: "RK",
    avatarColor: "from-slate-500 to-slate-700",
    email: "reem.khalil@cmp.local",
  },
];

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  "Super Admin": { bg: "var(--purple-light)", color: "var(--purple)" },
  Manager: { bg: "var(--blue-light)", color: "var(--blue)" },
  Analyst: { bg: "var(--teal-light)", color: "var(--teal)" },
  Executor: { bg: "var(--amber-light)", color: "var(--amber)" },
};

export function QuickLoginCards() {
  console.log("QuickLoginCards component mounted");
  
  async function handleQuickLogin(email: string) {
    try {
      console.log("=== CLICK HANDLER FIRED ===");
      console.log("Attempting login for:", email);
      
      const result = await signIn("credentials", {
        email,
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
        // Force a hard reload to clear any cached state
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Login exception:", error);
      toast.error("Login failed - check console for details");
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {DEV_USERS.map((user) => {
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
