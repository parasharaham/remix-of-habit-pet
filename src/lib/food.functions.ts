import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { consumeScan, safeLocalDate } from "./subscription-guard";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

/** Structured server-side log line for Food Scanner AI calls (never surfaced to users). */
function aiLog(event: string, fields: Record<string, unknown>) {
  try {
    console.log(JSON.stringify({ scope: "food_scanner_ai", event, ts: new Date().toISOString(), ...fields }));
  } catch {
    console.log(`{"scope":"food_scanner_ai","event":"${event}","log_serialize_failed":true}`);
  }
}

const MealType = z.enum([
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "pre_workout",
  "post_workout",
  "late_night",
]);

const n = (d = 0) => z.coerce.number().catch(d);
const s = () => z.coerce.string().nullable().catch(null);

const MealItem = z.object({
  name: z.coerce.string().catch("Item"),
  grams: z.coerce.number().nullable().catch(null),
  calories: n(),
  protein_g: n(),
  carbs_g: n(),
  fat_g: n(),
  fiber_g: n(),
});

const SubScores = z.object({
  protein: n(50),
  fiber: n(50),
  vitamin: n(50),
  healthy_fat: n(50),
  processed: n(50),
  sugar: n(50),
  salt: n(50),
});

const extraKeys = [
  "sugar_g","sodium_mg","potassium_mg","calcium_mg","iron_mg","magnesium_mg","zinc_mg",
  "cholesterol_mg","saturated_fat_g","unsaturated_fat_g","omega3_g","omega6_g","vit_a_iu",
  "vit_b_mg","vit_c_mg","vit_d_iu","vit_e_mg","vit_k_mcg","water_ml","water_pct",
  "glycemic_index","glycemic_load",
] as const;

const NutritionExtra = z.object(
  Object.fromEntries(extraKeys.map((k) => [k, n()])) as Record<(typeof extraKeys)[number], ReturnType<typeof n>>,
);

export const CLASSIFICATIONS = ["healthy_balanced", "moderate", "occasional_choice"] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];

export const CLASSIFICATION_LABEL: Record<Classification, string> = {
  healthy_balanced: "Balanced",
  moderate: "Moderate",
  occasional_choice: "Occasional Choice",
};

