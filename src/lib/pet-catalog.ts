import dragon from "@/assets/pets/dragon.jpg";
import redPanda from "@/assets/pets/red_panda.jpg";
import axolotl from "@/assets/pets/axolotl.jpg";
import shiba from "@/assets/pets/shiba.jpg";
import fox from "@/assets/pets/fox.jpg";
import owl from "@/assets/pets/owl.jpg";
import penguin from "@/assets/pets/penguin.jpg";
import capybara from "@/assets/pets/capybara.jpg";
import dinosaur from "@/assets/pets/dinosaur.jpg";
import bunny from "@/assets/pets/bunny.jpg";

export type PetType =
  | "dragon"
  | "red_panda"
  | "axolotl"
  | "shiba"
  | "fox"
  | "owl"
  | "penguin"
  | "capybara"
  | "dinosaur"
  | "bunny"
  // legacy fallbacks
  | "dog"
  | "cat";

export interface PetDef {
  type: PetType;
  label: string;
  vibe: string;
  image: string;
}

export const PETS: PetDef[] = [
  { type: "dragon", label: "Baby Dragon", vibe: "Mythical & fiery", image: dragon },
  { type: "red_panda", label: "Red Panda", vibe: "Fluffy & playful", image: redPanda },
  { type: "axolotl", label: "Axolotl", vibe: "Rare & smiley", image: axolotl },
  { type: "shiba", label: "Shiba Puppy", vibe: "Loyal & bold", image: shiba },
  { type: "fox", label: "Baby Fox", vibe: "Clever & quick", image: fox },
  { type: "owl", label: "Baby Owl", vibe: "Wise & watchful", image: owl },
  { type: "penguin", label: "Penguin Chick", vibe: "Cool & cuddly", image: penguin },
  { type: "capybara", label: "Capybara", vibe: "Calm & chill", image: capybara },
  { type: "dinosaur", label: "Baby Dino", vibe: "Tiny & mighty", image: dinosaur },
  { type: "bunny", label: "Baby Bunny", vibe: "Soft & sweet", image: bunny },
];

const MAP: Record<string, PetDef> = Object.fromEntries(PETS.map((p) => [p.type, p]));
// legacy aliases so existing DB rows still render
MAP.dog = MAP.shiba;
MAP.cat = MAP.red_panda;

export function getPet(type: string): PetDef {
  return MAP[type] ?? MAP.dragon;
}
