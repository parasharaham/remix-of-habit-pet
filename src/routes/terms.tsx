import { createFileRoute } from "@tanstack/react-router";
import { PublicFooter, PublicNav } from "@/components/PublicFooter";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — HabitPet" },
      { name: "description", content: "The terms that govern your use of HabitPet by SevenLabs." },
      { property: "og:title", content: "HabitPet — Terms of Service" },
      { property: "og:description", content: "Read the HabitPet Terms of Service." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Legal</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

        <p className="mt-8 text-muted-foreground">
          Welcome to HabitPet ("HabitPet", "we", "us", "our"), operated by SevenLabs. These Terms of Service
          ("Terms") govern your access to and use of our website, mobile application, and related services
          (collectively, the "Service"). By using HabitPet you agree to these Terms.
        </p>

        <Section title="1. Acceptance of Terms">
          By accessing or using the Service you confirm that you are at least 13 years old and that you agree
          to be bound by these Terms and our Privacy Policy. If you do not agree, do not use the Service.
        </Section>

        <Section title="2. User Accounts">
          You are responsible for safeguarding your account credentials and for all activity that occurs under
          your account. Notify us immediately at <Mail /> if you suspect unauthorized access. We may suspend
          or terminate accounts that contain inaccurate information or that are used in violation of these Terms.
        </Section>

        <Section title="3. Subscription Services">
          HabitPet offers free and paid subscription plans. Paid subscriptions are billed in advance on a
          recurring basis (monthly or yearly) and automatically renew at the end of each billing cycle until
          canceled. You may cancel at any time from your billing settings; cancellation takes effect at the end
          of the current billing period. Prices, features, and plan limits may change with reasonable notice.
        </Section>

        <Section title="4. Acceptable Use">
          You agree not to: (a) abuse, disrupt, or attempt to gain unauthorized access to the Service or its
          related systems; (b) spam, harass, or harm other users; (c) scrape, copy, or resell any part of the
          Service; (d) use the Service for any unlawful purpose or to violate any applicable law or regulation;
          or (e) attempt to reverse engineer or interfere with the Service.
        </Section>

        <Section title="5. Intellectual Property">
          The Service, including all software, text, graphics, logos, and pet artwork, is owned by SevenLabs or
          its licensors and is protected by copyright, trademark, and other laws. You retain ownership of
          content you submit, but grant us a limited license to host and display it as needed to operate the
          Service.
        </Section>

        <Section title="6. Limitation of Liability">
          The Service is provided "as is" and "as available" without warranties of any kind, express or
          implied. To the maximum extent permitted by law, SevenLabs shall not be liable for any indirect,
          incidental, special, consequential, or punitive damages, or any loss of profits or data, arising out
          of or in connection with your use of the Service.
        </Section>

        <Section title="7. Termination">
          We may suspend or terminate your access to the Service at any time, with or without notice, for
          conduct that we believe violates these Terms, is harmful to other users, harmful to us or third
          parties, or constitutes fraud. You may stop using the Service and delete your account at any time.
        </Section>

        <Section title="8. Changes to These Terms">
          We may update these Terms from time to time. When we do, we will revise the "Last updated" date
          above. Material changes will be communicated by email or in-app notice. Continued use of the Service
          after changes take effect constitutes acceptance of the updated Terms.
        </Section>

        <Section title="9. Contact Information">
          Questions about these Terms? Reach our support team at <Mail />.
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