const ClassificationEnum = z.preprocess((v) => {
  const s = String(v ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  if (s.includes("healthy") || s.includes("balanced")) return "healthy_balanced";
  if (s.includes("occasional") || s.includes("treat") || s.includes("indulg")) return "occasional_choice";
  if (s.includes("moderate") || s.includes("mixed")) return "moderate";
  return "moderate";
}, z.enum(CLASSIFICATIONS));

const MealAnalysis = z.object({
  is_food: z.coerce.boolean().catch(true),
  reject_reason: s(),
  food_name: s(),
  meal_category: s(),
  serving_size: s(),
  weight_g: n(),
  confidence: n(50),
  items: z.array(MealItem).catch([]),
  total_calories: n(),
  protein_g: n(),
  carbs_g: n(),
  fat_g: n(),
  fiber_g: n(),
  extra: NutritionExtra.catch({} as any),
  nutrition_score: n(50),
  health_score: n(50),
  sub_scores: SubScores.catch({} as any),
  classification: ClassificationEnum.catch("moderate"),
  classification_reason: s(),
  benefits: z.array(z.coerce.string()).catch([]),
  considerations: z.array(z.coerce.string()).catch([]),
  ingredients: z.array(z.coerce.string()).catch([]),
  verdict: s(),
  notes: s(),
  recommendations: z.array(z.coerce.string()).catch([]),
});


export type MealAnalysisDTO = z.infer<typeof MealAnalysis> & { analysis_id: string };


const AnalyzeSchema = z.object({
  image_data_url: z.string().startsWith("data:image/").optional().nullable(),
  text: z.string().max(2000).optional().nullable(),
  local_date: z.string().optional(),
});

export const analyzeMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => AnalyzeSchema.parse(d))
  .handler(async ({ data, context }): Promise<MealAnalysisDTO> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI service not configured.");
    if (!data.image_data_url && !data.text) throw new Error("Provide a photo or description.");

    const { supabase, userId } = context;

    // Free plan quota — enforced BEFORE any AI request is made.
    await consumeScan(supabase, userId, safeLocalDate(data.local_date));

    const { data: prof } = await supabase
      .from("profiles")
      .select(
        "full_name,age,sex,daily_calorie_target,health_conditions,fitness_goal,weight_kg,height_cm,activity_level,allergies,food_preferences,lifestyle",
      )
      .eq("id", userId)
      .maybeSingle();


    // Pull recent user corrections for personalization
    const { data: corrections } = await supabase
      .from("ai_food_corrections")
      .select("original_name,corrected_name")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    const userCtx = prof
      ? `USER PROFILE — age ${prof.age ?? "?"}, sex ${prof.sex ?? "?"}, weight ${prof.weight_kg ?? "?"}kg, height ${prof.height_cm ?? "?"}cm, activity ${prof.activity_level ?? "?"}, lifestyle ${(prof as any).lifestyle ?? "?"}, goal "${prof.fitness_goal ?? "general health"}", daily target ${prof.daily_calorie_target ?? "?"} kcal, medical: ${prof.health_conditions?.length ? prof.health_conditions.join(", ") : "none"}, allergies: ${(prof as any).allergies?.length ? (prof as any).allergies.join(", ") : "none"}, food preferences: ${(prof as any).food_preferences?.length ? (prof as any).food_preferences.join(", ") : "none"}.`
      : "";

    const correctionsHint = corrections?.length
      ? `PAST USER CORRECTIONS (prefer these mappings): ${corrections
          .map((c) => `"${c.original_name}" → "${c.corrected_name}"`)
          .join("; ")}.`
      : "";

    // AI SDK v5+ message parts: { type: "text" } and { type: "file", data, mediaType }.
    // (OpenAI-style { type: "image_url" } fails ModelMessage[] validation.)
    const content: Array<
      | { type: "text"; text: string }
      | { type: "file"; data: string; mediaType: string }
    > = [
      {
        type: "text",
        text: `You are a professional AI nutrition analyst. Analyze the meal ${data.image_data_url ? "in the image" : ""}${data.text ? ` (user description: "${data.text}")` : ""}.

STEP 1 — FOOD VALIDATION: is_food = true ONLY if the input clearly shows edible food or drink (single or multiple items, packaged food, restaurant meals, homemade, drinks all count). If it shows a person, animal, document, car, room, sky, screenshot, or any non-food object, set is_food=false, reject_reason="This doesn't appear to be a food item. Please take a clear photo of your meal.", set confidence to your certainty (0–100) that this is NOT food, and zero every nutrition field.

STEP 2 — IF FOOD: identify every visible item (multiple foods, drinks, packaged items). Set food_name to the primary dish name, meal_category to one of Breakfast/Lunch/Dinner/Snack/Drink, serving_size to a human-readable portion ("1 bowl ~180g", "2 rotis", "250ml glass") and weight_g to the total estimated weight in grams. Fill items[] with each component's macros. Fill EVERY numeric nutrient: macros, saturated_fat_g, unsaturated_fat_g, fiber, sugar, sodium, cholesterol, potassium, iron, calcium, magnesium, zinc, vitamins A/B-complex/C/D/E/K, omega3, omega6, water_ml, water_pct (0–100 % of the food's weight that is water), glycemic_index (0–100) and glycemic_load. Set confidence (0–100) = how sure you are of the recognition.

STEP 3 — SCORING (personalized to this user):
- nutrition_score 0–100 = objective nutritional quality of the food itself.
- health_score 0–100 = how good this meal is for THIS user right now (goals, conditions, allergies, preferences).
- sub_scores each 0–100: protein (adequate quality protein?), fiber, vitamin (micronutrient density), healthy_fat (unsat vs sat/trans), processed (100=whole food, 0=ultra-processed), sugar (100=low added sugar), salt (100=low sodium).

STEP 4 — CLASSIFICATION (never automatic): classification must be exactly one of "healthy_balanced", "moderate", "occasional_choice". Judge it from the whole nutrition picture — protein, fiber, sugar, saturated fat, sodium, processing level, vegetables/fruit/whole grains present, portion size and overall balance — NOT from calories alone. A burger, fries, pizza, dessert, sugary drink or deep-fried dish is normally "occasional_choice". Most mixed home meals are "moderate". Reserve "healthy_balanced" for meals that genuinely deliver protein, fiber and micronutrients with modest sugar/sodium/saturated fat.
- classification_reason: one calm, neutral sentence explaining the category. Never shame the user; never use words like bad, cheat, guilty, junk, failed.

STEP 5 — FEEDBACK:
- benefits: 2–4 short "Potential Benefits" statements grounded ONLY in what you actually detected (e.g. "Provides protein", "Contains vegetables").
- considerations: 2–4 short neutral "Things to Consider" statements (e.g. "Can be high in sodium", "Fiber is relatively low", "Nutrition varies by preparation and portion").
- ingredients: the ingredients you can actually see. If unsure about one, suffix it with " (uncertain)". Never invent ingredients.
- verdict: 1–2 sentence honest, non-judgemental assessment for THIS user's goal & conditions. Warn explicitly if it conflicts with an allergy or medical condition.
- recommendations: 3–5 short, specific, optional, non-judgemental suggestions personalized to the user (portion, swaps, timing, hydration, cooking method, macros to add). Never generic filler, never "don't eat X".

${userCtx}
${correctionsHint}

Respond with ONLY a raw JSON object (no markdown fences, no commentary) with exactly these keys:
{"is_food":boolean,"reject_reason":string|null,"food_name":string|null,"meal_category":string|null,"serving_size":string|null,"weight_g":number,"confidence":number,"items":[{"name":string,"grams":number|null,"calories":number,"protein_g":number,"carbs_g":number,"fat_g":number,"fiber_g":number}],"total_calories":number,"protein_g":number,"carbs_g":number,"fat_g":number,"fiber_g":number,"extra":{${extraKeys.map((k) => `"${k}":number`).join(",")}},"nutrition_score":number,"health_score":number,"sub_scores":{"protein":number,"fiber":number,"vitamin":number,"healthy_fat":number,"processed":number,"sugar":number,"salt":number},"classification":"healthy_balanced"|"moderate"|"occasional_choice","classification_reason":string,"benefits":[string],"considerations":[string],"ingredients":[string],"verdict":string|null,"notes":string|null,"recommendations":[string]}
Estimates are approximate; that's expected.`,

      },
    ];
    let imageBytes = 0;
    let mediaTypeLog: string | null = null;
    if (data.image_data_url) {
      const m = /^data:(image\/(?:jpeg|jpg|png|webp|heic|heif));base64,([A-Za-z0-9+/=\s]+)$/i.exec(
        data.image_data_url.trim(),
      );
      if (!m) {
        aiLog("image_rejected", { reason: "unsupported_data_url", prefix: data.image_data_url.slice(0, 32) });
        throw new Error("Unsupported image. Please use a JPEG, PNG or WebP photo.");
      }
      const mediaType = m[1].toLowerCase() === "image/jpg" ? "image/jpeg" : m[1].toLowerCase();
      const base64 = m[2].replace(/\s/g, "");
      if (base64.length < 100) {
        aiLog("image_rejected", { reason: "empty_payload", base64_len: base64.length, mediaType });
        throw new Error("That image looks empty. Please try another photo.");
      }
      imageBytes = Math.floor((base64.length * 3) / 4);
      mediaTypeLog = mediaType;
      content.push({ type: "file", data: base64, mediaType });
    }

    const started = Date.now();
    aiLog("request", {
      user_id: userId,
      has_image: Boolean(data.image_data_url),
      media_type: mediaTypeLog,
      image_bytes: imageBytes,
      text_len: data.text?.length ?? 0,
      model: "google/gemini-3-flash-preview",
      corrections: corrections?.length ?? 0,
    });

    let text: string;
    try {
      ({ text } = await generateText({ model, messages: [{ role: "user", content }] }));
    } catch (err) {
      aiLog("gateway_error", {
        user_id: userId,
        duration_ms: Date.now() - started,
        name: (err as any)?.name ?? null,
        status: (err as any)?.statusCode ?? (err as any)?.status ?? null,
        message: err instanceof Error ? err.message : String(err),
      });
      const status = (err as any)?.statusCode ?? (err as any)?.status;
      if (status === 429) throw new Error("AI is busy right now. Please try again in a moment.");
      if (status === 402) throw new Error("AI credits are exhausted. Please add credits to continue.");
      throw new Error("Couldn't analyze meal. Please try again.");
    }

    const duration = Date.now() - started;
    const raw = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) {
      aiLog("parse_error", {
        user_id: userId,
        duration_ms: duration,
        reason: "no_json_object",
        raw_len: raw.length,
        raw_preview: raw.slice(0, 400),
      });
      throw new Error("Couldn't analyze meal. Try a clearer photo or description.");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.slice(start, end + 1));
    } catch (err) {
      aiLog("parse_error", {
        user_id: userId,
        duration_ms: duration,
        reason: "invalid_json",
        message: err instanceof Error ? err.message : String(err),
        raw_preview: raw.slice(0, 400),
      });
      throw new Error("Couldn't analyze meal. Try a clearer photo or description.");
    }

    const result = MealAnalysis.safeParse(parsed);
    if (!result.success) {
      aiLog("validation_error", {
        user_id: userId,
        duration_ms: duration,
        issues: result.error.issues.slice(0, 10).map((i) => ({ path: i.path.join("."), code: i.code, message: i.message })),
        raw_preview: raw.slice(0, 400),
      });
      throw new Error("Couldn't analyze meal. Try a clearer photo or description.");
    }

    const out: MealAnalysisDTO = {
      ...result.data,
      classification: reconcileClassification(result.data),
      analysis_id: crypto.randomUUID(),
    };

    aiLog("response", {
      user_id: userId,
      duration_ms: duration,
      is_food: out.is_food,
      food_name: out.food_name,
      calories: out.total_calories,
      confidence: out.confidence,
      classification: out.classification,
      items: out.items.length,
      raw_len: raw.length,
    });

    return out;
  });

