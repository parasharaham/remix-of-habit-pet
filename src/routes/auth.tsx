import { useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import petEgg from "@/assets/pet-egg.png";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — HabitPet" },
      { name: "description", content: "Sign in or create your HabitPet account to start growing your habit pet." },
      { property: "og:title", content: "Sign in — HabitPet" },
      { property: "og:description", content: "Sign in or create your HabitPet account to start growing your habit pet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) throw redirect({ to: "/app" });
  },
  component: AuthPage,
});


function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Welcome! Your egg is hatching…");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-[2.5rem] bg-card shadow-pet md:grid-cols-2">
        <div className="hidden flex-col items-center justify-center gap-4 bg-[image:var(--gradient-sky)] p-10 md:flex">
          <img src={petEgg} alt="" width={768} height={768} className="pet-float h-auto w-56" />
          <h2 className="text-center text-2xl font-bold">Your HabitPet is waiting</h2>
          <p className="text-center text-sm text-muted-foreground">
            One account, infinite streaks.
          </p>
        </div>

        <div className="space-y-5 p-8 md:p-10">
          <div className="flex items-center gap-2 font-extrabold">
            <BrandMark className="h-9 w-9" />
            <span>HabitPet</span>
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
            <p className="text-sm text-muted-foreground">
              {mode === "signin" ? "Sign in to feed your pet." : "Hatch your egg in seconds."}
            </p>
          </div>


          <form onSubmit={submit} className="space-y-3">
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border-2 border-input bg-background px-4 py-3 outline-none focus:border-ring"
            />
            <input
              type="password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border-2 border-input bg-background px-4 py-3 outline-none focus:border-ring"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground shadow-card transition hover:-translate-y-0.5 disabled:opacity-50"
            >
              {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="font-semibold text-primary hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Create one" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}
