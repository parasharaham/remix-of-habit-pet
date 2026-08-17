import { createServerFn } from "@tanstack/react-start";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getTier } from "./subscription-guard";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { languageInstruction } from "./ai-language";

const MODEL = "google/gemini-3-flash-preview";

export interface PlannedMeal {
  slot: string;
  time: string;
  name: string;
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  why: string;
}

export interface MealPlanDTO {
  title: string;
  summary: string;
  goal: string;
  total_calories: number;
  total_protein_g: number;
  hydration_ml: number;
  meals: PlannedMeal[];
  grocery_list: string[];
  training_tip: string;
  coach_note: string;
  /** true when the plan was built from the user's full profile (Pro). */
  personalized: boolean;
}

const PlanSchema = z.object({
  title: z.string(),
  summary: z.string(),
  total_calories: z.number(),
  total_protein_g: z.number(),
  hydration_ml: z.number(),
  meals: z.array(
    z.object({
      slot: z.string(),
      time: z.string(),
      name: z.string(),
      description: z.string(),
      calories: z.number(),
      protein_g: z.number(),
      carbs_g: z.number(),
      fat_g: z.number(),
      why: z.string(),
    }),
  ),
  grocery_list: z.array(z.string()),
  training_tip: z.string(),
  coach_note: z.string(),
});

export const getMealPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        aim: z.string().optional(),
        cuisine: z.string().optional(),
        budget: z.string().optional(),
        target_calories: z.number().optional(),
        target_protein_g: z.number().optional(),
        target_carbs_g: z.number().optional(),
        target_fat_g: z.number().optional(),
        target_water_ml: z.number().optional(),
      })
      .parse(d ?? {}),
  )

  .handler(async ({ data, context }): Promise<MealPlanDTO> => {
    const { supabase, userId } = context;

    const { data: prof } = await supabase
      .from("profiles")
      .select(
        "full_name,age,sex,weight_kg,height_cm,activity_level,fitness_goal,health_conditions,allergies,food_preferences,lifestyle,daily_calorie_target,preferred_language",
      )
      .eq("id", userId)
      .maybeSingle();

    // Free = basic plan; Pro = fully personalized from the user's profile.
    const tier = await getTier(supabase, userId);
    const personalized = tier === "pro";
    const p = personalized ? prof : null;

    const aim = data.aim || prof?.fitness_goal || "general health";
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured");

    const provider = createLovableAiGatewayProvider(apiKey);

    const prompt = `Build ONE full day of eating for this person.

Profile:
- age: ${p?.age ?? "unknown"}, sex: ${p?.sex ?? "unknown"}
- weight: ${p?.weight_kg ?? "?"} kg, height: ${p?.height_cm ?? "?"} cm
- activity level: ${p?.activity_level ?? "moderate"}
- primary aim: ${aim}
- health conditions: ${JSON.stringify(p?.health_conditions ?? [])}
- allergies (NEVER include these): ${JSON.stringify(prof?.allergies ?? [])}
- food preferences: ${JSON.stringify(p?.food_preferences ?? [])}
- lifestyle: ${p?.lifestyle ?? "unspecified"}
- calorie target hint: ${p?.daily_calorie_target ?? "estimate it yourself"}
- preferred cuisine: ${data.cuisine || "any"}
- budget: ${data.budget || "normal"}

Adaptive targets for today (hit these closely, within 5%):
- calories: ${data.target_calories ?? "estimate it yourself"}
- protein: ${data.target_protein_g ?? "estimate"} g, carbs: ${data.target_carbs_g ?? "estimate"} g, fat: ${data.target_fat_g ?? "estimate"} g
- fluids: ${data.target_water_ml ?? 2500} ml

Rules:
- 4 to 6 meals including snacks, with realistic clock times.
- If the aim is muscle gain, hit at least 1.6 g protein per kg bodyweight and add a post-workout meal.
- If the aim is fat loss, keep a moderate deficit, high protein, high fibre and high satiety.
- Respect allergies and conditions strictly.

- Keep foods simple and buyable; describe portions in grams or household measures.
- Keep every text field under 220 characters. Grocery list max 14 short items.
- Warm, encouraging, practical tone. No medical claims.

${languageInstruction((prof as any)?.preferred_language)}`;

    try {
      const { output } = await generateText({
        model: provider(MODEL),
        prompt,
        output: Output.object({ schema: PlanSchema }),
      });
      return { ...output, goal: aim, personalized };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        try {
          const parsed = PlanSchema.parse(
            JSON.parse(String((error as any).text ?? "").replace(/^```json|```$/g, "").trim()),
          );
          return { ...parsed, goal: aim, personalized };
        } catch {
          /* fall through */
        }
      }
      throw new Error("Could not build a plan right now. Please try again.");
    }
  });
