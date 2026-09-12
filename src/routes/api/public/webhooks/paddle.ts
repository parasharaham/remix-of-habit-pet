import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Paddle webhook — the ONLY trusted path that grants or removes Pro access.
 * Frontend success URLs never unlock Pro on their own.
 *
 * Configure `PADDLE_WEBHOOK_SECRET` (Paddle notification destination secret)
 * before going live; without it the endpoint rejects every request.
 */
export const Route = createFileRoute("/api/public/webhooks/paddle")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PADDLE_WEBHOOK_SECRET"];
        if (!secret) return new Response("Webhook not configured", { status: 503 });

        const raw = await request.text();
        const header = request.headers.get("paddle-signature") ?? "";
        if (!verifyPaddleSignature(raw, header, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: any;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        const eventType: string = payload?.event_type ?? "";
        const sub = payload?.data ?? {};
        const userId: string | undefined =
          sub?.custom_data?.user_id ?? payload?.data?.custom_data?.userId;
        const customerId: string | undefined = sub?.customer_id;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Resolve the HabitPet user: prefer custom_data, fall back to a
        // previously stored Paddle customer id.
        let targetUserId = userId ?? null;
        if (!targetUserId && customerId) {
          const { data } = await supabaseAdmin
            .from("subscriptions")
            .select("user_id")
            .eq("paddle_customer_id", customerId)
            .maybeSingle();
          targetUserId = data?.user_id ?? null;
        }
        if (!targetUserId) return new Response("ok (no matching user)");

        const interval: string =
          sub?.billing_cycle?.interval === "year" ? "yearly" : "monthly";
        const periodStart: string | null = sub?.current_billing_period?.starts_at ?? null;
        const periodEnd: string | null = sub?.current_billing_period?.ends_at ?? null;
        const scheduledCancel = sub?.scheduled_change?.action === "cancel";

        // price/product id → HabitPet plan code (configured via env, never invented)
        const { planCodeForPriceId } = await import("@/lib/billing.server");
        const { PLAN_CATALOG } = await import("@/lib/plans");
        const priceId: string | null =
          sub?.items?.[0]?.price?.id ?? sub?.items?.[0]?.price_id ?? sub?.price_id ?? null;
        const mappedPlan = planCodeForPriceId(priceId);

        let status: string | null = null;
        let planState: string | null = null;
        switch (eventType) {
          case "subscription.created":
          case "subscription.activated":
          case "subscription.resumed":
            status = "pro_active";
            planState = "ACTIVE";
            break;
          case "subscription.updated":
            status = scheduledCancel ? "pro_cancelled" : mapPaddleStatus(sub?.status);
            planState = scheduledCancel
              ? "CANCELLED"
              : status === "payment_failed"
                ? "PAST_DUE"
                : status === "pro_expired"
                  ? "EXPIRED"
                  : "ACTIVE";
            break;
          case "subscription.canceled":
            status = periodEnd && new Date(periodEnd).getTime() > Date.now()
              ? "pro_cancelled"
              : "pro_expired";
            planState = status === "pro_cancelled" ? "CANCELLED" : "EXPIRED";
            break;
          case "subscription.past_due":
          case "transaction.payment_failed":
            status = "payment_failed";
            planState = "PAST_DUE";
            break;
          default:
            return new Response("ok (ignored)");
        }

        const isPro = status === "pro_active" || status === "pro_cancelled";
        const planCode = isPro
          ? (mappedPlan ?? (interval === "yearly" ? "YEARLY_PRO" : "MONTHLY_PRO"))
          : "FREE";

        await supabaseAdmin.from("subscriptions").upsert(
          {
            user_id: targetUserId,
            plan: isPro ? "premium" : "free",
            status,
            plan_code: planCode,
            plan_state: planState,
            one_time: PLAN_CATALOG[planCode as keyof typeof PLAN_CATALOG]?.oneTime ?? false,
            provider: "paddle",
            provider_price_id: priceId,
            billing_interval: interval,
            paddle_customer_id: customerId ?? null,
            paddle_subscription_id: sub?.id ?? null,
            current_period_start: periodStart,
            current_period_end: periodEnd,
            cancel_at_period_end: scheduledCancel,
          },
          { onConflict: "user_id" },
        );

        await supabaseAdmin
          .from("profiles")
          .update({ is_premium: isPro })
          .eq("id", targetUserId);

        return new Response("ok");
      },
    },
  },
});

function mapPaddleStatus(status?: string): string {
  switch (status) {
    case "active":
    case "trialing":
      return status === "trialing" ? "trial" : "pro_active";
    case "past_due":
      return "payment_failed";
    case "canceled":
      return "pro_expired";
    case "paused":
      return "pro_expired";
    default:
      return "pro_active";
  }
}

/** Paddle-Signature: `ts=<unix>;h1=<hmac sha256 of "ts:body">`. */
function verifyPaddleSignature(body: string, header: string, secret: string): boolean {
  const parts = Object.fromEntries(
    header.split(";").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim(), v?.trim()];
    }),
  ) as Record<string, string | undefined>;

  const ts = parts["ts"];
  const h1 = parts["h1"];
  if (!ts || !h1) return false;

  const expected = createHmac("sha256", secret).update(`${ts}:${body}`).digest("hex");
  const a = Buffer.from(h1);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
