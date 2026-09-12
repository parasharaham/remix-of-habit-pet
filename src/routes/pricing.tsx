import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useSubscription,
  SUBSCRIPTION_QUERY_KEY,
} from "@/hooks/useSubscription";
import { trackSubEvent } from "@/lib/sub-analytics";
import { Check, Minus, Sparkles, Crown, Zap, Gift } from "lucide-react";
import { PublicFooter, PublicNav } from "@/components/PublicFooter";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — HabitPet Free & Pro" },
      {
        name: "description",
        content:
          "Start HabitPet for free or unlock the complete HabitPet experience with Pro plans starting at $2.99.",
      },
      {
        property: "og:title",
        content: "HabitPet Pricing — Free & Pro",
      },
      {
        property: "og:description",
        content:
          "AI nutrition, food scanning, meal planning, workouts, habits and more in one HabitPet subscription.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

type PlanId = PlanCode;

type Plan = {
  id: PlanId;
  name: string;
  price: string;
  period: string;
  description: string;
  badge?: string;
  badgeIcon?: "crown" | "zap" | "gift";
  highlighted?: boolean;
  savings?: string;
  features: string[];
  cta: string;
};

const PRO_FEATURES = [
  "Unlimited AI food scans",
  "Unlimited custom habits",
  "Personalized AI meal plans",
  "Personalized AI workout plans",
  "AI Coach & recommendations",
  "Advanced nutrition analytics",
  "Full meal & workout history",
  "Premium pet features",
  "Smart reminders",
];

const BADGE_ICONS: Record<PlanId, "crown" | "zap" | "gift" | undefined> = {
  FREE: undefined,
  WEEKLY_PRO: "zap",
  SPECIAL_38_DAY: "gift",
  MONTHLY_PRO: "crown",
  YEARLY_PRO: "crown",
};

/** Every plan card is derived from the central catalogue in src/lib/plans.ts. */
const PLANS: Plan[] = PAID_PLANS.map((def) => ({
  id: def.code,
  name: def.name,
  price: def.priceLabel,
  period: def.periodLabel,
  description:
    def.code === "SPECIAL_38_DAY"
      ? `${SPECIAL_38_PAID_DAYS} days + ${SPECIAL_38_FREE_DAYS} FREE days to build your routine.`
      : def.description,
  badge: def.badge,
  badgeIcon: BADGE_ICONS[def.code],
  highlighted: def.code === "SPECIAL_38_DAY",
  savings:
    def.code === "YEARLY_PRO"
      ? `Save $${YEARLY_SAVING_USD.toFixed(2)}/year (${YEARLY_SAVING_PERCENT}%)`
      : undefined,
  features:
    def.code === "YEARLY_PRO"
      ? [...PRO_FEATURES, "Priority access to new features"]
      : PRO_FEATURES,
  cta: def.cta,
}));

const FREE_FEATURES = [
  "3 AI food scans per day",
  "Up to 3 custom habits",
  "Habit tracking & streaks",
  "Basic pet features",
  "Nutrition logging & meal history",
  "Basic workouts & meal planning",
  "Basic analytics & reminders",
];

const COMPARISON = [
  {
    feature: "AI food scans",
    free: "3/day",
    pro: "Unlimited",
  },
  {
    feature: "Custom habits",
    free: "3",
    pro: "Unlimited",
  },
  {
    feature: "AI food analysis",
    free: "Limited",
    pro: "Full access",
  },
  {
    feature: "Personalized nutrition goals",
    free: "Basic",
    pro: "Advanced",
  },
  {
    feature: "AI meal planner",
    free: "Basic",
    pro: "Personalized",
  },
  {
    feature: "AI workout planner",
    free: "Basic",
    pro: "Personalized",
  },
  {
    feature: "AI Coach",
    free: "Limited",
    pro: "Full access",
  },
  {
    feature: "Advanced analytics",
    free: "No",
    pro: "Yes",
  },
  {
    feature: "Premium pet features",
    free: "Limited",
    pro: "Full access",
  },
  {
    feature: "Smart reminders",
    free: "Basic",
    pro: "Advanced",
  },
  {
    feature: "Priority new features",
    free: "No",
    pro: "Yes",
  },
];

function PricingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
  const [showMobileUpgrade, setShowMobileUpgrade] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsAuthed(!!data.user);
    });

    trackSubEvent("pricing_viewed");
  }, []);

  const sub = useSubscription(!!isAuthed);

  const selectedPlanData = useMemo(
    () => PLANS.find((plan) => plan.id === selectedPlan) ?? null,
    [selectedPlan],
  );

  const isPro = sub.isPro;

  /**
   * IMPORTANT:
   *
   * This function is intentionally separated from the UI.
   *
   * Replace the body with the real payment integration:
   *
   * Android:
   *   Google Play Billing
   *
   * Web:
   *   Your chosen payment provider
   *
   * Do NOT simply set the user to PRO here.
   */
  async function startSubscription(plan: Plan) {
    if (!isAuthed) {
      navigate({ to: "/auth" });
      return;
    }

    try {
      setSelectedPlan(plan.id);

      trackSubEvent("checkout_started", {
        plan: plan.id,
        price: plan.price,
        period: plan.period,
      });

      /*
       * ============================================================
       * GOOGLE PLAY BILLING INTEGRATION POINT
       * ============================================================
       *
       * Example architecture:
       *
       * 1. Send plan.id to your Android billing layer.
       * 2. Open Google Play Billing.
       * 3. User completes purchase.
       * 4. Obtain purchase token.
       * 5. Send purchase token to secure backend.
       * 6. Backend verifies purchase with Google.
       * 7. Backend updates subscription entitlement.
       * 8. Refresh useSubscription().
       *
       * DO NOT unlock Pro from this frontend function alone.
       */

      toast.info(
        `${plan.name} selected. Connect this plan to your payment provider.`,
      );

      setShowMobileUpgrade(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn't start the subscription.",
      );
    } finally {
      setSelectedPlan(null);
    }
  }

  async function handlePlanClick(plan: Plan) {
    await startSubscription(plan);
  }

  async function cancelSubscription() {
    try {
      /*
       * Keep cancellation connected to your real billing provider.
       *
       * For Google Play:
       * redirect/open Google's subscription management flow.
       *
       * Do not manually change the subscription to FREE here.
       */

      trackSubEvent("subscription_canceled");

      qc.invalidateQueries({
        queryKey: SUBSCRIPTION_QUERY_KEY,
      });

      toast.success(
        "Open your subscription manager to cancel or change your plan.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn't open subscription management.",
      );
    }
  }

  function getBadgeIcon(icon?: Plan["badgeIcon"]) {
    if (icon === "crown") return <Crown size={13} />;
    if (icon === "zap") return <Zap size={13} />;
    if (icon === "gift") return <Gift size={13} />;
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicNav />

      <main className="px-4 py-14 md:px-6 md:py-20">
        <div className="mx-auto max-w-7xl">

          {/* =====================================================
              HEADER
          ====================================================== */}

          <header className="mx-auto mb-12 max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-4 py-1.5 text-sm font-semibold text-primary">
              <Sparkles size={14} />
              HabitPet Pro
            </span>

            <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
              Your complete fitness journey.
              <span className="block text-primary">
                One HabitPet subscription.
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
              AI-powered nutrition, food scanning, workouts, meal planning,
              habits, coaching and pet progression — all working together in
              one place.
            </p>
          </header>

          {/* =====================================================
              FREE + PAID PLANS
          ====================================================== */}

          <div className="grid gap-6 lg:grid-cols-5">

            {/* FREE */}

            <article className="flex flex-col rounded-[2rem] border-2 border-foreground/10 bg-card p-6 shadow-card lg:col-span-1 md:p-8">
              <div>
                <span className="inline-flex rounded-full bg-muted px-3 py-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Free
                </span>

                <h2 className="mt-4 text-2xl font-black">
                  Start Free
                </h2>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Get started with the essential HabitPet experience.
                </p>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-5xl font-black">$0</span>
                  <span className="text-sm text-muted-foreground">
                    forever
                  </span>
                </div>
              </div>

              <ul className="mt-8 flex-1 space-y-3">
                {FREE_FEATURES.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-sm"
                  >
                    <Check
                      size={18}
                      className="mt-0.5 shrink-0 text-muted-foreground"
                    />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                disabled
                className="mt-8 w-full rounded-full border-2 border-foreground/10 px-5 py-3.5 text-sm font-bold text-muted-foreground"
              >
                {isPro ? "Included with Pro" : "Current Plan"}
              </button>
            </article>

            {/* PAID PLANS */}

            {PLANS.map((plan) => {
              const isSelected = selectedPlan === plan.id;

              return (
                <article
                  key={plan.id}
                  className={`relative flex flex-col rounded-[2rem] p-6 shadow-card transition-all duration-200 md:p-7 ${
                    plan.highlighted
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/25 lg:-translate-y-2"
                      : "border-2 border-foreground/10 bg-card"
                  }`}
                >
                  {plan.badge && (
                    <span
                      className={`absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide shadow-card ${
                        plan.highlighted
                          ? "bg-foreground text-background"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      {getBadgeIcon(plan.badgeIcon)}
                      {plan.badge}
                    </span>
                  )}

                  <div>
                    <h2 className="text-xl font-black">
                      {plan.name}
                    </h2>

                    <p
                      className={`mt-2 min-h-[48px] text-sm leading-6 ${
                        plan.highlighted
                          ? "text-primary-foreground/80"
                          : "text-muted-foreground"
                      }`}
                    >
                      {plan.description}
                    </p>

                    <div className="mt-5 flex items-baseline gap-1">
                      <span className="text-4xl font-black">
                        {plan.price}
                      </span>

                      <span
                        className={`text-sm ${
                          plan.highlighted
                            ? "text-primary-foreground/80"
                            : "text-muted-foreground"
                        }`}
                      >
                        / {plan.period}
                      </span>
                    </div>

                    {plan.savings && (
                      <p
                        className={`mt-2 text-xs font-bold ${
                          plan.highlighted
                            ? "text-primary-foreground"
                            : "text-primary"
                        }`}
                      >
                        {plan.savings}
                      </p>
                    )}
                  </div>

                  <ul className="mt-7 flex-1 space-y-3">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm"
                      >
                        <Check
                          size={17}
                          className={`mt-0.5 shrink-0 ${
                            plan.highlighted
                              ? "text-primary-foreground"
                              : "text-primary"
                          }`}
                        />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {isPro ? (
                    <div className="mt-7 space-y-3">
                      <div
                        className={`rounded-2xl p-4 text-center text-sm font-semibold ${
                          plan.highlighted
                            ? "bg-background/20"
                            : "bg-primary/10"
                        }`}
                      >
                        {sub.status
                          ? String(sub.status).replaceAll("_", " ")
                          : "Pro Active"}

                        {sub.data?.current_period_end && (
                          <span className="mt-1 block text-xs font-normal opacity-80">
                            {sub.data.cancel_at_period_end
                              ? "Ends"
                              : "Renews"}{" "}
                            {new Date(
                              sub.data.current_period_end,
                            ).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      {!sub.data?.cancel_at_period_end && (
                        <button
                          onClick={cancelSubscription}
                          className={`w-full rounded-full px-5 py-3 text-sm font-bold transition ${
                            plan.highlighted
                              ? "bg-background/20 hover:bg-background/30"
                              : "border-2 border-foreground/10 hover:bg-muted"
                          }`}
                        >
                          Manage Subscription
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => handlePlanClick(plan)}
                      disabled={isSelected}
                      className={`mt-7 w-full rounded-full px-5 py-3.5 text-sm font-black shadow-card transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${
                        plan.highlighted
                          ? "bg-background text-primary"
                          : "bg-foreground text-background"
                      }`}
                    >
                      {isSelected
                        ? "Opening checkout..."
                        : plan.cta}
                    </button>
                  )}
                </article>
              );
            })}
          </div>

          {/* =====================================================
              SPECIAL OFFER MESSAGE
          ====================================================== */}

          <div className="mx-auto mt-8 max-w-3xl rounded-3xl border-2 border-primary/20 bg-primary/10 p-5 text-center">
            <div className="flex items-center justify-center gap-2 font-black text-primary">
              <Gift size={18} />
              38-Day Special
            </div>

            <p className="mt-2 text-sm text-muted-foreground">
              Get 35 paid days plus 3 additional free days for{" "}
              <strong className="text-foreground">$9.99</strong>.
            </p>
          </div>

          {/* =====================================================
              COMPARISON
          ====================================================== */}

          <section className="mt-20">
            <div className="mx-auto max-w-3xl text-center">
              <span className="text-sm font-bold uppercase tracking-widest text-primary">
                Compare
              </span>

              <h2 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
                Free vs Pro
              </h2>

              <p className="mt-3 text-muted-foreground">
                See exactly what you unlock with HabitPet Pro.
              </p>
            </div>

            <div className="mt-8 overflow-hidden rounded-[2rem] border-2 border-foreground/10 bg-card shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead>
                    <tr className="border-b-2 border-foreground/10">
                      <th className="p-5 font-black">
                        Feature
                      </th>

                      <th className="p-5 text-center font-black text-muted-foreground">
                        Free
                      </th>

                      <th className="bg-primary/10 p-5 text-center font-black text-primary">
                        Pro
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {COMPARISON.map((row) => (
                      <tr
                        key={row.feature}
                        className="border-b border-foreground/5 last:border-0"
                      >
                        <td className="p-5 font-semibold">
                          {row.feature}
                        </td>

                        <td className="p-5 text-center text-muted-foreground">
                          {row.free === "No" ? (
                            <Minus
                              size={16}
                              className="mx-auto"
                            />
                          ) : (
                            row.free
                          )}
                        </td>

                        <td className="bg-primary/5 p-5 text-center font-bold text-primary">
                          {row.pro}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* =====================================================
              FAQ
          ====================================================== */}

          <section className="mx-auto mt-20 max-w-3xl">
            <h2 className="text-center text-3xl font-black tracking-tight md:text-4xl">
              Frequently asked questions
            </h2>

            <div className="mt-8 divide-y divide-foreground/10 rounded-[2rem] border-2 border-foreground/10 bg-card">
              <Faq
                q="What do I get for free?"
                a="Free users can scan up to 3 foods per day, create up to 3 custom habits, track habits and nutrition, and use the basic HabitPet experience."
              />

              <Faq
                q="What does Pro unlock?"
                a="Pro unlocks unlimited food scanning, unlimited habits, personalized AI meal and workout plans, AI coaching, advanced nutrition analytics, premium pet features and other premium functionality."
              />

              <Faq
                q="What is the 38-Day Special?"
                a="The 38-Day Special costs $9.99 and provides 35 paid days plus 3 additional free days, for 38 total days of access."
              />

              <Faq
                q="Can I cancel a recurring subscription?"
                a="Yes. For recurring subscriptions, cancellation should be performed through the payment provider or Google Play subscription management. Access normally remains available until the end of the already-paid billing period."
              />

              <Faq
                q="What happens when Pro expires?"
                a="Your account and existing data remain intact. Your account returns to the Free plan and Free limits apply again. Your existing habits, meals, workouts, pet progress and history are not deleted."
              />

              <Faq
                q="Can I restore my purchase?"
                a="Yes. Supported platforms should provide a Restore Purchases option. The purchase must be verified before Pro access is restored."
              />

              <Faq
                q="Are payments handled securely?"
                a="Payments should be processed through the configured payment provider or Google Play Billing. HabitPet should never store users' card details or payment credentials."
              />
            </div>
          </section>

          {/* =====================================================
              LEGAL
          ====================================================== */}

          <div className="mt-12 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
            <Link
              to="/terms"
              className="transition hover:text-foreground"
            >
              Terms of Service
            </Link>

            <Link
              to="/privacy"
              className="transition hover:text-foreground"
            >
              Privacy Policy
            </Link>

            <Link
              to="/refund-policy"
              className="transition hover:text-foreground"
            >
              Refund Policy
            </Link>

            <Link
              to="/contact"
              className="transition hover:text-foreground"
            >
              Contact
            </Link>
          </div>

          {/* =====================================================
              MOBILE QUICK UPGRADE
          ====================================================== */}

          {!isPro && (
            <div className="fixed bottom-4 left-4 right-4 z-40 md:hidden">
              <button
                onClick={() => setShowMobileUpgrade(true)}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-6 py-4 text-sm font-black text-background shadow-2xl"
              >
                <Sparkles size={17} />
                Unlock HabitPet Pro
              </button>
            </div>
          )}

          {showMobileUpgrade && !isPro && (
            <div className="fixed inset-0 z-50 flex items-end bg-black/60 p-0 backdrop-blur-sm md:hidden">
              <div className="w-full rounded-t-[2rem] bg-background p-6 shadow-2xl">
                <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />

                <div className="flex items-start justify-between">
                  <div>
                    <span className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
                      <Sparkles size={12} />
                      HabitPet Pro
                    </span>

                    <h2 className="mt-3 text-2xl font-black">
                      Unlock your complete fitness journey
                    </h2>
                  </div>

                  <button
                    onClick={() => setShowMobileUpgrade(false)}
                    className="rounded-full bg-muted px-3 py-2 text-sm font-bold"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                <ul className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  {[
                    "Unlimited scans",
                    "Unlimited habits",
                    "AI meal planner",
                    "AI workout planner",
                    "AI Coach",
                    "Advanced analytics",
                  ].map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2"
                    >
                      <Check
                        size={16}
                        className="shrink-0 text-primary"
                      />
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setShowMobileUpgrade(false);
                      handlePlanClick(
                        PLANS.find(
                          (plan) => plan.id === "special38",
                        )!,
                      );
                    }}
                    className="rounded-2xl border-2 border-primary/20 bg-primary/10 p-4 text-left"
                  >
                    <span className="text-xs font-bold text-primary">
                      SPECIAL
                    </span>

                    <span className="mt-1 block text-xl font-black">
                      $9.99
                    </span>

                    <span className="text-xs text-muted-foreground">
                      38 days
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMobileUpgrade(false);
                      handlePlanClick(
                        PLANS.find(
                          (plan) => plan.id === "yearly",
                        )!,
                      );
                    }}
                    className="rounded-2xl bg-foreground p-4 text-left text-background"
                  >
                    <span className="text-xs font-bold">
                      BEST VALUE
                    </span>

                    <span className="mt-1 block text-xl font-black">
                      $64.99
                    </span>

                    <span className="text-xs opacity-70">
                      yearly
                    </span>
                  </button>
                </div>

                <button
                  onClick={() => setShowMobileUpgrade(false)}
                  className="mt-4 w-full rounded-full py-3 text-sm font-semibold text-muted-foreground"
                >
                  Maybe later
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

function Faq({
  q,
  a,
}: {
  q: string;
  a: string;
}) {
  return (
    <details className="group p-6">
      <summary className="flex cursor-pointer items-center justify-between font-semibold">
        <span>{q}</span>

        <span className="ml-4 shrink-0 text-lg text-muted-foreground transition-transform group-open:rotate-45">
          +
        </span>
      </summary>

      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {a}
      </p>
    </details>
  );
}
