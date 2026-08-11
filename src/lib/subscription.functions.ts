import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface SubscriptionDTO {
  id: string;
  plan: "free" | "premium";
  status: "active" | "inactive" | "canceled";
  current_period_end: string | null;
}

async function ensure(supabase: any, userId: string): Promise<SubscriptionDTO> {
  const existing = await supabase.from("subscriptions").select("*").eq("user_id", userId).maybeSingle();
  if (existing.data) return existing.data as SubscriptionDTO;
  const created = await supabase
    .from("subscriptions")
    .insert({ user_id: userId, plan: "free", status: "inactive" })
    .select("*")
    .single();
  if (created.error) throw created.error;
  return created.data as SubscriptionDTO;
}

export const getSubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SubscriptionDTO> => {
    return await ensure(context.supabase, context.userId);
  });

const PlanSchema = z.object({ plan: z.enum(["free", "premium"]) });

/**
 * STUB: real Stripe checkout will replace this. For now it directly toggles
 * the plan so the UI flow is testable end-to-end.
 */
export const mockChangePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => PlanSchema.parse(d))
  .handler(async ({ data, context }): Promise<SubscriptionDTO> => {
    const { supabase, userId } = context;
    await ensure(supabase, userId);
    const periodEnd =
      data.plan === "premium"
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : null;
    const { data: sub, error } = await supabase
      .from("subscriptions")
      .update({
        plan: data.plan,
        status: data.plan === "premium" ? "active" : "canceled",
        current_period_end: periodEnd,
      })
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw error;
    await supabase
      .from("profiles")
      .update({ is_premium: data.plan === "premium" })
      .eq("id", userId);
    return sub as SubscriptionDTO;
  });
