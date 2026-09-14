import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import petAdult from "@/assets/pet-adult.png";
import { PublicFooter, PublicNav } from "@/components/PublicFooter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HabitPet — Build Habits With Your Pet" },
      { name: "description", content: "Build daily habits. Hatch and grow a virtual pet that thrives on your streaks." },
      { property: "og:title", content: "HabitPet — Build Habits With Your Pet" },
      { property: "og:description", content: "Build daily habits. Hatch and grow a virtual pet that thrives on your streaks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();

  // Already signed in (e.g. returning from OAuth)? Go straight to the dashboard.
  useEffect(() => {
    let active = true;
    import("@/integrations/supabase/client").then(async ({ supabase }) => {
      const { data } = await supabase.auth.getSession();
      if (active && data.session?.user) navigate({ to: "/app", replace: true });
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      <main className="px-6 py-16 md:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
            ✨ Habit streaks, but cuter
          </span>
          <h1 className="text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Build habits. <br />
            <span className="bg-[var(--gradient-candy)] bg-clip-text text-transparent">
              Grow your HabitPet.
            </span>
          </h1>
          <p className="max-w-md text-lg text-muted-foreground">
            Every habit you keep feeds your virtual pet XP and happiness. Skip
            your habits and your HabitPet gets sad — and a little hangry. Grow it from
            egg to legend.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/app"
              className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-7 text-base font-semibold text-primary-foreground shadow-card transition hover:-translate-y-0.5 hover:shadow-pet"
            >
              Start with HabitPet →
            </Link>
            <Link
              to="/auth"
              className="inline-flex h-12 items-center justify-center rounded-full border-2 border-foreground/10 bg-card px-7 text-base font-semibold transition hover:bg-muted"
            >
              I already have an account
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-3 pt-6 text-sm font-medium">
            <li className="rounded-2xl bg-card p-3 shadow-card">🔥 Streak multipliers</li>
            <li className="rounded-2xl bg-card p-3 shadow-card">🥚 4 evolution stages</li>
            <li className="rounded-2xl bg-card p-3 shadow-card">💚 HP &amp; happiness</li>
            <li className="rounded-2xl bg-card p-3 shadow-card">⭐ Level-up animations</li>
          </ul>
        </div>
        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute inset-0 -z-10 rounded-[3rem] bg-[var(--gradient-sky)] blur-2xl opacity-70" />
          <div className="rounded-[3rem] bg-card p-10 shadow-pet">
            <img
              src={petAdult}
              alt="A cute Tamagotchi-style pet at its adult stage with a tiny crown"
              width={768}
              height={768}
              className="pet-float mx-auto h-auto w-full max-w-xs"
            />
          </div>
        </div>
      </div>
      </main>
      <PublicFooter />
    </div>
  );
}
