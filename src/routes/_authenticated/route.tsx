import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Session restore gate.
 *
 * We use getSession() (not getUser()) so a stored session is restored from the
 * browser persistence layer and silently refreshed when the access token is
 * stale — a transient network failure must never sign the user out.
 */
async function restoreSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  if (data.session) return data.session;

  // Supabase may still be rehydrating storage on a cold start; give it one tick
  // and wait for INITIAL_SESSION before deciding the user is signed out.
  return await new Promise<Session | null>((resolve) => {
    let settled = false;
    const finish = (s: Session | null) => {
      if (settled) return;
      settled = true;
      sub.data.subscription.unsubscribe();
      clearTimeout(timer);
      resolve(s);
    };
    const sub = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        finish(session ?? null);
      }
    });
    const timer = setTimeout(() => finish(null), 1500);
  });
}

export function AuthSplash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="grid h-16 w-16 animate-[float-slow_3s_ease-in-out_infinite] place-items-center rounded-3xl bg-[image:var(--gradient-primary)] text-3xl shadow-glow">
          🐣
        </span>
        <p className="text-sm font-semibold text-muted-foreground">Loading your HabitPet…</p>
        <span className="h-1 w-32 overflow-hidden rounded-full bg-muted">
          <span className="block h-full w-1/2 animate-pulse rounded-full bg-primary" />
        </span>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  pendingMs: 0,
  pendingComponent: AuthSplash,
  beforeLoad: async () => {
    const session = await restoreSession();
    if (!session?.user) throw redirect({ to: "/auth" });
    return { user: session.user };
  },
  component: () => <Outlet />,
});
