import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.is_admin) throw new Error("Forbidden — admin only");
}

export interface AdminOverview {
  totalUsers: number;
  totalHabits: number;
  totalCompletions: number;
  totalPremium: number;
  recentUsers: {
    id: string;
    username: string | null;
    coins: number;
    total_habits_completed: number;
    is_premium: boolean;
    is_admin: boolean;
    created_at: string;
  }[];
}

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminOverview> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    // Caller is verified admin — use privileged client for cross-user reads.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [profilesC, habitsC, completionsC, premiumC, recent] = await Promise.all([
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("habits").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("habit_completions").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).eq("is_premium", true),
      supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: false }).limit(20),
    ]);

    return {
      totalUsers: profilesC.count ?? 0,
      totalHabits: habitsC.count ?? 0,
      totalCompletions: completionsC.count ?? 0,
      totalPremium: premiumC.count ?? 0,
      recentUsers: (recent.data ?? []) as any,
    };
  });
