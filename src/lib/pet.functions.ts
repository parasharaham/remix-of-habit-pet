import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  computeDecay,
  clamp,
  stageForLevel,
  xpNeededForLevel,
  applyXpGain,
} from "./pet-engine";

const RenameSchema = z.object({ pet_name: z.string().trim().min(1).max(40) });

export interface PetStatusDTO {
  id: string;
  pet_name: string;
  pet_type: string;
  pet_stage: "egg" | "baby" | "child" | "adult";
  health_points: number;
  happiness_points: number;
  energy_points: number;
  total_experience_points: number;
  current_level: number;
  xp_into_level: number;
  xp_to_next: number;
  last_decay_checked_at: string;
  created_at: string;
}

async function fetchOrCreatePet(supabase: any, userId: string) {
  const existing = await supabase.from("pets").select("*").eq("user_id", userId).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;
  const inserted = await supabase.from("pets").insert({ user_id: userId }).select("*").single();
  if (inserted.error) throw inserted.error;
  return inserted.data;
}

function toDTO(pet: any): PetStatusDTO {
  const calc = applyXpGain(pet.current_level, pet.total_experience_points, 0);
  return {
    id: pet.id,
    pet_name: pet.pet_name,
    pet_type: pet.pet_type ?? "dog",
    pet_stage: stageForLevel(calc.newLevel),
    health_points: pet.health_points,
    happiness_points: pet.happiness_points,
    energy_points: pet.energy_points ?? 100,
    total_experience_points: pet.total_experience_points,
    current_level: calc.newLevel,
    xp_into_level: calc.xpIntoLevel,
    xp_to_next: xpNeededForLevel(calc.newLevel),
    last_decay_checked_at: pet.last_decay_checked_at,
    created_at: pet.created_at,
  };
}

export const getPetStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PetStatusDTO> => {
    const pet = await fetchOrCreatePet(context.supabase, context.userId);
    return toDTO(pet);
  });

export const renamePet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => RenameSchema.parse(d))
  .handler(async ({ data, context }): Promise<PetStatusDTO> => {
    const { supabase, userId } = context;
    await fetchOrCreatePet(supabase, userId);
    const { data: pet, error } = await supabase
      .from("pets")
      .update({ pet_name: data.pet_name })
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw error;
    return toDTO(pet);
  });

export const syncDecay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PetStatusDTO> => {
    const { supabase, userId } = context;
    const pet = await fetchOrCreatePet(supabase, userId);

    const { data: habits, error: hErr } = await supabase
      .from("habits")
      .select("id,last_completed_at")
      .eq("user_id", userId)
      .eq("is_active", true);
    if (hErr) throw hErr;

    const total = habits?.length ?? 0;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const completed = (habits ?? []).filter(
      (h: any) => h.last_completed_at && new Date(h.last_completed_at) >= startOfToday,
    ).length;

    const { healthDecay, happinessDecay, ticks } = computeDecay({
      activeHabits: total,
      completedHabits: completed,
      lastCheckedAt: new Date(pet.last_decay_checked_at),
    });

    if (ticks <= 0) return toDTO(pet);

    const newHealth = clamp(pet.health_points - healthDecay, 0, 100);
    const newHappy = clamp(pet.happiness_points - happinessDecay, 0, 100);
    const newEnergy = clamp((pet.energy_points ?? 100) - Math.round(healthDecay / 2), 0, 100);

    const { data: updated, error: uErr } = await supabase
      .from("pets")
      .update({
        health_points: newHealth,
        happiness_points: newHappy,
        energy_points: newEnergy,
        last_decay_checked_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .select("*")
      .single();
    if (uErr) throw uErr;
    return toDTO(updated);
  });
