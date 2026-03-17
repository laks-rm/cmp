"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";

type Entity = {
  id: string;
  code: string;
  name: string;
};

type EntityContextType = {
  selectedEntityId: string | "GROUP";
  selectedTeamId: string | "ALL";
  selectedEntity: Entity | null;
  entities: Entity[];
  setEntity: (entityId: string | "GROUP") => void;
  setTeam: (teamId: string | "ALL") => void;
  setEntities: (entities: Entity[]) => void;
};

const EntityContext = createContext<EntityContextType | undefined>(undefined);

export function EntityProvider({ children }: { children: ReactNode }) {
  const [selectedEntityId, setSelectedEntityId] = useState<string | "GROUP">("GROUP");
  const [selectedTeamId, setSelectedTeamId] = useState<string | "ALL">("ALL");
  const [entities, setEntitiesState] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);

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

  useEffect(() => {
    if (selectedEntityId === "GROUP") {
      setSelectedEntity(null);
    } else {
      const entity = entities.find((e) => e.id === selectedEntityId);
      setSelectedEntity(entity || null);
    }
  }, [selectedEntityId, entities]);

  const setEntity = (entityId: string | "GROUP") => {
    setSelectedEntityId(entityId);
    localStorage.setItem("cmp_selected_entity", entityId);
  };

  const setTeam = (teamId: string | "ALL") => {
    setSelectedTeamId(teamId);
    localStorage.setItem("cmp_selected_team", teamId);
  };

  const setEntities = (newEntities: Entity[]) => {
    setEntitiesState(newEntities);
  };

  return <EntityContext.Provider value={{ selectedEntityId, selectedTeamId, selectedEntity, entities, setEntity, setTeam, setEntities }}>{children}</EntityContext.Provider>;
}

export function useEntity() {
  const context = useContext(EntityContext);
  if (!context) {
    throw new Error("useEntity must be used within EntityProvider");
  }
  return context;
}
