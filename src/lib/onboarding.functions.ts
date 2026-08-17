import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PetTypeSchema = z.enum([
  "dragon", "red_panda", "axolotl", "shiba", "fox",
  "owl", "penguin", "capybara", "dinosaur", "bunny",
  "dog", "cat",
]);

const Schema = z.object({
  pet_type: PetTypeSchema,
  pet_name: z.string().trim().min(1).max(40),
  habits: z.array(z.string().trim().min(1).max(100)).min(1).max(12),

  // Personal
  full_name: z.string().trim().min(1).max(80),
  age: z.number().int().min(5).max(120),
  sex: z.enum(["male", "female", "other", "prefer_not"]).optional().nullable(),
  profession: z.string().trim().max(80).optional().nullable(),
  grade: z.string().trim().max(40).optional().nullable(),
  mother_tongue: z.string().trim().min(2).max(20),
  preferred_language: z.string().trim().min(2).max(8).optional(),

  // Health
  health_conditions: z.array(z.string().trim().max(60)).max(20).default([]),
  height_cm: z.number().min(50).max(260).optional().nullable(),
  weight_kg: z.number().min(15).max(400).optional().nullable(),
  activity_level: z.enum(["sedentary", "light", "moderate", "active", "very_active"]).optional().nullable(),
  fitness_goal: z.enum(["lose_weight", "gain_muscle", "stay_fit", "more_energy", "flexible"]),

  // Skill
  target_skill: z.string().trim().min(1).max(80),
});

// Mifflin-St Jeor + activity multiplier
function calcCalorieTarget(input: {
  sex?: string | null; age: number; height_cm?: number | null; weight_kg?: number | null;
  activity_level?: string | null; fitness_goal: string;
}): number | null {
  const { sex, age, height_cm, weight_kg, activity_level, fitness_goal } = input;
  if (!height_cm || !weight_kg) return null;
  const s = sex === "female" ? -161 : 5;
  const bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + s;
  const mult = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 }[activity_level ?? "light"] ?? 1.375;
  let tdee = bmr * mult;
  if (fitness_goal === "lose_weight") tdee -= 400;
  else if (fitness_goal === "gain_muscle") tdee += 300;
  return Math.round(tdee);
}

export const getOnboardingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ onboarded: boolean }> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("pets")
      .select("onboarded")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return { onboarded: Boolean(data?.onboarded) };
  });

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Schema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;

    // Upsert pet
    const existing = await supabase.from("pets").select("id").eq("user_id", userId).maybeSingle();
    if (existing.error) throw existing.error;

    if (!existing.data) {
      const ins = await supabase.from("pets").insert({
        user_id: userId, pet_type: data.pet_type, pet_name: data.pet_name, onboarded: true,
      });
      if (ins.error) throw ins.error;
    } else {
      const upd = await supabase.from("pets")
        .update({ pet_type: data.pet_type, pet_name: data.pet_name, onboarded: true })
        .eq("user_id", userId);
      if (upd.error) throw upd.error;
    }

    // Profile
    const calorieTarget = calcCalorieTarget({
      sex: data.sex ?? null, age: data.age, height_cm: data.height_cm ?? null,
      weight_kg: data.weight_kg ?? null, activity_level: data.activity_level ?? null,
      fitness_goal: data.fitness_goal,
    });

    // Ensure profile row exists then update
    await supabase.from("profiles").insert({ id: userId }).select().maybeSingle();
    const profUpd = await supabase.from("profiles").update({
      full_name: data.full_name,
      age: data.age,
      sex: data.sex ?? null,
      profession: data.profession ?? null,
      grade: data.grade ?? null,
      mother_tongue: data.mother_tongue,
      preferred_language: data.preferred_language ?? data.mother_tongue,
      health_conditions: data.health_conditions ?? [],
      height_cm: data.height_cm ?? null,
      weight_kg: data.weight_kg ?? null,
      activity_level: data.activity_level ?? null,
      fitness_goal: data.fitness_goal,
      target_skill: data.target_skill,
      daily_calorie_target: calorieTarget,
      profile_completed: true,
    }).eq("id", userId);
    if (profUpd.error) throw profUpd.error;

    // Insert starter habits
    const rows = data.habits.map((title) => ({
      user_id: userId, title, frequency: "daily" as const,
    }));
    const habitsIns = await supabase.from("habits").insert(rows);
    if (habitsIns.error) throw habitsIns.error;

    return { ok: true };
  });
