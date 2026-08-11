import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getPetStatus, renamePet } from "@/lib/pet.functions";
import { getProfile } from "@/lib/profile.functions";
import { listShop, equipItem } from "@/lib/shop.functions";
import { AppShell } from "@/components/AppShell";
import { PetEmoji } from "@/components/PetEmoji";
import { StatBar } from "@/components/StatBar";
import { Edit2, Save, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pet")({
  head: () => ({
    meta: [
      { title: "My Pet — HabitPet" },
      { name: "description", content: "View your pet's stats, evolution, and customize their look." },
    ],
  }),
  component: PetPage,
});

const STAGES: { key: "egg" | "baby" | "child" | "adult"; label: string; req: string }[] = [
  { key: "egg", label: "Egg", req: "Lv 1-3" },
  { key: "baby", label: "Baby", req: "Lv 4-7" },
  { key: "child", label: "Child", req: "Lv 8-15" },
  { key: "adult", label: "Adult", req: "Lv 16+" },
];

function statusOf(health: number, happy: number, energy: number) {
  if (health < 30) return { label: "Sick", emoji: "🤒", tone: "text-destructive" };
  if (happy < 30) return { label: "Sad", emoji: "😢", tone: "text-blue-500" };
  if (energy < 30) return { label: "Tired", emoji: "😴", tone: "text-amber-600" };
  if (happy > 80 && health > 80) return { label: "Excited", emoji: "🤩", tone: "text-primary" };
  return { label: "Happy", emoji: "😊", tone: "text-[var(--hp)]" };
}

