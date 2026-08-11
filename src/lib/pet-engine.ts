/**
 * Pure functions for the Tamagotchi state engine.
 * Used by server functions (no Supabase/runtime deps here).
 */

export type PetStage = "egg" | "baby" | "child" | "adult";

export const BASE_DECAY = 10;
export const DECAY_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
export const HABIT_XP = 15;
export const HABIT_HAPPINESS = 10;
export const STREAK_MULTIPLIER_THRESHOLD = 5;
export const STREAK_MULTIPLIER = 1.2;

export function stageForLevel(level: number): PetStage {
  if (level >= 16) return "adult";
  if (level >= 8) return "child";
  if (level >= 4) return "baby";
  return "egg";
}

export function xpNeededForLevel(level: number): number {
  // Spec: XP_Needed = Current_Level * 100 * 1.5
  return Math.round(level * 100 * 1.5);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Apply XP gain, cascading level-ups while XP overflow remains.
 * Returns the new level, remaining XP within current level,
 * total XP, and number of levels gained.
 */
export function applyXpGain(
  currentLevel: number,
  totalXp: number,
  gainedXp: number,
) {
  let level = Math.max(1, currentLevel);
  let total = Math.max(0, totalXp) + Math.max(0, gainedXp);

  // XP needed to leave each level; we track cumulative threshold.
  // Interpretation: a level requires xpNeededForLevel(level) XP earned while at that level.
  // We model total_experience_points as cumulative and compute level by draining.
  let consumed = 0;
  // recompute consumed from baseline level=1 if drifted
  for (let l = 1; l < level; l++) consumed += xpNeededForLevel(l);

  let levelsGained = 0;
  while (total - consumed >= xpNeededForLevel(level)) {
    consumed += xpNeededForLevel(level);
    level += 1;
    levelsGained += 1;
  }

  const xpIntoLevel = total - consumed;
  const xpToNext = xpNeededForLevel(level);
  return {
    newLevel: level,
    newTotalXp: total,
    xpIntoLevel,
    xpToNext,
    levelsGained,
  };
}

/**
 * Reward applied when a habit is completed.
 * Streak multiplier (1.2x) kicks in once the new streak exceeds threshold.
 */
export function habitCompletionReward(newStreak: number) {
  const multiplier = newStreak > STREAK_MULTIPLIER_THRESHOLD ? STREAK_MULTIPLIER : 1;
  return {
    xp: Math.round(HABIT_XP * multiplier),
    happiness: Math.round(HABIT_HAPPINESS * multiplier),
    multiplier,
  };
}

/**
 * Compute decay since last_decay_checked_at.
 * Decay accrues per 24h tick based on the ratio of uncompleted active habits.
 */
export function computeDecay(args: {
  activeHabits: number;
  completedHabits: number;
  lastCheckedAt: Date;
  now?: Date;
}) {
  const now = args.now ?? new Date();
  const elapsed = now.getTime() - args.lastCheckedAt.getTime();
  const ticks = Math.floor(elapsed / DECAY_INTERVAL_MS);
  if (ticks <= 0 || args.activeHabits <= 0) {
    return { healthDecay: 0, happinessDecay: 0, ticks: 0 };
  }
  const uncompletedRatio = (args.activeHabits - args.completedHabits) / args.activeHabits;
  if (uncompletedRatio <= 0) return { healthDecay: 0, happinessDecay: 0, ticks };
  const healthDecay = Math.round(BASE_DECAY * uncompletedRatio * 1.5 * ticks);
  const happinessDecay = Math.round(BASE_DECAY * uncompletedRatio * 1.2 * ticks);
  return { healthDecay, happinessDecay, ticks };
}

/**
 * Determine the new streak value for a completion.
 * - If never completed → 1
 * - If completed today already → unchanged (caller can no-op)
 * - If completed yesterday → +1
 * - Otherwise → reset to 1
 */
export function nextStreak(
  lastCompletedAt: Date | null,
  now: Date = new Date(),
): { newStreak: number; alreadyCompletedToday: boolean } {
  if (!lastCompletedAt) return { newStreak: 1, alreadyCompletedToday: false };
  const dayMs = 24 * 60 * 60 * 1000;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const last = startOfDay(lastCompletedAt);
  const today = startOfDay(now);
  if (last === today) return { newStreak: 0, alreadyCompletedToday: true };
  if (today - last === dayMs) return { newStreak: -1, alreadyCompletedToday: false }; // sentinel → caller adds
  return { newStreak: 1, alreadyCompletedToday: false };
}
