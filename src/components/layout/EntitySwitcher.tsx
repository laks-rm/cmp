"use client";

type EntitySwitcherProps = {
  entities: string[];
};

export function EntitySwitcher({ entities }: EntitySwitcherProps) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
      Entities: <span className="font-medium">{entities.length ? entities.join(", ") : "All"}</span>
    </div>
  );
}
