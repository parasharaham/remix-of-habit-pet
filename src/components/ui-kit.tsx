import type { ComponentType, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------- surfaces */

export function Card({
  children,
  className,
  interactive,
  glass,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  glass?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.75rem] border border-border/60 p-5 shadow-card md:p-6",
        glass ? "glass" : "bg-card",
        interactive && "surface-lift",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  icon: Icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  action?: { label: string; to: string };
}) {
  return (
    <header className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Icon size={18} />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold md:text-xl">{title}</h2>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action && (
        <Link
          to={action.to}
          className="focus-ring shrink-0 rounded-full bg-muted px-3 py-1.5 text-xs font-bold text-foreground/80 transition hover:bg-primary hover:text-primary-foreground"
        >
          {action.label}
        </Link>
      )}
    </header>
  );
}

/* ------------------------------------------------------------ empty / load */

export function EmptyState({
  emoji = "✨",
  title,
  description,
  action,
}: {
  emoji?: string;
  title: string;
  description?: string;
  action?: { label: string; to: string };
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
      <div className="animate-[float-slow_6s_ease-in-out_infinite] text-4xl">{emoji}</div>
      <p className="font-bold">{title}</p>
      {description && <p className="max-w-xs text-sm text-muted-foreground">{description}</p>}
      {action && (
        <Link
          to={action.to}
          className="focus-ring mt-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:opacity-90 active:scale-95"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4 w-full", className)} />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <Card>
      <Skeleton className="mb-4 h-6 w-1/3" />
      <div className="space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={i % 2 ? "h-10 w-5/6" : "h-10"} />
        ))}
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------- indicators */

export function ProgressRing({
  value,
  max = 100,
  size = 132,
  stroke = 12,
  color = "var(--primary)",
  label,
  caption,
}: {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: ReactNode;
  caption?: string;
}) {
  const pct = Math.max(0, Math.min(1, value / Math.max(1, max)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="stroke-muted" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          stroke={color}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold leading-none">{label ?? `${Math.round(pct * 100)}%`}</span>
        {caption && <span className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{caption}</span>}
      </div>
    </div>
  );
}

export function StatTile({
  icon,
  label,
  value,
  tone = "muted",
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  tone?: "muted" | "blue" | "green" | "orange" | "purple" | "pink";
}) {
  const tones: Record<string, string> = {
    muted: "bg-muted/60 text-foreground",
    blue: "bg-brand-blue/15 text-brand-blue",
    green: "bg-brand-green/15 text-brand-green",
    orange: "bg-brand-orange/15 text-brand-orange",
    purple: "bg-brand-purple/15 text-brand-purple",
    pink: "bg-brand-pink/15 text-brand-pink",
  };
  return (
    <div className="rounded-2xl bg-muted/40 p-3 text-center transition hover:bg-muted/70">
      <div className={cn("mx-auto grid h-9 w-9 place-items-center rounded-xl", tones[tone])}>{icon}</div>
      <div className="mt-2 text-lg font-bold leading-tight">{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

export function Pill({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "success" | "warning" | "danger" | "info" }) {
  const tones: Record<string, string> = {
    muted: "bg-muted text-muted-foreground",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    danger: "bg-danger/15 text-danger",
    info: "bg-info/15 text-info",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold", tones[tone])}>
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------- delight */

export function Confetti({ fire }: { fire: number }) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!fire) return;
    setActive(true);
    const t = setTimeout(() => setActive(false), 1400);
    return () => clearTimeout(t);
  }, [fire]);

  const pieces = useMemo(
    () =>
      Array.from({ length: 26 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        dx: `${Math.round((Math.random() - 0.5) * 160)}px`,
        delay: Math.random() * 220,
        color: ["var(--brand-pink)", "var(--brand-blue)", "var(--brand-green)", "var(--brand-yellow)", "var(--brand-purple)"][i % 5],
      })),
    [fire],
  );

  if (!active) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute block h-2.5 w-1.5 rounded-[2px]"
          style={{
            left: `${p.left}%`,
            background: p.color,
            // @ts-expect-error custom property
            "--dx": p.dx,
            animation: `confetti-fall 1.3s cubic-bezier(.22,1,.36,1) ${p.delay}ms forwards`,
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ premium kit */

import { motion, useMotionValue, useSpring, useInView } from "motion/react";
import { useRef } from "react";

export function Button({
  children,
  variant = "primary",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "glass" | "danger";
}) {
  const base = variant === "primary" ? "btn-primary" : variant === "glass" ? "btn-glass" : "btn-danger";
  return (
    <button {...rest} className={cn(base, "focus-ring disabled:pointer-events-none disabled:opacity-50", className)}>
      {children}
    </button>
  );
}

/** Number that springs/counts up when the value changes. */
export function AnimatedNumber({
  value,
  decimals = 0,
  className,
}: {
  value: number;
  decimals?: number;
  className?: string;
}) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 90, damping: 20, mass: 0.6 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    mv.set(value);
  }, [value, mv]);

  useEffect(() => spring.on("change", (v) => setDisplay(v)), [spring]);

  return <span className={className}>{display.toFixed(decimals)}</span>;
}

/** Fades + rises children into view, with optional stagger index. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 18 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Glass card with a gradient glow border and hover float. */
export function GlowCard({
  children,
  className,
  tone = "blue",
}: {
  children: ReactNode;
  className?: string;
  tone?: "blue" | "green" | "cyan" | "amber" | "none";
}) {
  const glow: Record<string, string> = {
    blue: "shadow-[0_24px_60px_-30px_var(--brand-blue)]",
    green: "shadow-[0_24px_60px_-30px_var(--brand-green)]",
    cyan: "shadow-[0_24px_60px_-30px_var(--brand-cyan)]",
    amber: "shadow-[0_24px_60px_-30px_var(--brand-yellow)]",
    none: "",
  };
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={cn("glow-border glass rounded-[1.75rem] p-5 md:p-6", glow[tone], className)}
    >
      {children}
    </motion.div>
  );
}

/** Animated bar for macros / goals. */
export function GoalBar({
  label,
  value,
  target,
  unit = "",
  color = "var(--brand-blue)",
}: {
  label: string;
  value: number;
  target: number;
  unit?: string;
  color?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, target)) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="text-xs text-muted-foreground">
          <AnimatedNumber value={value} />
          {unit} / {target}
          {unit}
        </span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color, boxShadow: `0 0 16px ${color}` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

/** "AI is thinking" shimmer used instead of spinners. */
export function AIThinking({ label = "AI is thinking" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3 backdrop-blur">
      <span className="relative grid h-8 w-8 place-items-center rounded-full bg-[var(--gradient-primary)]">
        <motion.span
          className="absolute inset-0 rounded-full"
          animate={{ boxShadow: ["0 0 0 0 var(--brand-cyan)", "0 0 0 10px transparent"] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <span className="text-xs">✨</span>
      </span>
      <div className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
        {label}
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18 }}
          >
            .
          </motion.span>
        ))}
      </div>
    </div>
  );
}

/** Page-level entrance wrapper. */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
