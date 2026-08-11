import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { getNutritionSummary } from "@/lib/food.functions";
import { getProfile } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/nutrition")({
  head: () => ({
    meta: [
      { title: "Nutrition — HabitPet" },
      { name: "description", content: "Your daily calories, macros, and 7-day trend." },
    ],
  }),
  component: NutritionPage,
});

function NutritionPage() {
  const fetchSummary = useServerFn(getNutritionSummary);
  const fetchProfile = useServerFn(getProfile);
  const summary = useQuery({ queryKey: ["nutrition"], queryFn: () => fetchSummary() });
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });

  const s = summary.data;
  const target = s?.target_calories ?? null;
  const pct = target && s ? Math.min(100, Math.round((s.total_calories / target) * 100)) : 0;
  const weekMax = Math.max(1, ...(s?.weekly ?? []).map((d) => d.calories));

  return (
    <AppShell title="Nutrition" isAdmin={profile.data?.is_admin}>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[2rem] bg-[var(--gradient-meadow)] p-6 shadow-pet md:col-span-2">
          <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Today's calories</div>
          <div className="mt-1 text-4xl font-bold">
            {s?.total_calories ?? 0}
            {target && <span className="text-xl text-muted-foreground"> / {target}</span>}
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-background/60">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          {!target && (
            <p className="mt-3 text-xs text-muted-foreground">
              Complete onboarding with height/weight for a personalized target.
            </p>
          )}
        </div>

        <div className="rounded-[2rem] bg-card p-6 shadow-pet">
          <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Macros today</div>
          <div className="mt-3 space-y-2">
            <MacroRow label="Protein" value={s?.protein_g ?? 0} color="hsl(var(--primary))" />
            <MacroRow label="Carbs" value={s?.carbs_g ?? 0} color="#f59e0b" />
            <MacroRow label="Fat" value={s?.fat_g ?? 0} color="#ec4899" />
            <MacroRow label="Fiber" value={s?.fiber_g ?? 0} color="#10b981" />
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-[2rem] bg-card p-6 shadow-pet">
        <div className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Last 7 days
        </div>
        <div className="flex h-40 items-end justify-between gap-2">
          {(s?.weekly ?? []).map((d) => {
            const h = Math.max(4, Math.round((d.calories / weekMax) * 140));
            const day = new Date(d.date).toLocaleDateString(undefined, { weekday: "short" });
            return (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <div className="text-xs font-semibold">{d.calories}</div>
                <div
                  className="w-full rounded-t-xl bg-primary/80"
                  style={{ height: `${h}px` }}
                  title={`${d.date}: ${d.calories} kcal`}
                />
                <div className="text-xs text-muted-foreground">{day}</div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Estimates are approximate and not medical advice.
      </p>
    </AppShell>
  );
}

function MacroRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="text-muted-foreground">{value}g</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, value)}%`, background: color }}
        />
      </div>
    </div>
  );
}
