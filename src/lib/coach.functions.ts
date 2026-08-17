import { createServerFn } from "@tanstack/react-start";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { languageInstruction } from "./ai-language";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const MODEL = "google/gemini-3-flash-preview";

function today() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

/* ------------------------------------------------------------ daily goals */

export interface DailyGoalsDTO {
  goal_date: string;
  calories: number;
  protein_g: number;
  water_ml: number;
  steps: number;
  sleep_hours: number;
  veg_servings: number;
  fruit_servings: number;
  healthy_meals: number;
  rationale: string | null;
  ai_generated: boolean;
  progress: {
    calories: number;
    protein_g: number;
    water_ml: number;
    steps: number;
    healthy_meals: number;
  };
}

const GoalSchema = z.object({
  calories: z.number(),
  protein_g: z.number(),
  water_ml: z.number(),
  steps: z.number(),
  sleep_hours: z.number(),
  veg_servings: z.number(),
  fruit_servings: z.number(),
  healthy_meals: z.number(),
  rationale: z.string(),
});

export const getDailyGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ regenerate: z.boolean().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<DailyGoalsDTO> => {
    const { supabase, userId } = context;
    const date = today();

    const { data: existing } = await supabase
      .from("daily_goals")
      .select("*")
      .eq("user_id", userId)
      .eq("goal_date", date)
      .maybeSingle();

    let row: any = existing;

    if (!row || data.regenerate) {
      const { data: prof } = await supabase
        .from("profiles")
        .select(
          "age,sex,weight_kg,height_cm,activity_level,fitness_goal,health_conditions,allergies,food_preferences,lifestyle,daily_calorie_target,preferred_language",
        )
        .eq("id", userId)
        .maybeSingle();

      // recent behaviour so goals adapt over time
      const { data: recentMeals } = await supabase
        .from("meal_logs")
        .select("meal_date,total_calories,protein_g,water_ml,health_score")
        .eq("user_id", userId)
        .gte("meal_date", daysAgo(13));
      const { data: recentActs } = await supabase
        .from("activity_logs")
        .select("activity_date,steps,duration_min")
        .eq("user_id", userId)
        .gte("activity_date", daysAgo(13));

      const days = Math.max(1, new Set((recentMeals ?? []).map((m) => m.meal_date)).size);
      const avgCals = (recentMeals ?? []).reduce((s, m) => s + Number(m.total_calories ?? 0), 0) / days;
      const avgProtein = (recentMeals ?? []).reduce((s, m) => s + Number(m.protein_g ?? 0), 0) / days;
      const avgSteps =
        (recentActs ?? []).reduce((s, a) => s + Number(a.steps ?? 0), 0) / Math.max(1, new Set((recentActs ?? []).map((a) => a.activity_date)).size);

      let generated: z.infer<typeof GoalSchema> | null = null;
      const apiKey = process.env["LOVABLE_API_KEY"];
      if (apiKey) {
        try {
          const gateway = createLovableAiGatewayProvider(apiKey);
          const { output } = await generateText({
            model: gateway(MODEL),
            output: Output.object({ schema: GoalSchema }),
            prompt: `You are a personal health coach. Set today's realistic daily goals for this user.

PROFILE: age ${prof?.age ?? "?"}, sex ${prof?.sex ?? "?"}, weight ${prof?.weight_kg ?? "?"}kg, height ${prof?.height_cm ?? "?"}cm, activity ${prof?.activity_level ?? "?"}, lifestyle ${(prof as any)?.lifestyle ?? "?"}, goal "${prof?.fitness_goal ?? "general health"}", conditions: ${prof?.health_conditions?.join(", ") || "none"}, allergies: ${(prof as any)?.allergies?.join(", ") || "none"}, preferences: ${(prof as any)?.food_preferences?.join(", ") || "none"}.

LAST 14 DAYS AVERAGES: ${Math.round(avgCals)} kcal/day, ${Math.round(avgProtein)}g protein/day, ${Math.round(avgSteps)} steps/day.

Set goals that stretch the user slightly beyond their recent averages but stay achievable and medically safe. Fields: calories (kcal), protein_g, water_ml, steps, sleep_hours, veg_servings, fruit_servings, healthy_meals. rationale = one warm sentence explaining today's focus. Numbers only, no text inside numeric fields.

${languageInstruction((prof as any)?.preferred_language)}`,
          });
          generated = output;
        } catch (e) {
          if (!NoObjectGeneratedError.isInstance(e)) throw e;
        }
      }

      const fallback = {
        calories: prof?.daily_calorie_target ?? 2000,
        protein_g: Math.round((Number(prof?.weight_kg) || 70) * 1.6),
        water_ml: 2500,
        steps: 8000,
        sleep_hours: 8,
        veg_servings: 3,
        fruit_servings: 2,
        healthy_meals: 3,
        rationale: null as string | null,
      };

      const payload = {
        user_id: userId,
        goal_date: date,
        calories: clamp(generated?.calories ?? fallback.calories, 1000, 6000),
        protein_g: clamp(generated?.protein_g ?? fallback.protein_g, 20, 400),
        water_ml: clamp(generated?.water_ml ?? fallback.water_ml, 500, 8000),
        steps: clamp(generated?.steps ?? fallback.steps, 1000, 40000),
        sleep_hours: Math.max(4, Math.min(12, Number(generated?.sleep_hours ?? fallback.sleep_hours))),
        veg_servings: clamp(generated?.veg_servings ?? fallback.veg_servings, 0, 12),
        fruit_servings: clamp(generated?.fruit_servings ?? fallback.fruit_servings, 0, 12),
        healthy_meals: clamp(generated?.healthy_meals ?? fallback.healthy_meals, 1, 8),
        rationale: generated?.rationale ?? fallback.rationale,
        ai_generated: Boolean(generated),
      };

      const { data: saved, error } = await supabase
        .from("daily_goals")
        .upsert(payload, { onConflict: "user_id,goal_date" })
        .select("*")
        .single();
      if (error) throw error;
      row = saved;
    }

    const { data: meals } = await supabase
      .from("meal_logs")
      .select("total_calories,protein_g,water_ml,health_score,classification")
      .eq("user_id", userId)
      .eq("meal_date", date);
    const { data: acts } = await supabase
      .from("activity_logs")
      .select("steps")
      .eq("user_id", userId)
      .eq("activity_date", date);

    return {
      goal_date: row.goal_date,
      calories: row.calories,
      protein_g: row.protein_g,
      water_ml: row.water_ml,
      steps: row.steps,
      sleep_hours: Number(row.sleep_hours),
      veg_servings: row.veg_servings,
      fruit_servings: row.fruit_servings,
      healthy_meals: row.healthy_meals,
      rationale: row.rationale ?? null,
      ai_generated: Boolean(row.ai_generated),
      progress: {
        calories: Math.round((meals ?? []).reduce((s, m) => s + Number(m.total_calories ?? 0), 0)),
        protein_g: Math.round((meals ?? []).reduce((s, m) => s + Number(m.protein_g ?? 0), 0)),
        water_ml: Math.round((meals ?? []).reduce((s, m) => s + Number(m.water_ml ?? 0), 0)),
        steps: Math.round((acts ?? []).reduce((s, a) => s + Number(a.steps ?? 0), 0)),
        healthy_meals: (meals ?? []).filter((m) => (m as any).classification === "healthy_balanced").length,
      },
    };
  });

