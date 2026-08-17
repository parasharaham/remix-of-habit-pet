import { UpgradeTrigger } from "@/components/ProUpgradeSheet";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Dumbbell, HeartPulse, Moon, Sparkles, Timer } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getWorkoutPlan, type WorkoutPlanDTO } from "@/lib/workout.functions";
import { getProfile } from "@/lib/profile.functions";
import { AIThinking, Button, EmptyState, GlowCard, PageTransition, Reveal } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/workout-planner")({
  head: () => ({
    meta: [
      { title: "AI Workout & Recovery Planner — HabitPet" },
      {
        name: "description",
        content:
          "Get a weekly training and recovery plan matched to your goal — build muscle, lose fat, endurance or maintenance — and the time you actually have.",
      },
      { property: "og:title", content: "AI Workout & Recovery Planner — HabitPet" },
      { property: "og:description", content: "Goal-aligned weekly training plus recovery, sleep and fuelling guidance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WorkoutPlannerPage,
});

type Goal = "muscle_gain" | "fat_loss" | "maintenance" | "endurance";

const GOALS: Array<{ id: Goal; label: string }> = [
  { id: "muscle_gain", label: "Build muscle" },
  { id: "fat_loss", label: "Lose fat" },
  { id: "maintenance", label: "Maintain" },
  { id: "endurance", label: "Endurance" },
];

function WorkoutPlannerPage() {
  const fetchProfile = useServerFn(getProfile);
  const build = useServerFn(getWorkoutPlan);
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });

  const [goal, setGoal] = useState<Goal>("muscle_gain");
  const [minutes, setMinutes] = useState(45);
  const [days, setDays] = useState(4);
  const [equipment, setEquipment] = useState("");
  const [plan, setPlan] = useState<WorkoutPlanDTO | null>(null);

  const gen = useMutation({
    mutationFn: () =>
      build({ data: { goal, minutes_per_session: minutes, days_per_week: days, equipment: equipment || undefined } }),
    onSuccess: setPlan,
  });

  return (
    <AppShell title="AI Workout & Recovery" isAdmin={profile.data?.is_admin}>
      <UpgradeTrigger source="ai_workout" when={plan?.personalized === false} />
      <PageTransition>
        <div className="space-y-5">
          <GlowCard tone="green">
            <h1 className="text-xl font-extrabold">Train for your goal, recover like a pro</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              A week of sessions built around your goal, your conditions and the time you actually have.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {GOALS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGoal(g.id)}
                  className={`focus-ring rounded-2xl border p-3 text-xs font-bold transition ${
                    goal === g.id
                      ? "border-transparent bg-[var(--gradient-primary)] text-primary-foreground"
                      : "border-border bg-card/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className="font-semibold">Minutes per session: {minutes}</span>
                <input
                  type="range"
                  min={15}
                  max={120}
                  step={5}
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                  className="mt-2 w-full accent-[var(--primary)]"
                />
              </label>
              <label className="text-sm">
                <span className="font-semibold">Sessions per week: {days}</span>
                <input
                  type="range"
                  min={2}
                  max={7}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="mt-2 w-full accent-[var(--primary)]"
                />
              </label>
            </div>

            <input
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              placeholder="Equipment (optional) — e.g. dumbbells at home, full gym, none"
              className="focus-ring mt-4 w-full rounded-2xl border border-border bg-card/60 px-4 py-3 text-sm"
            />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={() => gen.mutate()} disabled={gen.isPending}>
                <Sparkles size={16} /> {plan ? "Rebuild my week" : "Build my week"}
              </Button>
              {gen.isError && <span className="text-xs text-danger">{(gen.error as Error).message}</span>}
            </div>
          </GlowCard>

          <AnimatePresence mode="wait">
            {gen.isPending && (
              <motion.div key="load" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <AIThinking label="Programming your training week" />
              </motion.div>
            )}
          </AnimatePresence>

          {!plan && !gen.isPending && (
            <EmptyState
              emoji="🏋️"
              title="No training plan yet"
              description="Pick your goal and available time, and the AI coach will program your week — training and recovery."
            />
          )}

          {plan && (
            <div className="space-y-4">
              <Reveal>
                <GlowCard tone="amber">
                  <h2 className="text-lg font-extrabold text-gradient">{plan.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.summary}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Metric icon={<Timer size={16} />} label="Weekly load" value={`${plan.weekly_minutes} min`} />
                    <Metric icon={<Moon size={16} />} label="Sleep target" value={`${plan.sleep_target_hours} h`} />
                    <Metric icon={<Dumbbell size={16} />} label="Goal" value={plan.goal.replace("_", " ")} />
                  </div>
                </GlowCard>
              </Reveal>

              <div className="grid gap-4 md:grid-cols-2">
                {plan.days.map((d, i) => (
                  <Reveal key={`${d.day}-${i}`} delay={i * 0.05}>
                    <GlowCard tone={d.type === "rest" ? "cyan" : "blue"} className="h-full">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wide text-accent">{d.day}</div>
                          <h3 className="mt-0.5 text-base font-extrabold">{d.focus}</h3>
                        </div>
                        <span className="rounded-full tile-mint px-3 py-1 text-[11px] font-bold">
                          {d.minutes} min · {d.intensity}
                        </span>
                      </div>
                      <ul className="mt-3 space-y-2">
                        {d.blocks.map((b, j) => (
                          <li key={j} className="rounded-2xl bg-card/60 p-3">
                            <div className="flex items-center justify-between gap-2 text-sm font-bold">
                              <span>{b.name}</span>
                              <span className="text-xs text-muted-foreground">{b.minutes} min</span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{b.detail}</p>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 flex items-start gap-2 rounded-2xl tile-lilac p-3 text-xs font-semibold">
                        <HeartPulse size={14} className="mt-0.5 shrink-0" /> {d.recovery}
                      </p>
                    </GlowCard>
                  </Reveal>
                ))}
              </div>

              <Reveal>
                <GlowCard tone="green">
                  <h3 className="text-base font-extrabold">Recovery rules</h3>
                  <ul className="mt-3 space-y-2">
                    {plan.recovery_rules.map((r, i) => (
                      <li key={i} className="rounded-2xl bg-card/60 p-3 text-sm text-muted-foreground">
                        · {r}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-sm text-muted-foreground">🍽️ {plan.fuel_tip}</p>
                  <p className="mt-2 text-sm text-muted-foreground">💬 {plan.coach_note}</p>
                </GlowCard>
              </Reveal>
            </div>
          )}
        </div>
      </PageTransition>
    </AppShell>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card/60 p-3">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 text-base font-extrabold capitalize">{value}</div>
    </div>
  );
}
