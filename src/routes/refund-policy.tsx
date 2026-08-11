import { createFileRoute } from "@tanstack/react-router";
import { PublicFooter, PublicNav } from "@/components/PublicFooter";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({
    meta: [
      { title: "Refund Policy — HabitPet" },
      { name: "description", content: "HabitPet offers a 7-day refund window on first-time purchases. Read the full policy." },
      { property: "og:title", content: "HabitPet — Refund Policy" },
      { property: "og:description", content: "Read the HabitPet Refund Policy." },
    ],
  }),
  component: RefundPage,
});

function RefundPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Legal</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">Refund Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

        <div className="mt-8 rounded-3xl border border-primary/20 bg-primary/5 p-6">
          <p className="text-lg">
            <strong>7-day refund window.</strong> We offer a 7-day refund window for first-time purchases. If
            you're not satisfied with HabitPet, email us at{" "}
            <a href="mailto:support@habitpet.app" className="font-semibold text-primary hover:underline">
              support@habitpet.app
            </a>{" "}
            within 7 days of your purchase and we'll review your request.
          </p>
        </div>

        <Section title="How to request a refund">
          Send an email to <Mail /> from the address associated with your HabitPet account. Include your order
          ID (from your receipt) and a short note about why you're requesting a refund. We aim to respond
          within 24–48 hours.
        </Section>

        <Section title="What is eligible">
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>First-time subscription purchases, within 7 days of the initial charge</li>
            <li>Accidental duplicate charges</li>
            <li>Verified billing errors on our end</li>
          </ul>
        </Section>

        <Section title="What is generally not eligible">
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Renewals after the initial purchase</li>
            <li>Accounts found to be in violation of our Terms of Service</li>
            <li>Fraudulent or chargeback-disputed transactions</li>
            <li>Refund requests submitted more than 7 days after purchase</li>
          </ul>
        </Section>

        <Section title="How refunds are issued">
          Refund requests are reviewed individually. Approved refunds are returned to the original payment
          method through our payment processor (Paddle, Lemon Squeezy, or Stripe) and typically appear within
          5–10 business days, depending on your bank or card issuer.
        </Section>

        <Section title="Cancellations">
          Canceling your subscription stops future charges but does not automatically issue a refund for the
          current billing period. You'll keep access until the end of the period you've already paid for.
        </Section>

        <Section title="Questions">
          For anything refund-related, contact <Mail />.
        </Section>
      </main>
      <PublicFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-2 leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function Mail() {
  return <a href="mailto:support@habitpet.app" className="font-semibold text-primary hover:underline">support@habitpet.app</a>;
}
