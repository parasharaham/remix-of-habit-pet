import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
const round = (n: number) => Math.round(n);

export type Aim = "muscle_gain" | "fat_loss" | "maintenance" | "endurance";

export interface MacroTargetsDTO {
  aim: Aim;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  water_ml: number;
  base_calories: number;
  tdee: number;
  consistency: number; // 0-100, how many of last 14 days were logged
  adherence: number; // 0-100, average % of calorie target hit
  adjustment_kcal: number;
  note: string;
  today: { calories: number; protein_g: number; carbs_g: number; fat_g: number; water_ml: number };
}

const AIM_VALUES = ["muscle_gain", "fat_loss", "maintenance", "endurance"] as const;

function normaliseAim(v?: string | null): Aim {
  const s = (v ?? "").toLowerCase();
  if (s.includes("muscle") || s.includes("gain") || s.includes("bulk")) return "muscle_gain";
  if (s.includes("fat") || s.includes("lose") || s.includes("weight loss") || s.includes("cut")) return "fat_loss";
  if (s.includes("endur") || s.includes("stamina") || s.includes("run")) return "endurance";
  return "maintenance";
}

const ACTIVITY_FACTOR: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  lightly_active: 1.375,
  moderate: 1.55,
  moderately_active: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const getMacroTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ aim: z.enum(AIM_VALUES).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<MacroTargetsDTO> => {
    const { supabase, userId } = context;

    const { data: prof } = await supabase
      .from("profiles")
      .select("age,sex,weight_kg,height_cm,activity_level,fitness_goal,daily_calorie_target")
      .eq("id", userId)
      .maybeSingle();

    const aim = data.aim ?? normaliseAim(prof?.fitness_goal);
    const weight = Number(prof?.weight_kg) || 70;
    const height = Number(prof?.height_cm) || 170;
    const age = Number(prof?.age) || 30;
    const male = (prof?.sex ?? "").toLowerCase().startsWith("m");

    const bmr = 10 * weight + 6.25 * height - 5 * age + (male ? 5 : -161);
    const factor = ACTIVITY_FACTOR[(prof?.activity_level ?? "moderate").toLowerCase()] ?? 1.55;
    const tdee = bmr * factor;

    const baseByAim: Record<Aim, number> = {
      muscle_gain: tdee * 1.12,
      fat_loss: tdee * 0.82,
      maintenance: tdee,
      endurance: tdee * 1.05,
    };
    const base = baseByAim[aim];

    // --- progress + consistency over the last 14 days -----------------------
    const { data: rows } = await supabase
      .from("meal_logs")
      .select("meal_date,total_calories,protein_g,carbs_g,fat_g,water_ml")
      .eq("user_id", userId)
      .gte("meal_date", daysAgo(13));

    const byDay = new Map<string, number>();
    for (const r of rows ?? []) {
      byDay.set(r.meal_date as string, (byDay.get(r.meal_date as string) ?? 0) + Number(r.total_calories ?? 0));
    }
    const loggedDays = byDay.size;
    const consistency = Math.round((loggedDays / 14) * 100);
    const avgIntake = loggedDays ? Array.from(byDay.values()).reduce((a, b) => a + b, 0) / loggedDays : 0;
    const adherence = loggedDays ? Math.max(0, Math.min(150, Math.round((avgIntake / base) * 100))) : 0;

    // Auto-adjust: nudge toward the target instead of demanding a big jump.
    let adjustment = 0;
    let note = "Targets set from your body stats and goal. Log a few days so I can fine-tune them.";
    if (loggedDays >= 4) {
      const gap = avgIntake - base;
      if (aim === "fat_loss" && gap > 250) {
        adjustment = Math.min(200, gap * 0.35);
        note = `You've been averaging ${round(avgIntake)} kcal. I raised today's target slightly so the deficit stays realistic instead of unsustainable.`;
      } else if (aim === "muscle_gain" && gap < -250) {
        adjustment = Math.max(-200, gap * 0.35);
        note = `You're eating under your build target. I trimmed it a little so it's reachable — then we push it back up.`;
      } else if (consistency >= 70) {
        adjustment = aim === "fat_loss" ? -60 : aim === "muscle_gain" ? 60 : 0;
        note = `${consistency}% logging consistency — strong. Targets nudged ${adjustment >= 0 ? "up" : "down"} to keep progress moving.`;
      } else {
        note = `Logged ${loggedDays}/14 days. Targets held steady — consistency first, then we optimise.`;
      }
    }

    const calories = Math.max(1200, round(base + adjustment));
    const proteinPerKg = aim === "muscle_gain" ? 1.9 : aim === "fat_loss" ? 2.0 : aim === "endurance" ? 1.5 : 1.6;
    const protein = round(weight * proteinPerKg);
    const fat = round((calories * (aim === "fat_loss" ? 0.28 : 0.25)) / 9);
    const carbs = Math.max(50, round((calories - protein * 4 - fat * 9) / 4));
    const water = round(Math.max(2000, weight * 35 + (aim === "endurance" ? 500 : 0)));

    const todays = (rows ?? []).filter((r) => r.meal_date === today());
    const sum = (k: "total_calories" | "protein_g" | "carbs_g" | "fat_g" | "water_ml") =>
      round(todays.reduce((s, r) => s + Number((r as any)[k] ?? 0), 0));

    return {
      aim,
      calories,
      protein_g: protein,
      carbs_g: carbs,
      fat_g: fat,
      water_ml: water,
      base_calories: round(base),
      tdee: round(tdee),
      consistency,
      adherence,
      adjustment_kcal: round(adjustment),
      note,
      today: {
        calories: sum("total_calories"),
        protein_g: sum("protein_g"),
        carbs_g: sum("carbs_g"),
        fat_g: sum("fat_g"),
        water_ml: sum("water_ml"),
      },
    };
  });
