import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getPetStatus, syncDecay } from "@/lib/pet.functions";
import { completeHabit, listHabits, type HabitDTO } from "@/lib/habits.functions";
import { getOnboardingStatus } from "@/lib/onboarding.functions";
import { getProfile } from "@/lib/profile.functions";
import { getMyActivity } from "@/lib/community.functions";
import { AppShell } from "@/components/AppShell";
import { PetEmoji } from "@/components/PetEmoji";
import { StatBar } from "@/components/StatBar";
import {
  Card,
  Confetti,
  EmptyState,
  Pill,
  ProgressRing,
  SectionHeader,
  Skeleton,
  SkeletonCard,
  StatTile,
} from "@/components/ui-kit";
import {
  Camera,
  Check,
  Coins,
  Flame,
  ListChecks,
  Plus,
  Sparkles,
  Target,
  Trophy,
  Zap,
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

const QUOTES = [
  "Small steps, every day, become a whole new you.",
  "Your pet grows when you do. Let's make today count.",
  "Consistency beats intensity — one habit at a time.",
  "Progress is a streak of ordinary days done well.",
  "Show up for yourself today. Your pet is watching.",
];

function feedIcon(kind: string) {
  if (kind === "habit_completed") return "✅";
  if (kind === "level_up") return "⬆️";
  if (kind === "evolution") return "🐣";
  if (kind === "achievement") return "🏆";
  if (kind === "purchase") return "🛍️";
  return "✨";
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchPet = useServerFn(getPetStatus);
  const fetchHabits = useServerFn(listHabits);
  const fetchProfile = useServerFn(getProfile);
  const fetchActivity = useServerFn(getMyActivity);
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
  const activity = useQuery({ queryKey: ["activity", "me"], queryFn: () => fetchActivity() });

  const quote = useMemo(() => QUOTES[new Date().getDate() % QUOTES.length], []);

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
      if ("vibrate" in navigator) navigator.vibrate?.(30);
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
      qc.invalidateQueries({ queryKey: ["activity", "me"] });
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
  const name = profile.data?.username || profile.data?.full_name || "friend";

  return (
    <AppShell isAdmin={profile.data?.is_admin}>
      <Confetti fire={celebrate} />

      {/* Greeting */}
      <header className="mb-6 animate-[rise-in_500ms_cubic-bezier(.22,1,.36,1)_both]">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
            </p>
            <h1 className="truncate text-2xl font-bold md:text-4xl">
              {greeting()}, {name} 👋
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{quote}</p>
          </div>
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <Pill tone="warning">
              <Coins size={12} /> {profile.data?.coins ?? 0}
            </Pill>
            <Pill tone="danger">
              <Flame size={12} /> {bestStreak}d
            </Pill>
          </div>
        </div>
      </header>

      {/* Quick actions */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <QuickAction to="/food-scanner" icon={<Camera size={18} />} label="Scan a meal" tone="var(--brand-blue)" />
        <QuickAction to="/habits" icon={<Plus size={18} />} label="Add habit" tone="var(--brand-green)" />
        <QuickAction to="/nutrition" icon={<Target size={18} />} label="Nutrition" tone="var(--brand-orange)" />
        <QuickAction to="/achievements" icon={<Trophy size={18} />} label="Achievements" tone="var(--brand-purple)" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[5fr_4fr]">
        {/* Pet hero */}
        <Card className="relative overflow-hidden bg-[var(--gradient-aurora)]">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
          {pet.isLoading || !pet.data ? (
            <div className="space-y-4 py-6">
              <Skeleton className="mx-auto h-40 w-40 rounded-full" />
              <Skeleton className="mx-auto h-6 w-32" />
              <Skeleton className="h-3" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          ) : (
            <>
              <div key={pulse} className="pet-pop">
                <div className="animate-[float-slow_6s_ease-in-out_infinite]">
                  <PetEmoji type={pet.data.pet_type} stage={pet.data.pet_stage} size="xl" />
                </div>
              </div>
              <div className="mt-3 text-center">
                <h2 className="text-2xl font-bold">{pet.data.pet_name}</h2>
                <p className="text-sm capitalize text-muted-foreground">
                  Level {pet.data.current_level} · {pet.data.pet_stage}
                </p>
              </div>
              <div className="mt-5 space-y-3.5 rounded-3xl bg-card/70 p-4 backdrop-blur">
                <StatBar label="Health" value={pet.data.health_points} max={100} variant="hp" icon="💚" />
                <StatBar label="Happiness" value={pet.data.happiness_points} max={100} variant="happy" icon="😊" />
                <StatBar label="XP" value={pet.data.xp_into_level} max={pet.data.xp_to_next} variant="xp" icon="⭐" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <StatTile icon={<Coins size={16} />} tone="orange" label="Coins" value={profile.data?.coins ?? 0} />
                <StatTile icon={<Flame size={16} />} tone="pink" label="Streak" value={`${bestStreak}d`} />
                <StatTile icon={<Zap size={16} />} tone="blue" label="Energy" value={pet.data.energy_points} />
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

        {/* Today's habits */}
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
              <div className="mb-5 flex items-center gap-4 rounded-3xl bg-muted/40 p-4">
                <ProgressRing
                  value={completedToday}
                  max={totalHabits}
                  size={96}
                  stroke={10}
                  color={dayDone ? "var(--success)" : "var(--primary)"}
                  label={`${completedToday}/${totalHabits}`}
                  caption="today"
                />
                <div className="min-w-0">
                  <p className="font-bold">{dayDone ? "Day complete! 🎉" : "Keep going"}</p>
                  <p className="text-sm text-muted-foreground">
                    {dayDone
                      ? "Your pet is thriving. Come back tomorrow for a new streak day."
                      : `${totalHabits - completedToday} habit${totalHabits - completedToday === 1 ? "" : "s"} left to feed your pet.`}
                  </p>
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

        {/* Lifetime stats */}
        <Card>
          <SectionHeader title="Lifetime progress" subtitle="Everything you've earned so far" icon={Trophy} />
          <div className="grid grid-cols-2 gap-3">
            <BigStat icon="✅" label="Habits done" value={profile.data?.total_habits_completed ?? 0} />
            <BigStat icon="⭐" label="XP earned" value={profile.data?.total_xp_earned ?? 0} />
            <BigStat icon="🪙" label="Coins earned" value={profile.data?.total_coins_earned ?? 0} />
            <BigStat icon="🔥" label="Best streak" value={Math.max(0, ...todaysHabits.map((h) => h.longest_streak))} />
          </div>
        </Card>

        {/* Recent activity */}
        <Card>
          <SectionHeader
            title="Recent activity"
            subtitle="Your latest wins"
            icon={Sparkles}
            action={{ label: "Community", to: "/community" }}
          />
          {activity.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (activity.data ?? []).length === 0 ? (
            <EmptyState
              emoji="📖"
              title="Your story starts here"
              description="Complete a habit or scan a meal and it'll show up in this log."
            />
          ) : (
            <ul className="space-y-2">
              {(activity.data ?? []).slice(0, 8).map((a, i) => (
                <li
                  key={a.id}
                  style={{ animationDelay: `${i * 35}ms` }}
                  className="flex animate-[rise-in_450ms_cubic-bezier(.22,1,.36,1)_both] items-center gap-3 rounded-2xl bg-muted/40 p-3 text-sm transition hover:bg-muted/70"
                >
                  <span className="text-xl">{feedIcon(a.kind)}</span>
                  <span className="min-w-0 flex-1">
                    {a.kind === "habit_completed" && (
                      <>
                        Completed <b>{a.payload.title}</b> · +{a.payload.coins} 🪙
                      </>
                    )}
                    {a.kind === "level_up" && (
                      <>
                        Reached level <b>{a.payload.level}</b>
                      </>
                    )}
                    {a.kind === "achievement" && (
                      <>
                        Unlocked {a.payload.badge} <b>{a.payload.title}</b>
                      </>
                    )}
                    {a.kind === "purchase" && (
                      <>
                        Bought {a.payload.image} <b>{a.payload.name}</b>
                      </>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(a.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

function QuickAction({
  to,
  icon,
  label,
  tone,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  tone: string;
}) {
  return (
    <Link
      to={to}
      className="focus-ring group flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3.5 shadow-card transition hover:-translate-y-1 hover:shadow-pet active:scale-[0.98]"
    >
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white transition group-hover:scale-110"
        style={{ background: tone }}
      >
        {icon}
      </span>
      <span className="min-w-0 truncate text-sm font-bold">{label}</span>
    </Link>
  );
}

function BigStat({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-[var(--gradient-meadow)] p-4 transition hover:-translate-y-0.5">
      <div className="text-2xl">{icon}</div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
