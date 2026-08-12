import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getTier, UpgradeRequiredError } from "./subscription-guard";
import { ENTITLEMENTS } from "./entitlements";
import {
  applyXpGain,
  clamp,
  habitCompletionReward,
  nextStreak,
  stageForLevel,
  xpNeededForLevel,
} from "./pet-engine";

const Frequency = z.enum(["daily", "weekly"]);
const Category = z.enum(["health", "fitness", "reading", "productivity", "study", "finance", "custom"]);
const Difficulty = z.enum(["easy", "medium", "hard"]);

const CreateSchema = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional().nullable(),
  frequency: Frequency.default("daily"),
  category: Category.default("custom"),
  difficulty: Difficulty.default("medium"),
});

const UpdateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  frequency: Frequency.optional(),
  category: Category.optional(),
  difficulty: Difficulty.optional(),
  is_paused: z.boolean().optional(),
});

const IdSchema = z.object({ id: z.string().uuid() });

export interface HabitDTO {
  id: string;
  title: string;
  description: string | null;
  frequency: "daily" | "weekly";
  category: string;
  difficulty: string;
  current_streak: number;
  longest_streak: number;
  last_completed_at: string | null;
  is_active: boolean;
  is_paused: boolean;
  completed_today: boolean;
}

function toHabitDTO(row: any): HabitDTO {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    frequency: row.frequency,
    category: row.category ?? "custom",
    difficulty: row.difficulty ?? "medium",
    current_streak: row.current_streak,
    longest_streak: row.longest_streak,
    last_completed_at: row.last_completed_at,
    is_active: row.is_active,
    is_paused: row.is_paused ?? false,
    completed_today: Boolean(row.last_completed_at && new Date(row.last_completed_at) >= startOfToday),
  };
}

export const listHabits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HabitDTO[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("habits")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(toHabitDTO);
  });

export const createHabit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateSchema.parse(d))
  .handler(async ({ data, context }): Promise<HabitDTO> => {
    const { supabase, userId } = context;

    // Free plan caps active custom habits. Existing habits are never removed.
    const tier = await getTier(supabase, userId);
    if (tier === "free") {
      const { count } = await supabase
        .from("habits")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_active", true);
      const limit = ENTITLEMENTS.free.custom_habits;
      if ((count ?? 0) >= limit) {
        throw new UpgradeRequiredError(
          "habit_limit",
          `You've reached your ${limit}-habit Free limit. Upgrade to Pro to create unlimited habits.`,
        );
      }
    }

    const { data: row, error } = await supabase
      .from("habits")
      .insert({
        user_id: userId,
        title: data.title,
        description: data.description ?? null,
        frequency: data.frequency,
        category: data.category,
        difficulty: data.difficulty,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toHabitDTO(row);
  });

export const updateHabit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UpdateSchema.parse(d))
  .handler(async ({ data, context }): Promise<HabitDTO> => {
    const { supabase, userId } = context;
    const { id, ...rest } = data;
    const { data: row, error } = await supabase
      .from("habits")
      .update(rest)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw error;
    return toHabitDTO(row);
  });

export const deleteHabit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => IdSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("habits")
      .update({ is_active: false })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });

export interface CompleteHabitResult {
  habit: HabitDTO;
  pet: {
    id: string;
    pet_name: string;
    pet_stage: "egg" | "baby" | "child" | "adult";
    health_points: number;
    happiness_points: number;
    energy_points: number;
    current_level: number;
    total_experience_points: number;
    xp_into_level: number;
    xp_to_next: number;
    levels_gained: number;
    xp_gained: number;
    happiness_gained: number;
    coins_gained: number;
  };
  newAchievements: { code: string; title: string; badge: string }[];
}

function streakBonusCoins(streak: number): number {
  if (streak === 100) return 1000;
  if (streak === 30) return 250;
  if (streak === 7) return 50;
  return 0;
}