/* ----------------------------------------------------------- daily report */

export interface DailyReportDTO {
  report_date: string;
  calories_in: number;
  calories_out: number;
  protein_g: number;
  water_ml: number;
  habits_completed: number;
  habits_total: number;
  nutrition_score: number;
  health_score: number;
  pet_status: string | null;
  summary: string | null;
  suggestions: string[];
}

const ReportSchema = z.object({
  summary: z.string(),
  pet_status: z.string(),
  suggestions: z.array(z.string()),
});

export const getDailyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ regenerate: z.boolean().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<DailyReportDTO> => {
    const { supabase, userId } = context;
    const date = today();

    const { data: existing } = await supabase
      .from("daily_reports")
      .select("*")
      .eq("user_id", userId)
      .eq("report_date", date)
      .maybeSingle();

    if (existing && !data.regenerate) {
      return {
        report_date: existing.report_date,
        calories_in: existing.calories_in,
        calories_out: existing.calories_out,
        protein_g: existing.protein_g,
        water_ml: existing.water_ml,
        habits_completed: existing.habits_completed,
        habits_total: existing.habits_total,
        nutrition_score: existing.nutrition_score,
        health_score: existing.health_score,
        pet_status: existing.pet_status,
        summary: existing.summary,
        suggestions: Array.isArray(existing.suggestions) ? (existing.suggestions as string[]) : [],
      };
    }

    const [{ data: meals }, { data: acts }, { data: habits }, { data: comps }, { data: pet }] = await Promise.all([
      supabase
        .from("meal_logs")
        .select("food_name,meal_type,total_calories,protein_g,carbs_g,fat_g,fiber_g,sugar_g,sodium_mg,water_ml,health_score,classification")
        .eq("user_id", userId)
        .eq("meal_date", date),
      supabase.from("activity_logs").select("activity_type,duration_min,steps,calories_burned").eq("user_id", userId).eq("activity_date", date),
      supabase.from("habits").select("id,title").eq("user_id", userId).eq("is_active", true),
      supabase.from("habit_completions").select("habit_id").eq("user_id", userId).eq("completion_date", date),
      supabase.from("pets").select("pet_name,health_points,happiness_points,energy_points,current_level").eq("user_id", userId).maybeSingle(),
    ]);

    const caloriesIn = Math.round((meals ?? []).reduce((s, m) => s + Number(m.total_calories ?? 0), 0));
    const caloriesOut = Math.round((acts ?? []).reduce((s, a) => s + Number(a.calories_burned ?? 0), 0));
    const protein = Math.round((meals ?? []).reduce((s, m) => s + Number(m.protein_g ?? 0), 0));
    const water = Math.round((meals ?? []).reduce((s, m) => s + Number(m.water_ml ?? 0), 0));
    const habitsTotal = habits?.length ?? 0;
    const habitsDone = new Set((comps ?? []).map((c) => c.habit_id)).size;
    const scored = (meals ?? []).filter((m) => m.health_score != null);
    const nutritionScore = scored.length
      ? Math.round(scored.reduce((s, m) => s + Number(m.health_score), 0) / scored.length)
      : 0;
    const habitRatio = habitsTotal ? habitsDone / habitsTotal : 0;
    const healthScore = clamp(nutritionScore * 0.55 + habitRatio * 100 * 0.3 + Math.min(1, water / 2500) * 100 * 0.15, 0, 100);

    const { data: langProf } = await supabase.from("profiles").select("preferred_language").eq("id", userId).maybeSingle();
    const reportLang = (langProf as any)?.preferred_language ?? "en";

    let ai: z.infer<typeof ReportSchema> | null = null;
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (apiKey) {
      try {
        const gateway = createLovableAiGatewayProvider(apiKey);
        const { output } = await generateText({
          model: gateway(MODEL),
          output: Output.object({ schema: ReportSchema }),
          prompt: `You are HabitPet's warm, encouraging AI health coach. Write today's end-of-day report.

TODAY: ${caloriesIn} kcal eaten across ${meals?.length ?? 0} meals (${(meals ?? []).map((m) => `${m.food_name ?? m.meal_type} — ${(m as any).classification ?? "moderate"}, ${Math.round(Number(m.total_calories ?? 0))} kcal, ${Math.round(Number(m.protein_g ?? 0))}g protein, ${Math.round(Number(m.fiber_g ?? 0))}g fiber`).join("; ") || "none"}), ${caloriesOut} kcal burned, ${protein}g protein, ${water}ml water logged, ${habitsDone}/${habitsTotal} habits completed, nutrition score ${nutritionScore}/100, overall health score ${healthScore}/100.
These nutrition numbers are the saved analysis for those meals — use them exactly, never invent or recalculate values.
PET: ${pet?.pet_name ?? "Pet"} — health ${pet?.health_points ?? 0}, happiness ${pet?.happiness_points ?? 0}, energy ${pet?.energy_points ?? 0}, level ${pet?.current_level ?? 1}.

Write:
- summary: 3–4 sentences reviewing the day honestly but kindly. Never guilt or shame. Celebrate what went well first.
- pet_status: one short sentence describing how the pet feels today because of these habits.
- suggestions: 2–4 short, concrete, doable actions for tomorrow.

${languageInstruction(reportLang)}`,
        });
        ai = output;
      } catch (e) {
        if (!NoObjectGeneratedError.isInstance(e)) throw e;
      }
    }

    const payload = {
      user_id: userId,
      report_date: date,
      calories_in: caloriesIn,
      calories_out: caloriesOut,
      protein_g: protein,
      water_ml: water,
      habits_completed: habitsDone,
      habits_total: habitsTotal,
      nutrition_score: nutritionScore,
      health_score: healthScore,
      pet_status: ai?.pet_status ?? null,
      summary: ai?.summary ?? null,
      suggestions: (ai?.suggestions ?? []) as any,
    };

    const { data: saved, error } = await supabase
      .from("daily_reports")
      .upsert(payload, { onConflict: "user_id,report_date" })
      .select("*")
      .single();
    if (error) throw error;

    return {
      report_date: saved.report_date,
      calories_in: saved.calories_in,
      calories_out: saved.calories_out,
      protein_g: saved.protein_g,
      water_ml: saved.water_ml,
      habits_completed: saved.habits_completed,
      habits_total: saved.habits_total,
      nutrition_score: saved.nutrition_score,
      health_score: saved.health_score,
      pet_status: saved.pet_status,
      summary: saved.summary,
      suggestions: Array.isArray(saved.suggestions) ? (saved.suggestions as string[]) : [],
    };
  });

