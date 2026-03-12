type EntityBadgeProps = {
  entityCode: "DIEL" | "DGL" | "DBVI" | "FINSERV" | "GROUP";
  size?: "sm" | "md";
};

const ENTITY_CONFIG = {
  DIEL: { label: "DIEL", bg: "#E0F2F1", color: "#00796B" },
  DGL: { label: "DGL", bg: "#E8EAF6", color: "#3949AB" },
  DBVI: { label: "DBVI", bg: "#FFF3E0", color: "#E65100" },
  FINSERV: { label: "FINSERV", bg: "#FFEBEE", color: "#C62828" },
  GROUP: { label: "GROUP", bg: "var(--purple-light)", color: "var(--purple)" },
};

export function EntityBadge({ entityCode, size = "sm" }: EntityBadgeProps) {
  const config = ENTITY_CONFIG[entityCode];
  const sizeClasses = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs";
  return (
    <span className={`inline-flex items-center rounded font-medium uppercase tracking-wide ${sizeClasses}`} style={{ backgroundColor: config.bg, color: config.color }}>
      {config.label}
    </span>
  );
}
