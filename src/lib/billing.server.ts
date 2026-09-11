/**
 * Payment-provider configuration.
 *
 * No credentials or product IDs are invented here. Each plan maps to an
 * environment variable that must hold the real price/product id created in the
 * payment provider dashboard. Until they are set, checkout stays unconfigured
 * and the app never grants Pro from the client.
 *
 * Required environment variables:
 *   WEEKLY_PRO_PRICE_ID
 *   SPECIAL_38_DAY_PRICE_ID
 *   MONTHLY_PRO_PRICE_ID
 *   YEARLY_PRO_PRICE_ID
 *   PADDLE_WEBHOOK_SECRET        (web provider webhook verification)
 *   GOOGLE_PLAY_PACKAGE_NAME     (Play Billing server verification)
 *   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
 */
import type { PlanCode } from "./plans";

export const PRICE_ID_ENV: Record<Exclude<PlanCode, "FREE">, string> = {
  WEEKLY_PRO: "WEEKLY_PRO_PRICE_ID",
  SPECIAL_38_DAY: "SPECIAL_38_DAY_PRICE_ID",
  MONTHLY_PRO: "MONTHLY_PRO_PRICE_ID",
  YEARLY_PRO: "YEARLY_PRO_PRICE_ID",
};

/** Reads configured price ids at call time (never at module scope). */
export function priceIdMap(): Partial<Record<PlanCode, string>> {
  const out: Partial<Record<PlanCode, string>> = {};
  for (const [code, envName] of Object.entries(PRICE_ID_ENV)) {
    const value = process.env[envName];
    if (value) out[code as PlanCode] = value;
  }
  return out;
}

export function priceIdFor(code: PlanCode): string | null {
  if (code === "FREE") return null;
  return process.env[PRICE_ID_ENV[code]] ?? null;
}

/** Webhook mapping: provider price/product id → HabitPet plan code. */
export function planCodeForPriceId(priceId?: string | null): PlanCode | null {
  if (!priceId) return null;
  const map = priceIdMap();
  for (const [code, id] of Object.entries(map)) {
    if (id === priceId) return code as PlanCode;
  }
  return null;
}

export function billingConfigured(): boolean {
  return Object.keys(priceIdMap()).length > 0;
}
