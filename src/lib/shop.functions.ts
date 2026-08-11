import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ShopItemDTO {
  id: string;
  name: string;
  description: string;
  category: string;
  image: string;
  coin_cost: number;
  rarity: "common" | "rare" | "epic" | "legendary";
  is_premium: boolean;
  owned: boolean;
  equipped: boolean;
}

export const listShop = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ShopItemDTO[]> => {
    const { supabase, userId } = context;
    const [itemsRes, invRes] = await Promise.all([
      supabase.from("shop_items").select("*").order("coin_cost"),
      supabase.from("user_inventory").select("item_id, equipped").eq("user_id", userId),
    ]);
    const inv = new Map<string, boolean>();
    for (const r of invRes.data ?? []) inv.set(r.item_id, r.equipped);
    return (itemsRes.data ?? []).map((i: any) => ({
      ...i,
      owned: inv.has(i.id),
      equipped: inv.get(i.id) ?? false,
    }));
  });

const IdSchema = z.object({ id: z.string().uuid() });

export const purchaseItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => IdSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; coins: number }> => {
    const { supabase, userId } = context;
    const item = (await supabase.from("shop_items").select("*").eq("id", data.id).single()).data;
    if (!item) throw new Error("Item not found");

    const prof = (await supabase.from("profiles").select("*").eq("id", userId).maybeSingle()).data;
    if (!prof) throw new Error("Profile missing");

    if (item.is_premium && !prof.is_premium) {
      throw new Error("This item requires Premium");
    }

    const owned = (
      await supabase
        .from("user_inventory")
        .select("id")
        .eq("user_id", userId)
        .eq("item_id", item.id)
        .maybeSingle()
    ).data;
    if (owned) throw new Error("Already owned");

    if (prof.coins < item.coin_cost) throw new Error("Not enough coins");

    const newCoins = prof.coins - item.coin_cost;
    const upd = await supabase.from("profiles").update({ coins: newCoins }).eq("id", userId);
    if (upd.error) throw upd.error;

    const ins = await supabase
      .from("user_inventory")
      .insert({ user_id: userId, item_id: item.id });
    if (ins.error) throw ins.error;

    await supabase.from("coin_transactions").insert({
      user_id: userId,
      amount: -item.coin_cost,
      reason: `Purchased: ${item.name}`,
    });
    await supabase.from("activity_feed").insert({
      user_id: userId,
      kind: "purchase",
      payload: { name: item.name, image: item.image, rarity: item.rarity },
    });

    return { ok: true, coins: newCoins };
  });

export const equipItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => IdSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;

    const item = (await supabase.from("shop_items").select("category").eq("id", data.id).single()).data;
    if (!item) throw new Error("Item not found");

    // Unequip others in same category
    const ownedSameCat = await supabase
      .from("user_inventory")
      .select("id, shop_items!inner(category)")
      .eq("user_id", userId)
      .eq("shop_items.category", item.category);
    for (const r of (ownedSameCat.data as any[]) ?? []) {
      await supabase.from("user_inventory").update({ equipped: false }).eq("id", r.id);
    }

    const upd = await supabase
      .from("user_inventory")
      .update({ equipped: true })
      .eq("user_id", userId)
      .eq("item_id", data.id);
    if (upd.error) throw upd.error;
    return { ok: true };
  });
