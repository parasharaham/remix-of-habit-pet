import { createServerFn } from "@tanstack/react-start";
import { generateText, streamText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { languageInstruction } from "./ai-language";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const MODEL = "google/gemini-3-flash-preview";

/* ----------------------------------------------------------------- types */

export interface RoutineBlock {
  start: string;
  end: string;
  title: string;
  category: "sleep" | "work" | "exercise" | "meal" | "water" | "passion" | "objective" | "rest" | "learning";
  why: string;
}

export interface RoadmapStep {
  timeframe: string;
  goal: string;
  actions: string[];
}

export interface RoutineDTO {
  blocks: RoutineBlock[];
  roadmap: RoadmapStep[];
  summary: string | null;
  encouragement: string | null;
  inputs: RoutineInputs | null;
  updated_at: string | null;
}

export interface RoutineInputs {
  profession: string;
  work_hours: string;
  wake_time: string;
  sleep_time: string;
  current_routine: string;
  life_objective: string;
  passion: string;
  feeling: string;
  blockers: string;
}

const InputsSchema = z.object({
  profession: z.string().trim().max(120).default(""),
  work_hours: z.string().trim().max(120).default(""),
  wake_time: z.string().trim().max(20).default(""),
  sleep_time: z.string().trim().max(20).default(""),
  current_routine: z.string().trim().max(2000).default(""),
  life_objective: z.string().trim().max(600).default(""),
  passion: z.string().trim().max(300).default(""),
  feeling: z.string().trim().max(600).default(""),
  blockers: z.string().trim().max(600).default(""),
});

const PlanSchema = z.object({
  summary: z.string(),
  encouragement: z.string(),
  blocks: z.array(
    z.object({
      start: z.string(),
      end: z.string(),
      title: z.string(),
      category: z.string(),
      why: z.string(),
    }),
  ),
  roadmap: z.array(
    z.object({
      timeframe: z.string(),
      goal: z.string(),
      actions: z.array(z.string()),
    }),
  ),
});

const CATEGORIES = new Set([
  "sleep", "work", "exercise", "meal", "water", "passion", "objective", "rest", "learning",
]);

function normCategory(c: string): RoutineBlock["category"] {
  const v = c.trim().toLowerCase();
  return (CATEGORIES.has(v) ? v : "rest") as RoutineBlock["category"];
}

/* ------------------------------------------------------------------ read */

export const getRoutine = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RoutineDTO> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("routines")
      .select("blocks,roadmap,summary,encouragement,inputs,updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return {
      blocks: (data?.blocks as unknown as RoutineBlock[]) ?? [],
      roadmap: (data?.roadmap as unknown as RoadmapStep[]) ?? [],
      summary: data?.summary ?? null,
      encouragement: data?.encouragement ?? null,
      inputs: (data?.inputs as unknown as RoutineInputs) ?? null,
      updated_at: data?.updated_at ?? null,
    };
  });

/* -------------------------------------------------------------- generate */

export const generateRoutine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => InputsSchema.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<RoutineDTO> => {
    const { supabase, userId } = context;

    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name,age,profession,activity_level,fitness_goal,health_conditions,target_skill,life_objective,passion,preferred_language")
      .eq("id", userId)
      .maybeSingle();

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured right now. Please try again later.");

    const gateway = createLovableAiGatewayProvider(apiKey);
    let plan: z.infer<typeof PlanSchema> | null = null;
    try {
      const { output } = await generateText({
        model: gateway(MODEL),
        output: Output.object({ schema: PlanSchema }),
        prompt: `You are a warm, emotionally intelligent life-design coach. Build ONE realistic daily routine plus a roadmap toward the person's real life objective.

PERSON
- name: ${prof?.full_name ?? "friend"}, age ${prof?.age ?? "?"}
- profession: ${data.profession || prof?.profession || "not shared"}
- work hours: ${data.work_hours || "not shared"}
- usually wakes: ${data.wake_time || "not shared"}, sleeps: ${data.sleep_time || "not shared"}
- current daily routine in their words: ${data.current_routine || "not shared"}
- main life objective: ${data.life_objective || prof?.life_objective || "not shared"}
- passion: ${data.passion || prof?.passion || "not shared"}
- how they feel right now: ${data.feeling || "not shared"}
- what blocks them: ${data.blockers || "not shared"}
- health notes: ${prof?.health_conditions?.join(", ") || "none"}; fitness goal: ${prof?.fitness_goal ?? "-"}; learning: ${prof?.target_skill ?? "-"}

NON-NEGOTIABLE RULES FOR THE ROUTINE
1. At least 8 hours of continuous sleep, as one block with category "sleep".
2. Water totalling 3 litres across the day — include at least 3 short blocks with category "water" and state the amount in the title (e.g. "Drink 750 ml").
3. At least 45 minutes of movement/exercise (category "exercise").
4. At least 60 minutes for their life objective (category "objective") and time for their passion (category "passion"), even on work days — carve it out around their real work hours.
5. Include meals (category "meal") and short rest/recovery breaks (category "rest").
6. 24 hours must fit. Times in 24h "HH:MM" format, blocks in chronological order, 10-16 blocks total.
7. category must be exactly one of: sleep, work, exercise, meal, water, passion, objective, rest, learning.
8. "why" = one short encouraging sentence connecting the block to how they feel and what they want.

ROADMAP
3-5 steps (timeframe like "Week 1-2", "Month 1", "Month 3-6") from where they are today to their life objective, each with 2-4 concrete actions. Be honest and practical, not hype.

summary = 2 sentences describing the shape of the new day.
encouragement = 2-3 sentences that acknowledge their feelings by name, remind them of their passion, and tell them the objective is reachable.

${languageInstruction(prof?.preferred_language)}`,
      });
      plan = output;
    } catch (e) {
      if (!NoObjectGeneratedError.isInstance(e)) throw e;
      throw new Error("The coach couldn't shape a plan this time. Try again in a moment.");
    }

    const blocks: RoutineBlock[] = (plan.blocks ?? []).slice(0, 20).map((b) => ({
      start: String(b.start).slice(0, 5),
      end: String(b.end).slice(0, 5),
      title: b.title,
      category: normCategory(b.category),
      why: b.why,
    }));
    const roadmap: RoadmapStep[] = (plan.roadmap ?? []).slice(0, 8).map((s) => ({
      timeframe: s.timeframe,
      goal: s.goal,
      actions: (s.actions ?? []).slice(0, 6),
    }));

    const { error } = await supabase.from("routines").upsert(
      {
        user_id: userId,
        inputs: data,
        blocks,
        roadmap,
        summary: plan.summary,
        encouragement: plan.encouragement,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw error;

    // keep the profile's objective/passion in sync so every other AI feature knows
    if (data.life_objective || data.passion) {
      await supabase
        .from("profiles")
        .update({
          ...(data.life_objective ? { life_objective: data.life_objective } : {}),
          ...(data.passion ? { passion: data.passion } : {}),
        })
        .eq("id", userId);
    }

    return {
      blocks,
      roadmap,
      summary: plan.summary,
      encouragement: plan.encouragement,
      inputs: data,
      updated_at: new Date().toISOString(),
    };
  });

/* ------------------------------------------------------------------ chat */

export interface RoutineMessageDTO {
  id: string;
  role: "user" | "assistant";
  content: string;
  emotion: string | null;
  created_at: string;
}

export const getRoutineMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RoutineMessageDTO[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("routine_messages")
      .select("id,role,content,emotion,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) throw error;
    return (data ?? []) as RoutineMessageDTO[];
  });

export const sendRoutineMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ message: z.string().trim().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }): Promise<RoutineMessageDTO> => {
    const { supabase, userId } = context;

    const [{ data: prof }, { data: routine }, { data: history }] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name,age,profession,target_skill,life_objective,passion,preferred_language")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("routines").select("summary,blocks,roadmap").eq("user_id", userId).maybeSingle(),
      supabase
        .from("routine_messages")
        .select("role,content")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

    const ins = await supabase
      .from("routine_messages")
      .insert({ user_id: userId, role: "user", content: data.message })
      .select("id")
      .single();
    if (ins.error) throw ins.error;

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured right now. Please try again later.");
    const gateway = createLovableAiGatewayProvider(apiKey);

    const transcript = (history ?? [])
      .slice()
      .reverse()
      .map((m) => `${m.role === "user" ? "Person" : "Coach"}: ${m.content}`)
      .join("\n");

    const result = streamText({
      model: gateway(MODEL),
      prompt: `You are HabitPet's routine coach: emotionally intelligent, calm, never preachy. You read feelings between the lines and name them gently before giving advice.

PERSON: ${prof?.full_name ?? "friend"}, age ${prof?.age ?? "?"}, work "${prof?.profession ?? "-"}", life objective "${prof?.life_objective ?? "not shared"}", passion "${prof?.passion ?? "not shared"}", learning "${prof?.target_skill ?? "-"}".
THEIR CURRENT ROUTINE SUMMARY: ${routine?.summary ?? "not built yet"}.

RECENT CONVERSATION:
${transcript || "(this is the first message)"}

NEW MESSAGE FROM THEM:
${data.message}

Reply in 2-5 short paragraphs or a small list. First acknowledge the emotion you hear in one sentence. Then give one or two concrete adjustments to their day that protect 8 hours of sleep, 3 litres of water and daily movement, and that move them closer to their life objective and passion. End with one line of genuine encouragement. Never give medical diagnoses.

${languageInstruction(prof?.preferred_language)}`,
    });

    const reply = await result.text;

    const saved = await supabase
      .from("routine_messages")
      .insert({ user_id: userId, role: "assistant", content: reply })
      .select("id,role,content,emotion,created_at")
      .single();
    if (saved.error) throw saved.error;

    return saved.data as RoutineMessageDTO;
  });
