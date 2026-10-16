import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAchievements } from "@/lib/achievements.functions";
import { getProfile } from "@/lib/profile.functions";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/achievements")({
  head: () => ({
    meta: [
      { title: "Achievements — HabitPet" },
      { name: "description", content: "Track unlocked and locked achievements with progress bars." },
    ],
  }),
  component: AchievementsPage,
});

const CATEGORIES = ["all", "habit", "pet", "level", "coin"] as const;

function AchievementsPage() {
  const fetchProf = useServerFn(getProfile);
  const fetchAch = useServerFn(listAchievements);
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => fetchProf() });
  const ach = useQuery({ queryKey: ["achievements"], queryFn: () => fetchAch() });

  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("all");

  const items = (ach.data ?? []).filter((a) => cat === "all" || a.category === cat);
  const earned = (ach.data ?? []).filter((a) => a.unlocked_at).length;
  const total = (ach.data ?? []).length;
  const pct = total ? Math.round((earned / total) * 100) : 0;

  return (
    <AppShell title="Achievements" isAdmin={profile.data?.is_admin}>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Summary label="Earned" value={earned} icon="🏆" />
        <Summary label="Locked" value={total - earned} icon="🔒" />
        <Summary label="Completion" value={`${pct}%`} icon="📊" />
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition ${
              cat === c ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((a) => {
          const unlocked = Boolean(a.unlocked_at);
          return (
            <article
              key={a.id}
              className={`rounded-2xl border-2 p-5 shadow-card transition ${
                unlocked
                  ? "border-primary/40 bg-[image:var(--gradient-meadow)]"
                  : "border-border bg-card"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`grid h-14 w-14 place-items-center rounded-2xl text-3xl ${
                    unlocked ? "bg-card shadow-card" : "bg-muted opacity-60 grayscale"
                  }`}
                >
                  {unlocked ? a.badge : "🔒"}
                </div>
                <div className="flex-1">
                  <div className="font-bold">{a.title}</div>
                  <div className="text-xs text-muted-foreground">{a.description}</div>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="capitalize text-muted-foreground">{a.category}</span>
                  <span>
                    {Math.min(a.current_value, a.threshold)} / {a.threshold}
                  </span>
                </div>
                <div className="stat-bar">
                  <div
                    className="fill"
                    style={{
                      width: `${a.progress * 100}%`,
                      background: unlocked ? "var(--primary)" : "var(--xp)",
                    }}
                  />
                </div>
                {unlocked && (
                  <p className="text-xs text-muted-foreground">
                    Unlocked {new Date(a.unlocked_at!).toLocaleDateString()}
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}

function Summary({ label, value, icon }: { label: string; value: number | string; icon: string }) {
  return (
    <div className="rounded-[2rem] bg-card p-5 shadow-card">
      <div className="text-3xl">{icon}</div>
      <div className="mt-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  );
}
