import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAnalytics } from "@/lib/analytics.functions";
import {
  getNutritionAnalytics,
  type DayPoint,
  type NutritionAnalyticsDTO,
  type RangeKey,
} from "@/lib/nutrition-analytics.functions";
import { CLASSIFICATION_LABEL } from "@/lib/food.functions";
import { getProfile } from "@/lib/profile.functions";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — HabitPet" },
      {
        name: "description",
        content: "Nutrition progress charts, food health score, habit consistency, and pet growth trends.",
      },
      { property: "og:title", content: "Analytics — HabitPet" },
      {
        property: "og:description",
        content: "Track calories, macros, food health score, and habit consistency over time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsPage,
});

const RANGES: { id: RangeKey; label: string }[] = [
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "1y", label: "1Y" },
];

const METRICS = [
  { id: "calories", label: "Calories", unit: "kcal", color: "#f5a524" },
  { id: "protein_g", label: "Protein", unit: "g", color: "#3b82f6" },
  { id: "carbs_g", label: "Carbs", unit: "g", color: "#f97316" },
  { id: "fat_g", label: "Fat", unit: "g", color: "#ec4899" },
  { id: "fiber_g", label: "Fiber", unit: "g", color: "#10b981" },
] as const;

type MetricId = (typeof METRICS)[number]["id"];

