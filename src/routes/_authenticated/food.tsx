import { useEffect, useRef, useState } from "react";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import {
  analyzeMeal,
  logMeal,
  listMealsByDate,
  deleteMeal,
  uploadMealPhoto,
  type MealLogDTO,
  type MealAnalysisDTO,
} from "@/lib/food.functions";
import { getProfile } from "@/lib/profile.functions";
import { Camera, Sparkles, Trash2, Plus, X } from "lucide-react";

const searchSchema = z.object({ scan: z.enum(["camera", "gallery"]).optional() });

export const Route = createFileRoute("/_authenticated/food")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Food Log — HabitPet" },
      { name: "description", content: "Log meals with a photo or description. AI estimates calories and macros." },
    ],
  }),
  component: FoodPage,
});

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
const MEAL_EMOJI: Record<string, string> = {
  breakfast: "🥐",
  lunch: "🥗",
  dinner: "🍽️",
  snack: "🍎",
};

function FoodPage() {
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getProfile);
  const fetchMeals = useServerFn(listMealsByDate);
  const fnAnalyze = useServerFn(analyzeMeal);
  const fnLog = useServerFn(logMeal);
  const fnDelete = useServerFn(deleteMeal);
  const fnUpload = useServerFn(uploadMealPhoto);

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const today = new Date().toISOString().slice(0, 10);
  const meals = useQuery({
    queryKey: ["meals", today],
    queryFn: () => fetchMeals({ data: { date: today } }),
  });

  const search = useSearch({ from: "/_authenticated/food" });
  const [showForm, setShowForm] = useState(false);
  const [mealType, setMealType] = useState<(typeof MEAL_TYPES)[number]>("breakfast");
  const [text, setText] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<MealAnalysisDTO | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (search.scan) {
      setShowForm(true);
      const t = setTimeout(() => {
        if (search.scan === "camera") cameraRef.current?.click();
        else galleryRef.current?.click();
        window.history.replaceState({}, "", "/food");
      }, 100);
      return () => clearTimeout(t);
    }
  }, [search.scan]);

  function resetForm() {
    setShowForm(false);
    setText("");
    setPhotoDataUrl(null);
    setAnalysis(null);
  }

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      toast.error("Photo must be under 6 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  const analyze = useMutation({
    mutationFn: () =>
      fnAnalyze({ data: { image_data_url: photoDataUrl, text: text || null } }),
    onSuccess: (r) => {
      if (!r.is_food) {
        toast.error(r.reject_reason || "This isn't food — please take a clear photo of your meal.");
        setAnalysis(null);
        return;
      }
      setAnalysis(r);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Analysis failed"),
  });

  const save = useMutation({
    mutationFn: async () => {
      let photoPath: string | null = null;
      if (photoDataUrl) {
        const up = await fnUpload({ data: { data_url: photoDataUrl } });
        photoPath = up.path;
      }
      const a = analysis;
      return fnLog({
        data: {
          meal_type: mealType,
          items: a?.items ?? [],
          notes: text || null,
          photo_url: photoPath,
          total_calories: a?.total_calories ?? 0,
          protein_g: a?.protein_g ?? 0,
          carbs_g: a?.carbs_g ?? 0,
          fat_g: a?.fat_g ?? 0,
          fiber_g: a?.fiber_g ?? 0,
          water_ml: 0,
          ai_analyzed: !!a,
        },
      });
    },
    onSuccess: () => {
      toast.success("Meal logged");
      qc.invalidateQueries({ queryKey: ["meals"] });
      qc.invalidateQueries({ queryKey: ["nutrition"] });
      resetForm();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => fnDelete({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meals"] });
      qc.invalidateQueries({ queryKey: ["nutrition"] });
      toast.success("Removed");
    },
  });

  const list = meals.data ?? [];
  const totalCal = list.reduce((s, m) => s + m.total_calories, 0);
  const target = profile.data?.daily_calorie_target ?? null;

  return (
    <AppShell title="Food log" isAdmin={profile.data?.is_admin}>
      <div className="mb-6 flex flex-col gap-3 rounded-[2rem] bg-[image:var(--gradient-meadow)] p-6 shadow-pet sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Today</div>
          <div className="text-3xl font-bold">
            {Math.round(totalCal)}
            {target ? <span className="text-lg text-muted-foreground"> / {target} kcal</span> : <span className="text-lg text-muted-foreground"> kcal</span>}
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground shadow-card hover:-translate-y-0.5"
        >
          <Plus size={18} /> Log a meal
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-[2rem] bg-card p-6 shadow-pet">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold">Log meal</h3>
            <button onClick={resetForm} className="rounded-full p-1.5 hover:bg-muted"><X size={16} /></button>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {MEAL_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setMealType(t)}
                className={`rounded-full px-4 py-2 text-sm font-semibold capitalize ${
                  mealType === t ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"
                }`}
              >
                {MEAL_EMOJI[t]} {t}
              </button>
            ))}
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Describe your meal (e.g. 'Oatmeal with banana and honey, 1 boiled egg')"
            rows={2}
            maxLength={2000}
            className="mb-3 w-full rounded-2xl border-2 border-input bg-background px-4 py-3 outline-none focus:border-ring"
          />

          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-full border-2 border-input bg-background px-4 py-2 text-sm font-semibold hover:bg-muted"
            >
              <Camera size={16} /> {photoDataUrl ? "Retake" : "Camera"}
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-full border-2 border-input bg-background px-4 py-2 text-sm font-semibold hover:bg-muted"
            >
              📁 Gallery
            </button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onPickPhoto} className="hidden" />
            <input ref={galleryRef} type="file" accept="image/*" onChange={onPickPhoto} className="hidden" />
          </div>
          <div className="mb-3">
            {photoDataUrl && (
              <div className="mt-3 flex items-start gap-3">
                <img src={photoDataUrl} alt="Meal preview" className="h-24 w-24 rounded-2xl object-cover" />
                <button
                  onClick={() => setPhotoDataUrl(null)}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {!analysis && (
            <button
              onClick={() => analyze.mutate()}
              disabled={analyze.isPending || (!photoDataUrl && !text.trim())}
              className="mb-3 inline-flex items-center gap-2 rounded-full border-2 border-primary/40 bg-primary/5 px-5 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
            >
              <Sparkles size={16} /> {analyze.isPending ? "Analyzing…" : "Analyze with AI"}
            </button>
          )}

          {analysis && (
            <div className="mb-4 rounded-2xl bg-muted/50 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles size={14} className="text-primary" /> AI estimate
                </div>
                <div className={`rounded-full px-3 py-1 text-xs font-bold ${
                  analysis.health_score >= 70 ? "bg-emerald-100 text-emerald-700"
                  : analysis.health_score >= 40 ? "bg-amber-100 text-amber-700"
                  : "bg-red-100 text-red-700"
                }`}>
                  Health {Math.round(analysis.health_score)}/100
                </div>
              </div>
              {analysis.verdict && (
                <p className="mb-3 rounded-xl bg-background p-3 text-sm">{analysis.verdict}</p>
              )}
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
                <Stat label="Calories" value={`${Math.round(analysis.total_calories)}`} />
                <Stat label="Protein" value={`${Math.round(analysis.protein_g)}g`} />
                <Stat label="Carbs" value={`${Math.round(analysis.carbs_g)}g`} />
                <Stat label="Fat" value={`${Math.round(analysis.fat_g)}g`} />
                <Stat label="Fiber" value={`${Math.round(analysis.fiber_g)}g`} />
              </div>
              {analysis.items.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {analysis.items.map((it, i) => (
                    <li key={i}>
                      • {it.name}{it.grams ? ` (${Math.round(it.grams)}g)` : ""} — {Math.round(it.calories)} kcal
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={resetForm} className="rounded-full bg-muted px-4 py-2 text-sm font-semibold">
              Cancel
            </button>
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {save.isPending ? "Saving…" : "Save meal"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {list.length === 0 && !meals.isLoading && (
          <div className="rounded-2xl bg-card p-10 text-center text-muted-foreground shadow-pet">
            No meals logged today. Tap "Log a meal" to start.
          </div>
        )}
        {list.map((m) => (
          <MealRow key={m.id} meal={m} onDelete={() => remove.mutate(m.id)} />
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        AI estimates are approximate and not medical advice.
      </p>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background p-2 text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-bold">{value}</div>
    </div>
  );
}

function MealRow({ meal, onDelete }: { meal: MealLogDTO; onDelete: () => void }) {
  return (
    <article className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-card">
      {meal.photo_url ? (
        <img src={meal.photo_url} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
      ) : (
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[image:var(--gradient-meadow)] text-3xl">
          {MEAL_EMOJI[meal.meal_type]}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-bold capitalize">{meal.meal_type}</span>
          <span className="text-sm font-semibold text-muted-foreground">
            {Math.round(meal.total_calories)} kcal
          </span>
        </div>
        {meal.notes && <div className="truncate text-sm text-muted-foreground">{meal.notes}</div>}
        <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>P {Math.round(meal.protein_g)}g</span>
          <span>C {Math.round(meal.carbs_g)}g</span>
          <span>F {Math.round(meal.fat_g)}g</span>
          {meal.ai_analyzed && <span className="text-primary">✨ AI</span>}
        </div>
      </div>
      <button
        onClick={onDelete}
        className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label="Delete"
      >
        <Trash2 size={16} />
      </button>
    </article>
  );
}
