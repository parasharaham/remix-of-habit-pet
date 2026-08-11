import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getSubscription, mockChangePlan } from "@/lib/subscription.functions";
import { Check, Sparkles } from "lucide-react";
import { PublicFooter, PublicNav } from "@/components/PublicFooter";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — HabitPet" },
      { name: "description", content: "Start free and upgrade as you grow. Simple, transparent pricing for HabitPet." },
      { property: "og:title", content: "HabitPet Pricing" },
      { property: "og:description", content: "Choose the plan that fits your habits. Free, Growth, and Pro tiers." },
    ],
  }),
  component: PricingPage,
});

type Cycle = "monthly" | "yearly";

function PricingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchSub = useServerFn(getSubscription);
  const fnChange = useServerFn(mockChangePlan);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [cycle, setCycle] = useState<Cycle>("monthly");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setIsAuthed(!!data.user));
  }, []);

  const sub = useQuery({
    queryKey: ["subscription"],
    queryFn: () => fetchSub(),
    enabled: !!isAuthed,
  });

  const change = useMutation({
    mutationFn: (plan: "free" | "premium") => fnChange({ data: { plan } }),
    onSuccess: (s) => {
      qc.setQueryData(["subscription"], s);
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success(s.plan === "premium" ? "Welcome to Premium! 🎉" : "Plan updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't update"),
  });

  function start(plan: "free" | "premium") {
    if (!isAuthed) {
      navigate({ to: "/auth" });
      return;
    }
    change.mutate(plan);
  }

  const isPremium = sub.data?.plan === "premium";

  return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      <main className="px-6 py-16 md:py-20">
        <div className="mx-auto max-w-6xl">
          <header className="mb-10 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
              <Sparkles size={14} /> Pricing
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">Choose Your Plan</h1>
            <p className="mt-3 text-lg text-muted-foreground">Start free and upgrade as you grow.</p>

            <div className="mt-6 inline-flex rounded-full border border-foreground/10 bg-card p-1 text-sm font-semibold">
              <button
                onClick={() => setCycle("monthly")}
                className={`rounded-full px-5 py-2 transition ${cycle === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setCycle("yearly")}
                className={`rounded-full px-5 py-2 transition ${cycle === "yearly" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                Yearly <span className="ml-1 text-xs opacity-80">save 25%</span>
              </button>
            </div>
          </header>

          <div className="grid gap-6 md:grid-cols-3">
            <PlanCard
              name="Free"
              price="$0"
              suffix={cycle === "monthly" ? "/month" : "/year"}
              tagline="Try HabitPet, no card required"
              features={[
                "Basic app access",
                "Limited usage",
                "Community access",
                "Basic analytics",
                "Basic profile",
              ]}
              cta="Get Started Free"
              onClick={() => start("free")}
              disabled={!isPremium && !!sub.data}
            />
            <PlanCard
              name="Growth"
              price={cycle === "monthly" ? "$3" : "$27"}
              suffix={cycle === "monthly" ? "/month" : "/year"}
              tagline="For building serious habits"
              badge="Most Popular"
              highlight
              features={[
                "Increased limits",
                "Premium analytics",
                "Growth tracking",
                "Premium profile badge",
                "Additional storage",
                "Priority support",
              ]}
              cta="Upgrade to Growth"
              onClick={() => start("premium")}
            />
            <PlanCard
              name="Pro"
              price={cycle === "monthly" ? "$7" : "$63"}
              suffix={cycle === "monthly" ? "/month" : "/year"}
              tagline="Everything, unlocked"
              features={[
                "Unlimited usage",
                "Unlimited storage",
                "Advanced analytics",
                "Data export",
                "Premium themes",
                "Custom profile customization",
                "Priority support",
                "Exclusive premium features",
              ]}
              cta="Upgrade to Pro"
              onClick={() => start("premium")}
            />
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Payments are coming soon. Plan switches happen instantly for testing.
          </p>

          <section className="mx-auto mt-20 max-w-3xl">
            <h2 className="text-center text-3xl font-bold tracking-tight">Frequently asked questions</h2>
            <div className="mt-8 divide-y divide-foreground/10 rounded-3xl border border-foreground/10 bg-card">
              <Faq q="How do subscriptions work?" a="Pick a plan and you're billed per cycle (monthly or yearly). Your plan stays active until you cancel — no surprises." />
              <Faq q="Can I cancel anytime?" a="Yes. You can cancel from your billing settings at any time. You keep access until the end of your current billing period." />
              <Faq q="Do you offer refunds?" a="We offer a 7-day refund window on first-time purchases. See our Refund Policy for details." />
              <Faq q="Can I change plans?" a="Absolutely. Upgrade or downgrade whenever you like. Upgrades take effect immediately; downgrades apply at the next billing cycle." />
              <Faq q="What payment methods are supported?" a="We support all major credit and debit cards through our payment partners (Paddle, Lemon Squeezy, and Stripe), plus Apple Pay and Google Pay where available." />
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

function PlanCard({
  name,
  price,
  suffix,
  tagline,
  features,
  cta,
  highlight,
  badge,
  disabled,
  onClick,
}: {
  name: string;
  price: string;
  suffix: string;
  tagline: string;
  features: string[];
  cta: string;
  highlight?: boolean;
  badge?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <article
      className={`relative flex flex-col rounded-[2rem] p-8 shadow-card ${
        highlight
          ? "bg-primary text-primary-foreground ring-4 ring-primary/30 md:-translate-y-2 md:scale-[1.02]"
          : "bg-card"
      }`}
    >
      {badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-foreground px-3 py-1 text-xs font-bold uppercase tracking-wide text-background shadow-card">
          {badge}
        </span>
      )}
      <h2 className="text-2xl font-bold">{name}</h2>
      <p className={`mt-1 text-sm ${highlight ? "opacity-90" : "text-muted-foreground"}`}>{tagline}</p>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-5xl font-bold">{price}</span>
        <span className={highlight ? "opacity-80" : "text-muted-foreground"}>{suffix}</span>
      </div>
      <ul className="mt-6 flex-1 space-y-3">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check size={18} className="mt-0.5 shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={onClick}
        disabled={disabled}
        className={`mt-8 rounded-full px-6 py-3.5 font-bold transition hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 ${
          highlight ? "bg-background text-primary shadow-card" : "bg-primary text-primary-foreground shadow-card"
        }`}
      >
        {cta}
      </button>
    </article>
  );
}
