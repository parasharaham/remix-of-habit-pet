interface Props {
  label: string;
  value: number;
  max: number;
  variant: "hp" | "happy" | "xp";
  icon?: string;
}

export function StatBar({ label, value, max, variant, icon }: Props) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));

  // HP shifts to red as it depletes
  let fillStyle: React.CSSProperties = {};
  if (variant === "hp") {
    const t = pct / 100; // 0 → red, 1 → green
    fillStyle.background = `linear-gradient(90deg, var(--hp-low), var(--hp) ${Math.max(20, t * 100)}%)`;
  } else if (variant === "happy") {
    fillStyle.background = "var(--happy)";
  } else {
    fillStyle.background = "linear-gradient(90deg, var(--xp), oklch(0.78 0.18 320))";
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span>{icon} {label}</span>
        <span>
          {Math.round(value)}<span className="opacity-50"> / {max}</span>
        </span>
      </div>
      <div className="stat-bar">
        <div className="fill" style={{ width: `${pct}%`, ...fillStyle }} />
      </div>
    </div>
  );
}
