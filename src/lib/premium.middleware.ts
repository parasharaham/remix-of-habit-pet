import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * `requirePremium` — server middleware to gate premium-only server functions
 * (e.g. custom pet skins). Composes on top of `requireSupabaseAuth`.
 *
 * Equivalent to a `@require_premium_license` decorator: when the caller is
 * authenticated but has no active premium entitlement we throw 403. Wire up
 * Stripe later by reading the entitlement from `user_metadata`, a
 * `subscriptions` table, or your billing provider of choice.
 */
export const requirePremium = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    // Stubbed: opt-in via user metadata flag `is_premium: true`.
    const claims = context.claims as Record<string, unknown> | undefined;
    const userMeta = (claims?.user_metadata ?? {}) as Record<string, unknown>;
    const isPremium = Boolean(userMeta.is_premium);

    if (!isPremium) {
      throw new Response(
        JSON.stringify({ error: "premium_required", message: "This feature is part of Tama Premium." }),
        { status: 403, headers: { "content-type": "application/json" } },
      );
    }
    return next({ context: { ...context, isPremium: true } });
  });
