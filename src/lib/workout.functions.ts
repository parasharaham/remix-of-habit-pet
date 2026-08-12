import { createServerFn } from "@tanstack/react-start";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getTier } from "./subscription-guard";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const MODEL = "google/gemini-3-flash-preview";

export interface WorkoutBlock {
  name: string;
  detail: string;
  minutes: number;
}
export interface WorkoutDay {
  day: string;
  focus: string;
  type: string; // strength | cardio | mobility | rest
  minutes: number;
  intensity: string;
  blocks: WorkoutBlock[];
  recovery: string;
}
export interface WorkoutPlanDTO {
  title: string;
  summary: string;
  goal: string;
  weekly_minutes: number;
  days: WorkoutDay[];
  recovery_rules: string[];
  sleep_target_hours: number;
  fuel_tip: string;
  coach_note: string;
}

const PlanSchema = z.object({
  title: z.string(),
  summary: z.string(),
  weekly_minutes: z.number(),
  days: z.array(
    z.object({
      day: z.string(),
      focus: z.string(),
      type: z.string(),
      minutes: z.number(),
      intensity: z.string(),
      blocks: z.array(z.object({ name: z.string(), detail: z.string(), minutes: z.number() })),
      recovery: z.string(),
    }),
  ),
  recovery_rules: z.array(z.string()),
  sleep_target_hours: z.number(),
  fuel_tip: z.string(),
  coach_note: z.string(),
});

export const getWorkoutPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        goal: z.enum(["muscle_gain", "fat_loss", "maintenance", "endurance"]).default("maintenance"),
        minutes_per_session: z.number().min(10).max(180).default(45),
        days_per_week: z.number().min(2).max(7).default(4),
        equipment: z.string().max(120).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<WorkoutPlanDTO> => {
    const { supabase, userId } = context;

    const { data: prof } = await supabase
      .from("profiles")
      .select("age,sex,weight_kg,height_cm,activity_level,health_conditions,lifestyle,sleep_hours,fitness_goal")
      .eq("id", userId)
      .maybeSingle();

    const tier = await getTier(supabase, userId);
    const personalized = tier === "pro";
    const p = personalized ? (prof as any) : null;

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured");
    const gateway = createLovableAiGatewayProvider(apiKey);

    const prompt = `Design a one-week training and recovery plan.

PERSON: age ${p?.age ?? "?"}, sex ${p?.sex ?? "?"}, ${p?.weight_kg ?? "?"}kg, ${p?.height_cm ?? "?"}cm, activity ${p?.activity_level ?? "moderate"}, lifestyle ${p?.lifestyle ?? "unspecified"}, sleeps ~${p?.sleep_hours ?? "?"}h.
CONDITIONS (train around these safely): ${p?.health_conditions?.join(", ") || "none"}.
GOAL: ${data.goal}. TIME: ${data.days_per_week} sessions per week, ${data.minutes_per_session} minutes each. EQUIPMENT: ${data.equipment || "bodyweight plus basic dumbbells"}.

Rules:
- Return exactly 7 day entries, Monday to Sunday. Non-training days must have type "rest" or "mobility" with a real recovery activity.
- Match the goal: muscle_gain = progressive strength split with low-impact cardio; fat_loss = strength plus intervals and daily steps; endurance = zone-2 base plus one interval day; maintenance = balanced.
- Every training day: 3-5 blocks with sets/reps or duration in "detail". Total block minutes ≈ session minutes.
- "recovery" per day: one concrete recovery action (stretch, walk, sleep, protein timing).
- recovery_rules: 3-5 short rules (deload signs, soreness, rest between sessions, hydration).
- Keep every text field under 200 characters. No medical claims. Warm, confident coaching tone.`;

    try {
      const { output } = await generateText({
        model: gateway(MODEL),
        prompt,
        output: Output.object({ schema: PlanSchema }),
      });
      return { ...output, goal: data.goal, personalized };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        try {
          const parsed = PlanSchema.parse(
            JSON.parse(String((error as any).text ?? "").replace(/^```json|```$/g, "").trim()),
          );
          return { ...parsed, goal: data.goal, personalized };
        } catch {
          /* fall through */
        }
      }
      throw new Error("Could not build your training plan right now. Please try again.");
    }
  });