/**
 * Deterministic guard rail: a meal is only "balanced" when the nutrition data
 * actually supports it. Prevents every scan from being labelled healthy.
 */
function reconcileClassification(a: z.infer<typeof MealAnalysis>): Classification {
  const sub = a.sub_scores ?? ({} as any);
  const sodium = Number(a.extra?.sodium_mg ?? 0);
  const sugar = Number(a.extra?.sugar_g ?? 0);
  const sat = Number(a.extra?.saturated_fat_g ?? 0);
  const quality =
    (Number(sub.protein ?? 50) +
      Number(sub.fiber ?? 50) +
      Number(sub.vitamin ?? 50) +
      Number(sub.healthy_fat ?? 50) +
      Number(sub.processed ?? 50) +
      Number(sub.sugar ?? 50) +
      Number(sub.salt ?? 50)) /
    7;
  const nutrition = Number(a.nutrition_score ?? quality);
  const composite = (quality + nutrition) / 2;

  const heavy = sodium > 900 || sugar > 25 || sat > 12;
  if (a.classification === "healthy_balanced" && (composite < 65 || heavy)) {
    return composite < 45 ? "occasional_choice" : "moderate";
  }
  if (a.classification === "moderate" && composite < 40 && heavy) return "occasional_choice";
  return a.classification;
}