/* --------------------------------------------------------------- trends */

export interface TrendPoint {
  bucket: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  water_ml: number;
  health_score: number;
}

export interface TrendsDTO {
  period: "day" | "week" | "month" | "year";
  points: TrendPoint[];
  totals: Omit<TrendPoint, "bucket">;
  micros: Record<string, number>;
}

const PERIOD_DAYS = { day: 1, week: 7, month: 30, year: 365 } as const;

export const getNutritionTrends = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ period: z.enum(["day", "week", "month", "year"]).default("week") }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<TrendsDTO> => {
    const { supabase, userId } = context;
    const span = PERIOD_DAYS[data.period];
    const from = daysAgo(span - 1);

    const { data: rows, error } = await supabase
      .from("meal_logs")
      .select("meal_date,total_calories,protein_g,carbs_g,fat_g,fiber_g,sugar_g,water_ml,health_score,nutrition_extra")
      .eq("user_id", userId)
      .gte("meal_date", from)
      .lte("meal_date", today());
    if (error) throw error;

    const bucketOf = (d: string) => {
      if (data.period === "year") return d.slice(0, 7);
      if (data.period === "month") {
        const idx = Math.floor((Date.now() - new Date(d).getTime()) / (7 * 86400000));
        return `W-${Math.max(0, idx)}`;
      }
      return d;
    };

    const map = new Map<string, TrendPoint & { _n: number; _scoreSum: number; _scoreN: number }>();
    const micros: Record<string, number> = {};
    const totals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0, water_ml: 0, health_score: 0 };
    let scoreSum = 0;
    let scoreN = 0;

    for (const r of rows ?? []) {
      const b = bucketOf(r.meal_date as string);
      const cur =
        map.get(b) ??
        ({ bucket: b, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0, water_ml: 0, health_score: 0, _n: 0, _scoreSum: 0, _scoreN: 0 } as any);
      cur.calories += Number(r.total_calories ?? 0);
      cur.protein_g += Number(r.protein_g ?? 0);
      cur.carbs_g += Number(r.carbs_g ?? 0);
      cur.fat_g += Number(r.fat_g ?? 0);
      cur.fiber_g += Number(r.fiber_g ?? 0);
      cur.sugar_g += Number(r.sugar_g ?? 0);
      cur.water_ml += Number(r.water_ml ?? 0);
      cur._n += 1;
      if (r.health_score != null) {
        cur._scoreSum += Number(r.health_score);
        cur._scoreN += 1;
        scoreSum += Number(r.health_score);
        scoreN += 1;
      }
      map.set(b, cur);

      totals.calories += Number(r.total_calories ?? 0);
      totals.protein_g += Number(r.protein_g ?? 0);
      totals.carbs_g += Number(r.carbs_g ?? 0);
      totals.fat_g += Number(r.fat_g ?? 0);
      totals.fiber_g += Number(r.fiber_g ?? 0);
      totals.sugar_g += Number(r.sugar_g ?? 0);
      totals.water_ml += Number(r.water_ml ?? 0);

      const extra = (r.nutrition_extra ?? {}) as Record<string, any>;
      for (const [k, v] of Object.entries(extra)) {
        if (typeof v === "number" && Number.isFinite(v)) micros[k] = (micros[k] ?? 0) + v;
      }
    }

    const points = Array.from(map.values())
      .map((p) => ({
        bucket: p.bucket,
        calories: Math.round(p.calories),
        protein_g: Math.round(p.protein_g),
        carbs_g: Math.round(p.carbs_g),
        fat_g: Math.round(p.fat_g),
        fiber_g: Math.round(p.fiber_g),
        sugar_g: Math.round(p.sugar_g),
        water_ml: Math.round(p.water_ml),
        health_score: p._scoreN ? Math.round(p._scoreSum / p._scoreN) : 0,
      }))
      .sort((a, b) => a.bucket.localeCompare(b.bucket));

    for (const k of Object.keys(micros)) micros[k] = Math.round(micros[k]);

    return {
      period: data.period,
      points,
      totals: {
        calories: Math.round(totals.calories),
        protein_g: Math.round(totals.protein_g),
        carbs_g: Math.round(totals.carbs_g),
        fat_g: Math.round(totals.fat_g),
        fiber_g: Math.round(totals.fiber_g),
        sugar_g: Math.round(totals.sugar_g),
        water_ml: Math.round(totals.water_ml),
        health_score: scoreN ? Math.round(scoreSum / scoreN) : 0,
      },
      micros,
    };
  });
