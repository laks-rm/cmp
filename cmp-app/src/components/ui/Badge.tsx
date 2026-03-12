type BadgeProps = {
  label: string;
  tone?: "default" | "purple" | "green" | "amber";
};

export function Badge({ label, tone = "default" }: BadgeProps) {
  const tones = {
    default: "bg-slate-100 text-slate-700",
    purple: "bg-purple-100 text-purple-700",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>{label}</span>;
}
