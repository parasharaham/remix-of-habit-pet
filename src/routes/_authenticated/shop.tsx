import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listShop, purchaseItem, equipItem } from "@/lib/shop.functions";
import { getProfile } from "@/lib/profile.functions";
import { AppShell } from "@/components/AppShell";
import { Coins, Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/shop")({
  head: () => ({
    meta: [
      { title: "Shop — HabitPet" },
      { name: "description", content: "Buy skins, accessories, backgrounds, and animations with coins." },
    ],
  }),
  component: ShopPage,
});

const CATS = ["all", "skin", "accessory", "background", "animation"] as const;

const RARITY: Record<string, { label: string; ring: string; text: string }> = {
  common: { label: "Common", ring: "ring-muted-foreground/30", text: "text-muted-foreground" },
  rare: { label: "Rare", ring: "ring-blue-400/60", text: "text-blue-500" },
  epic: { label: "Epic", ring: "ring-purple-400/60", text: "text-purple-500" },
  legendary: { label: "Legendary", ring: "ring-amber-400/70", text: "text-amber-500" },
};

function ShopPage() {
  const qc = useQueryClient();
  const fetchShop = useServerFn(listShop);
  const fetchProf = useServerFn(getProfile);
  const fnBuy = useServerFn(purchaseItem);
  const fnEquip = useServerFn(equipItem);

  const shop = useQuery({ queryKey: ["shop"], queryFn: () => fetchShop() });
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => fetchProf() });

  const [cat, setCat] = useState<(typeof CATS)[number]>("all");

  const buy = useMutation({
    mutationFn: (id: string) => fnBuy({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shop"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Purchase successful 🛍️");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't buy"),
  });

  const equip = useMutation({
    mutationFn: (id: string) => fnEquip({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shop"] });
      toast.success("Equipped!");
    },
  });

  const items = (shop.data ?? []).filter((i) => cat === "all" || i.category === cat);
  const isPremium = profile.data?.is_premium ?? false;

  return (
    <AppShell title="Shop" isAdmin={profile.data?.is_admin}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {CATS.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition ${
                cat === c ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-full bg-card px-4 py-2 text-sm font-bold shadow-card sm:self-auto">
          <Coins size={16} className="text-[var(--streak)]" /> {profile.data?.coins ?? 0} coins
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((i) => {
          const rar = RARITY[i.rarity] ?? RARITY.common;
          const locked = i.is_premium && !isPremium && !i.owned;
          const canAfford = (profile.data?.coins ?? 0) >= i.coin_cost;
          return (
            <article
              key={i.id}
              className={`flex flex-col rounded-[1.5rem] bg-card p-4 shadow-card ring-2 ${rar.ring}`}
            >
              <div className="grid aspect-square place-items-center rounded-2xl bg-[var(--gradient-meadow)] text-6xl">
                {i.image}
              </div>
              <div className="mt-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-bold">{i.name}</div>
                  <div className={`text-[11px] font-bold uppercase tracking-wider ${rar.text}`}>
                    {rar.label}
                  </div>
                </div>
                <div className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-bold">
                  <Coins size={12} /> {i.coin_cost}
                </div>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{i.description}</p>

              <div className="mt-3">
                {i.owned ? (
                  <button
                    onClick={() => !i.equipped && equip.mutate(i.id)}
                    disabled={i.equipped}
                    className={`w-full rounded-full py-2 text-sm font-bold transition ${
                      i.equipped
                        ? "bg-muted text-muted-foreground"
                        : "bg-foreground text-background hover:opacity-90"
                    }`}
                  >
                    {i.equipped ? "Equipped" : "Equip"}
                  </button>
                ) : locked ? (
                  <a
                    href="/pricing"
                    className="flex w-full items-center justify-center gap-1 rounded-full bg-[var(--gradient-candy)] py-2 text-sm font-bold text-primary-foreground"
                  >
                    <Lock size={14} /> Premium
                  </a>
                ) : (
                  <button
                    onClick={() => buy.mutate(i.id)}
                    disabled={!canAfford || buy.isPending}
                    className="w-full rounded-full bg-primary py-2 text-sm font-bold text-primary-foreground transition hover:-translate-y-0.5 disabled:opacity-50"
                  >
                    {canAfford ? "Buy" : "Need more coins"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}
