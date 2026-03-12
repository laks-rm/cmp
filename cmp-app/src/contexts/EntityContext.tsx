"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";

type EntityContextType = {
  selectedEntityId: string | "GROUP";
  selectedTeamId: string | "ALL";
  setEntity: (entityId: string | "GROUP") => void;
  setTeam: (teamId: string | "ALL") => void;
};

const EntityContext = createContext<EntityContextType | undefined>(undefined);

export function EntityProvider({ children }: { children: ReactNode }) {
  const [selectedEntityId, setSelectedEntityId] = useState<string | "GROUP">("GROUP");
  const [selectedTeamId, setSelectedTeamId] = useState<string | "ALL">("ALL");

  useEffect(() => {
    const savedEntity = localStorage.getItem("cmp_selected_entity");
    const savedTeam = localStorage.getItem("cmp_selected_team");
    if (savedEntity) {
      setSelectedEntityId(savedEntity);
    }
    if (savedTeam) {
      setSelectedTeamId(savedTeam);
    }
  }, []);

  const setEntity = (entityId: string | "GROUP") => {
    setSelectedEntityId(entityId);
    localStorage.setItem("cmp_selected_entity", entityId);
  };

  const setTeam = (teamId: string | "ALL") => {
    setSelectedTeamId(teamId);
    localStorage.setItem("cmp_selected_team", teamId);
  };

  return <EntityContext.Provider value={{ selectedEntityId, selectedTeamId, setEntity, setTeam }}>{children}</EntityContext.Provider>;
}

export function useEntity() {
  const context = useContext(EntityContext);
  if (!context) {
    throw new Error("useEntity must be used within EntityProvider");
  }
  return context;
}
