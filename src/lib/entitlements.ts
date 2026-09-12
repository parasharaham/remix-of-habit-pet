/**
 * Centralised subscription entitlement system.
 *
 * Every Free/Pro decision in the app funnels through this module — never
 * scatter ad-hoc `isPremium` checks in components. The values here are mirrored
 * on the server (see `subscription-guard.ts`), which is the source of truth.
 */

export type PlanTier = "free" | "pro";

export type SubscriptionStatus =
  | "free"
  | "pro_active"
  | "pro_cancelled"
  | "pro_expired"
  | "payment_failed"
  | "trial";

export type BillingInterval = "monthly" | "yearly";

/** Derived from the central 5-plan catalogue — see src/lib/plans.ts. */
export const PRICING = {
  weekly: { amount: 2.99, label: "$2.99", suffix: "/7 days" },
  special38: { amount: 9.99, label: "$9.99", suffix: "/38 days" },
  monthly: { amount: 7.99, label: "$7.99", suffix: "/month" },
  yearly: { amount: 64.99, label: "$64.99", suffix: "/year" },
} as const;

/** $64.99 / 12 → effective monthly price on the yearly plan. */
export const YEARLY_PER_MONTH = Math.round((PRICING.yearly.amount / 12) * 100) / 100;
/** Real saving vs. paying $7.99 × 12. */
export const YEARLY_SAVING_USD =
  Math.round((PRICING.monthly.amount * 12 - PRICING.yearly.amount) * 100) / 100; // 30.89
export const YEARLY_SAVING_PERCENT = Math.round(
  (YEARLY_SAVING_USD / (PRICING.monthly.amount * 12)) * 100,
);

export const UNLIMITED = Number.POSITIVE_INFINITY;

export interface Entitlements {
  food_scans_per_day: number;
  custom_habits: number;
  advanced_analytics: boolean;
  analytics_history_days: number;
  unlimited_ai: boolean;
  ai_meal_plan: boolean;
  ai_workout_plan: boolean;
  ai_coach_full: boolean;
  premium_pet: boolean;
  full_history: boolean;
  advanced_achievements: boolean;
}

export const ENTITLEMENTS: Record<PlanTier, Entitlements> = {
  free: {
    food_scans_per_day: 3,
    custom_habits: 3,
    advanced_analytics: false,
    analytics_history_days: 7,
    unlimited_ai: false,
    ai_meal_plan: false,
    ai_workout_plan: false,
    ai_coach_full: false,
    premium_pet: false,
    full_history: false,
    advanced_achievements: false,
  },
  pro: {
    food_scans_per_day: UNLIMITED,
    custom_habits: UNLIMITED,
    advanced_analytics: true,
    analytics_history_days: 365,
    unlimited_ai: true,
    ai_meal_plan: true,
    ai_workout_plan: true,
    ai_coach_full: true,
    premium_pet: true,
    full_history: true,
    advanced_achievements: true,
  },
};

export type FeatureKey =
  | "food_scan"
  | "custom_habit"
  | "advanced_analytics"
  | "ai_meal_plan"
  | "ai_workout_plan"
  | "ai_coach"
  | "premium_pet"
  | "full_history";

export interface FeatureUsage {
  /** AI scans already used today (local date). */
  scans_today?: number;
  /** Active custom habits the user currently has. */
  habit_count?: number;
}

export interface FeatureVerdict {
  allowed: boolean;
  limit?: number;
  used?: number;
  remaining?: number;
  source: UpgradeSource;
  reason?: string;
}

/** Pro access statuses — cancelled subs keep access until the period ends. */
export function isProStatus(status: SubscriptionStatus): boolean {
  return status === "pro_active" || status === "pro_cancelled" || status === "trial";
}

export function tierForStatus(status: SubscriptionStatus): PlanTier {
  return isProStatus(status) ? "pro" : "free";
}

export function entitlementsFor(tier: PlanTier): Entitlements {
  return ENTITLEMENTS[tier];
}

