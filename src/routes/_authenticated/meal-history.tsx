import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search, Trash2, Camera, Calendar } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { listMealsByDate, deleteMeal, type MealLogDTO } from "@/lib/food.functions";
import { getProfile } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/meal-history")({
  head: () => ({
    meta: [
      { title: "Meal History — HabitPet" },
      { name: "description", content: "Browse every meal you've scanned, with photos, calories, and health scores." },
    ],
  }),
  component: MealHistoryPage,
});

const MEAL_EMOJI: Record<string, string> = {
  breakfast: "🥐",
  lunch: "🥗",
  dinner: "🍽️",
  snack: "🍎",
};

function MealHistoryPage() {
  const qc = useQueryClient();
  const fetchMeals = useServerFn(listMealsByDate);
  const fetchProfile = useServerFn(getProfile);
  const fnDelete = useServerFn(deleteMeal);

  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const meals = useQuery({
    queryKey: ["meals", date],
    queryFn: () => fetchMeals({ data: { date } }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => fnDelete({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meals"] });
      qc.invalidateQueries({ queryKey: ["nutrition"] });
      toast.success("Deleted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const filtered = useMemo(() => {
    const list = meals.data ?? [];
    return list.filter((m) => {
      if (filter !== "all" && m.meal_type !== filter) return false;
      if (q) {
        const hay = [m.meal_type, m.notes ?? "", ...(m.items as any[]).map((i) => i?.name ?? "")]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [meals.data, filter, q]);

  const totalCal = filtered.reduce((s, m) => s + m.total_calories, 0);

  return (
    <AppShell title="Meal History" isAdmin={profile.data?.is_admin}>
      <div className="mb-6 flex flex-col gap-3 rounded-[2rem] bg-[var(--gradient-meadow)] p-6 shadow-pet sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {filtered.length} meal{filtered.length === 1 ? "" : "s"}
          </div>
          <div className="text-3xl font-bold">{Math.round(totalCal)} kcal</div>
        </div>
        <Link
          to="/food-scanner"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground shadow-card hover:-translate-y-0.5"
        >
          <Camera size={18} /> Scan meal
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search meals…"
            className="w-full rounded-full border-2 border-input bg-background py-2.5 pl-9 pr-4 text-sm outline-none focus:border-ring"
          />
        </div>
        <div className="relative">
          <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-full border-2 border-input bg-background py-2.5 pl-9 pr-4 text-sm outline-none focus:border-ring"
          />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {["all", "breakfast", "lunch", "dinner", "snack"].map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize ${
              filter === t ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"
            }`}
          >
            {t === "all" ? "All" : `${MEAL_EMOJI[t]} ${t}`}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {meals.isLoading && (
          <div className="rounded-2xl bg-card p-10 text-center text-muted-foreground shadow-pet">
            Loading…
          </div>
        )}
        {!meals.isLoading && filtered.length === 0 && (
          <div className="rounded-2xl bg-card p-10 text-center text-muted-foreground shadow-pet">
            No meals found. Scan your first meal to get started.
          </div>
        )}
        {filtered.map((m) => (
          <MealCard key={m.id} meal={m} onDelete={() => remove.mutate(m.id)} />
        ))}
      </div>
    </AppShell>
  );
}

function MealCard({ meal, onDelete }: { meal: MealLogDTO; onDelete: () => void }) {
  const time = new Date(meal.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return (
    <article className="flex items-stretch gap-4 overflow-hidden rounded-2xl bg-card shadow-card">
      {meal.photo_url ? (
        <img src={meal.photo_url} alt="" className="h-28 w-28 shrink-0 object-cover" />
      ) : (
        <div className="grid h-28 w-28 shrink-0 place-items-center bg-[var(--gradient-meadow)] text-4xl">
          {MEAL_EMOJI[meal.meal_type]}
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col justify-center py-3 pr-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold capitalize">{meal.meal_type}</span>
              <span className="text-xs text-muted-foreground">· {time}</span>
              {meal.ai_analyzed && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  ✨ AI
                </span>
              )}
            </div>
            {meal.notes && <div className="truncate text-sm text-muted-foreground">{meal.notes}</div>}
          </div>
          <button
            onClick={onDelete}
            className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          <span className="font-bold">{Math.round(meal.total_calories)} kcal</span>
          <span className="text-muted-foreground">P {Math.round(meal.protein_g)}g</span>
          <span className="text-muted-foreground">C {Math.round(meal.carbs_g)}g</span>
          <span className="text-muted-foreground">F {Math.round(meal.fat_g)}g</span>
        </div>
      </div>
    </article>
  );
}
