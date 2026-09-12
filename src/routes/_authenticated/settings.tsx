import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { deleteAccount, getProfile, updateProfile } from "@/lib/profile.functions";
import { AppShell } from "@/components/AppShell";
import { Moon, Sun } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useSubscription } from "@/hooks/useSubscription";
import { ProBadge } from "@/components/ProBadge";
import { statusLabel } from "@/lib/entitlements";
import { LanguagePicker } from "@/components/LanguagePicker";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — HabitPet" },
      { name: "description", content: "Manage your profile, theme, and notification preferences." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchProf = useServerFn(getProfile);
  const fnUpdate = useServerFn(updateProfile);
  const fnDelete = useServerFn(deleteAccount);

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => fetchProf() });
  const sub = useSubscription();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [dark, setDark] = useState(false);
  const [notif, setNotif] = useState({ daily: true, streaks: true, achievements: true });

  useEffect(() => {
    if (profile.data?.username) setUsername(profile.data.username);
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    const isDark = document.documentElement.classList.contains("dark");
    setDark(isDark);
  }, [profile.data?.username]);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("habitpet-theme", next ? "dark" : "light");
  }

  const save = useMutation({
    mutationFn: () => fnUpdate({ data: { username: username.trim() } }),
    onSuccess: (p) => {
      qc.setQueryData(["profile"], p);
      toast.success("Profile saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save"),
  });

  const del = useMutation({
    mutationFn: () => fnDelete(),
    onSuccess: async () => {
      await supabase.auth.signOut();
      qc.clear();
      toast.success("Account data removed");
      navigate({ to: "/", replace: true });
    },
  });

  return (
    <AppShell title="Settings" isAdmin={profile.data?.is_admin}>
      <div className="mx-auto max-w-2xl space-y-6">
        <section className="rounded-[2rem] bg-card p-6 shadow-pet md:p-8">
          <h2 className="mb-4 text-lg font-bold">Profile</h2>
          <div className="space-y-3">
            <Field label="Email">
              <input
                value={email}
                disabled
                className="w-full rounded-full border-2 border-input bg-muted/40 px-4 py-2.5 text-muted-foreground"
              />
            </Field>
            <Field label="Username">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Pick a username"
                maxLength={40}
                className="w-full rounded-full border-2 border-input bg-background px-4 py-2.5 outline-none focus:border-ring"
              />
            </Field>
            <div className="flex justify-end">
              <button
                onClick={() => save.mutate()}
                disabled={!username.trim() || save.isPending}
                className="rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-foreground disabled:opacity-50"
              >
                Save changes
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] bg-card p-6 shadow-pet md:p-8">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-lg font-bold">Subscription</h2>
            {sub.isPro && <ProBadge />}
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Current plan</dt>
              <dd className="font-semibold">{sub.plan.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-semibold">{sub.planLabel}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Billing</dt>
              <dd className="font-semibold">
                {sub.plan.price === 0
                  ? "$0"
                  : `${sub.plan.priceLabel} / ${sub.plan.periodLabel}${sub.oneTime ? " (one-time)" : ""}`}
              </dd>
            </div>
            {sub.data?.current_period_end && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  {sub.data.cancel_at_period_end ? "Access ends" : "Renews"}
                </dt>
                <dd className="font-semibold">
                  {new Date(sub.data.current_period_end).toLocaleDateString()}
                </dd>
              </div>
            )}
          </dl>
          {sub.status === "payment_failed" && (
            <p className="mt-3 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
              We couldn't process your Pro renewal. Update your payment method to keep Pro active.
            </p>
          )}
          {sub.isPro && sub.daysUntilRenewal !== null && sub.daysUntilRenewal <= 7 && (
            <p className="mt-3 rounded-2xl bg-muted/60 p-3 text-sm">
              Your Pro plan {sub.data?.cancel_at_period_end ? "ends" : "renews"} in {sub.daysUntilRenewal} days.
            </p>
          )}
          <Link
            to="/pricing"
            className="mt-4 inline-block rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-foreground"
          >
            {sub.isPro ? "Manage Subscription" : "Upgrade to Pro"}
          </Link>
        </section>

        <section className="rounded-[2rem] bg-card p-6 shadow-pet md:p-8">
          <LanguagePicker />
        </section>

        <section className="rounded-[2rem] bg-card p-6 shadow-pet md:p-8">
          <h2 className="mb-4 text-lg font-bold">Appearance</h2>
          <button
            onClick={toggleTheme}
            className="flex w-full items-center justify-between rounded-2xl bg-muted/40 p-4"
          >
            <span className="flex items-center gap-3 font-semibold">
              {dark ? <Moon size={18} /> : <Sun size={18} />}
              {dark ? "Dark mode" : "Light mode"}
            </span>
            <span className={`relative h-6 w-11 rounded-full transition ${dark ? "bg-primary" : "bg-input"}`}>
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition ${
                  dark ? "left-5" : "left-0.5"
                }`}
              />
            </span>
          </button>
        </section>

        <section className="rounded-[2rem] bg-card p-6 shadow-pet md:p-8">
          <h2 className="mb-4 text-lg font-bold">Notifications</h2>
          <div className="space-y-3">
            <Toggle label="Daily reminders" value={notif.daily} onChange={(v) => setNotif({ ...notif, daily: v })} />
            <Toggle label="Streak warnings" value={notif.streaks} onChange={(v) => setNotif({ ...notif, streaks: v })} />
            <Toggle label="Achievement alerts" value={notif.achievements} onChange={(v) => setNotif({ ...notif, achievements: v })} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Preferences saved locally for now.</p>
        </section>

        <section className="rounded-[2rem] border-2 border-destructive/30 bg-card p-6 shadow-pet md:p-8">
          <h2 className="mb-2 text-lg font-bold text-destructive">Danger zone</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Permanently delete all of your pet, habits, achievements, and coin history.
          </p>
          <button
            onClick={() => {
              if (confirm("This will delete all your HabitPet data. Continue?")) del.mutate();
            }}
            className="rounded-full bg-destructive px-5 py-2.5 font-semibold text-destructive-foreground"
          >
            Delete my data
          </button>
        </section>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between rounded-2xl bg-muted/40 p-4"
    >
      <span className="font-semibold">{label}</span>
      <span className={`relative h-6 w-11 rounded-full transition ${value ? "bg-primary" : "bg-input"}`}>
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition ${value ? "left-5" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}
