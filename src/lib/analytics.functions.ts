import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface AnalyticsDTO {
  consistencyScore: number; // 0..100
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  activeDays: number;
  missedDays: number;
  totalActiveHabits: number;
  weekly: { date: string; count: number }[]; // last 14 days
  monthly: { date: string; count: number }[]; // last 12 weeks
  xpGrowth: { date: string; cumulative: number }[];
  coinGrowth: { date: string; cumulative: number }[];
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const getAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AnalyticsDTO> => {
    const { supabase, userId } = context;

    const [habitsRes, compsRes, coinsRes] = await Promise.all([
      supabase.from("habits").select("current_streak, longest_streak, is_active").eq("user_id", userId),
      supabase
        .from("habit_completions")
        .select("completion_date, created_at")
        .eq("user_id", userId)
        .order("completion_date", { ascending: true }),
      supabase
        .from("coin_transactions")
        .select("amount, created_at, reason")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
    ]);

    const habits = habitsRes.data ?? [];
    const comps = compsRes.data ?? [];
    const coins = coinsRes.data ?? [];

    const activeHabits = habits.filter((h: any) => h.is_active);
    const longestStreak = habits.reduce((m: number, h: any) => Math.max(m, h.longest_streak ?? 0), 0);
    const currentStreak = activeHabits.reduce((m: number, h: any) => Math.max(m, h.current_streak ?? 0), 0);

    // Per-day completion counts
    const byDay = new Map<string, number>();
    for (const c of comps as any[]) {
      const k = c.completion_date;
      byDay.set(k, (byDay.get(k) ?? 0) + 1);
    }

    // Last 14 days
    const weekly: { date: string; count: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      weekly.push({ date: dayKey(d), count: byDay.get(dayKey(d)) ?? 0 });
    }

    // Last 12 weeks rolled
    const monthly: { date: string; count: number }[] = [];
    for (let w = 11; w >= 0; w--) {
      const start = new Date(today);
      start.setDate(today.getDate() - w * 7);
      let total = 0;
      for (let d = 0; d < 7; d++) {
        const dt = new Date(start);
        dt.setDate(start.getDate() + d);
        total += byDay.get(dayKey(dt)) ?? 0;
      }
      monthly.push({ date: dayKey(start), count: total });
    }

    // XP/coin growth (cumulative over time, last 30 days)
    const xpGrowth: { date: string; cumulative: number }[] = [];
    const coinGrowth: { date: string; cumulative: number }[] = [];
    let xpCum = 0;
    let coinCum = 0;
    const coinsByDay = new Map<string, number>();
    for (const t of coins as any[]) {
      const k = new Date(t.created_at).toISOString().slice(0, 10);
      coinsByDay.set(k, (coinsByDay.get(k) ?? 0) + t.amount);
    }
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const k = dayKey(d);
      xpCum += (byDay.get(k) ?? 0) * 15;
      coinCum += coinsByDay.get(k) ?? 0;
      xpGrowth.push({ date: k, cumulative: xpCum });
      coinGrowth.push({ date: k, cumulative: Math.max(0, coinCum) });
    }

    const totalCompletions = comps.length;
    const distinctDays = new Set((comps as any[]).map((c) => c.completion_date));
    const activeDays = distinctDays.size;

    // Missed days: days in the last 30 with active habits but no completion
    const daysWindow = 30;
    let missed = 0;
    for (let i = 0; i < daysWindow; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const k = dayKey(d);
      if (!distinctDays.has(k) && activeHabits.length > 0) missed++;
    }

    const last30Completed = weekly.length
      ? Math.min(30, daysWindow) - missed
      : 0;
    const consistencyScore = Math.round(
      activeHabits.length === 0 ? 0 : (last30Completed / daysWindow) * 100,
    );

    return {
      consistencyScore,
      currentStreak,
      longestStreak,
      totalCompletions,
      activeDays,
      missedDays: missed,
      totalActiveHabits: activeHabits.length,
      weekly,
      monthly,
      xpGrowth,
      coinGrowth,
    };
  });
