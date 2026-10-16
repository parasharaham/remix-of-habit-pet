import { UpgradeTrigger } from "@/components/ProUpgradeSheet";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bell, ChefHat, Clock, Droplets, Dumbbell, ShoppingBasket, Sparkles, Target } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getMealPlan, type MealPlanDTO } from "@/lib/planner.functions";
import { getMacroTargets } from "@/lib/targets.functions";
import { getProfile } from "@/lib/profile.functions";
import { AIThinking, AnimatedNumber, Button, EmptyState, GlowCard, GoalBar, PageTransition, Reveal } from "@/components/ui-kit";
import { useReminders } from "@/lib/reminders";


export const Route = createFileRoute("/_authenticated/meal-planner")({
  head: () => ({
    meta: [
      { title: "AI Meal Planner & Reminders — HabitPet" },
      {
        name: "description",
        content: "Generate a personalised day of eating for muscle gain, fat loss or all-round health, and set meal and hydration reminders.",
      },
      { property: "og:title", content: "AI Meal Planner & Reminders — HabitPet" },
      { property: "og:description", content: "Personalised AI meal plans plus morning goal, meal and hydration reminders." },
    ],
  }),
  component: PlannerPage,
});

type AimId = "muscle_gain" | "fat_loss" | "maintenance" | "endurance";

const AIMS: Array<{ id: AimId; label: string; icon: typeof Dumbbell }> = [
  { id: "muscle_gain", label: "Build muscle", icon: Dumbbell },
  { id: "fat_loss", label: "Lose fat", icon: Sparkles },
  { id: "maintenance", label: "Stay healthy", icon: ChefHat },
  { id: "endurance", label: "Endurance", icon: Droplets },
];


