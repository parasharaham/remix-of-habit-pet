import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Sparkles,
  RefreshCw,
  Flame,
  Beef,
  Droplets,
  Footprints,
  Moon,
  Salad,
  Apple as AppleIcon,
  HeartPulse,
  TrendingUp,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, SectionHeader, ProgressRing, Pill, Skeleton, EmptyState } from "@/components/ui-kit";
import { getDailyGoals, getDailyReport, getNutritionTrends } from "@/lib/coach.functions";
import { runDailyCheckIn } from "@/lib/checkin.functions";

export const Route = createFileRoute("/_authenticated/coach")({
  component: CoachPage,
  head: () => ({
    meta: [
      { title: "AI Coach — Daily Goals & Health Report | HabitPet" },
      {
        name: "description",
        content:
          "Your personalized HabitPet AI coach: adaptive daily nutrition goals, an end-of-day health report and long-term nutrition trends.",
      },
      { property: "og:title", content: "AI Coach — Daily Goals & Health Report | HabitPet" },
      {
        property: "og:description",
        content: "Adaptive daily goals, AI health reports and nutrition trends that keep your pet thriving.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const PERIODS = ["day", "week", "month", "year"] as const;
type Period = (typeof PERIODS)[number];

function CoachPage() {
  const qc = useQueryClient();
  const goalsFn = useServerFn(getDailyGoals);
  const reportFn = useServerFn(getDailyReport);
  const trendsFn = useServerFn(getNutritionTrends);
  const [period, setPeriod] = useState<Period>("week");

  const goals = useQuery({
    queryKey: ["daily-goals"],
    queryFn: () => goalsFn({ data: {} }),
  });

  const report = useQuery({
    queryKey: ["daily-report"],
    queryFn: () => reportFn({ data: {} }),
  });

  const trends = useQuery({
    queryKey: ["nutrition-trends", period],
    queryFn: () => trendsFn({ data: { period } }),
  });

  const regenGoals = useMutation({
    mutationFn: () => goalsFn({ data: { regenerate: true } }),
    onSuccess: (d) => qc.setQueryData(["daily-goals"], d),
  });
  const regenReport = useMutation({
    mutationFn: () => reportFn({ data: { regenerate: true } }),
    onSuccess: (d) => qc.setQueryData(["daily-report"], d),
  });

  const g = goals.data;

  return (
    <AppShell title="AI Coach">
      <div className="space-y-6">
        <CheckInCard />

        {/* Daily goals */}

        <Card>
          <SectionHeader
            title="Today's goals"
            subtitle={g?.ai_generated ? "Personalized by AI from your recent habits" : "Baseline goals from your profile"}
            icon={Sparkles}
          />
          {goals.isLoading && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
          )}
          {g && (
            <>
              {g.rationale && <p className="mb-4 text-sm text-muted-foreground">{g.rationale}</p>}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <GoalTile icon={<Flame size={16} />} label="Calories" now={g.progress.calories} goal={g.calories} unit="kcal" />
                <GoalTile icon={<Beef size={16} />} label="Protein" now={g.progress.protein_g} goal={g.protein_g} unit="g" />
                <GoalTile icon={<Droplets size={16} />} label="Water" now={g.progress.water_ml} goal={g.water_ml} unit="ml" />
                <GoalTile icon={<Footprints size={16} />} label="Steps" now={g.progress.steps} goal={g.steps} unit="" />
                <GoalTile icon={<HeartPulse size={16} />} label="Healthy meals" now={g.progress.healthy_meals} goal={g.healthy_meals} unit="" />
                <GoalTile icon={<Moon size={16} />} label="Sleep" now={0} goal={g.sleep_hours} unit="h" />
                <GoalTile icon={<Salad size={16} />} label="Vegetables" now={0} goal={g.veg_servings} unit="servings" />
                <GoalTile icon={<AppleIcon size={16} />} label="Fruit" now={0} goal={g.fruit_servings} unit="servings" />
              </div>
              <button
                onClick={() => regenGoals.mutate()}
                disabled={regenGoals.isPending}
                className="focus-ring mt-4 inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-xs font-bold transition hover:bg-primary hover:text-primary-foreground disabled:opacity-60"
              >
                <RefreshCw size={14} className={regenGoals.isPending ? "animate-spin" : ""} />
                {regenGoals.isPending ? "Rebalancing…" : "Regenerate goals"}
              </button>
            </>
          )}
        </Card>

        {/* Daily report */}
        <Card>
          <SectionHeader title="Daily health report" subtitle="Your day, reviewed by your AI coach" icon={HeartPulse} />
          {report.isLoading && <Skeleton className="h-40 rounded-2xl" />}
          {report.data && (
            <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
              <div className="flex items-center justify-center gap-6">
                <ProgressRing value={report.data.health_score} label={`${report.data.health_score}`} caption="Health" />
                <ProgressRing
                  value={report.data.nutrition_score}
                  color="var(--brand-green)"
                  size={110}
                  label={`${report.data.nutrition_score}`}
                  caption="Nutrition"
                />
              </div>
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Pill tone="info">🔥 {report.data.calories_in} kcal in</Pill>
                  <Pill tone="warning">🏃 {report.data.calories_out} kcal out</Pill>
                  <Pill tone="success">🥩 {report.data.protein_g}g protein</Pill>
                  <Pill tone="info">💧 {report.data.water_ml} ml</Pill>
                  <Pill tone="muted">
                    ✅ {report.data.habits_completed}/{report.data.habits_total} habits
                  </Pill>
                </div>
                {report.data.summary ? (
                  <p className="text-sm leading-relaxed">{report.data.summary}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Log a meal or complete a habit and your coach will write today's summary.
                  </p>
                )}
                {report.data.pet_status && (
                  <div className="rounded-2xl bg-muted/50 p-3 text-sm">
                    <span className="mr-1">🐣</span>
                    {report.data.pet_status}
                  </div>
                )}
                {report.data.suggestions.length > 0 && (
                  <ul className="space-y-1.5">
                    {report.data.suggestions.map((s, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="text-primary">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  onClick={() => regenReport.mutate()}
                  disabled={regenReport.isPending}
                  className="focus-ring inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-xs font-bold transition hover:bg-primary hover:text-primary-foreground disabled:opacity-60"
                >
                  <RefreshCw size={14} className={regenReport.isPending ? "animate-spin" : ""} />
                  {regenReport.isPending ? "Writing…" : "Refresh report"}
                </button>
              </div>
            </div>
          )}
        </Card>

        {/* Trends */}
        <Card>
          <SectionHeader title="Long-term insights" subtitle="Nutrition trends over time" icon={TrendingUp} />
          <div className="mb-4 inline-flex rounded-full bg-muted p-1">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`focus-ring rounded-full px-4 py-1.5 text-xs font-bold capitalize transition ${
                  period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {trends.isLoading && <Skeleton className="h-48 rounded-2xl" />}
          {trends.data && trends.data.points.length === 0 && (
            <EmptyState
              emoji="🍽️"
              title="No meals logged yet"
              description="Scan your first meal and your trends will appear here."
              action={{ label: "Scan a meal", to: "/food-scanner" }}
            />
          )}
          {trends.data && trends.data.points.length > 0 && (
            <>
              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <TotalTile label="Calories" value={`${trends.data.totals.calories}`} />
                <TotalTile label="Protein" value={`${trends.data.totals.protein_g} g`} />
                <TotalTile label="Fiber" value={`${trends.data.totals.fiber_g} g`} />
                <TotalTile label="Avg score" value={`${trends.data.totals.health_score}/100`} />
              </div>
              <TrendBars points={trends.data.points} />
              <MicroGrid micros={trends.data.micros} />
            </>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

function GoalTile({
  icon,
  label,
  now,
  goal,
  unit,
}: {
  icon: React.ReactNode;
  label: string;
  now: number;
  goal: number;
  unit: string;
}) {
  const pct = Math.min(100, goal > 0 ? (now / goal) * 100 : 0);
  return (
    <div className="rounded-2xl bg-muted/40 p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-lg font-bold leading-none">
        {now > 0 ? `${now} / ` : ""}
        {goal}
        <span className="ml-1 text-xs font-semibold text-muted-foreground">{unit}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function TotalTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted/40 p-3 text-center">
      <div className="text-lg font-bold leading-tight">{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function TrendBars({ points }: { points: { bucket: string; calories: number; health_score: number }[] }) {
  const max = Math.max(1, ...points.map((p) => p.calories));
  return (
    <div className="flex h-40 items-end gap-1.5 overflow-x-auto rounded-2xl bg-muted/30 p-3">
      {points.map((p) => (
        <div key={p.bucket} className="flex min-w-[26px] flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t-lg bg-primary/80 transition-[height] duration-700"
            style={{ height: `${Math.max(4, (p.calories / max) * 100)}%` }}
            title={`${p.bucket}: ${p.calories} kcal · score ${p.health_score}`}
          />
          <span className="truncate text-[9px] font-semibold text-muted-foreground">{p.bucket.slice(-5)}</span>
        </div>
      ))}
    </div>
  );
}

const MICRO_LABELS: Record<string, string> = {
  sugar_g: "Sugar (g)",
  sodium_mg: "Sodium (mg)",
  potassium_mg: "Potassium (mg)",
  calcium_mg: "Calcium (mg)",
  iron_mg: "Iron (mg)",
  magnesium_mg: "Magnesium (mg)",
  zinc_mg: "Zinc (mg)",
  cholesterol_mg: "Cholesterol (mg)",
  saturated_fat_g: "Saturated fat (g)",
  unsaturated_fat_g: "Unsaturated fat (g)",
  omega3_g: "Omega 3 (g)",
  omega6_g: "Omega 6 (g)",
  vit_a_iu: "Vitamin A (IU)",
  vit_b_mg: "Vitamin B (mg)",
  vit_c_mg: "Vitamin C (mg)",
  vit_d_iu: "Vitamin D (IU)",
  vit_e_mg: "Vitamin E (mg)",
  vit_k_mcg: "Vitamin K (mcg)",
};

function MicroGrid({ micros }: { micros: Record<string, number> }) {
  const entries = Object.entries(MICRO_LABELS).filter(([k]) => micros[k]);
  if (entries.length === 0) return null;
  return (
    <div className="mt-5">
      <h3 className="mb-2 text-sm font-bold">Micronutrients this period</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {entries.map(([k, label]) => (
          <div key={k} className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-xs">
            <span className="truncate text-muted-foreground">{label}</span>
            <span className="ml-2 font-bold">{micros[k]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CheckInCard() {
  const qc = useQueryClient();
  const checkIn = useServerFn(runDailyCheckIn);
  const run = useMutation({
    mutationFn: () => checkIn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pet"] });
      qc.invalidateQueries({ queryKey: ["daily-report"] });
    },
  });
  const c = run.data;

  return (
    <Card>
      <SectionHeader
        title="Daily AI check-in"
        subtitle="Reviews what you ate and drank, updates your pet and gives one clear next action"
        icon={HeartPulse}
      />
      {!c && !run.isPending && (
        <p className="mb-4 text-sm text-muted-foreground">
          Run your check-in at the end of the day for an honest review of your food and hydration.
        </p>
      )}
      {run.isPending && <Skeleton className="mb-4 h-32 rounded-2xl" />}
      {run.isError && <p className="mb-4 text-sm text-danger">{(run.error as Error).message}</p>}

      {c && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Pill tone="info">🔥 {c.calories_in} kcal</Pill>
            <Pill tone="success">🥩 {c.protein_g}g protein</Pill>
            <Pill tone="info">💧 {c.water_ml} ml</Pill>
            <Pill tone="muted">🍽️ {c.meals_logged} meals</Pill>
            <Pill tone="muted">
              ✅ {c.habits_completed}/{c.habits_total} habits
            </Pill>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl bg-muted/40 p-4 text-sm">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Food review</div>
              {c.food_review}
            </div>
            <div className="rounded-2xl bg-muted/40 p-4 text-sm">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Drink review</div>
              {c.drink_review}
            </div>
          </div>

          <div className="rounded-2xl bg-muted/40 p-4">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Your pet</div>
            <p className="text-sm">{c.pet_status}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Pill tone="success">❤️ {c.pet.health} ({c.pet.delta_health >= 0 ? "+" : ""}{c.pet.delta_health})</Pill>
              <Pill tone="info">😊 {c.pet.happiness} ({c.pet.delta_happiness >= 0 ? "+" : ""}{c.pet.delta_happiness})</Pill>
              <Pill tone="warning">⚡ {c.pet.energy} ({c.pet.delta_energy >= 0 ? "+" : ""}{c.pet.delta_energy})</Pill>
            </div>
          </div>

          <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-primary">Tomorrow's one action</div>
            <p className="mt-1 text-base font-extrabold">{c.next_action}</p>
            <p className="mt-1 text-sm text-muted-foreground">{c.next_action_why}</p>
          </div>
        </div>
      )}

      <button
        onClick={() => run.mutate()}
        disabled={run.isPending}
        className="focus-ring mt-4 inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-xs font-bold transition hover:bg-primary hover:text-primary-foreground disabled:opacity-60"
      >
        <RefreshCw size={14} className={run.isPending ? "animate-spin" : ""} />
        {run.isPending ? "Reviewing your day…" : c ? "Run check-in again" : "Run today's check-in"}
      </button>
    </Card>
  );
}

