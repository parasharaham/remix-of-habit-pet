import { createServerFn } from "@tanstack/react-start";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const MODEL = "google/gemini-3-flash-preview";
const today = () => new Date().toISOString().slice(0, 10);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));

export interface CheckInDTO {
  date: string;
  calories_in: number;
  protein_g: number;
  water_ml: number;
  meals_logged: number;
  drinks_logged: number;
  habits_completed: number;
  habits_total: number;
  nutrition_score: number;
  food_review: string;
  drink_review: string;
  pet_status: string;
  pet: { health: number; happiness: number; energy: number; delta_health: number; delta_happiness: number; delta_energy: number };
  next_action: string;
  next_action_why: string;
}

const CheckInSchema = z.object({
  food_review: z.string(),
  drink_review: z.string(),
  pet_status: z.string(),
  next_action: z.string(),
  next_action_why: z.string(),
});

/** Daily AI check-in: reviews food + drink, updates the pet, returns ONE next action. */
export const runDailyCheckIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CheckInDTO> => {
    const { supabase, userId } = context;
    const date = today();

    const [{ data: meals }, { data: habits }, { data: comps }, { data: pet }, { data: prof }] = await Promise.all([
      supabase
        .from("meal_logs")
        .select("food_name,meal_type,total_calories,protein_g,carbs_g,fat_g,fiber_g,sugar_g,sodium_mg,water_ml,health_score,classification")
        .eq("user_id", userId)
        .eq("meal_date", date),
      supabase.from("habits").select("id,title").eq("user_id", userId).eq("is_active", true),
      supabase.from("habit_completions").select("habit_id").eq("user_id", userId).eq("completion_date", date),
      supabase
        .from("pets")
        .select("id,pet_name,health_points,happiness_points,energy_points,current_level")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase.from("profiles").select("fitness_goal,allergies,health_conditions,daily_calorie_target").eq("id", userId).maybeSingle(),
    ]);

    const list = meals ?? [];
    const caloriesIn = Math.round(list.reduce((s, m) => s + Number(m.total_calories ?? 0), 0));
    const protein = Math.round(list.reduce((s, m) => s + Number(m.protein_g ?? 0), 0));
    const water = Math.round(list.reduce((s, m) => s + Number(m.water_ml ?? 0), 0));
    const drinks = list.filter((m) => Number(m.water_ml ?? 0) > 0).length;
    const habitsTotal = habits?.length ?? 0;
    const habitsDone = new Set((comps ?? []).map((c) => c.habit_id)).size;
    const scored = list.filter((m) => m.health_score != null);
    const nutritionScore = scored.length ? Math.round(scored.reduce((s, m) => s + Number(m.health_score), 0) / scored.length) : 0;

    // ---- pet impact -------------------------------------------------------
    const habitRatio = habitsTotal ? habitsDone / habitsTotal : 0;
    const waterRatio = Math.min(1, water / 2500);
    const dHealth = clamp((nutritionScore - 60) / 6 + habitRatio * 6 - (list.length === 0 ? 8 : 0), -12, 12);
    const dHappy = clamp(habitRatio * 10 + (list.length ? 3 : -6), -12, 12);
    const dEnergy = clamp(waterRatio * 8 + (caloriesIn > 800 ? 4 : -6), -12, 12);

    let petState = {
      health: pet?.health_points ?? 100,
      happiness: pet?.happiness_points ?? 100,
      energy: pet?.energy_points ?? 100,
    };
    if (pet?.id) {
      petState = {
        health: clamp(petState.health + dHealth, 0, 100),
        happiness: clamp(petState.happiness + dHappy, 0, 100),
        energy: clamp(petState.energy + dEnergy, 0, 100),
      };
      await supabase
        .from("pets")
        .update({
          health_points: petState.health,
          happiness_points: petState.happiness,
          energy_points: petState.energy,
        })
        .eq("id", pet.id);
    }

    // ---- AI review --------------------------------------------------------
    let ai: z.infer<typeof CheckInSchema> | null = null;
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (apiKey) {
      try {
        const gateway = createLovableAiGatewayProvider(apiKey);
        const { output } = await generateText({
          model: gateway(MODEL),
          output: Output.object({ schema: CheckInSchema }),
          prompt: `You are HabitPet's daily check-in coach. Warm, specific, never shaming.

GOAL: ${prof?.fitness_goal ?? "general health"}. Conditions: ${prof?.health_conditions?.join(", ") || "none"}. Allergies: ${(prof as any)?.allergies?.join(", ") || "none"}.
TODAY (${date}):
- meals: ${list.map((m) => `${m.meal_type}: ${m.food_name ?? "unnamed"} (${(m as any).classification ?? "moderate"}, ${Math.round(Number(m.total_calories ?? 0))} kcal, ${Math.round(Number(m.protein_g ?? 0))}g protein, ${Math.round(Number(m.sugar_g ?? 0))}g sugar, score ${m.health_score ?? "?"})`).join(" | ") || "nothing logged"}
  (These are the saved analyses — treat the numbers and classifications as final; never recalculate them. Logging any meal is a win; never shame an "occasional_choice".)
- totals: ${caloriesIn} kcal, ${protein}g protein, ${water}ml fluids across ${drinks} drink entries
- habits: ${habitsDone}/${habitsTotal}
- pet ${pet?.pet_name ?? "Pet"} now: health ${petState.health}, happiness ${petState.happiness}, energy ${petState.energy}

Return:
- food_review: 2 sentences on what they ATE today (name real foods).
- drink_review: 1-2 sentences on hydration and drinks.
- pet_status: 1 sentence, in the pet's voice, about how today made it feel.
- next_action: exactly ONE clear, concrete action for TOMORROW. Under 90 characters, imperative, measurable.
- next_action_why: 1 short sentence on why that single action matters most right now.`,
        });
        ai = output;
      } catch (e) {
        if (!NoObjectGeneratedError.isInstance(e)) throw e;
      }
    }

    const fallbackAction =
      list.length === 0
        ? "Scan your first meal before 10am tomorrow."
        : water < 2000
          ? "Drink 500ml of water before each of your three meals."
          : protein < 80
            ? "Add one protein source (eggs, dal, chicken or yoghurt) to breakfast."
            : "Log every meal tomorrow — even the snacks.";

    const result: CheckInDTO = {
      date,
      calories_in: caloriesIn,
      protein_g: protein,
      water_ml: water,
      meals_logged: list.length,
      drinks_logged: drinks,
      habits_completed: habitsDone,
      habits_total: habitsTotal,
      nutrition_score: nutritionScore,
      food_review: ai?.food_review ?? (list.length ? "You logged meals today — keep the streak going." : "Nothing logged today yet."),
      drink_review: ai?.drink_review ?? `You logged ${water}ml of fluids today.`,
      pet_status: ai?.pet_status ?? "Your pet is watching your habits closely.",
      pet: {
        ...petState,
        delta_health: dHealth,
        delta_happiness: dHappy,
        delta_energy: dEnergy,
      },
      next_action: ai?.next_action ?? fallbackAction,
      next_action_why: ai?.next_action_why ?? "Small, specific actions are the ones that actually stick.",
    };

    await supabase.from("daily_reports").upsert(
      {
        user_id: userId,
        report_date: date,
        calories_in: caloriesIn,
        protein_g: protein,
        water_ml: water,
        habits_completed: habitsDone,
        habits_total: habitsTotal,
        nutrition_score: nutritionScore,
        pet_status: result.pet_status,
        summary: `${result.food_review} ${result.drink_review}`,
        suggestions: [result.next_action] as any,
      },
      { onConflict: "user_id,report_date" },
    );

    return result;
  });