function AnalyticsPage() {
  const [tab, setTab] = useState<"nutrition" | "habits">("nutrition");
  const [range, setRange] = useState<RangeKey>("7d");
  const [metric, setMetric] = useState<MetricId>("calories");

  const fetchNutrition = useServerFn(getNutritionAnalytics);
  const fetchAnalytics = useServerFn(getAnalytics);
  const fetchProf = useServerFn(getProfile);

  const nutrition = useQuery({
    queryKey: ["nutrition-analytics", range],
    queryFn: () => fetchNutrition({ data: { range } }),
  });
  const analytics = useQuery({ queryKey: ["analytics"], queryFn: () => fetchAnalytics() });
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => fetchProf() });

  return (
    <AppShell title="Analytics" isAdmin={profile.data?.is_admin}>
      <div className="mb-5 flex rounded-full bg-[#f4efe2] p-1 dark:bg-muted">
        {(["nutrition", "habits"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-bold capitalize transition-colors ${
              tab === t ? "bg-card shadow-card" : "text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "nutrition" ? (
        <NutritionTab
          data={nutrition.data}
          loading={nutrition.isPending}
          range={range}
          setRange={setRange}
          metric={metric}
          setMetric={setMetric}
        />
      ) : (
        <HabitsTab analytics={analytics.data} profile={profile.data} />
      )}
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */
/* Nutrition                                                           */
/* ------------------------------------------------------------------ */

function NutritionTab({
  data,
  loading,
  range,
  setRange,
  metric,
  setMetric,
}: {
  data: NutritionAnalyticsDTO | undefined;
  loading: boolean;
  range: RangeKey;
  setRange: (r: RangeKey) => void;
  metric: MetricId;
  setMetric: (m: MetricId) => void;
}) {
  const active = METRICS.find((m) => m.id === metric)!;
  const goal = data?.targets
    ? metric === "calories"
      ? data.targets.calories
      : metric === "protein_g"
        ? data.targets.protein_g
        : metric === "carbs_g"
          ? data.targets.carbs_g
          : metric === "fat_g"
            ? data.targets.fat_g
            : data.targets.fiber_g
    : null;

  return (
    <div className="space-y-5">
      {/* Range selector */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Nutrition Progress</h2>
        <div className="flex rounded-full bg-[#f4efe2] p-1 dark:bg-muted">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                range === r.id ? "bg-card shadow-card" : "text-muted-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Line chart card */}
      <section className="rounded-[2rem] bg-card p-6 shadow-pet md:p-8">
        <div className="mb-4 flex flex-wrap gap-2">
          {METRICS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMetric(m.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                metric === m.id ? "text-card" : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
              style={metric === m.id ? { background: m.color, color: "#fff" } : undefined}
            >
              {m.label}
            </button>
          ))}
        </div>

        {loading && !data ? (
          <div className="h-56 animate-pulse rounded-2xl bg-muted" />
        ) : !data?.has_data ? (
          <EmptyState />
        ) : (
          <>
            <div className="mb-2 flex items-end gap-3">
              <div className="text-4xl font-bold">
                {(data.averages as any)[metric] ?? 0}
                <span className="ml-1 text-base font-semibold text-muted-foreground">{active.unit}</span>
              </div>
              <div className="pb-1.5 text-xs font-semibold text-muted-foreground">
                daily average{goal ? ` · goal ${goal}${active.unit}` : ""}
              </div>
            </div>
            <LineChart days={data.days} metric={metric} color={active.color} goal={goal} />
          </>
        )}
      </section>

      {/* Today's nutrition */}
      <section className="rounded-[2rem] bg-card p-6 shadow-pet md:p-8">
        <h2 className="mb-1 text-lg font-bold">Today's nutrition</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {data?.targets
            ? data.targets.minor
              ? "Age-appropriate guidance — these are general reference amounts, not restrictions."
              : "Progress against your personalized targets."
            : "Add your age, height and weight in settings for personalized targets."}
        </p>
        <div className="space-y-4">
          {METRICS.map((m) => {
            const value = data ? ((data.today as any)[m.id] as number) : 0;
            const target = data?.targets ? ((data.targets as any)[m.id] as number) : null;
            const pct = target ? Math.min(100, Math.round((value / target) * 100)) : 0;
            return (
              <div key={m.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{m.label}</span>
                  <span className="text-muted-foreground">
                    {value}
                    {m.unit}
                    {target ? ` / ${target}${m.unit}` : ""}
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: m.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Health score + stats */}
      <div className="grid gap-5 md:grid-cols-3">
        <section className="rounded-[2rem] bg-[#fdf6e3] p-6 shadow-pet dark:bg-card">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Food Health Score
          </div>
          <div className="mt-2 flex items-center gap-4">
            <ScoreRing score={data?.health_score ?? 0} />
            <div className="text-sm text-muted-foreground">
              {scoreLabel(data?.health_score ?? 0)}
              <div className="mt-1 text-xs">
                Goal fit, balance and logging consistency combined.
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] bg-card p-6 shadow-pet">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Goal completion
          </div>
          <div className="mt-2 text-4xl font-bold">{data?.goal_completion ?? 0}%</div>
          <p className="mt-1 text-xs text-muted-foreground">Average across logged days.</p>
        </section>

        <section className="rounded-[2rem] bg-card p-6 shadow-pet">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Meals logged
          </div>
          <div className="mt-2 text-4xl font-bold">{data?.meals_logged ?? 0}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            {data?.balanced_meals ?? 0} balanced ({data?.balanced_rate ?? 0}%)
          </p>
        </section>
      </div>

      {/* Insights */}
      <section className="rounded-[2rem] bg-card p-6 shadow-pet md:p-8">
        <h2 className="mb-3 text-lg font-bold">Trend insights</h2>
        <ul className="space-y-2.5 text-sm">
          {(data?.insights ?? ["Log a few meals to unlock insights."]).map((i, idx) => (
            <li key={idx} className="flex gap-2.5">
              <span className="mt-0.5 text-[#f5a524]">◆</span>
              <span className="text-muted-foreground">{i}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Today's meals quality */}
      {data && data.today_meals.length > 0 && (
        <section className="rounded-[2rem] bg-card p-6 shadow-pet md:p-8">
          <h2 className="mb-4 text-lg font-bold">Today's meals</h2>
          <ul className="space-y-3">
            {data.today_meals.map((m) => (
              <li key={m.id} className="rounded-2xl bg-muted/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">{m.food_name || m.meal_type}</div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      m.classification === "healthy_balanced"
                        ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                        : m.classification === "moderate"
                          ? "bg-amber-500/12 text-amber-700 dark:text-amber-300"
                          : "bg-sky-500/12 text-sky-700 dark:text-sky-300"
                    }`}
                  >
                    {CLASSIFICATION_LABEL[m.classification]}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {m.calories} kcal · {m.protein_g}g protein · {m.fiber_g}g fiber
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.notes.map((n, i) => (
                    <span key={i} className="rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {n}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Calendar */}
      {data && (
        <section className="rounded-[2rem] bg-card p-6 shadow-pet md:p-8">
          <h2 className="mb-1 text-lg font-bold">Consistency calendar</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Each square is a day — brighter means closer to your nutrition goals.
          </p>
          <Calendar days={data.days} />
        </section>
      )}

      <p className="pb-4 text-center text-xs text-muted-foreground">
        Estimates are approximate and not medical advice.
      </p>
    </div>
  );
}

function scoreLabel(s: number) {
  if (s >= 85) return "Excellent";
  if (s >= 70) return "Strong";
  if (s >= 50) return "Building";
  if (s > 0) return "Getting started";
  return "Not enough data yet";
}

function EmptyState() {
  return (
    <div className="rounded-2xl bg-muted/40 py-14 text-center">
      <div className="text-4xl">🥗</div>
      <p className="mt-3 font-semibold">No meals logged in this period</p>
      <p className="mt-1 text-sm text-muted-foreground">Scan a meal and your charts will fill in.</p>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const off = c - (Math.max(0, Math.min(100, score)) / 100) * c;
  return (
    <svg viewBox="0 0 72 72" className="h-20 w-20 shrink-0 -rotate-90">
      <circle cx="36" cy="36" r={r} fill="none" strokeWidth="8" className="stroke-muted" />
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        strokeWidth="8"
        stroke="#f5a524"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={off}
      />
      <text
        x="36"
        y="36"
        textAnchor="middle"
        dominantBaseline="central"
        className="rotate-90 fill-foreground text-[18px] font-bold"
        style={{ transformOrigin: "36px 36px" }}
      >
        {Math.round(score)}
      </text>
    </svg>
  );
}

function LineChart({
  days,
  metric,
  color,
  goal,
}: {
  days: DayPoint[];
  metric: MetricId;
  color: string;
  goal: number | null;
}) {
  const values = days.map((d) => (d as any)[metric] as number);
  const max = Math.max(1, ...values, goal ?? 0) * 1.15;
  const w = 300;
  const h = 120;
  const step = w / Math.max(1, values.length - 1);

  const path = useMemo(
    () =>
      values
        .map((v, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(2)} ${(h - (v / max) * h).toFixed(2)}`)
        .join(" "),
    [values, step, max],
  );

  const labels = days.filter((_, i) => i % Math.ceil(days.length / 6) === 0);
  const goalY = goal ? h - (goal / max) * h : null;
  const gid = `grad-${metric}`;

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-56 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={w} y1={h * f} y2={h * f} className="stroke-muted" strokeWidth="0.5" />
        ))}
        {goalY !== null && (
          <line
            x1="0"
            x2={w}
            y1={goalY}
            y2={goalY}
            stroke="#111"
            strokeOpacity="0.35"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        )}
        <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill={`url(#${gid})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        {labels.map((d) => (
          <span key={d.date}>{d.date.slice(5)}</span>
        ))}
      </div>
      {goal !== null && (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block h-0 w-5 border-t border-dashed border-foreground/40" />
          Goal line
        </div>
      )}
    </div>
  );
}

function Calendar({ days }: { days: DayPoint[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {days.map((d) => {
        const done = d.goal_completion;
        const bg =
          d.meals === 0
            ? "bg-muted"
            : done >= 80
              ? "bg-emerald-500"
              : done >= 55
                ? "bg-[#f5a524]"
                : "bg-[#f5a524]/40";
        return (
          <div
            key={d.date}
            title={`${d.date}: ${d.meals} meals, ${done}% of goals`}
            className={`h-6 w-6 rounded-md ${bg}`}
          />
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Habits (existing)                                                   */
/* ------------------------------------------------------------------ */

function HabitsTab({ analytics, profile }: { analytics: any; profile: any }) {
  if (!analytics) {
    return <div className="py-20 text-center text-muted-foreground">Crunching numbers…</div>;
  }
  const a = analytics;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Consistency" value={`${a.consistencyScore}%`} icon="📈" />
        <Kpi label="Current streak" value={a.currentStreak} icon="🔥" />
        <Kpi label="Longest streak" value={a.longestStreak} icon="🏆" />
        <Kpi label="Total completions" value={a.totalCompletions} icon="✅" />
      </div>

      <section className="mt-6 rounded-[2rem] bg-card p-6 shadow-pet md:p-8">
        <h2 className="mb-2 text-lg font-bold">Last 14 days</h2>
        <p className="mb-4 text-sm text-muted-foreground">Daily habit completions.</p>
        <BarChart data={a.weekly} />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-[2rem] bg-card p-6 shadow-pet md:p-8">
          <h2 className="mb-2 text-lg font-bold">Last 12 weeks</h2>
          <p className="mb-4 text-sm text-muted-foreground">Weekly habit volume.</p>
          <BarChart data={a.monthly} />
        </div>

        <div className="rounded-[2rem] bg-card p-6 shadow-pet md:p-8">
          <h2 className="mb-2 text-lg font-bold">Cumulative XP (30d)</h2>
          <SimpleLine points={a.xpGrowth.map((p: any) => p.cumulative)} color="var(--xp)" />
        </div>

        <div className="rounded-[2rem] bg-card p-6 shadow-pet md:p-8">
          <h2 className="mb-2 text-lg font-bold">Cumulative coins (30d)</h2>
          <SimpleLine points={a.coinGrowth.map((p: any) => p.cumulative)} color="var(--streak)" />
        </div>

        <div className="rounded-[2rem] bg-card p-6 shadow-pet md:p-8">
          <h2 className="mb-4 text-lg font-bold">Summary</h2>
          <ul className="space-y-3 text-sm">
            <Row label="Active days (lifetime)" value={a.activeDays} />
            <Row label="Missed days (30d)" value={a.missedDays} />
            <Row label="Active habits" value={a.totalActiveHabits} />
            <Row label="Total XP earned" value={profile?.total_xp_earned ?? 0} />
            <Row label="Total coins earned" value={profile?.total_coins_earned ?? 0} />
          </ul>
        </div>
      </section>
    </>
  );
}

function Kpi({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="rounded-[2rem] bg-card p-5 shadow-card">
      <div className="text-3xl">{icon}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex items-center justify-between border-b border-border pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold">{value.toLocaleString()}</span>
    </li>
  );
}

function BarChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex h-40 items-end gap-1">
      {data.map((d) => (
        <div key={d.date} className="flex flex-1 flex-col items-center gap-1" title={`${d.date}: ${d.count}`}>
          <div
            className="w-full rounded-t bg-[var(--gradient-candy)] transition-all"
            style={{ height: `${(d.count / max) * 100}%`, minHeight: 2 }}
          />
          <span className="text-[9px] text-muted-foreground">{d.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function SimpleLine({ points, color }: { points: number[]; color: string }) {
  if (points.length === 0) return null;
  const max = Math.max(1, ...points);
  const w = 100;
  const h = 40;
  const step = w / (points.length - 1 || 1);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(2)} ${(h - (p / max) * h).toFixed(2)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full" preserveAspectRatio="none">
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill={color} opacity="0.15" />
    </svg>
  );
}
