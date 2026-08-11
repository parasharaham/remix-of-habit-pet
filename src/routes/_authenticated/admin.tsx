import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminOverview } from "@/lib/admin.functions";
import { getProfile } from "@/lib/profile.functions";
import { AppShell } from "@/components/AppShell";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — HabitPet" },
      { name: "description", content: "Internal admin console." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const fetchProf = useServerFn(getProfile);
  const fetchOverview = useServerFn(getAdminOverview);
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => fetchProf() });
  const overview = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => fetchOverview(),
    retry: false,
  });

  if (!profile.data?.is_admin) {
    return (
      <AppShell title="Admin" isAdmin={false}>
        <div className="mx-auto max-w-md rounded-[2rem] bg-card p-8 text-center shadow-pet">
          <Shield className="mx-auto mb-3 text-destructive" size={48} />
          <h2 className="text-xl font-bold">Admin only</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You need an admin role to view this page. Ask an existing admin to flip{" "}
            <code className="rounded bg-muted px-1">profiles.is_admin = true</code> for your account.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Admin" isAdmin>
      {overview.data ? (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-4">
            <Kpi label="Users" value={overview.data.totalUsers} icon="👤" />
            <Kpi label="Habits" value={overview.data.totalHabits} icon="📋" />
            <Kpi label="Completions" value={overview.data.totalCompletions} icon="✅" />
            <Kpi label="Premium" value={overview.data.totalPremium} icon="💎" />
          </div>

          <section className="rounded-[2rem] bg-card p-6 shadow-pet md:p-8">
            <h2 className="mb-4 text-lg font-bold">Recent users</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 text-left font-semibold">Username</th>
                    <th className="py-2 text-right font-semibold">Coins</th>
                    <th className="py-2 text-right font-semibold">Habits done</th>
                    <th className="py-2 text-right font-semibold">Premium</th>
                    <th className="py-2 text-right font-semibold">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.data.recentUsers.map((u) => (
                    <tr key={u.id} className="border-b border-border/50">
                      <td className="py-2 font-medium">{u.username || u.id.slice(0, 8)}</td>
                      <td className="py-2 text-right">{u.coins}</td>
                      <td className="py-2 text-right">{u.total_habits_completed}</td>
                      <td className="py-2 text-right">{u.is_premium ? "✅" : "—"}</td>
                      <td className="py-2 text-right text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <div className="py-20 text-center text-muted-foreground">Loading…</div>
      )}
    </AppShell>
  );
}

function Kpi({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="rounded-[1.5rem] bg-card p-5 shadow-card">
      <div className="text-2xl">{icon}</div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-3xl font-bold">{value.toLocaleString()}</div>
    </div>
  );
}
