"use client";

import { useState, useEffect } from "react";
import { Plus, Settings, CheckCircle, XCircle } from "lucide-react";
import toast from "react-hot-toast";

type Team = {
  id: string;
  name: string;
  description: string | null;
  approvalRequired: boolean;
  evidenceRequired: boolean;
  narrativeRequired: boolean;
  statusFlow: unknown;
  isActive: boolean;
  _count?: {
    memberships: number;
  };
};

export function TeamsWorkflowsTab() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/teams");
      if (!res.ok) throw new Error("Failed to fetch teams");
      const data = await res.json();
      setTeams(data);
    } catch (error) {
      console.error("Failed to fetch teams:", error);
      toast.error("Failed to load teams");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (teamId: string, field: "approvalRequired" | "evidenceRequired" | "narrativeRequired", currentValue: boolean) => {
    try {
      setUpdating(teamId);
      const res = await fetch(`/api/teams`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          [field]: !currentValue,
        }),
      });

      if (!res.ok) throw new Error("Failed to update team");

      // Update local state
      setTeams((prev) =>
        prev.map((team) =>
          team.id === teamId ? { ...team, [field]: !currentValue } : team
        )
      );

      toast.success("Team settings updated");
    } catch (error) {
      console.error("Failed to update team:", error);
      toast.error("Failed to update team settings");
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-[14px] border bg-white p-12 text-center" style={{ borderColor: "var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Loading teams...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Teams & Workflows
          </h3>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            Configure team workflows and approval requirements
          </p>
        </div>
        <button
          onClick={() => toast("Add Team coming soon")}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity"
          style={{ backgroundColor: "var(--blue)" }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <Plus size={16} />
          Add Team
        </button>
      </div>

      {/* Teams Table */}
      <div className="rounded-[14px] border bg-white" style={{ borderColor: "var(--border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Team Name
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Approval Workflow
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Evidence Required
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Narrative Required
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Members
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr
                  key={team.id}
                  className="transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ borderBottom: "1px solid var(--border-light)" }}
                >
                  <td className="px-4 py-3">
                    <div>
                      <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {team.name}
                      </div>
                      {team.description && (
                        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {team.description}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggle(team.id, "approvalRequired", team.approvalRequired)}
                      disabled={updating === team.id}
                      className="rounded-full p-1 transition-colors disabled:opacity-50"
                      style={{
                        backgroundColor: team.approvalRequired ? "var(--green-light)" : "var(--bg-subtle)",
                      }}
                    >
                      {team.approvalRequired ? (
                        <CheckCircle size={18} style={{ color: "var(--green)" }} />
                      ) : (
                        <XCircle size={18} style={{ color: "var(--text-muted)" }} />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggle(team.id, "evidenceRequired", team.evidenceRequired)}
                      disabled={updating === team.id}
                      className="rounded-full p-1 transition-colors disabled:opacity-50"
                      style={{
                        backgroundColor: team.evidenceRequired ? "var(--green-light)" : "var(--bg-subtle)",
                      }}
                    >
                      {team.evidenceRequired ? (
                        <CheckCircle size={18} style={{ color: "var(--green)" }} />
                      ) : (
                        <XCircle size={18} style={{ color: "var(--text-muted)" }} />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggle(team.id, "narrativeRequired", team.narrativeRequired)}
                      disabled={updating === team.id}
                      className="rounded-full p-1 transition-colors disabled:opacity-50"
                      style={{
                        backgroundColor: team.narrativeRequired ? "var(--green-light)" : "var(--bg-subtle)",
                      }}
                    >
                      {team.narrativeRequired ? (
                        <CheckCircle size={18} style={{ color: "var(--green)" }} />
                      ) : (
                        <XCircle size={18} style={{ color: "var(--text-muted)" }} />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}
                    >
                      {team._count?.memberships || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toast("Configure team coming soon")}
                      className="rounded-lg p-2 transition-colors hover:bg-[var(--bg-subtle)]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <Settings size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {teams.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No teams found
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