function PlannerPage() {
  const fetchProfile = useServerFn(getProfile);
  const buildPlan = useServerFn(getMealPlan);
  const fetchTargets = useServerFn(getMacroTargets);
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const [aim, setAim] = useState<"muscle_gain" | "fat_loss" | "maintenance" | "endurance">("muscle_gain");
  const [cuisine, setCuisine] = useState("");
  const [plan, setPlan] = useState<MealPlanDTO | null>(null);

  const targets = useQuery({
    queryKey: ["macro-targets", aim],
    queryFn: () => fetchTargets({ data: { aim } }),
  });
  const t = targets.data;

  const gen = useMutation({
    mutationFn: () =>
      buildPlan({
        data: {
          aim,
          cuisine,
          target_calories: t?.calories,
          target_protein_g: t?.protein_g,
          target_carbs_g: t?.carbs_g,
          target_fat_g: t?.fat_g,
          target_water_ml: t?.water_ml,
        },
      }),
    onSuccess: (p) => setPlan(p),
  });

  return (
    <AppShell title="AI Meal Planner" isAdmin={profile.data?.is_admin}>
      <UpgradeTrigger source="ai_meal_plan" when={plan?.personalized === false} />
      <PageTransition>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <GlowCard tone="cyan">

              <h2 className="text-xl font-extrabold">What are we training for?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your plan respects your allergies, conditions and food preferences.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {AIMS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setAim(id)}
                    className={`focus-ring flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-xs font-bold transition ${
                      aim === id
                        ? "border-transparent bg-[image:var(--gradient-primary)] text-primary-foreground"
                        : "border-border bg-card/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon size={18} />
                    {label}
                  </button>
                ))}
              </div>
              <input
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
                placeholder="Preferred cuisine (optional) — e.g. Indian, Mediterranean"
                className="focus-ring mt-4 w-full rounded-2xl border border-border bg-card/60 px-4 py-3 text-sm"
              />
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button onClick={() => gen.mutate()} disabled={gen.isPending}>
                  <Sparkles size={16} /> {plan ? "Regenerate plan" : "Generate my plan"}
                </Button>
                {gen.isError && <span className="text-xs text-danger">{(gen.error as Error).message}</span>}
              </div>
            </GlowCard>

            {t && (
              <Reveal>
                <GlowCard tone="amber">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="flex items-center gap-2 text-base font-extrabold">
                      <Target size={18} /> Today's adaptive targets
                    </h3>
                    <span className="rounded-full tile-lemon px-3 py-1 text-[11px] font-bold">
                      {t.consistency}% consistent
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{t.note}</p>
                  <div className="mt-4 space-y-3">
                    <GoalBar label="Calories" value={t.today.calories} target={t.calories} unit="kcal" />
                    <GoalBar label="Protein" value={t.today.protein_g} target={t.protein_g} unit="g" />
                    <GoalBar label="Carbs" value={t.today.carbs_g} target={t.carbs_g} unit="g" />
                    <GoalBar label="Fat" value={t.today.fat_g} target={t.fat_g} unit="g" />
                    <GoalBar label="Water" value={t.today.water_ml} target={t.water_ml} unit="ml" />
                  </div>
                  <p className="mt-3 text-[11px] font-semibold text-muted-foreground">
                    Maintenance {t.tdee} kcal · goal base {t.base_calories} kcal · auto-adjust{" "}
                    {t.adjustment_kcal >= 0 ? "+" : ""}
                    {t.adjustment_kcal} kcal
                  </p>
                </GlowCard>
              </Reveal>
            )}



            <AnimatePresence mode="wait">
              {gen.isPending && (
                <motion.div key="load" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <AIThinking label="Designing your day of eating" />
                </motion.div>
              )}
            </AnimatePresence>

            {!plan && !gen.isPending && (
              <EmptyState
                emoji="🥗"
                title="No plan yet"
                description="Pick your aim and let the AI coach build a full day of meals around your body and goals."
              />
            )}

            {plan && (
              <div className="space-y-4">
                <Reveal>
                  <GlowCard tone="green">
                    <h3 className="text-lg font-extrabold text-gradient">{plan.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{plan.summary}</p>
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <Stat label="Calories" value={plan.total_calories} unit="kcal" />
                      <Stat label="Protein" value={plan.total_protein_g} unit="g" />
                      <Stat label="Water" value={plan.hydration_ml} unit="ml" />
                    </div>
                  </GlowCard>
                </Reveal>

                {plan.meals.map((m, i) => (
                  <Reveal key={`${m.slot}-${i}`} delay={i * 0.06}>
                    <GlowCard tone="blue">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold uppercase tracking-wide text-accent">
                            {m.slot} · {m.time}
                          </div>
                          <h4 className="mt-0.5 text-base font-extrabold">{m.name}</h4>
                          <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
                        </div>
                        <div className="shrink-0 rounded-2xl bg-muted/60 px-3 py-2 text-center">
                          <div className="text-lg font-extrabold leading-none">
                            <AnimatedNumber value={m.calories} />
                          </div>
                          <div className="text-[10px] font-semibold uppercase text-muted-foreground">kcal</div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
                        <Chip>{m.protein_g}g protein</Chip>
                        <Chip>{m.carbs_g}g carbs</Chip>
                        <Chip>{m.fat_g}g fat</Chip>
                      </div>
                      <p className="mt-3 rounded-2xl bg-card/60 p-3 text-xs text-muted-foreground">💡 {m.why}</p>
                    </GlowCard>
                  </Reveal>
                ))}

                <Reveal>
                  <GlowCard tone="amber">
                    <h4 className="flex items-center gap-2 text-base font-extrabold">
                      <ShoppingBasket size={18} /> Grocery list
                    </h4>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {plan.grocery_list.map((g) => (
                        <Chip key={g}>{g}</Chip>
                      ))}
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground">🏋️ {plan.training_tip}</p>
                    <p className="mt-2 text-sm text-muted-foreground">💬 {plan.coach_note}</p>
                  </GlowCard>
                </Reveal>
              </div>
            )}
          </div>

          <RemindersPanel />
        </div>
      </PageTransition>
    </AppShell>
  );
}

function Stat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-2xl bg-card/60 p-3 text-center">
      <div className="text-xl font-extrabold leading-none">
        <AnimatedNumber value={value} />
        <span className="text-xs text-muted-foreground"> {unit}</span>
      </div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-card/60 px-3 py-1 text-[11px] font-bold text-muted-foreground">
      {children}
    </span>
  );
}

function RemindersPanel() {
  const { settings, save, permission, requestPermission, schedule, snooze } = useReminders();

  async function toggle() {
    if (!settings.enabled && permission !== "granted") {
      const p = await requestPermission();
      if (p !== "granted") return;
    }
    save({ enabled: !settings.enabled });
  }

  const times: Array<[keyof typeof settings, string]> = [
    ["morningGoals", "Morning goals"],
    ["breakfast", "Breakfast"],
    ["lunch", "Lunch"],
    ["dinner", "Dinner"],
  ];

  return (
    <GlowCard tone="cyan" className="h-fit lg:sticky lg:top-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-extrabold">
          <Bell size={18} /> Reminders
        </h3>
        <button
          onClick={toggle}
          role="switch"
          aria-checked={settings.enabled}
          aria-label="Enable reminders"
          className={`focus-ring relative h-7 w-12 rounded-full transition ${
            settings.enabled ? "bg-[image:var(--gradient-primary)]" : "bg-muted"
          }`}
        >
          <motion.span
            layout
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
            className={`absolute top-1 h-5 w-5 rounded-full bg-foreground ${settings.enabled ? "left-6" : "left-1"}`}
          />
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Gentle nudges for your morning goals, each meal and hydration — so you close your rings and your pet keeps thriving.
      </p>
      {permission === "denied" && (
        <p className="mt-2 rounded-xl bg-danger/15 p-2 text-xs text-danger">
          Notifications are blocked in your browser settings.
        </p>
      )}

      <div className="mt-4 space-y-3">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold">I wake up at</span>
          <input
            type="time"
            value={settings.wakeTime}
            onChange={(e) => save({ wakeTime: e.target.value })}
            className="focus-ring rounded-xl border border-border bg-card/60 px-3 py-1.5 text-sm"
          />
        </label>
        {times.map(([key, label]) => (
          <label key={key} className="flex items-center justify-between gap-3 text-sm">
            <span className="font-semibold">{label}</span>
            <input
              type="time"
              value={settings[key] as string}
              onChange={(e) => save({ [key]: e.target.value } as any)}
              className="focus-ring rounded-xl border border-border bg-card/60 px-3 py-1.5 text-sm"
            />
          </label>
        ))}
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold">Water every</span>
          <select
            value={settings.hydrationEveryMin}
            onChange={(e) => save({ hydrationEveryMin: Number(e.target.value) })}
            className="focus-ring rounded-xl border border-border bg-card/60 px-3 py-1.5 text-sm"
          >
            {[60, 90, 120, 180].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold">Snooze length</span>
          <select
            value={settings.snoozeMin}
            onChange={(e) => save({ snoozeMin: Number(e.target.value) })}
            className="focus-ring rounded-xl border border-border bg-card/60 px-3 py-1.5 text-sm"
          >
            {[10, 15, 30, 45, 60].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold">Context-aware timing</span>
          <input
            type="checkbox"
            checked={settings.contextAware}
            onChange={(e) => save({ contextAware: e.target.checked })}
            className="h-5 w-5 accent-[var(--primary)]"
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold">Sound</span>
          <input
            type="checkbox"
            checked={settings.sound}
            onChange={(e) => save({ sound: e.target.checked })}
            className="h-5 w-5 accent-[var(--primary)]"
          />
        </label>
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <h4 className="flex items-center gap-2 text-sm font-extrabold">
          <Clock size={16} /> Today's schedule
        </h4>
        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
          {schedule.map((item) => (
            <div
              key={item.key}
              className={`flex items-center justify-between gap-2 rounded-2xl px-3 py-2 text-sm ${
                item.status === "now"
                  ? "tile-lemon font-bold"
                  : item.status === "snoozed"
                    ? "tile-lilac"
                    : item.status === "passed"
                      ? "bg-muted/50 text-muted-foreground"
                      : "bg-card/60"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span>{item.emoji}</span>
                <span className="truncate font-semibold">{item.label}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-xs font-bold tabular-nums">{item.time}</span>
                {(item.status === "now" || item.status === "upcoming") && (
                  <button
                    onClick={() => snooze(item.key)}
                    className="focus-ring rounded-full border border-border px-2 py-0.5 text-[10px] font-bold hover:bg-muted"
                  >
                    Snooze
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

    </GlowCard>
  );
}
