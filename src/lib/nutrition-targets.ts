/**
 * Deterministic personalized nutrition targets.
 * Pure functions — safe to import from both server and client code.
 */

export interface ProfileForTargets {
  age?: number | null;
  sex?: string | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  activity_level?: string | null;
  fitness_goal?: string | null;
  daily_calorie_target?: number | null;
}

export interface NutritionTargets {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  /** True when the profile has enough data to personalize. */
  personalized: boolean;
  /** Under-18 users get guidance only, never deficit targets. */
  minor: boolean;
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

function goalFactor(goal: string | null | undefined, minor: boolean): number {
  if (minor) return 1; // never a deficit or surplus target for under-18s
  const g = (goal ?? "").toLowerCase();
  if (g.includes("muscle") || g.includes("gain") || g.includes("bulk")) return 1.12;
  if (g.includes("fat") || g.includes("lose") || g.includes("cut") || g.includes("weight loss")) return 0.82;
  if (g.includes("endur") || g.includes("stamina")) return 1.05;
  return 1;
}

export function computeTargets(p: ProfileForTargets | null | undefined): NutritionTargets | null {
  if (!p) return null;
  const weight = Number(p.weight_kg) || 0;
  const height = Number(p.height_cm) || 0;
  const age = Number(p.age) || 0;
  const minor = age > 0 && age < 18;

  const hasBody = weight > 0 && height > 0 && age > 0;
  if (!hasBody && !p.daily_calorie_target) return null;

  let calories: number;
  if (hasBody) {
    const male = (p.sex ?? "").toLowerCase().startsWith("m");
    const bmr = 10 * weight + 6.25 * height - 5 * age + (male ? 5 : -161);
    const factor = ACTIVITY_FACTOR[(p.activity_level ?? "moderate").toLowerCase()] ?? 1.55;
    calories = bmr * factor * goalFactor(p.fitness_goal, minor);
  } else {
    calories = Number(p.daily_calorie_target);
  }
  calories = Math.max(1200, Math.round(calories));

  const proteinPerKg = minor ? 1.2 : 1.7;
  const protein = Math.round((weight > 0 ? weight : 65) * proteinPerKg);
  const fat = Math.round((calories * 0.27) / 9);
  const carbs = Math.max(50, Math.round((calories - protein * 4 - fat * 9) / 4));
  const fiber = Math.max(15, Math.round((calories / 1000) * 14));

  return { calories, protein_g: protein, carbs_g: carbs, fat_g: fat, fiber_g: fiber, personalized: true, minor };
}
