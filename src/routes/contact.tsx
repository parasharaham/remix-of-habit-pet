import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Mail, Clock, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PublicFooter, PublicNav } from "@/components/PublicFooter";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us — HabitPet" },
      { name: "description", content: "Get in touch with the HabitPet team for support, billing, or partnership inquiries." },
      { property: "og:title", content: "Contact HabitPet" },
      { property: "og:description", content: "We usually reply within 24–48 hours." },
    ],
  }),
  component: ContactPage,
});

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  subject: z.string().trim().min(1, "Subject is required").max(200),
  message: z.string().trim().min(1, "Message is required").max(5000),
});

function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    setSending(true);
    const { error } = await supabase.from("contact_submissions").insert(parsed.data);
    setSending(false);
    if (error) {
      toast.error("Couldn't send. Please email support@habitpet.app");
      return;
    }
    setSent(true);
    setForm({ name: "", email: "", subject: "", message: "" });
    toast.success("Message sent — we'll reply within 24–48 hours.");
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      <main className="mx-auto max-w-5xl px-6 py-16">
        <header className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Contact</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight md:text-5xl">Contact Us</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Questions, billing issues, partnership requests, or support inquiries — we'd love to hear from you.
          </p>
        </header>

        <div className="mt-12 grid gap-8 md:grid-cols-[1fr_2fr]">
          <aside className="space-y-4">
            <InfoCard icon={<Mail size={18} />} label="Support email" value="support@habitpet.app" href="mailto:support@habitpet.app" />
            <InfoCard icon={<Building2 size={18} />} label="Business" value="SevenLabs" />
            <InfoCard icon={<Clock size={18} />} label="Response time" value="Usually within 24–48 hours" />
          </aside>

          <form onSubmit={submit} className="space-y-4 rounded-3xl border border-foreground/10 bg-card p-6 shadow-card">
            {sent && (
              <div className="rounded-2xl bg-primary/10 p-4 text-sm text-primary">
                Thanks! Your message is in. We'll get back to you soon.
              </div>
            )}
            <Field label="Name">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={100}
                required
                className="input"
                placeholder="Jane Doe"
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                maxLength={255}
                required
                className="input"
                placeholder="jane@example.com"
              />
            </Field>
            <Field label="Subject">
              <input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                maxLength={200}
                required
                className="input"
                placeholder="How can we help?"
              />
            </Field>
            <Field label="Message">
              <textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                maxLength={5000}
                required
                rows={6}
                className="input resize-none"
                placeholder="Tell us a bit about your question…"
              />
            </Field>
            <button
              type="submit"
              disabled={sending}
              className="w-full rounded-full bg-primary px-6 py-3.5 font-bold text-primary-foreground shadow-card transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {sending ? "Sending…" : "Send Message"}
            </button>
          </form>
        </div>
      </main>
      <PublicFooter />

      <style>{`
        .input {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid color-mix(in oklab, currentColor 12%, transparent);
          background: var(--background);
          padding: 0.75rem 1rem;
          font-size: 0.95rem;
          outline: none;
          transition: border-color .15s, box-shadow .15s;
        }
        .input:focus { border-color: var(--primary); box-shadow: 0 0 0 4px color-mix(in oklab, var(--primary) 20%, transparent); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}

function InfoCard({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  const inner = (
    <div className="flex items-start gap-3 rounded-2xl border border-foreground/10 bg-card p-4 shadow-card">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 font-semibold">{value}</p>
      </div>
    </div>
  );
  return href ? <a href={href} className="block transition hover:-translate-y-0.5">{inner}</a> : inner;
}
