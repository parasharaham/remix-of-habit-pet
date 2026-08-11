import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getActivityFeed, getLeaderboard } from "@/lib/community.functions";
import { getProfile } from "@/lib/profile.functions";
import { AppShell } from "@/components/AppShell";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/community")({
  head: () => ({
    meta: [
      { title: "Community — HabitPet" },
      { name: "description", content: "Leaderboards and a live activity feed of players around the world." },
    ],
  }),
  component: CommunityPage,
});

const METRICS = [
  { key: "xp" as const, label: "XP", icon: "⭐" },
  { key: "coins" as const, label: "Coins", icon: "🪙" },
  { key: "streak" as const, label: "Streaks", icon: "🔥" },
  { key: "level" as const, label: "Pet level", icon: "🐾" },
];

function CommunityPage() {
  const [metric, setMetric] = useState<(typeof METRICS)[number]["key"]>("xp");
  const fetchLb = useServerFn(getLeaderboard);
  const fetchFeed = useServerFn(getActivityFeed);
  const fetchProf = useServerFn(getProfile);

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => fetchProf() });
  const lb = useQuery({ queryKey: ["leaderboard", metric], queryFn: () => fetchLb({ data: { metric } }) });
  const feed = useQuery({ queryKey: ["feed"], queryFn: () => fetchFeed() });

  return (
    <AppShell title="Community" isAdmin={profile.data?.is_admin}>
      <div className="grid gap-6 lg:grid-cols-[3fr_4fr]">
        <section className="rounded-[2rem] bg-card p-6 shadow-pet md:p-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Trophy size={20} className="text-[var(--streak)]" /> Leaderboard
            </h2>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {METRICS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  metric === m.key ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"
                }`}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>
          <ol className="space-y-2">
            {(lb.data ?? []).map((row, i) => (
              <li
                key={row.user_id}
                className={`flex items-center gap-3 rounded-2xl p-3 ${
                  row.user_id === profile.data?.id ? "bg-primary/10 ring-2 ring-primary/30" : "bg-muted/40"
                }`}
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-card font-bold">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{row.username}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.pet_name ? `${row.pet_name} · Lv ${row.pet_level ?? 1}` : "No pet yet"}
                  </div>
                </div>
                <div className="font-bold">{row.value.toLocaleString()}</div>
              </li>
            ))}
            {(lb.data ?? []).length === 0 && (
              <li className="rounded-2xl bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                No one on the board yet. Be the first!
              </li>
            )}
          </ol>
        </section>

        <section className="rounded-[2rem] bg-card p-6 shadow-pet md:p-8">
          <h2 className="mb-4 text-lg font-bold">Live activity</h2>
          <ul className="space-y-2">
            {(feed.data ?? []).map((f) => (
              <li key={f.id} className="flex items-start gap-3 rounded-2xl bg-muted/40 p-3 text-sm">
                <span className="text-xl">{feedEmoji(f.kind)}</span>
                <span className="flex-1">
                  <b>{f.username}</b>{" "}
                  {f.kind === "habit_completed" && (
                    <>completed <i>{f.payload.title}</i> ({f.payload.streak}d streak)</>
                  )}
                  {f.kind === "level_up" && <>leveled up to <b>Lv {f.payload.level}</b></>}
                  {f.kind === "achievement" && (
                    <>unlocked {f.payload.badge} <i>{f.payload.title}</i></>
                  )}
                  {f.kind === "purchase" && <>bought {f.payload.image} <i>{f.payload.name}</i></>}
                  {f.kind === "evolution" && <>evolved to <b>{f.payload.stage}</b></>}
                </span>
                <span className="text-xs text-muted-foreground">{timeAgo(f.created_at)}</span>
              </li>
            ))}
            {(feed.data ?? []).length === 0 && (
              <li className="rounded-2xl bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                The feed is quiet. Complete a habit to kick things off.
              </li>
            )}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}

function feedEmoji(kind: string) {
  return ({ habit_completed: "✅", level_up: "⬆️", achievement: "🏆", purchase: "🛍️", evolution: "🐣" } as any)[kind] ?? "✨";
}
function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
