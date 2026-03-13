"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, CheckCircle, XCircle } from "lucide-react";
import { EntityBadge } from "@/components/ui/EntityBadge";
import toast from "@/lib/toast";

type Entity = {
  id: string;
  code: string;
  name: string;
  shortName: string;
  jurisdiction: string;
  regulator: string;
  isActive: boolean;
  _count?: {
    userAccess: number;
    sourceLinks: number;
  };
};

export function EntitiesTab() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEntities();
  }, []);

  const fetchEntities = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/entities");
      if (!res.ok) throw new Error("Failed to fetch entities");
      const data = await res.json();
      setEntities(data);
    } catch (error) {
      console.error("Failed to fetch entities:", error);
      toast.error("Failed to load entities");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-[14px] border bg-white p-12 text-center" style={{ borderColor: "var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Loading entities...
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
            Entity Configuration
          </h3>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            Manage legal entities and their regulatory details
          </p>
        </div>
        <button
          onClick={() => toast("Add Entity coming soon")}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity"
          style={{ backgroundColor: "var(--blue)" }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <Plus size={16} />
          Add Entity
        </button>
      </div>

      {/* Entities Table */}
      <div className="rounded-[14px] border bg-white" style={{ borderColor: "var(--border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Full Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Jurisdiction
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Regulator
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Users
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Sources
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {entities.map((entity) => (
                <tr
                  key={entity.id}
                  className="transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ borderBottom: "1px solid var(--border-light)" }}
                >
                  <td className="px-4 py-3">
                    <EntityBadge entityCode={entity.code as "DIEL" | "DGL" | "DBVI" | "FINSERV" | "GROUP"} />
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {entity.name}
                      </div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {entity.shortName}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      {entity.jurisdiction}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      {entity.regulator}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}
                    >
                      {entity._count?.userAccess || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-secondary)" }}
                    >
                      {entity._count?.sourceLinks || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {entity.isActive ? (
                      <CheckCircle size={18} style={{ color: "var(--green)", margin: "0 auto" }} />
                    ) : (
                      <XCircle size={18} style={{ color: "var(--text-muted)", margin: "0 auto" }} />
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toast("Edit Entity coming soon")}
                      className="rounded-lg p-2 transition-colors hover:bg-[var(--bg-subtle)]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <Edit2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {entities.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No entities found
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
