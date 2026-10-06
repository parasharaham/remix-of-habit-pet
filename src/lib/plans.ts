/**
 * Central plan catalogue — the single definition of HabitPet's 5 plans.
 *
 * Prices, durations and labels live here only. Server enforcement resolves a
 * user's `plan_code` + `plan_state` from the database (never a client flag).
 */

export type PlanCode =
  | "FREE"
  | "WEEKLY_PRO"
  | "SPECIAL_38_DAY"
  | "MONTHLY_PRO"
  | "YEARLY_PRO";

export type PlanState = "ACTIVE" | "CANCELLED" | "EXPIRED" | "PENDING" | "PAST_DUE";

export const PLAN_CODES: PlanCode[] = [
  "FREE",
  "WEEKLY_PRO",
  "SPECIAL_38_DAY",
  "MONTHLY_PRO",
  "YEARLY_PRO",
];

export interface PlanDef {
  code: PlanCode;
  name: string;
  /** Price in USD. */
  price: number;
  priceLabel: string;
  periodLabel: string;
  /** Access length in days; null for Free. */
  durationDays: number | null;
  /** Non-recurring plans expire straight back to Free. */
  recurring: boolean;
  oneTime: boolean;
  pro: boolean;
  badge?: string;
  description: string;
  cta: string;
}

export const PLAN_CATALOG: Record<PlanCode, PlanDef> = {
  FREE: {
    code: "FREE",
    name: "Free",
    price: 0,
    priceLabel: "$0",
    periodLabel: "forever",
    durationDays: null,
    recurring: false,
    oneTime: false,
    pro: false,
    description: "Start building habits with your pet.",
    cta: "Current plan",
  },
  WEEKLY_PRO: {
    code: "WEEKLY_PRO",
    name: "Weekly Pro",
    price: 2.99,
    priceLabel: "$2.99",
    periodLabel: "7 days",
    durationDays: 7,
    recurring: true,
    oneTime: false,
    pro: true,
    badge: "Easy Start",
    description: "Try the full HabitPet experience for one week.",
    cta: "Start Weekly Pro",
  },
  SPECIAL_38_DAY: {
    code: "SPECIAL_38_DAY",
    name: "38-Day Special",
    price: 9.99,
    priceLabel: "$9.99",
    periodLabel: "38 days",
    durationDays: 38,
    recurring: false,
    oneTime: true,
    pro: true,
    badge: "Special Offer",
    description: "35 paid days + 3 free days. One payment, no renewal.",
    cta: "Get 38-Day Pro",
  },
  MONTHLY_PRO: {
    code: "MONTHLY_PRO",
    name: "Monthly Pro",
    price: 7.99,
    priceLabel: "$7.99",
    periodLabel: "month",
    durationDays: 30,
    recurring: true,
    oneTime: false,
    pro: true,
    badge: "Most Popular",
    description: "Full Pro access with flexible monthly billing.",
    cta: "Start Monthly Pro",
  },
  YEARLY_PRO: {
    code: "YEARLY_PRO",
    name: "Yearly Pro",
    price: 64.99,
    priceLabel: "$64.99",
    periodLabel: "year",
    durationDays: 365,
    recurring: true,
    oneTime: false,
    pro: true,
    badge: "Best Value",
    description: "The complete HabitPet experience at the best price.",
    cta: "Start Yearly Pro",
  },
};

export const PAID_PLANS: PlanDef[] = [
  PLAN_CATALOG.MONTHLY_PRO,
  PLAN_CATALOG.YEARLY_PRO,
];

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** $7.99 × 12 − $64.99 = $30.89 — computed, never hardcoded. */
export const YEARLY_SAVING_USD = round2(
  PLAN_CATALOG.MONTHLY_PRO.price * 12 - PLAN_CATALOG.YEARLY_PRO.price,
);
export const YEARLY_SAVING_PERCENT = Math.round(
  (YEARLY_SAVING_USD / (PLAN_CATALOG.MONTHLY_PRO.price * 12)) * 100,
);
export const YEARLY_PER_MONTH_USD = round2(PLAN_CATALOG.YEARLY_PRO.price / 12);
export const SPECIAL_38_PAID_DAYS = 35;
export const SPECIAL_38_FREE_DAYS = 3;

export function isPlanCode(value: unknown): value is PlanCode {
  return typeof value === "string" && (PLAN_CODES as string[]).includes(value);
}

export function isPlanState(value: unknown): value is PlanState {
  return (
    typeof value === "string" &&
    ["ACTIVE", "CANCELLED", "EXPIRED", "PENDING", "PAST_DUE"].includes(value)
  );
}

export function planDef(code: PlanCode): PlanDef {
  return PLAN_CATALOG[code];
}

/** Cancelled plans keep access until the paid period ends. */
export function grantsPro(code: PlanCode, state: PlanState): boolean {
  return PLAN_CATALOG[code].pro && (state === "ACTIVE" || state === "CANCELLED");
}

export function planStateLabel(code: PlanCode, state: PlanState): string {
  if (code === "FREE") return state === "EXPIRED" ? "Pro expired — on Free" : "Free";
  switch (state) {
    case "ACTIVE":
      return `${PLAN_CATALOG[code].name} — active`;
    case "CANCELLED":
      return `${PLAN_CATALOG[code].name} — cancelled, active until period end`;
    case "EXPIRED":
      return `${PLAN_CATALOG[code].name} — expired`;
    case "PENDING":
      return `${PLAN_CATALOG[code].name} — payment pending`;
    case "PAST_DUE":
      return `${PLAN_CATALOG[code].name} — payment failed`;
    default:
      return PLAN_CATALOG[code].name;
  }
}

/** Access end date for a newly started plan. */
export function periodEndFor(code: PlanCode, from: Date = new Date()): Date | null {
  const days = PLAN_CATALOG[code].durationDays;
  if (days === null) return null;
  const end = new Date(from);
  end.setDate(end.getDate() + days);
  return end;
}