export const completeHabit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => IdSchema.parse(d))
  .handler(async ({ data, context }): Promise<CompleteHabitResult> => {
    const { supabase, userId } = context;

    const { data: habit, error: hErr } = await supabase
      .from("habits")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (hErr) throw hErr;
    if (!habit) throw new Error("Habit not found");

    const last = habit.last_completed_at ? new Date(habit.last_completed_at) : null;
    const { newStreak, alreadyCompletedToday } = nextStreak(last);

    let petRow: any = (await supabase.from("pets").select("*").eq("user_id", userId).maybeSingle()).data;
    if (!petRow) {
      petRow = (await supabase.from("pets").insert({ user_id: userId }).select("*").single()).data;
    }

    let updatedHabit = habit;
    let xpGain = 0;
    let happyGain = 0;
    let coinsGain = 0;
    let levelsGained = 0;
    const newAchievements: { code: string; title: string; badge: string }[] = [];

    if (!alreadyCompletedToday) {
      const finalStreak = newStreak === -1 ? habit.current_streak + 1 : newStreak;
      const longest = Math.max(habit.longest_streak, finalStreak);
      const { data: hUpdated, error: huErr } = await supabase
        .from("habits")
        .update({
          current_streak: finalStreak,
          longest_streak: longest,
          last_completed_at: new Date().toISOString(),
        })
        .eq("id", habit.id)
        .eq("user_id", userId)
        .select("*")
        .single();
      if (huErr) throw huErr;
      updatedHabit = hUpdated;

      // Log completion row (one per day)
      const today = new Date().toISOString().slice(0, 10);
      await supabase
        .from("habit_completions")
        .insert({ user_id: userId, habit_id: habit.id, completion_date: today });

      // Pet rewards
      const reward = habitCompletionReward(finalStreak);
      xpGain = reward.xp;
      happyGain = reward.happiness;
      coinsGain = 10 + streakBonusCoins(finalStreak);

      const newHappy = clamp(petRow.happiness_points + happyGain, 0, 100);
      const newEnergy = clamp((petRow.energy_points ?? 100) + 5, 0, 100);
      const xpResult = applyXpGain(petRow.current_level, petRow.total_experience_points, xpGain);
      levelsGained = xpResult.levelsGained;

      const { data: pUpdated, error: puErr } = await supabase
        .from("pets")
        .update({
          happiness_points: newHappy,
          energy_points: newEnergy,
          total_experience_points: xpResult.newTotalXp,
          current_level: xpResult.newLevel,
          pet_stage: stageForLevel(xpResult.newLevel),
        })
        .eq("user_id", userId)
        .select("*")
        .single();
      if (puErr) throw puErr;
      petRow = pUpdated;

      // Update profile totals
      let prof = (await supabase.from("profiles").select("*").eq("id", userId).maybeSingle()).data;
      if (!prof) {
        prof = (await supabase.from("profiles").insert({ id: userId }).select("*").single()).data;
      }
      const profSafe = prof as any;
      const newTotals = {
        coins: (profSafe?.coins ?? 0) + coinsGain,
        total_coins_earned: (profSafe?.total_coins_earned ?? 0) + coinsGain,
        total_xp_earned: (profSafe?.total_xp_earned ?? 0) + xpGain,
        total_habits_completed: (profSafe?.total_habits_completed ?? 0) + 1,
      };
      await supabase.from("profiles").update(newTotals).eq("id", userId);

      await supabase.from("coin_transactions").insert({
        user_id: userId,
        amount: coinsGain,
        reason: `Completed: ${habit.title}`,
      });

      // Activity feed
      await supabase.from("activity_feed").insert({
        user_id: userId,
        kind: "habit_completed",
        payload: { title: habit.title, streak: finalStreak, coins: coinsGain },
      });
      if (levelsGained > 0) {
        await supabase.from("activity_feed").insert({
          user_id: userId,
          kind: "level_up",
          payload: { level: xpResult.newLevel, stage: stageForLevel(xpResult.newLevel) },
        });
      }

      // Achievement evaluation
      const metrics: Record<string, number> = {
        habits_completed: newTotals.total_habits_completed,
        longest_streak: longest,
        pet_level: xpResult.newLevel,
        total_coins_earned: newTotals.total_coins_earned,
      };
      const { data: allAch } = await supabase.from("achievements").select("*");
      const { data: ownedAch } = await supabase
        .from("user_achievements")
        .select("achievement_id")
        .eq("user_id", userId);
      const ownedIds = new Set((ownedAch ?? []).map((r: any) => r.achievement_id));
      for (const a of allAch ?? []) {
        if (ownedIds.has(a.id)) continue;
        const val = metrics[a.metric] ?? 0;
        if (val >= a.threshold) {
          const ins = await supabase
            .from("user_achievements")
            .insert({ user_id: userId, achievement_id: a.id });
          if (!ins.error) {
            newAchievements.push({ code: a.code, title: a.title, badge: a.badge });
            await supabase.from("activity_feed").insert({
              user_id: userId,
              kind: "achievement",
              payload: { code: a.code, title: a.title, badge: a.badge },
            });
          }
        }
      }
    }

    const calc = applyXpGain(petRow.current_level, petRow.total_experience_points, 0);
    return {
      habit: toHabitDTO(updatedHabit),
      pet: {
        id: petRow.id,
        pet_name: petRow.pet_name,
        pet_stage: stageForLevel(petRow.current_level),
        health_points: petRow.health_points,
        happiness_points: petRow.happiness_points,
        energy_points: petRow.energy_points ?? 100,
        current_level: petRow.current_level,
        total_experience_points: petRow.total_experience_points,
        xp_into_level: calc.xpIntoLevel,
        xp_to_next: xpNeededForLevel(petRow.current_level),
        levels_gained: levelsGained,
        xp_gained: xpGain,
        happiness_gained: happyGain,
        coins_gained: coinsGain,
      },
      newAchievements,
    };
  });