function PetPage() {
  const qc = useQueryClient();
  const fetchPet = useServerFn(getPetStatus);
  const fetchProf = useServerFn(getProfile);
  const fetchShop = useServerFn(listShop);
  const fnRename = useServerFn(renamePet);
  const fnEquip = useServerFn(equipItem);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  const pet = useQuery({ queryKey: ["pet"], queryFn: () => fetchPet() });
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => fetchProf() });
  const shop = useQuery({ queryKey: ["shop"], queryFn: () => fetchShop() });

  const rename = useMutation({
    mutationFn: (n: string) => fnRename({ data: { pet_name: n } }),
    onSuccess: (p) => {
      qc.setQueryData(["pet"], p);
      setEditing(false);
      toast.success("Renamed");
    },
  });

  const equip = useMutation({
    mutationFn: (id: string) => fnEquip({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shop"] });
      toast.success("Equipped!");
    },
  });

  const owned = (shop.data ?? []).filter((i) => i.owned);
  const equippedAccessory = owned.find((i) => i.category === "accessory" && i.equipped);
  const equippedBackground = owned.find((i) => i.category === "background" && i.equipped);

  if (!pet.data) {
    return (
      <AppShell isAdmin={profile.data?.is_admin}>
        <div className="py-20 text-center text-muted-foreground">Loading your pet…</div>
      </AppShell>
    );
  }

  const p = pet.data;
  const status = statusOf(p.health_points, p.happiness_points, p.energy_points);
  const daysActive = Math.max(
    1,
    Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86_400_000),
  );

  return (
    <AppShell title="My Pet" isAdmin={profile.data?.is_admin}>
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-[2rem] bg-card p-6 shadow-pet md:p-8">
          <PetEmoji
            type={p.pet_type}
            stage={p.pet_stage}
            size="xl"
            background={equippedBackground?.image ?? null}
            accessory={equippedAccessory?.image ?? null}
          />
          <div className="mt-4 text-center">
            {editing ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (name.trim()) rename.mutate(name.trim());
                }}
                className="flex justify-center gap-2"
              >
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={40}
                  className="rounded-full border-2 border-input bg-background px-4 py-1.5 text-center font-semibold outline-none focus:border-ring"
                />
                <button type="submit" className="rounded-full bg-primary px-3 text-primary-foreground" aria-label="Save">
                  <Save size={16} />
                </button>
                <button type="button" onClick={() => setEditing(false)} className="rounded-full bg-muted px-3" aria-label="Cancel">
                  <X size={16} />
                </button>
              </form>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-3xl font-bold">{p.pet_name}</h2>
                <button
                  onClick={() => {
                    setName(p.pet_name);
                    setEditing(true);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Rename"
                >
                  <Edit2 size={16} />
                </button>
              </div>
            )}
            <p className="text-sm text-muted-foreground capitalize">
              {p.pet_type} · {p.pet_stage} · Lv. {p.current_level}
            </p>
            <p className={`mt-2 inline-flex items-center gap-1 text-sm font-semibold ${status.tone}`}>
              {status.emoji} {status.label}
            </p>
          </div>

          <div className="mt-6 space-y-4">
            <StatBar label="Health" value={p.health_points} max={100} variant="hp" icon="💚" />
            <StatBar label="Happiness" value={p.happiness_points} max={100} variant="happy" icon="😊" />
            <StatBar label="Energy" value={p.energy_points} max={100} variant="happy" icon="⚡" />
            <StatBar label="XP" value={p.xp_into_level} max={p.xp_to_next} variant="xp" icon="⭐" />
          </div>
        </section>

        <div className="space-y-6">
          {/* Evolution timeline */}
          <section className="rounded-[2rem] bg-card p-6 shadow-pet md:p-8">
            <h3 className="mb-4 text-lg font-bold">Evolution timeline</h3>
            <ol className="grid grid-cols-4 gap-2">
              {STAGES.map((s, i) => {
                const active = s.key === p.pet_stage;
                const past = STAGES.findIndex((x) => x.key === p.pet_stage) > i;
                return (
                  <li
                    key={s.key}
                    className={`rounded-2xl border-2 p-3 text-center text-xs font-semibold ${
                      active
                        ? "border-primary bg-primary/10"
                        : past
                          ? "border-transparent bg-muted/60 text-muted-foreground"
                          : "border-dashed border-border text-muted-foreground"
                    }`}
                  >
                    <div className="text-2xl">{past || active ? "🌟" : "🔒"}</div>
                    <div>{s.label}</div>
                    <div className="opacity-60">{s.req}</div>
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {p.pet_stage === "adult"
                ? "Your pet has reached its final form!"
                : `${p.xp_to_next - p.xp_into_level} XP until next milestone`}
            </p>
          </section>

          {/* Stats */}
          <section className="rounded-[2rem] bg-card p-6 shadow-pet md:p-8">
            <h3 className="mb-4 text-lg font-bold">Statistics</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Days active" value={daysActive} />
              <Stat label="Pet level" value={p.current_level} />
              <Stat label="Total XP" value={p.total_experience_points} />
              <Stat label="Habits done" value={profile.data?.total_habits_completed ?? 0} />
              <Stat label="Coins earned" value={profile.data?.total_coins_earned ?? 0} />
              <Stat label="Owned items" value={owned.length} />
            </div>
          </section>

          {/* Inventory */}
          <section className="rounded-[2rem] bg-card p-6 shadow-pet md:p-8">
            <h3 className="mb-4 text-lg font-bold">Inventory</h3>
            {owned.length === 0 ? (
              <p className="rounded-2xl bg-muted/50 p-6 text-center text-sm text-muted-foreground">
                Nothing equipped yet. Visit the shop to grab skins, accessories, and backgrounds.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {owned.map((i) => (
                  <button
                    key={i.id}
                    onClick={() => equip.mutate(i.id)}
                    className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-3 text-xs font-semibold transition ${
                      i.equipped
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background hover:border-primary/50"
                    }`}
                  >
                    <span className="text-3xl">{i.image}</span>
                    <span className="truncate w-full text-center">{i.name}</span>
                    {i.equipped && <span className="text-[10px] text-primary">Equipped</span>}
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-muted/40 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-bold">{value.toLocaleString()}</div>
    </div>
  );
}
