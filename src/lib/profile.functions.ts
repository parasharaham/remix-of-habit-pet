import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ProfileDTO {
  id: string;
  username: string | null;
  avatar_url: string | null;
  coins: number;
  total_coins_earned: number;
  total_xp_earned: number;
  total_habits_completed: number;
  is_premium: boolean;
  is_admin: boolean;
  created_at: string;
  full_name?: string | null;
  age?: number | null;
  sex?: string | null;
  profession?: string | null;
  grade?: string | null;
  mother_tongue?: string | null;
  preferred_language?: string | null;
  health_conditions?: string[] | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  activity_level?: string | null;
  fitness_goal?: string | null;
  target_skill?: string | null;
  daily_calorie_target?: number | null;
  profile_completed?: boolean;
}

async function ensureProfile(supabase: any, userId: string) {
  const existing = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (existing.data) return existing.data;
  const created = await supabase.from("profiles").insert({ id: userId }).select("*").single();
  if (created.error) throw created.error;
  return created.data;
}

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProfileDTO> => {
    return await ensureProfile(context.supabase, context.userId);
  });

const UpdateSchema = z.object({
  username: z.string().trim().min(2).max(40).optional(),
  avatar_url: z.string().url().max(500).optional().nullable(),
  preferred_language: z.string().trim().min(2).max(8).optional(),
});

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UpdateSchema.parse(d))
  .handler(async ({ data, context }): Promise<ProfileDTO> => {
    const { supabase, userId } = context;
    await ensureProfile(supabase, userId);
    const { data: row, error } = await supabase
      .from("profiles")
      .update(data)
      .eq("id", userId)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    // Cascade via FKs; remove what we directly own.
    await supabase.from("habits").delete().eq("user_id", userId);
    await supabase.from("pets").delete().eq("user_id", userId);
    await supabase.from("profiles").delete().eq("id", userId);
    return { ok: true };
  });
