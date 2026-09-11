import {
  ENTITLEMENTS,
  canUseFeature,
  type FeatureKey,
  type PlanTier,
  type SubscriptionStatus,
} from "./entitlements";
import {
  PLAN_CATALOG,
  grantsPro,
  isPlanCode,
  isPlanState,
  type PlanCode,
  type PlanState,
} from "./plans";

/**
 * Server-side entitlement resolution. The database is the ONLY source of
 * truth for paid access — never trust a client flag.
 */

export interface SubscriptionRow {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  plan_code: string | null;
  plan_state: string | null;
  one_time: boolean | null;
  provider: string | null;
  provider_price_id: string | null;
  billing_interval: string | null;
  paddle_customer_id: string | null;
  paddle_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
}

export interface ResolvedSubscription extends SubscriptionRow {
  plan_code: PlanCode;
  plan_state: PlanState;
  status: SubscriptionStatus;
  tier: PlanTier;
}

/** Legacy status/plan rows → the 5-plan model. */
function normalizePlan(row: SubscriptionRow): { code: PlanCode; state: PlanState } {
  if (isPlanCode(row.plan_code) && isPlanState(row.plan_state)) {
    return { code: row.plan_code, state: row.plan_state };
  }
  const raw = (row.status ?? "free").toLowerCase();
  const paid = ["pro_active", "pro_cancelled", "trial", "active"].includes(raw);
  const code: PlanCode = paid
    ? row.billing_interval === "yearly"
      ? "YEARLY_PRO"
      : "MONTHLY_PRO"
    : "FREE";
  const state: PlanState =
    raw === "pro_cancelled" || raw === "canceled"
      ? "CANCELLED"
      : raw === "pro_expired"
        ? "EXPIRED"
        : raw === "payment_failed"
          ? "PAST_DUE"
          : "ACTIVE";
  return { code, state };
}

/** Legacy `status` column kept in sync so older code paths still read right. */
export function legacyStatusFor(code: PlanCode, state: PlanState): SubscriptionStatus {
  if (!PLAN_CATALOG[code].pro) return state === "EXPIRED" ? "pro_expired" : "free";
  switch (state) {
    case "CANCELLED":
      return "pro_cancelled";
    case "EXPIRED":
      return "pro_expired";
    case "PAST_DUE":
      return "payment_failed";
    case "PENDING":
      return "free";
    default:
      return "pro_active";
  }
}

/** Ensures a subscription row exists and applies period-expiry transitions. */
export async function resolveSubscription(
  supabase: any,
  userId: string,
): Promise<ResolvedSubscription> {
  let { data: row } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row) {
    const created = await supabase
      .from("subscriptions")
      .insert({ user_id: userId, plan: "free", status: "free", plan_code: "FREE", plan_state: "ACTIVE" })
      .select("*")
      .single();
    if (created.error) throw created.error;
    row = created.data;
  }

  let { code, state } = normalizePlan(row as SubscriptionRow);

  // Expire once the paid period has actually elapsed. One-time plans (the
  // 38-day special) always fall back to Free — they never renew. User data is
  // never touched, only access level.
  const periodEnd = row.current_period_end ? new Date(row.current_period_end).getTime() : null;
  if (PLAN_CATALOG[code].pro && periodEnd !== null && periodEnd < Date.now()) {
    code = "FREE";
    state = "EXPIRED";
  }

  const status = legacyStatusFor(code, state);
  const isPro = grantsPro(code, state);

  const changed =
    row.plan_code !== code ||
    row.plan_state !== state ||
    (row.status ?? "") !== status;

  if (changed) {
    await supabase
      .from("subscriptions")
      .update({ plan_code: code, plan_state: state, status, plan: isPro ? "premium" : "free" })
      .eq("user_id", userId);
    await supabase.from("profiles").update({ is_premium: isPro }).eq("id", userId);
    row = { ...row, plan_code: code, plan_state: state, status, plan: isPro ? "premium" : "free" };
  }

  return {
    ...(row as SubscriptionRow),
    plan_code: code,
    plan_state: state,
    status,
    tier: isPro ? "pro" : "free",
  };
}

export async function getTier(supabase: any, userId: string): Promise<PlanTier> {
  const sub = await resolveSubscription(supabase, userId);
  return sub.tier;
}

export class UpgradeRequiredError extends Error {
  constructor(
    public readonly source: string,
    message: string,
  ) {
    super(message);
    this.name = "UpgradeRequiredError";
  }
}

/** Throws when a Free user hits a Pro-only feature. */
export async function assertFeature(
  supabase: any,
  userId: string,
  feature: FeatureKey,
): Promise<PlanTier> {
  const tier = await getTier(supabase, userId);
  const verdict = canUseFeature(tier, feature);
  if (!verdict.allowed) {
    throw new UpgradeRequiredError(
      verdict.source,
      verdict.reason ?? "This feature is part of HabitPet Pro.",
    );
  }
  return tier;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function safeLocalDate(input?: string | null): string {
  if (input && DATE_RE.test(input)) return input;
  return new Date().toISOString().slice(0, 10);
}

export async function getScansUsed(
  supabase: any,
  userId: string,
  localDate: string,
): Promise<number> {
  const { data } = await supabase
    .from("scan_usage")
    .select("scan_count")
    .eq("user_id", userId)
    .eq("usage_date", localDate)
    .maybeSingle();
  return data?.scan_count ?? 0;
}

export interface ScanQuota {
  tier: PlanTier;
  unlimited: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
}

export async function getScanQuota(
  supabase: any,
  userId: string,
  localDate: string,
): Promise<ScanQuota> {
  const tier = await getTier(supabase, userId);
  const used = await getScansUsed(supabase, userId, localDate);
  if (tier === "pro") {
    return { tier, unlimited: true, limit: null, used, remaining: null };
  }
  const limit = ENTITLEMENTS.free.food_scans_per_day;
  return { tier, unlimited: false, limit, used, remaining: Math.max(0, limit - used) };
}

/**
 * Consumes one AI scan for the given local date. Throws before any AI call is
 * made when a Free user is out of scans.
 */
export async function consumeScan(
  supabase: any,
  userId: string,
  localDate: string,
): Promise<ScanQuota> {
  const quota = await getScanQuota(supabase, userId, localDate);
  if (!quota.unlimited && quota.remaining !== null && quota.remaining <= 0) {
    throw new UpgradeRequiredError(
      "food_scan_limit",
      `You've used all ${quota.limit} free scans for today. Upgrade to Pro for unlimited food scanning.`,
    );
  }

  const next = quota.used + 1;
  const { error } = await supabase
    .from("scan_usage")
    .upsert({ user_id: userId, usage_date: localDate, scan_count: next }, { onConflict: "user_id,usage_date" });
  if (error) throw error;

  return {
    ...quota,
    used: next,
    remaining: quota.unlimited || quota.limit === null ? null : Math.max(0, quota.limit - next),
  };
}
