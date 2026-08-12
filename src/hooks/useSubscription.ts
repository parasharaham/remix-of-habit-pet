import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useMemo } from "react";
import { getSubscription, type SubscriptionDTO } from "@/lib/subscription.functions";
import {
  canUseFeature,
  entitlementsFor,
  localDateString,
  type FeatureKey,
  type FeatureVerdict,
  type PlanTier,
  type SubscriptionStatus,
} from "@/lib/entitlements";

export const SUBSCRIPTION_QUERY_KEY = ["subscription"] as const;

export interface SubscriptionState {
  loading: boolean;
  data: SubscriptionDTO | null;
  tier: PlanTier;
  isPro: boolean;
  status: SubscriptionStatus;
  entitlements: ReturnType<typeof entitlementsFor>;
  can: (feature: FeatureKey) => FeatureVerdict;
  scansUsed: number;
  scansRemaining: number | null;
  habitCount: number;
  daysUntilRenewal: number | null;
  refresh: () => void;
}

/**
 * Single source of subscription state for the whole UI. Backed by one shared
 * React Query cache entry, so mounting it in many components does not create
 * duplicate requests.
 */
export function useSubscription(enabled = true): SubscriptionState {
  const qc = useQueryClient();
  const fetchSub = useServerFn(getSubscription);

  const query = useQuery({
    queryKey: SUBSCRIPTION_QUERY_KEY,
    queryFn: () => fetchSub({ data: { local_date: localDateString() } }),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
  }, [qc]);

  return useMemo(() => {
    const data = query.data ?? null;
    const tier: PlanTier = data?.tier ?? "free";
    const ent = entitlementsFor(tier);
    const scansUsed = data?.scans_today ?? 0;
    const habitCount = data?.habit_count ?? 0;
    const scansRemaining =
      tier === "pro" ? null : Math.max(0, ent.food_scans_per_day - scansUsed);

    let daysUntilRenewal: number | null = null;
    if (data?.current_period_end) {
      const ms = new Date(data.current_period_end).getTime() - Date.now();
      daysUntilRenewal = Math.ceil(ms / 86_400_000);
    }

    return {
      loading: query.isLoading,
      data,
      tier,
      isPro: tier === "pro",
      status: data?.status ?? "free",
      entitlements: ent,
      can: (feature: FeatureKey) =>
        canUseFeature(tier, feature, { scans_today: scansUsed, habit_count: habitCount }),
      scansUsed,
      scansRemaining,
      habitCount,
      daysUntilRenewal,
      refresh,
    };
  }, [query.data, query.isLoading, refresh]);
}
