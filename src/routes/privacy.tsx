import { createFileRoute } from "@tanstack/react-router";
import { PublicFooter, PublicNav } from "@/components/PublicFooter";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — HabitPet" },
      { name: "description", content: "How HabitPet collects, uses, and protects your personal information." },
      { property: "og:title", content: "HabitPet — Privacy Policy" },
      { property: "og:description", content: "Read the HabitPet Privacy Policy." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Legal</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

        <p className="mt-8 text-muted-foreground">
          This Privacy Policy explains how HabitPet, operated by SevenLabs ("we", "us", "our"), collects, uses,
          and protects your information when you use our Service. We respect your privacy and only collect what
          we need to deliver a great experience.
        </p>

        <Section title="1. Information We Collect">
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Name</li>
            <li>Email address</li>
            <li>Profile information (avatar, pet preferences, display name)</li>
            <li>Subscription and billing information (handled by our payment processors)</li>
            <li>Usage analytics (habit completions, app interactions, device/browser info)</li>
          </ul>
        </Section>

        <Section title="2. How We Use Information">
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Account management and authentication</li>
            <li>Subscription management and billing</li>
            <li>Product improvements and new feature development</li>
            <li>Customer support and communications about your account</li>
            <li>Security, fraud prevention, and abuse detection</li>
          </ul>
        </Section>

        <Section title="3. Data Storage">
          Your data is securely stored using <strong>Supabase</strong>, a managed database and authentication
          platform with industry-standard encryption in transit (TLS) and at rest. Backups are taken regularly
          and access is restricted to authorized personnel.
        </Section>

        <Section title="4. Third-Party Services">
          We rely on a small number of trusted providers to deliver the Service:
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li><strong>Supabase</strong> — database, authentication, and storage</li>
            <li><strong>Paddle</strong> — payments and merchant of record</li>
            <li><strong>Lemon Squeezy</strong> — payments and merchant of record</li>
            <li><strong>Stripe</strong> — card processing (where applicable)</li>
          </ul>
          Each provider has its own privacy practices. Payment processors handle your card details directly —
          we never store full payment card numbers on our servers.
        </Section>

        <Section title="5. Your Rights">
          You may request access to, correction of, or deletion of your personal data at any time by contacting
          us at <Mail />. You can also delete your account from the in-app Settings page, which removes your
          profile, habits, and pet data from our active systems.
        </Section>

        <Section title="6. Security">
          We use reasonable administrative, technical, and physical safeguards to protect your information,
          including encryption in transit, hashed credentials, row-level security policies, and routine
          security reviews. No system is 100% secure — please use a strong, unique password.
        </Section>

        <Section title="7. Children's Privacy">
          HabitPet is not intended for children under 13. We do not knowingly collect personal information from
          children under 13. If you believe a child has provided us with personal data, contact us and we will
          delete it.
        </Section>

        <Section title="8. Changes to This Policy">
          We may update this Privacy Policy from time to time. We will post the new version on this page and
          update the "Last updated" date.
        </Section>

        <Section title="9. Contact Information">
          For privacy questions or data requests, email <Mail />.
        </Section>
      </main>
      <PublicFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-2 leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function Mail() {
  return <a href="mailto:support@habitpet.app" className="font-semibold text-primary hover:underline">support@habitpet.app</a>;
}
