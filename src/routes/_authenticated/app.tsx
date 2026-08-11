import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getPetStatus, syncDecay } from "@/lib/pet.functions";
import { completeHabit, listHabits, type HabitDTO } from "@/lib/habits.functions";
import { getOnboardingStatus } from "@/lib/onboarding.functions";
import { getProfile } from "@/lib/profile.functions";
import { getMacroTargets } from "@/lib/targets.functions";
import { getNutritionSummary, listMealsByDate } from "@/lib/food.functions";
import { AppShell } from "@/components/AppShell";
import { PetEmoji } from "@/components/PetEmoji";
import { StatBar } from "@/components/StatBar";
import {
  Card,
  Confetti,
  EmptyState,
  GoalBar,
  Pill,
  ProgressRing,
  SectionHeader,
  Skeleton,
  SkeletonCard,
} from "@/components/ui-kit";
import {
  BarChart3,
  Camera,
  Check,
  ChevronRight,
  Coins,
  Droplets,
  Flame,
  ListChecks,
  Settings,
  Sparkles,
  Target,
  Utensils,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Dashboard — HabitPet" },
      { name: "description", content: "Your daily command center: pet, habits, meals and progress." },
      { property: "og:title", content: "HabitPet Dashboard" },
      { property: "og:description", content: "Complete today's habits to feed and grow your pet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const MEAL_SLOTS = [
  { id: "breakfast", label: "Breakfast", emoji: "🥐" },
  { id: "lunch", label: "Lunch", emoji: "🥗" },
  { id: "dinner", label: "Dinner", emoji: "🍽️" },
  { id: "snack", label: "Snack", emoji: "🍎" },
] as const;

function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchPet = useServerFn(getPetStatus);
  const fetchHabits = useServerFn(listHabits);
  const fetchProfile = useServerFn(getProfile);
  const fetchTargets = useServerFn(getMacroTargets);
  const fetchSummary = useServerFn(getNutritionSummary);
  const fetchMeals = useServerFn(listMealsByDate);
  const fnSync = useServerFn(syncDecay);
  const fnComplete = useServerFn(completeHabit);

  const [pulse, setPulse] = useState(0);
  const [celebrate, setCelebrate] = useState(0);

  useEffect(() => {
    getOnboardingStatus()
      .then((s) => {
        if (!s.onboarded) navigate({ to: "/onboarding", replace: true });
      })
      .catch(() => {});
    fnSync().then(() => qc.invalidateQueries({ queryKey: ["pet"] })).catch(() => {});
  }, [fnSync, qc, navigate]);

  const pet = useQuery({ queryKey: ["pet"], queryFn: () => fetchPet() });
  const habits = useQuery({ queryKey: ["habits"], queryFn: () => fetchHabits() });
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const targets = useQuery({ queryKey: ["macro-targets"], queryFn: () => fetchTargets({ data: {} }) });
  const nutrition = useQuery({ queryKey: ["nutrition", "summary"], queryFn: () => fetchSummary() });
  const meals = useQuery({ queryKey: ["meals", "today"], queryFn: () => fetchMeals({ data: {} }) });

  const complete = useMutation({
    mutationFn: (id: string) => fnComplete({ data: { id } }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["habits"] });
      const prev = qc.getQueryData<HabitDTO[]>(["habits"]);
      qc.setQueryData<HabitDTO[]>(["habits"], (old) =>
        (old ?? []).map((h) =>
          h.id === id
            ? {
                ...h,
                completed_today: true,
                current_streak: h.current_streak + 1,
                last_completed_at: new Date().toISOString(),
              }
            : h,
        ),
      );
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(30);
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["habits"], ctx.prev);
      toast.error("Couldn't complete habit");
    },
    onSuccess: (res) => {
      qc.setQueryData(["habits"], (old: HabitDTO[] | undefined) =>
        (old ?? []).map((h) => (h.id === res.habit.id ? res.habit : h)),
      );
      qc.invalidateQueries({ queryKey: ["pet"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      setPulse((p) => p + 1);
      if (res.pet.levels_gained > 0) {
        setCelebrate((c) => c + 1);
        toast.success(`Level up! Lv. ${res.pet.current_level} (${res.pet.pet_stage})`);
      } else if (res.pet.xp_gained > 0) {
        toast.success(`+${res.pet.xp_gained} XP · +${res.pet.coins_gained} 🪙`);
      }
      for (const a of res.newAchievements) {
        setCelebrate((c) => c + 1);
        toast.success(`${a.badge} Achievement: ${a.title}`);
      }
    },
  });

  const todaysHabits = habits.data ?? [];
  const completedToday = todaysHabits.filter((h) => h.completed_today).length;
  const totalHabits = todaysHabits.length;
  const bestStreak = Math.max(0, ...todaysHabits.map((h) => h.current_streak));
  const dayDone = totalHabits > 0 && completedToday === totalHabits;
  const firstName = (profile.data?.full_name || profile.data?.username || "friend").split(" ")[0];

  const t = targets.data;
  const eaten = t?.today;
  const fiberTarget = t ? Math.max(20, Math.round(t.calories / 1000) * 14) : 30;

  const loggedTypes = new Set((meals.data ?? []).map((m) => m.meal_type));
  const weekly = nutrition.data?.weekly ?? [];
  const weekMax = Math.max(1, ...weekly.map((d) => d.calories));

  const coachLine = useMemo(() => {
    if (!t || !nutrition.data) return null;
    const mealsLogged = nutrition.data.meals_logged;
    const proteinLeft = Math.max(0, t.protein_g - t.today.protein_g);
    const calsLeft = Math.max(0, t.calories - t.today.calories);
    if (mealsLogged === 0)
      return `No meals logged yet today. Scan your first meal to start tracking your ${t.calories.toLocaleString()} kcal target.`;
    const base = `You've logged ${mealsLogged} meal${mealsLogged === 1 ? "" : "s"} today.`;
    if (proteinLeft > 15) return `${base} You're still ${Math.round(proteinLeft)}g short on protein.`;
    if (calsLeft > 250) return `${base} About ${Math.round(calsLeft)} kcal left in your budget.`;
    if (t.today.calories > t.calories) return `${base} You're ${Math.round(t.today.calories - t.calories)} kcal over target — a walk would help.`;
    return `${base} You're right on track with calories and protein. Nice work.`;
  }, [t, nutrition.data]);

  const petMood = useMemo(() => {
    const p = pet.data;
    if (!p) return null;
    const score = (p.health_points + p.happiness_points) / 2;
    if (score >= 80) return { text: "Your pet is feeling great!", emoji: "😄", tone: "success" as const };
    if (score >= 55) return { text: "Your pet is doing okay — keep it up.", emoji: "🙂", tone: "info" as const };
    if (score >= 30) return { text: "Your pet needs some care today.", emoji: "😕", tone: "warning" as const };
    return { text: "Your pet really misses you.", emoji: "😢", tone: "danger" as const };
  }, [pet.data]);

  return (
    <AppShell isAdmin={profile.data?.is_admin}>
      <Confetti fire={celebrate} />

      {/* ---------------------------------------------------------- header */}
      <header className="mb-6 animate-[rise-in_500ms_cubic-bezier(.22,1,.36,1)_both]">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
            </p>
            <h1 className="truncate text-2xl font-bold md:text-4xl">
              {greeting()}, {firstName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Let's keep your HabitPet healthy today.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              to="/pet"
              aria-label="Your pet"
              className="focus-ring grid h-11 w-11 place-items-center rounded-2xl bg-[var(--gradient-primary)] text-xl shadow-card transition hover:-translate-y-0.5"
            >
              {pet.data ? <PetEmoji type={pet.data.pet_type} stage={pet.data.pet_stage} size="sm" /> : "🐣"}
            </Link>
            <Link
              to="/settings"
              aria-label="Settings"
              className="focus-ring grid h-11 w-11 place-items-center rounded-2xl bg-muted text-foreground/70 transition hover:bg-muted/70"
            >
              <Settings size={18} />
            </Link>
          </div>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[6fr_5fr]">
        {/* ------------------------------------------- today's progress hero */}
        <Card className="relative overflow-hidden bg-[var(--gradient-aurora)] lg:col-span-2">
          <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-primary/25 blur-3xl" />
          <SectionHeader
            title="Today's Progress"
            subtitle={t ? t.note : "Personalized to your goal"}
            icon={Target}
            action={{ label: "Nutrition", to: "/nutrition" }}
          />
          {!t || !eaten ? (
            <div className="grid gap-5 md:grid-cols-[auto_minmax(0,1fr)]">
              <Skeleton className="h-40 w-40 rounded-full" />
              <div className="space-y-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-6" />
                ))}
              </div>
            </div>
          ) : (
            <div className="grid items-center gap-6 md:grid-cols-[auto_minmax(0,1fr)]">
              <div className="mx-auto">
                <ProgressRing
                  value={eaten.calories}
                  max={t.calories}
                  size={168}
                  stroke={14}
                  color="var(--primary)"
                  label={
                    <span className="text-3xl font-bold">{Math.round(eaten.calories).toLocaleString()}</span>
                  }
                  caption={`of ${t.calories.toLocaleString()} kcal`}
                />
                <p className="mt-2 text-center text-xs font-semibold text-muted-foreground">
                  {Math.max(0, t.calories - eaten.calories).toLocaleString()} kcal left
                </p>
              </div>
              <div className="space-y-3.5 rounded-3xl bg-card/70 p-4 backdrop-blur">
                <GoalBar label="Protein" value={Math.round(eaten.protein_g)} target={t.protein_g} unit="g" color="var(--brand-blue)" />
                <GoalBar label="Carbs" value={Math.round(eaten.carbs_g)} target={t.carbs_g} unit="g" color="var(--brand-orange)" />
                <GoalBar label="Fat" value={Math.round(eaten.fat_g)} target={t.fat_g} unit="g" color="var(--brand-purple)" />
                <GoalBar
                  label="Fiber"
                  value={Math.round(nutrition.data?.fiber_g ?? 0)}
                  target={fiberTarget}
                  unit="g"
                  color="var(--brand-green)"
                />
                <GoalBar
                  label="Water"
                  value={Math.round(eaten.water_ml)}
                  target={t.water_ml}
                  unit="ml"
                  color="var(--brand-cyan)"
                />
              </div>
            </div>
          )}
        </Card>

        {/* --------------------------------------------------------- pet card */}
        <Card className="relative overflow-hidden">
          {pet.isLoading || !pet.data ? (
            <div className="space-y-4 py-6">
              <Skeleton className="mx-auto h-32 w-32 rounded-full" />
              <Skeleton className="mx-auto h-6 w-32" />
              <Skeleton className="h-3" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <div key={pulse} className="pet-pop shrink-0">
                  <div className="animate-[float-slow_6s_ease-in-out_infinite]">
                    <PetEmoji type={pet.data.pet_type} stage={pet.data.pet_stage} size="lg" />
                  </div>
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-bold">{pet.data.pet_name}</h2>
                  <p className="text-sm capitalize text-muted-foreground">
                    Level {pet.data.current_level} · {pet.data.pet_stage}
                  </p>
                  {petMood && (
                    <span className="mt-2 inline-block">
                      <Pill tone={petMood.tone}>
                        {petMood.emoji} {petMood.text}
                      </Pill>
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-5 space-y-3.5 rounded-3xl bg-muted/40 p-4">
                <StatBar label="Health" value={pet.data.health_points} max={100} variant="hp" icon="💚" />
                <StatBar label="Happiness" value={pet.data.happiness_points} max={100} variant="happy" icon="😊" />
                <StatBar label="Energy" value={pet.data.energy_points} max={100} variant="xp" icon="⚡" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[var(--gradient-sunrise)] p-4">
                  <div className="flex items-center gap-2 text-2xl font-bold">
                    <Flame size={20} /> {bestStreak}
                  </div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-foreground/70">
                    Day streak {bestStreak > 0 ? "· keep going!" : ""}
                  </p>
                </div>
                <div className="rounded-2xl bg-muted/50 p-4">
                  <div className="flex items-center gap-2 text-2xl font-bold">
                    <Coins size={20} /> {profile.data?.coins ?? 0}
                  </div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Coins</p>
                </div>
              </div>
              <Link
                to="/pet"
                className="focus-ring mt-4 block rounded-full bg-primary py-3 text-center text-sm font-bold text-primary-foreground transition hover:opacity-90 active:scale-[0.98]"
              >
                Visit {pet.data.pet_name}
              </Link>
            </>
          )}
        </Card>

        {/* ----------------------------------------------------- AI coach card */}
        <Card className="flex flex-col">
          <SectionHeader title="AI Coach" subtitle="Based on today's data" icon={Sparkles} />
          {coachLine ? (
            <p className="text-sm leading-relaxed text-foreground/85">{coachLine}</p>
          ) : (
            <Skeleton className="h-12" />
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/nutrition"
              className="focus-ring inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              View Nutrition <ChevronRight size={14} />
            </Link>
            <Link
              to="/coach"
              className="focus-ring inline-flex items-center gap-1 rounded-full bg-muted px-4 py-2 text-xs font-bold"
            >
              Ask the coach
            </Link>
          </div>

          {/* meals */}
          <div className="mt-6">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Today's meals</h3>
            <div className="grid grid-cols-2 gap-2">
              {MEAL_SLOTS.map((m) => {
                const done = loggedTypes.has(m.id);
                return (
                  <Link
                    key={m.id}
                    to="/food-scanner"
                    className={`focus-ring flex items-center gap-2 rounded-2xl border p-3 text-sm font-semibold transition hover:-translate-y-0.5 ${
                      done ? "border-success/30 bg-success/10" : "border-border bg-background"
                    }`}
                  >
                    <span className="text-lg">{m.emoji}</span>
                    <span className="min-w-0 flex-1 truncate">{m.label}</span>
                    {done ? (
                      <Check size={16} className="shrink-0 text-success" strokeWidth={3} />
                    ) : (
                      <span className="shrink-0 text-xs text-muted-foreground">Log</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </Card>

        {/* -------------------------------------------------------- today's focus */}
        <Card className="lg:col-span-2">
          <SectionHeader title="Today's Focus" subtitle="A few things that move the needle" icon={Sparkles} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FocusCard
              to="/food-scanner"
              icon={<Camera size={18} />}
              tone="var(--brand-blue)"
              title="Scan a Meal"
              desc="AI calories & macros"
              status={
                nutrition.data ? `${nutrition.data.meals_logged} logged today` : "—"
              }
            />
            <FocusCard
              to="/habits"
              icon={<ListChecks size={18} />}
              tone="var(--brand-green)"
              title="Complete a Habit"
              desc="Feed your pet XP"
              status={totalHabits ? `${completedToday}/${totalHabits} done` : "No habits yet"}
            />
            <FocusCard
              to="/nutrition"
              icon={<Droplets size={18} />}
              tone="var(--brand-cyan)"
              title="Drink Water"
              desc="Stay hydrated"
              status={t ? `${Math.round(eaten?.water_ml ?? 0)} / ${t.water_ml} ml` : "—"}
            />
            <FocusCard
              to="/workout-planner"
              icon={<Utensils size={18} />}
              tone="var(--brand-orange)"
              title="Move"
              desc="Plan today's session"
              status="Open planner"
            />
          </div>
        </Card>

        {/* -------------------------------------------------------------- habits */}
        {habits.isLoading ? (
          <SkeletonCard lines={4} />
        ) : (
          <Card>
            <SectionHeader
              title="Today's habits"
              subtitle={totalHabits ? `${completedToday} of ${totalHabits} complete` : "Build your first routine"}
              icon={ListChecks}
              action={{ label: "Manage", to: "/habits" }}
            />

            {totalHabits > 0 && (
              <div className="mb-5">
                <div className="mb-1.5 flex items-baseline justify-between text-sm">
                  <span className="font-bold">{dayDone ? "Day complete! 🎉" : "Keep going"}</span>
                  <span className="text-xs text-muted-foreground">
                    {completedToday} / {totalHabits} habits
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-700"
                    style={{ width: `${(completedToday / Math.max(1, totalHabits)) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2.5">
              {totalHabits === 0 && (
                <EmptyState
                  emoji="🌱"
                  title="No habits yet"
                  description="Add your first habit — or let AI build a personalized plan for you."
                  action={{ label: "Create a habit", to: "/habits" }}
                />
              )}
              {todaysHabits.map((h, i) => (
                <article
                  key={h.id}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className={`group flex animate-[rise-in_450ms_cubic-bezier(.22,1,.36,1)_both] items-center gap-3 rounded-2xl border p-3.5 transition ${
                    h.completed_today
                      ? "border-success/30 bg-success/10"
                      : "border-border bg-background hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card"
                  }`}
                >
                  <button
                    onClick={() => !h.completed_today && complete.mutate(h.id)}
                    disabled={h.completed_today}
                    aria-label={h.completed_today ? `${h.title} completed` : `Mark ${h.title} complete`}
                    className={`focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90 ${
                      h.completed_today
                        ? "border-transparent bg-success text-success-foreground"
                        : "border-border hover:border-primary hover:bg-primary/10"
                    }`}
                  >
                    {h.completed_today && <Check size={18} strokeWidth={3} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className={`truncate font-semibold ${h.completed_today ? "line-through opacity-60" : ""}`}>
                      {h.title}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 font-bold text-[var(--streak)]">
                        <Flame size={12} /> {h.current_streak}d
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">{h.category}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </Card>
        )}

        {/* ---------------------------------------------------- analytics preview */}
        <Card>
          <SectionHeader
            title="Your Week"
            subtitle="Calories logged over the last 7 days"
            icon={BarChart3}
            action={{ label: "Analytics", to: "/analytics" }}
          />
          {nutrition.isLoading ? (
            <Skeleton className="h-40" />
          ) : weekly.every((d) => d.calories === 0) ? (
            <EmptyState
              emoji="📈"
              title="No data yet this week"
              description="Log a meal and your 7-day trend will appear here."
              action={{ label: "Scan a meal", to: "/food-scanner" }}
            />
          ) : (
            <div className="flex h-44 items-end gap-2">
              {weekly.map((d) => {
                const pct = (d.calories / weekMax) * 100;
                const isToday = d.date === nutrition.data?.date;
                return (
                  <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {d.calories > 0 ? Math.round(d.calories) : ""}
                    </span>
                    <div className="flex h-full w-full items-end">
                      <div
                        className={`w-full rounded-t-xl transition-[height] duration-700 ${
                          isToday ? "bg-primary" : "bg-primary/35"
                        }`}
                        style={{ height: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">
                      {new Date(d.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "narrow" })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

function FocusCard({
  to,
  icon,
  tone,
  title,
  desc,
  status,
}: {
  to: string;
  icon: React.ReactNode;
  tone: string;
  title: string;
  desc: string;
  status: string;
}) {
  return (
    <Link
      to={to}
      className="focus-ring group flex flex-col gap-2 rounded-2xl border border-border/60 bg-background p-4 shadow-card transition hover:-translate-y-1 hover:shadow-pet active:scale-[0.98]"
    >
      <span
        className="grid h-10 w-10 place-items-center rounded-xl text-foreground transition group-hover:scale-110"
        style={{ background: tone }}
      >
        {icon}
      </span>
      <span className="text-sm font-bold">{title}</span>
      <span className="text-xs text-muted-foreground">{desc}</span>
      <span className="mt-auto pt-1 text-[11px] font-bold uppercase tracking-wide text-primary">{status}</span>
    </Link>
  );
}
