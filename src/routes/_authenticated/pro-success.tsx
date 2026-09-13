import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Check, Sparkles } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { PRO_FEATURE_LIST } from "@/lib/entitlements";

export const Route = createFileRoute("/_authenticated/pro-success")({
  head: () => ({
    meta: [
      { title: "Welcome to HabitPet Pro" },
      { name: "description", content: "Your HabitPet Pro plan is active — everything is unlocked." },
    ],
  }),
  component: ProSuccessPage,
});

function ProSuccessPage() {
  const navigate = useNavigate();
  const sub = useSubscription();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--gradient-sky,transparent)] px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg rounded-[2.5rem] bg-card p-8 text-center shadow-pet md:p-10"
      >
        <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-3 py-1 text-xs font-bold uppercase tracking-wider text-background">
          <Sparkles size={12} /> Pro
        </span>
        <h1 className="mt-4 text-3xl font-bold">🎉 Welcome to HabitPet Pro!</h1>
        <p className="mt-2 text-muted-foreground">You've unlocked the full HabitPet experience.</p>

        <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left">
          {PRO_FEATURE_LIST.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm font-medium">
              <Check size={16} className="mt-0.5 shrink-0 text-primary" />
              {f}
            </li>
          ))}
        </ul>

        {sub.data?.current_period_end && (
          <p className="mt-5 text-xs text-muted-foreground">
            {sub.plan.name} · {sub.oneTime ? "access ends" : "renews"}{" "}
            {new Date(sub.data.current_period_end).toLocaleDateString()}
          </p>
        )}

        <button
          onClick={() => navigate({ to: "/app" })}
          className="mt-7 w-full rounded-full bg-primary px-6 py-3.5 font-bold text-primary-foreground shadow-card transition hover:-translate-y-0.5"
        >
          Start Using Pro
        </button>
      </motion.div>
    </main>
  );
}
