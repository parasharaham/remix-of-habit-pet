import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getTier } from "./subscription-guard";
import { computeTargets, type NutritionTargets } from "./nutrition-targets";
import { CLASSIFICATIONS, type Classification } from "./food.functions";

export type RangeKey = "7d" | "30d" | "90d" | "1y";

const RANGE_DAYS: Record<RangeKey, number> = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 };

export interface DayPoint {
  date: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  meals: number;
  balanced_meals: number;
  /** 0-100 how close this day landed to the calorie + protein + fiber goals */
  goal_completion: number;
}

export interface MealQuality {
  id: string;
  meal_type: string;
  food_name: string | null;
  classification: Classification;
  calories: number;
  protein_g: number;
  fiber_g: number;
  notes: string[];
}

export interface NutritionAnalyticsDTO {
  range: RangeKey;
  targets: NutritionTargets | null;
  days: DayPoint[];
  today: DayPoint;
  averages: { calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number };
  goal_completion: number;
  balanced_rate: number;
  meals_logged: number;
  balanced_meals: number;
  health_score: number;
  insights: string[];
  today_meals: MealQuality[];
  has_data: boolean;
  /** false on Free: history is limited to the last 7 days. */
  advanced: boolean;
  range: string;
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}
const round = (n: number) => Math.round(n);
const pct = (actual: number, goal: number) =>
  goal > 0 ? Math.max(0, Math.min(100, Math.round((1 - Math.abs(actual - goal) / goal) * 100))) : 0;

