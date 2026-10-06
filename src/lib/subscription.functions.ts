import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  consumeScan,
  getScanQuota,
  legacyStatusFor,
  resolveSubscription,
  safeLocalDate,
} from "./subscription-guard";
import type { BillingInterval, PlanTier, SubscriptionStatus } from "./entitlements";
import { PLAN_CATALOG, periodEndFor, type PlanCode, type PlanState } from "./plans";

export interface SubscriptionDTO {
  id: string;
  tier: PlanTier;
  plan_code: PlanCode;
  plan_state: PlanState;
  one_time: boolean;
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

const PlanCodeSchema = z.enum([
  "MONTHLY_PRO",
  "YEARLY_PRO",
]);

async function buildDTO(
  supabase: any,
  userId: string,
  localDate: string,
): Promise<SubscriptionDTO> {
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
    plan_code: sub.plan_code,
    plan_state: sub.plan_state,
    one_time: Boolean(sub.one_time ?? PLAN_CATALOG[sub.plan_code].oneTime),
    status: sub.status,
    billing_interval: (sub.billing_interval as BillingInterval) ?? "monthly",
    current_period_start: sub.current_period_start,
    current_period_end: sub.current_period_end,
    cancel_at_period_end: Boolean(sub.cancel_at_period_end),
    paddle_subscription_id: sub.paddle_subscription_id,
    scans_today: quota.used,
    habit_count: count ?? 0,
  };
}

export const getSubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ContextSchema.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<SubscriptionDTO> =>
    buildDTO(context.supabase, context.userId, safeLocalDate(data.local_date)),
  );

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

export interface CheckoutHandoff {
  plan_code: PlanCode;
  /** True only when a real provider price id is configured for this plan. */
  configured: boolean;
  price_id: string | null;
  message: string;
}

/**
 * Checkout hand-off. Returns the configured provider price id for the plan, or
 * reports that billing is not configured yet. Pro is NEVER granted here — only
 * a verified provider webhook / server-side purchase verification may do that.
 */
export const startPlanCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ plan_code: PlanCodeSchema }).parse(d))
  .handler(async ({ data }): Promise<CheckoutHandoff> => {
    const { priceIdFor } = await import("./billing.server");
    const priceId = priceIdFor(data.plan_code);
    return {
      plan_code: data.plan_code,
      configured: Boolean(priceId),
      price_id: priceId,
      message: priceId
        ? "Checkout ready."
        : `${PLAN_CATALOG[data.plan_code].name} is not connected to a payment provider yet.`,
    };
  });

/**
 * TEMPORARY activation path used until a payment provider is connected.
 * Once checkout is live, activation happens exclusively through the verified
 * webhook (`/api/public/webhooks/paddle`) or Play purchase verification.
 */
export const activatePlanSandbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ plan_code: PlanCodeSchema }).parse(d))
  .handler(async ({ data, context }): Promise<SubscriptionDTO> => {
    const { supabase, userId } = context;
    await resolveSubscription(supabase, userId);
    const def = PLAN_CATALOG[data.plan_code];
    const start = new Date();
    const end = periodEndFor(data.plan_code, start);
    const state: PlanState = "ACTIVE";

    const { error } = await supabase
      .from("subscriptions")
      .update({
        plan: "premium",
        status: legacyStatusFor(data.plan_code, state),
        plan_code: data.plan_code,
        plan_state: state,
        one_time: def.oneTime,
        billing_interval: data.plan_code === "YEARLY_PRO" ? "yearly" : "monthly",
        current_period_start: start.toISOString(),
        current_period_end: end ? end.toISOString() : null,
        cancel_at_period_end: def.oneTime,
      })
      .eq("user_id", userId);
    if (error) throw error;
    await supabase.from("profiles").update({ is_premium: true }).eq("id", userId);

    return buildDTO(supabase, userId, safeLocalDate());
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
      .update({
        status: "pro_cancelled",
        plan_state: "CANCELLED",
        cancel_at_period_end: true,
      })
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });
