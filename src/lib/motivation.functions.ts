import { createServerFn } from "@tanstack/react-start";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { languageInstruction } from "./ai-language";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const MODEL = "google/gemini-3-flash-preview";

export const MOTIVATION_IMAGE_COUNT = 4;

export interface MotivationDTO {
  quote: string;
  author: string | null;
  image_index: number;
  /** false when the user has already seen today's motivation */
  is_new: boolean;
}

const QuoteSchema = z.object({
  quote: z.string(),
  author: z.string(),
});

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * One motivation per user per day, and never the same words twice:
 * every quote the user has already seen is sent to the model as a
 * do-not-repeat list, and the chosen line is stored right away.
 */
export const getDailyMotivation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MotivationDTO | null> => {
    const { supabase, userId } = context;

    const { data: seen, error: seenErr } = await supabase
      .from("motivations")
      .select("quote,author,image_index,shown_at")
      .eq("user_id", userId)
      .order("shown_at", { ascending: false })
      .limit(60);
    if (seenErr) throw seenErr;

    const latest = seen?.[0];
    if (latest && String(latest.shown_at).slice(0, 10) === todayIso()) {
      return {
        quote: latest.quote,
        author: latest.author ?? null,
        image_index: latest.image_index ?? 0,
        is_new: false,
      };
    }

    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name,profession,fitness_goal,target_skill,life_objective,passion,preferred_language")
      .eq("id", userId)
      .maybeSingle();

    const already = (seen ?? []).map((s) => `- ${s.quote}`).join("\n") || "- (none yet)";

    let generated: z.infer<typeof QuoteSchema> | null = null;
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (apiKey) {
      try {
        const gateway = createLovableAiGatewayProvider(apiKey);
        const { output } = await generateText({
          model: gateway(MODEL),
          output: Output.object({ schema: QuoteSchema }),
          prompt: `Write ONE short, emotionally intelligent motivational line for this person to read the moment they open their habit app.

PERSON: name ${prof?.full_name ?? "friend"}, work "${prof?.profession ?? "unknown"}", life objective "${prof?.life_objective ?? "not shared"}", passion "${prof?.passion ?? "not shared"}", learning "${prof?.target_skill ?? "-"}", fitness goal "${prof?.fitness_goal ?? "-"}".

ALREADY SHOWN TO THEM (never repeat these, not even reworded):
${already}

Rules: 1-2 sentences, max 200 characters, warm and human, speak to their real objective and passion, no hashtags, no emojis, no quotation marks. author = the person the words belong to, or "HabitPet" when the words are yours.

${languageInstruction(prof?.preferred_language)}`,
        });
        generated = output;
      } catch (e) {
        if (!NoObjectGeneratedError.isInstance(e)) throw e;
      }
    }

    const fallbacks = [
      "The life you want is built in the small hours nobody claps for. Start with today.",
      "You are not behind. You are early in a story that only you can finish.",
      "Your future self is quietly hoping you show up today. Do one honest thing.",
      "Passion does not die, it waits. Give it ten minutes today.",
    ];
    const usedTexts = new Set((seen ?? []).map((s) => s.quote.trim().toLowerCase()));
    const quote =
      generated?.quote?.trim() ||
      fallbacks.find((f) => !usedTexts.has(f.toLowerCase())) ||
      fallbacks[(seen?.length ?? 0) % fallbacks.length];

    if (usedTexts.has(quote.trim().toLowerCase())) {
      return latest
        ? { quote: latest.quote, author: latest.author ?? null, image_index: latest.image_index ?? 0, is_new: false }
        : null;
    }

    const image_index = (seen?.length ?? 0) % MOTIVATION_IMAGE_COUNT;
    const author = generated?.author?.trim() || "HabitPet";

    const { error } = await supabase.from("motivations").insert({
      user_id: userId,
      quote,
      author,
      image_index,
    });
    if (error) throw error;

    return { quote, author, image_index, is_new: true };
  });