export const getNutritionAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ range: z.enum(["7d", "30d", "90d", "1y"]).default("7d") }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<NutritionAnalyticsDTO> => {
    const { supabase, userId } = context;
    // Free plans see the last 7 days; Pro unlocks the longer ranges.
    const tier = await getTier(supabase, userId);
    const advanced = tier === "pro";
    const range = advanced ? data.range : "7d";
    const days = RANGE_DAYS[range];
    const today = dayKey(new Date());
    const from = dayKey(new Date(Date.now() - (days - 1) * 86400000));

    const [{ data: rows, error }, { data: prof }] = await Promise.all([
      supabase
        .from("meal_logs")
        .select(
          "id,meal_date,meal_type,food_name,total_calories,protein_g,carbs_g,fat_g,fiber_g,sugar_g,sodium_mg,classification,created_at",
        )
        .eq("user_id", userId)
        .gte("meal_date", from)
        .lte("meal_date", today)
        .order("created_at", { ascending: true }),
      supabase
        .from("profiles")
        .select("age,sex,weight_kg,height_cm,activity_level,fitness_goal,daily_calorie_target")
        .eq("id", userId)
        .maybeSingle(),
    ]);
    if (error) throw error;

    const targets = computeTargets(prof);
    const list = rows ?? [];

    const empty = (date: string): DayPoint => ({
      date,
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
      sugar_g: 0,
      sodium_mg: 0,
      meals: 0,
      balanced_meals: 0,
      goal_completion: 0,
    });

    const byDay = new Map<string, DayPoint>();
    for (let i = days - 1; i >= 0; i--) {
      const k = dayKey(new Date(Date.now() - i * 86400000));
      byDay.set(k, empty(k));
    }
    for (const r of list) {
      const k = r.meal_date as string;
      const p = byDay.get(k);
      if (!p) continue;
      p.calories += Number(r.total_calories ?? 0);
      p.protein_g += Number(r.protein_g ?? 0);
      p.carbs_g += Number(r.carbs_g ?? 0);
      p.fat_g += Number(r.fat_g ?? 0);
      p.fiber_g += Number(r.fiber_g ?? 0);
      p.sugar_g += Number(r.sugar_g ?? 0);
      p.sodium_mg += Number(r.sodium_mg ?? 0);
      p.meals += 1;
      if (r.classification === "healthy_balanced") p.balanced_meals += 1;
    }

    const series = Array.from(byDay.values()).map((p) => {
      const out: DayPoint = {
        ...p,
        calories: round(p.calories),
        protein_g: round(p.protein_g),
        carbs_g: round(p.carbs_g),
        fat_g: round(p.fat_g),
        fiber_g: round(p.fiber_g),
        sugar_g: round(p.sugar_g),
        sodium_mg: round(p.sodium_mg),
      };
      if (targets && out.meals > 0) {
        out.goal_completion = Math.round(
          (pct(out.calories, targets.calories) +
            pct(out.protein_g, targets.protein_g) +
            pct(out.fiber_g, targets.fiber_g)) /
            3,
        );
      }
      return out;
    });

    const logged = series.filter((d) => d.meals > 0);
    const avg = (sel: (d: DayPoint) => number) =>
      logged.length ? round(logged.reduce((s, d) => s + sel(d), 0) / logged.length) : 0;

    const averages = {
      calories: avg((d) => d.calories),
      protein_g: avg((d) => d.protein_g),
      carbs_g: avg((d) => d.carbs_g),
      fat_g: avg((d) => d.fat_g),
      fiber_g: avg((d) => d.fiber_g),
    };

    const mealsLogged = list.length;
    const balancedMeals = list.filter((r) => r.classification === "healthy_balanced").length;
    const goalCompletion = logged.length
      ? round(logged.reduce((s, d) => s + d.goal_completion, 0) / logged.length)
      : 0;
    const balancedRate = mealsLogged ? Math.round((balancedMeals / mealsLogged) * 100) : 0;

    // Deterministic food health score — no AI call needed to draw charts.
    const healthScore = targets && logged.length
      ? Math.round(goalCompletion * 0.6 + balancedRate * 0.25 + Math.min(100, (logged.length / days) * 100) * 0.15)
      : 0;

    // ---- Trend insights from real data only -------------------------------
    const insights: string[] = [];
    if (logged.length < 3) {
      insights.push("You need a few more logged meals before we can identify a reliable trend.");
    } else {
      const half = Math.floor(series.length / 2);
      const first = series.slice(0, half).filter((d) => d.meals > 0);
      const second = series.slice(half).filter((d) => d.meals > 0);
      const mean = (arr: DayPoint[], sel: (d: DayPoint) => number) =>
        arr.length ? arr.reduce((s, d) => s + sel(d), 0) / arr.length : 0;

      const pFirst = mean(first, (d) => d.protein_g);
      const pSecond = mean(second, (d) => d.protein_g);
      if (pFirst > 0 && pSecond > pFirst * 1.1) insights.push("Your protein intake has improved over this period.");
      else if (pFirst > 0 && pSecond < pFirst * 0.9) insights.push("Your protein intake has drifted lower recently.");

      if (targets) {
        const fiberDays = logged.filter((d) => d.fiber_g >= targets.fiber_g).length;
        if (fiberDays / logged.length >= 0.6) insights.push("You're consistently meeting your fiber target.");
        else if (averages.fiber_g < targets.fiber_g * 0.7)
          insights.push("Fiber is running below your target — extra vegetables, fruit or whole grains would help.");

        if (averages.calories < targets.calories * 0.85 && !targets.minor)
          insights.push("Your average calorie intake is below your current target.");
        else if (averages.calories > targets.calories * 1.15 && !targets.minor)
          insights.push("Your average calorie intake is above your current target.");
      }

      insights.push(
        `You logged meals on ${logged.length} of the last ${days} day${days === 1 ? "" : "s"} — ${balancedRate}% of them were balanced.`,
      );
    }

    // ---- Today's meal quality breakdown -----------------------------------
    const todayMeals: MealQuality[] = list
      .filter((r) => r.meal_date === today)
      .map((r) => {
        const notes: string[] = [];
        const protein = Number(r.protein_g ?? 0);
        const fiber = Number(r.fiber_g ?? 0);
        const fat = Number(r.fat_g ?? 0);
        if (protein >= 20) notes.push("✓ Good protein");
        else notes.push("○ Lower in protein");
        if (fiber >= 6) notes.push("✓ Good fiber");
        else notes.push("○ Lower in fiber");
        if (fat > 30) notes.push("○ Higher in fat");
        if (Number(r.sodium_mg ?? 0) > 900) notes.push("○ Higher in sodium");
        return {
          id: r.id as string,
          meal_type: r.meal_type as string,
          food_name: (r.food_name as string) ?? null,
          classification: ((CLASSIFICATIONS as readonly string[]).includes(r.classification as string)
            ? r.classification
            : "moderate") as Classification,
          calories: round(Number(r.total_calories ?? 0)),
          protein_g: round(protein),
          fiber_g: round(fiber),
          notes,
        };
      });

    const todayPoint = series[series.length - 1] ?? empty(today);

    return {
      range: data.range,
      targets,
      days: series,
      today: todayPoint,
      averages,
      goal_completion: goalCompletion,
      balanced_rate: balancedRate,
      meals_logged: mealsLogged,
      balanced_meals: balancedMeals,
      health_score: healthScore,
      insights,
      today_meals: todayMeals,
      has_data: mealsLogged > 0,
    };
  });