export function canUseFeature(
  tier: PlanTier,
  feature: FeatureKey,
  usage: FeatureUsage = {},
): FeatureVerdict {
  const ent = ENTITLEMENTS[tier];
  switch (feature) {
    case "food_scan": {
      const limit = ent.food_scans_per_day;
      const used = usage.scans_today ?? 0;
      if (limit === UNLIMITED) return { allowed: true, source: "food_scan_limit" };
      return {
        allowed: used < limit,
        limit,
        used,
        remaining: Math.max(0, limit - used),
        source: "food_scan_limit",
        reason: used >= limit ? `You've used all ${limit} free scans for today.` : undefined,
      };
    }
    case "custom_habit": {
      const limit = ent.custom_habits;
      const used = usage.habit_count ?? 0;
      if (limit === UNLIMITED) return { allowed: true, source: "habit_limit" };
      return {
        allowed: used < limit,
        limit,
        used,
        remaining: Math.max(0, limit - used),
        source: "habit_limit",
        reason: used >= limit ? `You've reached your ${limit}-habit Free limit.` : undefined,
      };
    }
    case "advanced_analytics":
      return { allowed: ent.advanced_analytics, source: "analytics" };
    case "ai_meal_plan":
      return { allowed: ent.ai_meal_plan, source: "ai_meal_plan" };
    case "ai_workout_plan":
      return { allowed: ent.ai_workout_plan, source: "ai_workout" };
    case "ai_coach":
      return { allowed: ent.ai_coach_full, source: "ai_coach" };
    case "premium_pet":
      return { allowed: ent.premium_pet, source: "premium_pet" };
    case "full_history":
      return { allowed: ent.full_history, source: "analytics" };
    default:
      return { allowed: false, source: "dashboard" };
  }
}

export type UpgradeSource =
  | "food_scan_limit"
  | "habit_limit"
  | "analytics"
  | "ai_meal_plan"
  | "ai_workout"
  | "ai_coach"
  | "premium_pet"
  | "onboarding"
  | "session"
  | "dashboard"
  | "pricing";

export const UPGRADE_COPY: Record<UpgradeSource, { title: string; subtitle: string }> = {
  food_scan_limit: {
    title: "Want unlimited food scans?",
    subtitle: "Pro removes the 3-a-day limit so you can scan every meal, every day.",
  },
  habit_limit: {
    title: "Ready for unlimited habits?",
    subtitle: "Free keeps 3 custom habits. Pro lets you build as many routines as you like.",
  },
  analytics: {
    title: "Unlock your full nutrition story.",
    subtitle: "Longer history, detailed trends and goal comparisons across every meal you log.",
  },
  ai_meal_plan: {
    title: "Unlock personalized AI meal planning.",
    subtitle: "Plans built around your profile, allergies, preferences and calorie targets.",
  },
  ai_workout: {
    title: "Unlock personalized AI workouts.",
    subtitle: "Training built around your goals, equipment, experience and available time.",
  },
  ai_coach: {
    title: "Unlock the full AI Coach.",
    subtitle: "Weekly reviews, progress analysis and recommendations from your real data.",
  },
  premium_pet: {
    title: "Give your pet the premium treatment.",
    subtitle: "Extra reactions, celebrations and customisation for your companion.",
  },
  onboarding: {
    title: "Meet HabitPet Pro",
    subtitle:
      "Unlock unlimited scans, unlimited habits, personalized plans, advanced analytics and more.",
  },
  session: {
    title: "Enjoying HabitPet?",
    subtitle: "Pro takes your journey further with unlimited scans, habits and personalized plans.",
  },
  dashboard: {
    title: "🐾 HabitPet Pro",
    subtitle: "Take your journey further.",
  },
  pricing: {
    title: "🐾 HabitPet Pro",
    subtitle: "Unlock the full HabitPet experience.",
  },
};

export const PRO_FEATURE_LIST = [
  "Unlimited food scans",
  "Unlimited habits",
  "Personalized AI meal plans",
  "Personalized AI workout plans",
  "Advanced nutrition analytics",
  "Full AI Coach",
  "Premium pet features",
] as const;

export const COMPARISON: Array<{ feature: string; free: string; pro: string }> = [
  { feature: "Food scans", free: "3 / day", pro: "Unlimited" },
  { feature: "Custom habits", free: "3", pro: "Unlimited" },
  { feature: "AI food analysis", free: "Limited", pro: "Unlimited" },
  { feature: "Meal planner", free: "Basic", pro: "Personalized" },
  { feature: "Workout planner", free: "Basic", pro: "Personalized" },
  { feature: "AI Coach", free: "Limited", pro: "Full" },
  { feature: "Nutrition analytics", free: "Basic", pro: "Advanced" },
  { feature: "Meal history", free: "Basic", pro: "Full" },
  { feature: "Workout history", free: "Basic", pro: "Full" },
  { feature: "Pet features", free: "Basic", pro: "Full" },
  { feature: "Achievements", free: "Basic", pro: "Advanced" },
  { feature: "Premium features", free: "No", pro: "Yes" },
];

export function statusLabel(status: SubscriptionStatus): string {
  switch (status) {
    case "pro_active":
      return "Pro — active";
    case "pro_cancelled":
      return "Pro — canceled, active until period end";
    case "pro_expired":
      return "Pro expired";
    case "payment_failed":
      return "Payment failed";
    case "trial":
      return "Pro trial";
    default:
      return "Free";
  }
}

/** Local (device timezone) YYYY-MM-DD — free scan quota resets at local midnight. */
export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}
