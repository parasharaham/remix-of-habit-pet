import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface AchievementDTO {
  id: string;
  code: string;
  title: string;
  description: string;
  badge: string;
  category: string;
  threshold: number;
  metric: string;
  unlocked_at: string | null;
  progress: number; // 0..1
  current_value: number;
}

export const listAchievements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AchievementDTO[]> => {
    const { supabase, userId } = context;

    const [allRes, ownedRes, profRes, petRes, habitsRes] = await Promise.all([
      supabase.from("achievements").select("*").order("threshold", { ascending: true }),
      supabase.from("user_achievements").select("achievement_id, unlocked_at").eq("user_id", userId),
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("pets").select("current_level").eq("user_id", userId).maybeSingle(),
      supabase.from("habits").select("longest_streak").eq("user_id", userId),
    ]);

    const owned = new Map<string, string>();
    for (const r of ownedRes.data ?? []) owned.set(r.achievement_id, r.unlocked_at);

    const longest = (habitsRes.data ?? []).reduce(
      (m: number, h: any) => Math.max(m, h.longest_streak ?? 0),
      0,
    );
    const metrics: Record<string, number> = {
      habits_completed: profRes.data?.total_habits_completed ?? 0,
      longest_streak: longest,
      pet_level: petRes.data?.current_level ?? 1,
      total_coins_earned: profRes.data?.total_coins_earned ?? 0,
    };

    return (allRes.data ?? []).map((a: any) => {
      const current = metrics[a.metric] ?? 0;
      return {
        id: a.id,
        code: a.code,
        title: a.title,
        description: a.description,
        badge: a.badge,
        category: a.category,
        threshold: a.threshold,
        metric: a.metric,
        unlocked_at: owned.get(a.id) ?? null,
        progress: Math.min(1, current / a.threshold),
        current_value: current,
      };
    });
  });
