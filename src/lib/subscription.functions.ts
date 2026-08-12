import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  consumeScan,
  getScanQuota,
  resolveSubscription,
  safeLocalDate,
} from "./subscription-guard";
import type { BillingInterval, PlanTier, SubscriptionStatus } from "./entitlements";

export interface SubscriptionDTO {
  id: string;
  tier: PlanTier;
  status: SubscriptionStatus;
  billing_interval: BillingInterval;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  paddle_subscription_id: string | null;
  /** AI scans already used today, in the caller's local date. */
  scans_today: number;
  /** Active custom habits the user currently owns. */
  habit_count: number;
}

const ContextSchema = z.object({ local_date: z.string().optional() });

export const getSubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ContextSchema.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<SubscriptionDTO> => {
    const { supabase, userId } = context;
    const localDate = safeLocalDate(data.local_date);
    const sub = await resolveSubscription(supabase, userId);
    const quota = await getScanQuota(supabase, userId, localDate);
    const { count } = await supabase
      .from("habits")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_active", true);

    return {
      id: sub.id,
      tier: sub.tier,
      status: sub.status,
      billing_interval: (sub.billing_interval as BillingInterval) ?? "monthly",
      current_period_start: sub.current_period_start,
      current_period_end: sub.current_period_end,
      cancel_at_period_end: Boolean(sub.cancel_at_period_end),
      paddle_subscription_id: sub.paddle_subscription_id,
      scans_today: quota.used,
      habit_count: count ?? 0,
    };
  });

export const getScanQuotaFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ContextSchema.parse(d ?? {}))
  .handler(async ({ data, context }) =>
    getScanQuota(context.supabase, context.userId, safeLocalDate(data.local_date)),
  );

/** Internal helper shared by the scan flow (kept here so tests can reuse it). */
export const consumeScanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ContextSchema.parse(d ?? {}))
  .handler(async ({ data, context }) =>
    consumeScan(context.supabase, context.userId, safeLocalDate(data.local_date)),
  );

const ActivateSchema = z.object({
  interval: z.enum(["monthly", "yearly"]),
});

/**
 * TEMPORARY activation path used until Paddle checkout is wired in.
 * Once Paddle is enabled, activation happens exclusively through the verified
 * webhook (`/api/public/webhooks/paddle`) — this function is then removed.
 */
export const activateProSandbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ActivateSchema.parse(d))
  .handler(async ({ data, context }): Promise<SubscriptionDTO> => {
    const { supabase, userId } = context;
    await resolveSubscription(supabase, userId);
    const start = new Date();
    const end = new Date(start);
    if (data.interval === "yearly") end.setFullYear(end.getFullYear() + 1);
    else end.setMonth(end.getMonth() + 1);

    const { data: row, error } = await supabase
      .from("subscriptions")
      .update({
        plan: "premium",
        status: "pro_active",
        billing_interval: data.interval,
        current_period_start: start.toISOString(),
        current_period_end: end.toISOString(),
        cancel_at_period_end: false,
      })
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw error;
    await supabase.from("profiles").update({ is_premium: true }).eq("id", userId);

    const quota = await getScanQuota(supabase, userId, safeLocalDate());
    const { count } = await supabase
      .from("habits")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_active", true);

    return {
      id: row.id,
      tier: "pro",
      status: "pro_active",
      billing_interval: data.interval,
      current_period_start: row.current_period_start,
      current_period_end: row.current_period_end,
      cancel_at_period_end: false,
      paddle_subscription_id: row.paddle_subscription_id ?? null,
      scans_today: quota.used,
      habit_count: count ?? 0,
    };
  });

/** Cancels at period end — access is preserved until `current_period_end`. */
export const cancelPro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const sub = await resolveSubscription(supabase, userId);
    if (sub.tier !== "pro") return { ok: true };
    const { error } = await supabase
      .from("subscriptions")
      .update({ status: "pro_cancelled", cancel_at_period_end: true })
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });
