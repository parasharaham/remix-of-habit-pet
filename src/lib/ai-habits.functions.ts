import { createServerFn } from "@tanstack/react-start";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { languageInstruction } from "./ai-language";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const HabitItem = z.object({
  title: z.string(),
  description: z.string().nullable(),
  category: z.enum(["health", "fitness", "reading", "productivity", "study", "finance", "custom"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

const HabitsOut = z.object({
  habits: z.array(HabitItem),
});

export interface GeneratedHabit {
  title: string;
  description: string | null;
  category: string;
  difficulty: string;
}

export const generateHabitPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ habits: GeneratedHabit[] }> => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI service is not configured.");

    const { data: profile, error } = await supabase
      .from("profiles")
      .select(
        "full_name, age, sex, profession, grade, mother_tongue, preferred_language, health_conditions, height_cm, weight_kg, activity_level, fitness_goal, target_skill, daily_calorie_target",
      )
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    const prompt = `You are a supportive health & habit coach. Generate 7 daily habits tailored to this user. Keep titles short (max 8 words) and actionable. Mix categories. Descriptions max 120 chars.

User profile:
- Age: ${profile?.age ?? "unknown"}
- Sex: ${profile?.sex ?? "unspecified"}
- Profession: ${profile?.profession ?? "unspecified"}${profile?.grade ? " (grade: " + profile.grade + ")" : ""}
- Height/Weight: ${profile?.height_cm ?? "?"} cm / ${profile?.weight_kg ?? "?"} kg
- Activity level: ${profile?.activity_level ?? "light"}
- Fitness goal: ${profile?.fitness_goal ?? "stay_fit"}
- Health conditions: ${(profile?.health_conditions as string[] | null)?.join(", ") || "none"}
- Skill they want to learn: ${profile?.target_skill ?? "general"}
- Daily calorie target: ${profile?.daily_calorie_target ?? "unspecified"}

Return valid JSON matching the schema. Categories must be one of: health, fitness, reading, productivity, study, finance, custom. Difficulty: easy, medium, hard. Include at least 2 fitness/health, 1 study (aligned to their skill), 1 productivity.

${languageInstruction((profile as any)?.preferred_language)}`;

    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: HabitsOut }),
        prompt,
      });
      const habits = (output.habits ?? []).slice(0, 10).map((h) => ({
        title: h.title.slice(0, 100),
        description: h.description ? h.description.slice(0, 500) : null,
        category: h.category,
        difficulty: h.difficulty,
      }));
      return { habits };
    } catch (e) {
      if (NoObjectGeneratedError.isInstance(e)) {
        throw new Error("Couldn't parse AI response. Please try again.");
      }
      throw e;
    }
  });

const ApplySchema = z.object({
  habits: z.array(
    z.object({
      title: z.string().min(1).max(100),
      description: z.string().max(500).nullable().optional(),
      category: z.enum(["health", "fitness", "reading", "productivity", "study", "finance", "custom"]),
      difficulty: z.enum(["easy", "medium", "hard"]),
    }),
  ).min(1).max(15),
  replace: z.boolean().default(false),
});

export const applyGeneratedHabits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ApplySchema.parse(d))
  .handler(async ({ data, context }): Promise<{ inserted: number }> => {
    const { supabase, userId } = context;

    if (data.replace) {
      await supabase.from("habits").update({ is_active: false }).eq("user_id", userId);
    }

    const rows = data.habits.map((h) => ({
      user_id: userId,
      title: h.title,
      description: h.description ?? null,
      frequency: "daily" as const,
      category: h.category,
      difficulty: h.difficulty,
    }));
    const { error } = await supabase.from("habits").insert(rows);
    if (error) throw error;
    return { inserted: rows.length };
  });
