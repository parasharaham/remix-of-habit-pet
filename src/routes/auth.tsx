import { useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import petEgg from "@/assets/pet-egg.png";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Tama" },
      { name: "description", content: "Sign in or create your Tama account to start growing your habit pet." },
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

  async function withGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/app" });
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-[2.5rem] bg-card shadow-pet md:grid-cols-2">
        <div className="hidden flex-col items-center justify-center gap-4 bg-[var(--gradient-sky)] p-10 md:flex">
          <img src={petEgg} alt="" width={768} height={768} className="pet-float h-auto w-56" />
          <h2 className="text-center text-2xl font-bold">Your Tama is waiting</h2>
          <p className="text-center text-sm text-muted-foreground">
            One account, infinite streaks.
          </p>
        </div>

        <div className="space-y-5 p-8 md:p-10">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
            <p className="text-sm text-muted-foreground">
              {mode === "signin" ? "Sign in to feed your pet." : "Hatch your egg in seconds."}
            </p>
          </div>

          <button
            onClick={withGoogle}
            disabled={busy}
            type="button"
            className="flex w-full items-center justify-center gap-3 rounded-full border-2 border-foreground/10 bg-card px-4 py-3 font-semibold transition hover:bg-muted disabled:opacity-50"
          >
            <span className="text-lg">G</span> Continue with Google
          </button>

          <div className="relative text-center text-xs text-muted-foreground">
            <span className="bg-card px-3">or with email</span>
            <div className="absolute left-0 right-0 top-1/2 -z-10 h-px bg-border" />
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
              minLength={8}
              placeholder="Password (8+ characters)"
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
