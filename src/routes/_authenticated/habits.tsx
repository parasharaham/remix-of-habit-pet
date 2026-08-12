import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeToProModal } from "@/components/UpgradeToProModal";
import { trackSubEvent } from "@/lib/sub-analytics";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  createHabit,
  deleteHabit,
  listHabits,
  updateHabit,
  type HabitDTO,
} from "@/lib/habits.functions";
import { generateHabitPlan, applyGeneratedHabits, type GeneratedHabit } from "@/lib/ai-habits.functions";
import { getProfile } from "@/lib/profile.functions";
import { AppShell } from "@/components/AppShell";
import { Pause, Play, Plus, Search, Trash2, Flame, Sparkles, X, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/habits")({
  head: () => ({
    meta: [
      { title: "Habits — HabitPet" },
      { name: "description", content: "Create, edit, pause, and organize your habits." },
    ],
  }),
  component: HabitsPage,
});

const CATEGORIES = ["health", "fitness", "reading", "productivity", "study", "finance", "custom"] as const;
const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const FREQ = ["daily", "weekly"] as const;

function HabitsPage() {
  const qc = useQueryClient();
  const fetchHabits = useServerFn(listHabits);
  const fetchProfile = useServerFn(getProfile);
  const fnCreate = useServerFn(createHabit);
  const fnUpdate = useServerFn(updateHabit);
  const fnDelete = useServerFn(deleteHabit);
  const fnGenerate = useServerFn(generateHabitPlan);
  const fnApply = useServerFn(applyGeneratedHabits);

  const habits = useQuery({ queryKey: ["habits"], queryFn: () => fetchHabits() });
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });

  const [showForm, setShowForm] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const sub = useSubscription();
  const habitVerdict = sub.can("custom_habit");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "paused">("all");
  const [aiPreview, setAiPreview] = useState<GeneratedHabit[] | null>(null);
  const [aiReplace, setAiReplace] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    frequency: "daily" as (typeof FREQ)[number],
    category: "custom" as (typeof CATEGORIES)[number],
    difficulty: "medium" as (typeof DIFFICULTIES)[number],
  });

  const create = useMutation({
    mutationFn: () =>
      fnCreate({
        data: {
          title: form.title,
          description: form.description || null,
          frequency: form.frequency,
          category: form.category,
          difficulty: form.difficulty,
        },
      }),
    onSuccess: (h) => {
      qc.setQueryData<HabitDTO[]>(["habits"], (old) => [...(old ?? []), h]);
      setShowForm(false);
      setForm({ title: "", description: "", frequency: "daily", category: "custom", difficulty: "medium" });
      toast.success("Habit added");
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Couldn't add";
      if (/Free limit|Pro/i.test(msg)) {
        trackSubEvent("feature_limit_reached", { feature: "custom_habit" });
        setShowForm(false);
        setShowUpgrade(true);
        return;
      }
      toast.error(msg);
    },
  });

  const togglePause = useMutation({
    mutationFn: (h: HabitDTO) => fnUpdate({ data: { id: h.id, is_paused: !h.is_paused } }),
    onSuccess: (h) => {
      qc.setQueryData<HabitDTO[]>(["habits"], (old) =>
        (old ?? []).map((x) => (x.id === h.id ? h : x)),
      );
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => fnDelete({ data: { id } }),
    onSuccess: (_r, id) => {
      qc.setQueryData<HabitDTO[]>(["habits"], (old) => (old ?? []).filter((h) => h.id !== id));
      toast.success("Habit removed");
    },
  });

  const generate = useMutation({
    mutationFn: () => fnGenerate(),
    onSuccess: (r) => {
      setAiPreview(r.habits);
      setAiReplace(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "AI failed"),
  });

  const applyAi = useMutation({
    mutationFn: () =>
      fnApply({ data: { habits: aiPreview ?? [], replace: aiReplace } }),
    onSuccess: (r) => {
      toast.success(`Added ${r.inserted} habits`);
      setAiPreview(null);
      qc.invalidateQueries({ queryKey: ["habits"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const items = (habits.data ?? []).filter((h) => {
    if (filter === "active" && h.is_paused) return false;
    if (filter === "paused" && !h.is_paused) return false;
    if (search && !h.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const isPremium = profile.data?.is_premium ?? false;
  const activeCount = (habits.data ?? []).filter((h) => !h.is_paused).length;
  const overLimit = !isPremium && activeCount >= 3;

  return (
    <AppShell title="Habits" isAdmin={profile.data?.is_admin}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search habits…"
            className="w-full rounded-full border-2 border-input bg-card py-2.5 pl-9 pr-4 outline-none focus:border-ring"
          />
        </div>
        <div className="flex items-center gap-2">
          {(["all", "active", "paused"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition ${
                filter === f ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
              }`}
            >
              {f}
            </button>
          ))}
          <button
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-primary/40 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
          >
            <Sparkles size={16} /> {generate.isPending ? "Generating…" : "AI plan"}
          </button>
          <button
            onClick={() => {
              if (!habitVerdict.allowed) {
                trackSubEvent("feature_limit_reached", { feature: "custom_habit" });
                setShowUpgrade(true);
                return;
              }
              setShowForm(true);
            }}
            disabled={overLimit}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card hover:-translate-y-0.5 disabled:opacity-50"
          >
            <Plus size={16} /> New habit
          </button>
        </div>
      </div>

      {aiPreview && (
        <div className="mb-6 rounded-[2rem] border-2 border-primary/30 bg-card p-6 shadow-pet">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-primary" />
              <h3 className="text-lg font-bold">Your personalized habit plan</h3>
            </div>
            <button
              onClick={() => setAiPreview(null)}
              className="rounded-full p-1.5 hover:bg-muted"
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            {aiPreview.map((h, i) => (
              <div key={i} className="rounded-2xl bg-muted/50 p-3">
                <div className="flex items-center gap-2 font-semibold">
                  <span>{categoryIcon(h.category)}</span>
                  <span className="text-sm">{h.title}</span>
                </div>
                {h.description && (
                  <div className="mt-1 text-xs text-muted-foreground">{h.description}</div>
                )}
                <div className="mt-1 flex gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <span>{h.category}</span> · <span>{h.difficulty}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={aiReplace}
                onChange={(e) => setAiReplace(e.target.checked)}
                className="h-4 w-4"
              />
              Replace my current habits
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => generate.mutate()}
                disabled={generate.isPending}
                className="rounded-full bg-muted px-4 py-2 text-sm font-semibold hover:bg-muted/70"
              >
                Regenerate
              </button>
              <button
                onClick={() => applyAi.mutate()}
                disabled={applyAi.isPending}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                <Check size={16} /> Add to my habits
              </button>
            </div>
          </div>
        </div>
      )}

      {overLimit && (
        <div className="mb-4 rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 text-sm">
          You&apos;ve hit the free plan&apos;s 3-habit limit.{" "}
          <a href="/pricing" className="font-semibold text-primary hover:underline">
            Upgrade to Premium →
          </a>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (form.title.trim()) create.mutate();
          }}
          className="mb-6 grid gap-3 rounded-[2rem] bg-card p-6 shadow-pet sm:grid-cols-2"
        >
          <input
            autoFocus
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Title (e.g. Drink 2L water)"
            maxLength={100}
            className="rounded-full border-2 border-input bg-background px-4 py-2.5 outline-none focus:border-ring sm:col-span-2"
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description (optional)"
            maxLength={500}
            className="rounded-2xl border-2 border-input bg-background px-4 py-2.5 outline-none focus:border-ring sm:col-span-2"
            rows={2}
          />
          <SelectField
            label="Category"
            value={form.category}
            onChange={(v) => setForm({ ...form, category: v as any })}
            options={CATEGORIES}
          />
          <SelectField
            label="Frequency"
            value={form.frequency}
            onChange={(v) => setForm({ ...form, frequency: v as any })}
            options={FREQ}
          />
          <SelectField
            label="Difficulty"
            value={form.difficulty}
            onChange={(v) => setForm({ ...form, difficulty: v as any })}
            options={DIFFICULTIES}
          />
          <div className="flex items-end justify-end gap-2 sm:col-span-1">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-full bg-muted px-4 py-2.5 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!form.title.trim() || create.isPending}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {items.length === 0 && (
          <div className="rounded-2xl bg-card p-10 text-center text-muted-foreground shadow-pet">
            No habits match.
          </div>
        )}
        {items.map((h) => (
          <article
            key={h.id}
            className={`group flex items-center gap-3 rounded-2xl border-2 bg-card p-4 shadow-card transition ${
              h.is_paused ? "opacity-60" : ""
            }`}
          >
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--gradient-meadow)] text-2xl">
              {categoryIcon(h.category)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold">{h.title}</div>
              {h.description && (
                <div className="truncate text-sm text-muted-foreground">{h.description}</div>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Pill>{h.category}</Pill>
                <Pill>{h.frequency}</Pill>
                <Pill>{h.difficulty}</Pill>
                <span className="inline-flex items-center gap-1 font-semibold text-[var(--streak)]">
                  <Flame size={12} /> {h.current_streak}d · best {h.longest_streak}
                </span>
              </div>
            </div>
            <button
              onClick={() => togglePause.mutate(h)}
              className="rounded-full p-2 text-muted-foreground hover:bg-muted"
              aria-label={h.is_paused ? "Resume" : "Pause"}
            >
              {h.is_paused ? <Play size={16} /> : <Pause size={16} />}
            </button>
            <button
              onClick={() => remove.mutate(h.id)}
              className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label="Delete"
            >
              <Trash2 size={16} />
            </button>
          </article>
        ))}
      </div>
          <UpgradeToProModal
        open={showUpgrade}
        source="habit_limit"
        onClose={() => setShowUpgrade(false)}
        detail={
          habitVerdict.limit
            ? `You've reached your ${habitVerdict.limit}-habit Free limit. Your existing habits stay exactly as they are — Pro unlocks unlimited new ones.`
            : undefined
        }
      />
</AppShell>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold capitalize">
      {children}
    </span>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-full border-2 border-input bg-background px-4 py-2 text-sm font-medium capitalize text-foreground outline-none focus:border-ring"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function categoryIcon(c: string) {
  const m: Record<string, string> = {
    health: "💚",
    fitness: "💪",
    reading: "📚",
    productivity: "⚙️",
    study: "🎓",
    finance: "💰",
    custom: "✨",
  };
  return m[c] ?? "✨";
}