const LogMealSchema = z.object({
  meal_type: MealType,
  meal_date: z.string().optional(),
  items: z.array(z.any()).default([]),
  notes: z.string().max(2000).optional().nullable(),
  photo_url: z.string().optional().nullable(),
  food_name: z.string().max(200).optional().nullable(),
  total_calories: z.number().min(0).max(20000).default(0),
  protein_g: z.number().min(0).max(2000).default(0),
  carbs_g: z.number().min(0).max(2000).default(0),
  fat_g: z.number().min(0).max(2000).default(0),
  fiber_g: z.number().min(0).max(500).default(0),
  sugar_g: z.number().min(0).max(500).default(0),
  sodium_mg: z.number().min(0).max(20000).default(0),
  water_ml: z.number().int().min(0).max(20000).default(0),
  ai_analyzed: z.boolean().default(false),
  health_score: z.number().int().min(0).max(100).nullable().optional(),
  confidence: z.number().int().min(0).max(100).nullable().optional(),
  nutrition_extra: z.record(z.string(), z.any()).optional(),
  sub_scores: z.record(z.string(), z.any()).optional(),
  recommendations: z.array(z.string()).optional(),
  classification: z.enum(CLASSIFICATIONS).default("moderate"),
  classification_reason: z.string().max(600).optional().nullable(),
  benefits: z.array(z.string()).optional(),
  considerations: z.array(z.string()).optional(),
  ingredients: z.array(z.string()).optional(),
  portion_grams: z.number().min(0).max(20000).optional().nullable(),
  user_adjusted: z.boolean().default(false),
  analysis_id: z.string().uuid().optional().nullable(),
});


