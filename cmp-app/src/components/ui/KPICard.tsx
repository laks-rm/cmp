type KPICardProps = {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accentColor: string;
  trend?: { value: string; isPositive: boolean };
  iconBg: string;
};

export function KPICard({ label, value, icon, accentColor, trend, iconBg }: KPICardProps) {
  return (
    <div className="group relative overflow-hidden rounded-[14px] border bg-white shadow-sm transition-all hover:shadow-md" style={{ borderColor: "var(--border)" }}>
      <div className="absolute left-0 top-0 h-[3px] w-full" style={{ backgroundColor: accentColor }} />
      <div className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: iconBg }}>
            {icon}
          </div>
          {trend && (
            <span className={`text-xs font-medium ${trend.isPositive ? "text-green-600" : "text-red-600"}`}>
              {trend.isPositive ? "↑" : "↓"} {trend.value}
            </span>
          )}
        </div>
        <div className="text-[28px] font-bold leading-none" style={{ color: "var(--text-primary)" }}>
          {value}
        </div>
        <div className="mt-1.5 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          {label}
        </div>
      </div>
    </div>
  );
}
