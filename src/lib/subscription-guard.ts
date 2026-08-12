import {
  ENTITLEMENTS,
  canUseFeature,
  isProStatus,
  tierForStatus,
  type FeatureKey,
  type PlanTier,
  type SubscriptionStatus,
} from "./entitlements";

/**
 * Server-side entitlement resolution. The database is the ONLY source of
 * truth for paid access — never trust a client flag.
 */

export interface SubscriptionRow {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  billing_interval: string | null;
  paddle_customer_id: string | null;
  paddle_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
}

const VALID_STATUSES: SubscriptionStatus[] = [
  "free",
  "pro_active",
  "pro_cancelled",
  "pro_expired",
  "payment_failed",
  "trial",
];

function normalizeStatus(row: SubscriptionRow): SubscriptionStatus {
  const raw = (row.status ?? "free").toLowerCase();
  // Legacy rows used plan=premium / status=active|inactive|canceled.
  if (VALID_STATUSES.includes(raw as SubscriptionStatus)) return raw as SubscriptionStatus;
  if (row.plan === "premium" && raw === "active") return "pro_active";
  if (row.plan === "premium" && raw === "canceled") return "pro_cancelled";
  return "free";
}

/** Ensures a subscription row exists and applies period-expiry transitions. */
export async function resolveSubscription(
  supabase: any,
  userId: string,
): Promise<SubscriptionRow & { status: SubscriptionStatus; tier: PlanTier }> {
  let { data: row } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row) {
    const created = await supabase
      .from("subscriptions")
      .insert({ user_id: userId, plan: "free", status: "free" })
      .select("*")
      .single();
    if (created.error) throw created.error;
    row = created.data;
  }

  let status = normalizeStatus(row as SubscriptionRow);

  // Expire Pro once the paid period has actually elapsed. User data is never
  // touched — only access level changes.
  const periodEnd = row.current_period_end ? new Date(row.current_period_end).getTime() : null;
  if (isProStatus(status) && periodEnd !== null && periodEnd < Date.now()) {
    status = "pro_expired";
    await supabase
      .from("subscriptions")
      .update({ status, plan: "free" })
      .eq("user_id", userId);
    await supabase.from("profiles").update({ is_premium: false }).eq("id", userId);
    row = { ...row, status, plan: "free" };
  }

  if ((row.status ?? "") !== status) {
    await supabase.from("subscriptions").update({ status }).eq("user_id", userId);
  }

  return { ...(row as SubscriptionRow), status, tier: tierForStatus(status) };
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