export interface MealLogDTO {
  id: string;
  meal_type: string;
  meal_date: string;
  items: any[];
  notes: string | null;
  photo_url: string | null;
  food_name: string | null;
  total_calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  water_ml: number;
  ai_analyzed: boolean;
  health_score: number | null;
  confidence: number | null;
  nutrition_extra: Record<string, any>;
  sub_scores: Record<string, any>;
  recommendations: string[];
  classification: Classification;
  classification_reason: string | null;
  benefits: string[];
  considerations: string[];
  ingredients: string[];
  portion_grams: number | null;
  user_adjusted: boolean;
  analysis_id: string | null;
  created_at: string;
}

function toMealDTO(r: any): MealLogDTO {
  return {
    id: r.id,
    meal_type: r.meal_type,
    meal_date: r.meal_date,
    items: (r.items as any[]) ?? [],
    notes: r.notes ?? null,

    photo_url: r.photo_url ?? null,
    food_name: r.food_name ?? null,
    total_calories: Number(r.total_calories ?? 0),
    protein_g: Number(r.protein_g ?? 0),
    carbs_g: Number(r.carbs_g ?? 0),
    fat_g: Number(r.fat_g ?? 0),
    fiber_g: Number(r.fiber_g ?? 0),
    sugar_g: Number(r.sugar_g ?? 0),
    sodium_mg: Number(r.sodium_mg ?? 0),
    water_ml: r.water_ml ?? 0,
    ai_analyzed: Boolean(r.ai_analyzed),
    health_score: r.health_score ?? null,
    confidence: r.confidence ?? null,
    nutrition_extra: r.nutrition_extra ?? {},
    sub_scores: r.sub_scores ?? {},
    recommendations: Array.isArray(r.recommendations) ? r.recommendations : [],
    classification: (CLASSIFICATIONS as readonly string[]).includes(r.classification)
      ? (r.classification as Classification)
      : "moderate",
    classification_reason: r.classification_reason ?? null,
    benefits: Array.isArray(r.benefits) ? r.benefits : [],
    considerations: Array.isArray(r.considerations) ? r.considerations : [],
    ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
    portion_grams: r.portion_grams != null ? Number(r.portion_grams) : null,
    user_adjusted: Boolean(r.user_adjusted),
    analysis_id: r.analysis_id ?? null,
    created_at: r.created_at,

  };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export const logMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => LogMealSchema.parse(d))
  .handler(async ({ data, context }): Promise<MealLogDTO & { xp_gained: number; coins_gained: number; pet_reaction: "happy" | "neutral" | "tired" }> => {
    const { supabase, userId } = context;

    // Idempotency: the same analysis can only ever produce one meal record.
    if (data.analysis_id) {
      const { data: existing } = await supabase
        .from("meal_logs")
        .select("*")
        .eq("user_id", userId)
        .eq("analysis_id", data.analysis_id)
        .maybeSingle();
      if (existing) {
        return { ...toMealDTO(existing), xp_gained: 0, coins_gained: 0, pet_reaction: "neutral" as const };
      }
    }

    const { data: row, error } = await supabase
      .from("meal_logs")
      .insert({
        user_id: userId,
        meal_type: data.meal_type,
        meal_date: data.meal_date ?? new Date().toISOString().slice(0, 10),
        items: data.items,
        notes: data.notes ?? null,
        photo_url: data.photo_url ?? null,
        food_name: data.food_name ?? null,
        total_calories: data.total_calories,
        protein_g: data.protein_g,
        carbs_g: data.carbs_g,
        fat_g: data.fat_g,
        fiber_g: data.fiber_g,
        sugar_g: data.sugar_g,
        sodium_mg: data.sodium_mg,
        water_ml: data.water_ml,
        ai_analyzed: data.ai_analyzed,
        health_score: data.health_score ?? null,
        confidence: data.confidence ?? null,
        nutrition_extra: (data.nutrition_extra ?? {}) as any,
        sub_scores: (data.sub_scores ?? {}) as any,
        recommendations: (data.recommendations ?? []) as any,
        classification: data.classification,
        classification_reason: data.classification_reason ?? null,
        benefits: (data.benefits ?? []) as any,
        considerations: (data.considerations ?? []) as any,
        ingredients: (data.ingredients ?? []) as any,
        portion_grams: data.portion_grams ?? null,
        user_adjusted: data.user_adjusted,
        analysis_id: data.analysis_id ?? null,
      })
      .select("*")
      .single();
    if (error) {
      // Unique-violation → a parallel double-tap already saved it.
      if ((error as any).code === "23505" && data.analysis_id) {
        const { data: dup } = await supabase
          .from("meal_logs")
          .select("*")
          .eq("user_id", userId)
          .eq("analysis_id", data.analysis_id)
          .maybeSingle();
        if (dup) return { ...toMealDTO(dup), xp_gained: 0, coins_gained: 0, pet_reaction: "neutral" as const };
      }
      throw error;
    }

    // The pet rewards the HABIT of logging — never punishes a single food choice.
    const balanced = data.classification === "healthy_balanced";
    const moderate = data.classification === "moderate";
    const xpGain = balanced ? 15 : moderate ? 10 : 8;
    const coinsGain = balanced ? 10 : moderate ? 6 : 5;
    const happyDelta = balanced ? 6 : 3;
    const energyDelta = balanced ? 8 : 4;
    const reaction: "happy" | "neutral" | "tired" = balanced ? "happy" : "neutral";


    const { data: pet } = await supabase.from("pets").select("*").eq("user_id", userId).maybeSingle();
    if (pet) {
      await supabase
        .from("pets")
        .update({
          happiness_points: clamp((pet.happiness_points ?? 50) + happyDelta, 0, 100),
          energy_points: clamp((pet.energy_points ?? 100) + energyDelta, 0, 100),
          total_experience_points: (pet.total_experience_points ?? 0) + xpGain,
        })
        .eq("user_id", userId);
    }

    const { data: prof } = await supabase.from("profiles").select("coins,total_coins_earned,total_xp_earned").eq("id", userId).maybeSingle();
    if (prof) {
      await supabase
        .from("profiles")
        .update({
          coins: (prof.coins ?? 0) + coinsGain,
          total_coins_earned: (prof.total_coins_earned ?? 0) + coinsGain,
          total_xp_earned: (prof.total_xp_earned ?? 0) + xpGain,
        })
        .eq("id", userId);
      await supabase.from("coin_transactions").insert({
        user_id: userId,
        amount: coinsGain,
        reason: `Meal scan (${data.food_name ?? data.meal_type})`,
      });
    }

    return { ...toMealDTO(row), xp_gained: xpGain, coins_gained: coinsGain, pet_reaction: reaction };
  });

const UpdateMealSchema = z.object({
  id: z.string().uuid(),
  food_name: z.string().max(200).optional().nullable(),
  meal_type: MealType.optional(),
  items: z.array(z.any()).optional(),
  total_calories: z.number().min(0).max(20000).optional(),
  protein_g: z.number().min(0).max(2000).optional(),
  carbs_g: z.number().min(0).max(2000).optional(),
  fat_g: z.number().min(0).max(2000).optional(),
  fiber_g: z.number().min(0).max(500).optional(),
  sugar_g: z.number().min(0).max(500).optional(),
  sodium_mg: z.number().min(0).max(20000).optional(),
  portion_grams: z.number().min(0).max(20000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UpdateMealSchema.parse(d))
  .handler(async ({ data, context }): Promise<MealLogDTO> => {
    const { supabase, userId } = context;
    const { id, ...rest } = data;
    const { data: row, error } = await supabase
      .from("meal_logs")
      .update({ ...rest, user_adjusted: true })

      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw error;
    return toMealDTO(row);
  });

export const logAiCorrection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ original_name: z.string().min(1).max(200), corrected_name: z.string().min(1).max(200) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("ai_food_corrections").insert({
      user_id: userId,
      original_name: data.original_name,
      corrected_name: data.corrected_name,
    });
    if (error) throw error;
    return { ok: true as const };
  });

export const deleteMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("meal_logs").delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw error;
    return { ok: true as const };
  });

export const listMealsByDate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ date: z.string().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<MealLogDTO[]> => {
    const { supabase, userId } = context;
    const date = data.date ?? new Date().toISOString().slice(0, 10);
    const { data: rows, error } = await supabase
      .from("meal_logs")
      .select("*")
      .eq("user_id", userId)
      .eq("meal_date", date)
      .order("created_at", { ascending: true });
    if (error) throw error;
    const out: MealLogDTO[] = [];
    for (const r of rows ?? []) {
      const dto = toMealDTO(r);
      if (dto.photo_url && !dto.photo_url.startsWith("http")) {
        const { data: signed } = await supabase.storage.from("meal-photos").createSignedUrl(dto.photo_url, 3600);
        if (signed?.signedUrl) dto.photo_url = signed.signedUrl;
      }
      out.push(dto);
    }
    return out;
  });

export interface NutritionSummary {
  date: string;
  total_calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  water_ml: number;
  meals_logged: number;
  balanced_meals: number;
  target_calories: number | null;
  weekly: { date: string; calories: number }[];
}

export const getNutritionSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NutritionSummary> => {
    const { supabase, userId } = context;
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);

    const { data: rows, error } = await supabase
      .from("meal_logs")
      .select("meal_date,total_calories,protein_g,carbs_g,fat_g,fiber_g,sugar_g,sodium_mg,water_ml,classification")
      .eq("user_id", userId)
      .gte("meal_date", weekAgo)
      .lte("meal_date", today);
    if (error) throw error;

    const { data: prof } = await supabase.from("profiles").select("daily_calorie_target").eq("id", userId).maybeSingle();

    const byDate = new Map<string, number>();
    let todaySum = { c: 0, p: 0, ca: 0, f: 0, fi: 0, su: 0, so: 0, w: 0 };
    let mealsLogged = 0;
    let balancedMeals = 0;
    for (const r of rows ?? []) {
      const d = r.meal_date as string;
      byDate.set(d, (byDate.get(d) ?? 0) + Number(r.total_calories ?? 0));
      if (d === today) {
        mealsLogged++;
        if ((r as any).classification === "healthy_balanced") balancedMeals++;
        todaySum.c += Number(r.total_calories ?? 0);
        todaySum.p += Number(r.protein_g ?? 0);
        todaySum.ca += Number(r.carbs_g ?? 0);
        todaySum.f += Number(r.fat_g ?? 0);
        todaySum.fi += Number(r.fiber_g ?? 0);
        todaySum.su += Number((r as any).sugar_g ?? 0);
        todaySum.so += Number((r as any).sodium_mg ?? 0);
        todaySum.w += Number(r.water_ml ?? 0);
      }
    }
    const weekly: { date: string; calories: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      weekly.push({ date: d, calories: Math.round(byDate.get(d) ?? 0) });
    }
    return {
      date: today,
      total_calories: Math.round(todaySum.c),
      protein_g: Math.round(todaySum.p),
      carbs_g: Math.round(todaySum.ca),
      fat_g: Math.round(todaySum.f),
      fiber_g: Math.round(todaySum.fi),
      sugar_g: Math.round(todaySum.su),
      sodium_mg: Math.round(todaySum.so),
      water_ml: Math.round(todaySum.w),
      meals_logged: mealsLogged,
      balanced_meals: balancedMeals,
      target_calories: prof?.daily_calorie_target ?? null,
      weekly,
    };
  });


export const uploadMealPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ data_url: z.string().startsWith("data:image/") }).parse(d))
  .handler(async ({ data, context }): Promise<{ path: string }> => {
    const { supabase, userId } = context;
    const match = data.data_url.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
    if (!match) throw new Error("Invalid image data URL");
    const mime = match[1];
    const ext = mime.split("/")[1].replace("+xml", "");
    const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("meal-photos").upload(path, bytes, {
      contentType: mime,
      upsert: false,
    });
    if (error) throw error;
    return { path };
  });
