import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { activateProSandbox, cancelPro } from "@/lib/subscription.functions";
import { useSubscription, SUBSCRIPTION_QUERY_KEY } from "@/hooks/useSubscription";
import { trackSubEvent } from "@/lib/sub-analytics";
import {
  COMPARISON,
  PRICING,
  YEARLY_PER_MONTH,
  YEARLY_SAVING_USD,
  YEARLY_SAVING_PERCENT,
  statusLabel,
} from "@/lib/entitlements";
import { Check, Minus, Sparkles } from "lucide-react";
import { PublicFooter, PublicNav } from "@/components/PublicFooter";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — HabitPet Free & Pro" },
      {
        name: "description",
        content:
          "HabitPet Free is $0 forever. Pro is $5/month or $49/year for unlimited scans, unlimited habits, personalized AI plans and advanced analytics.",
      },
      { property: "og:title", content: "HabitPet Pricing — Free & Pro" },
      {
        property: "og:description",
        content: "Start free. Upgrade to Pro for unlimited scans, habits and personalized AI plans.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

type Cycle = "monthly" | "yearly";

function PricingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [cycle, setCycle] = useState<Cycle>("monthly");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setIsAuthed(!!data.user));
    trackSubEvent("pricing_viewed");
  }, []);

  const sub = useSubscription(!!isAuthed);
  const fnActivate = useServerFn(activateProSandbox);
  const fnCancel = useServerFn(cancelPro);

  const activate = useMutation({
    mutationFn: (interval: Cycle) => {
      trackSubEvent("checkout_started", { interval });
      return fnActivate({ data: { interval } });
    },
    onSuccess: (s) => {
      qc.setQueryData(SUBSCRIPTION_QUERY_KEY, s);
      qc.invalidateQueries({ queryKey: ["profile"] });
      trackSubEvent("subscription_activated", { interval: cycle });
      navigate({ to: "/pro-success" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't start your Pro plan"),
  });

  const cancel = useMutation({
    mutationFn: () => fnCancel(),
    onSuccess: () => {
      trackSubEvent("subscription_canceled");
      qc.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
      toast.success("Pro canceled — you keep access until your period ends.");
    },
  });

  function startPro() {
    if (!isAuthed) {
      navigate({ to: "/auth" });
      return;
    }
    activate.mutate(cycle);
  }

  const isPro = sub.isPro;
  const proPrice = cycle === "monthly" ? PRICING.monthly : PRICING.yearly;

  return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      <main className="px-6 py-16 md:py-20">
        <div className="mx-auto max-w-5xl">
          <header className="mb-10 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-4 py-1.5 text-sm font-semibold text-primary">
              <Sparkles size={14} /> Pricing
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">Choose Your Plan</h1>
            <p className="mt-3 text-lg text-muted-foreground">
              Start free. Upgrade when you're ready for the full HabitPet experience.
            </p>

            <div className="mt-6 inline-flex rounded-full border-2 border-foreground/10 bg-card p-1 text-sm font-bold">
              <button
                onClick={() => setCycle("monthly")}
                className={`rounded-full px-6 py-2 uppercase tracking-wide transition ${
                  cycle === "monthly" ? "bg-foreground text-background" : "text-muted-foreground"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setCycle("yearly")}
                className={`rounded-full px-6 py-2 uppercase tracking-wide transition ${
                  cycle === "yearly" ? "bg-foreground text-background" : "text-muted-foreground"
                }`}
              >
                Yearly
              </button>
            </div>
            {cycle === "yearly" && (
              <p className="mt-3 text-sm font-semibold text-primary">
                Best Value — ${YEARLY_PER_MONTH.toFixed(2)}/month, saving ${YEARLY_SAVING_USD} (
                {YEARLY_SAVING_PERCENT}%) vs. monthly billing.
              </p>
            )}
          </header>

          <div className="grid gap-6 md:grid-cols-2">
            {/* FREE */}
            <article className="flex flex-col rounded-[2rem] bg-card p-8 shadow-card">
              <h2 className="text-2xl font-bold">Free</h2>
              <p className="mt-1 text-sm text-muted-foreground">Start your HabitPet journey.</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-5xl font-bold">$0</span>
                <span className="text-muted-foreground">forever</span>
              </div>
              <ul className="mt-6 flex-1 space-y-3">
                {[
                  "3 AI food scans per day",
                  "Up to 3 custom habits",
                  "Habit tracking & streaks",
                  "Basic pet features",
                  "Nutrition logging & meal history",
                  "Basic workouts & meal planning",
                  "Basic analytics and reminders",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check size={18} className="mt-0.5 shrink-0 text-muted-foreground" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                disabled
                className="mt-8 rounded-full border-2 border-foreground/10 px-6 py-3.5 font-bold text-muted-foreground"
              >
                {isPro ? "Included with Pro" : "Current Plan"}
              </button>
            </article>

            {/* PRO */}
            <article className="relative flex flex-col rounded-[2rem] bg-primary p-8 text-primary-foreground shadow-card ring-4 ring-primary/25 md:-translate-y-2">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-foreground px-3 py-1 text-xs font-bold uppercase tracking-wide text-background shadow-card">
                {cycle === "yearly" ? "Best Value" : "Most Popular"}
              </span>
              <h2 className="text-2xl font-bold">Pro</h2>
              <p className="mt-1 text-sm opacity-90">Unlock the full HabitPet experience.</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-5xl font-bold">{proPrice.label}</span>
                <span className="opacity-80">{proPrice.suffix}</span>
              </div>
              <p className="mt-1 text-sm opacity-90">
                {cycle === "yearly"
                  ? `$${YEARLY_PER_MONTH.toFixed(2)}/month, billed yearly`
                  : `or ${PRICING.yearly.label}/year — best value for your journey`}
              </p>
              <ul className="mt-6 flex-1 space-y-3">
                {[
                  "Unlimited AI food scans",
                  "Unlimited custom habits",
                  "Personalized AI meal plans",
                  "Personalized AI workout plans",
                  "Full AI Coach & recommendations",
                  "Advanced nutrition analytics & charts",
                  "Full meal & workout history",
                  "Premium pet features and rewards",
                  "Priority access to new features",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check size={18} className="mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {isPro ? (
                <div className="mt-8 space-y-2">
                  <div className="rounded-2xl bg-background/20 p-4 text-center text-sm font-semibold">
                    {statusLabel(sub.status)}
                    {sub.data?.current_period_end && (
                      <span className="block font-normal opacity-90">
                        {sub.data.cancel_at_period_end ? "Ends" : "Renews"}{" "}
                        {new Date(sub.data.current_period_end).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {!sub.data?.cancel_at_period_end && (
                    <button
                      onClick={() => cancel.mutate()}
                      disabled={cancel.isPending}
                      className="w-full rounded-full bg-background/20 px-6 py-3 font-semibold"
                    >
                      Cancel Pro
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={startPro}
                  disabled={activate.isPending}
                  className="mt-8 rounded-full bg-background px-6 py-3.5 font-bold text-primary shadow-card transition hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {activate.isPending ? "Starting…" : "Upgrade to Pro"}
                </button>
              )}
            </article>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Card payments through Paddle are being finalised. Pro currently activates instantly for
            testing and your plan is stored securely on your account.
          </p>

          {/* Comparison */}
          <section className="mt-16">
            <h2 className="text-center text-3xl font-bold tracking-tight">Free vs Pro</h2>
            <div className="mt-8 overflow-hidden rounded-[2rem] border-2 border-foreground/10 bg-card">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-foreground/10">
                    <th className="p-4 font-bold">Feature</th>
                    <th className="p-4 text-center font-bold text-muted-foreground">Free</th>
                    <th className="bg-primary/10 p-4 text-center font-bold text-primary">Pro</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr key={row.feature} className="border-b border-foreground/5 last:border-0">
                      <td className="p-4 font-semibold">{row.feature}</td>
                      <td className="p-4 text-center text-muted-foreground">
                        {row.free === "No" ? <Minus size={16} className="mx-auto" /> : row.free}
                      </td>
                      <td className="bg-primary/5 p-4 text-center font-bold">{row.pro}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mx-auto mt-16 max-w-3xl">
            <h2 className="text-center text-3xl font-bold tracking-tight">Frequently asked questions</h2>
            <div className="mt-8 divide-y divide-foreground/10 rounded-3xl border-2 border-foreground/10 bg-card">
              <Faq
                q="What happens when I hit a Free limit?"
                a="Nothing is deleted. You keep everything you've already logged — you simply can't add more scans or custom habits that day until you upgrade."
              />
              <Faq
                q="Can I cancel anytime?"
                a="Yes. Cancel whenever you like and Pro stays active until the end of the period you already paid for."
              />
              <Faq
                q="What happens if my Pro plan expires?"
                a="Your habits, meals, workouts, pet progress and analytics history all remain. Free limits apply again to creating new custom habits and daily scans."
              />
              <Faq
                q="Is yearly really cheaper?"
                a={`Yes — $49/year works out to $${YEARLY_PER_MONTH.toFixed(2)}/month, $${YEARLY_SAVING_USD} less than 12 months at $5.`}
              />
            </div>
          </section>

          <div className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link to="/terms" className="hover:text-foreground">Terms of Service</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
            <Link to="/refund-policy" className="hover:text-foreground">Refund Policy</Link>
            <Link to="/contact" className="hover:text-foreground">Contact</Link>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group p-6">
      <summary className="flex cursor-pointer items-center justify-between font-semibold">
        {q}
        <span className="ml-4 text-muted-foreground transition group-open:rotate-45">+</span>
      </summary>
      <p className="mt-3 text-sm text-muted-foreground">{a}</p>
    </details>
  );
}
