import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface LeaderboardRow {
  user_id: string;
  username: string;
  avatar_url: string | null;
  value: number;
  pet_name: string | null;
  pet_stage: string | null;
  pet_level: number | null;
}

export interface FeedItem {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  kind: string;
  payload: Record<string, any>;
  created_at: string;
}

const LBSchema = z.object({
  metric: z.enum(["xp", "coins", "streak", "level"]).default("xp"),
});

export const getLeaderboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => LBSchema.parse(d))
  .handler(async ({ data, context }): Promise<LeaderboardRow[]> => {
    const { supabase } = context;
    const profiles = (await supabase.rpc("get_public_profiles")).data ?? [];
    const pets = (await supabase.from("pets").select("user_id, pet_name, pet_stage, current_level")).data ?? [];
    const habits = (await supabase.from("habits").select("user_id, longest_streak, current_streak")).data ?? [];

    const petByUser = new Map<string, any>();
    for (const p of pets as any[]) petByUser.set(p.user_id, p);
    const streakByUser = new Map<string, number>();
    for (const h of habits as any[]) {
      const cur = streakByUser.get(h.user_id) ?? 0;
      streakByUser.set(h.user_id, Math.max(cur, h.longest_streak ?? 0));
    }

    const rows = (profiles as any[]).map((p) => {
      const pet = petByUser.get(p.id);
      let value = 0;
      if (data.metric === "xp") value = p.total_xp_earned ?? 0;
      else if (data.metric === "coins") value = p.total_coins_earned ?? 0;
      else if (data.metric === "streak") value = streakByUser.get(p.id) ?? 0;
      else if (data.metric === "level") value = pet?.current_level ?? 1;
      return {
        user_id: p.id,
        username: p.username || "Anonymous Player",
        avatar_url: p.avatar_url,
        value,
        pet_name: pet?.pet_name ?? null,
        pet_stage: pet?.pet_stage ?? null,
        pet_level: pet?.current_level ?? null,
      };
    });
    rows.sort((a, b) => b.value - a.value);
    return rows.slice(0, 50);
  });

export const getActivityFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FeedItem[]> => {
    const { supabase } = context;
    const feed = (
      await supabase
        .from("activity_feed")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50)
    ).data ?? [];
    const userIds = Array.from(new Set((feed as any[]).map((f) => f.user_id)));
    const profs = userIds.length
      ? (await supabase.rpc("get_public_profiles", { _ids: userIds })).data ?? []
      : [];
    const pmap = new Map<string, any>();
    for (const p of profs as any[]) pmap.set(p.id, p);
    return (feed as any[]).map((f) => ({
      id: f.id,
      user_id: f.user_id,
      username: pmap.get(f.user_id)?.username || "Player",
      avatar_url: pmap.get(f.user_id)?.avatar_url ?? null,
      kind: f.kind,
      payload: f.payload ?? {},
      created_at: f.created_at,
    }));
  });

export const getMyActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FeedItem[]> => {
    const { supabase, userId } = context;
    const feed = (
      await supabase
        .from("activity_feed")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20)
    ).data ?? [];
    return (feed as any[]).map((f) => ({
      id: f.id,
      user_id: f.user_id,
      username: "You",
      avatar_url: null,
      kind: f.kind,
      payload: f.payload ?? {},
      created_at: f.created_at,
    }));
  });
