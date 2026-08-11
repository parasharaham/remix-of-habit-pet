import { getPet } from "@/lib/pet-catalog";

const STAGE_OVERLAY: Record<string, string> = {
  egg: "🥚",
  baby: "👶",
  child: "✨",
  adult: "⭐",
};

interface Props {
  type: string;
  stage: "egg" | "baby" | "child" | "adult";
  size?: "sm" | "md" | "lg" | "xl";
  background?: string | null;
  accessory?: string | null;
}

const SIZE: Record<NonNullable<Props["size"]>, string> = {
  sm: "h-16 w-16",
  md: "h-28 w-28",
  lg: "h-44 w-44",
  xl: "h-56 w-56",
};

export function PetEmoji({ type, stage, size = "lg", background, accessory }: Props) {
  const pet = getPet(type);
  return (
    <div
      className={`relative mx-auto flex select-none items-center justify-center rounded-full ${SIZE[size]}`}
      style={{
        background: background
          ? `radial-gradient(circle, color-mix(in oklab, var(--primary) 20%, transparent), transparent 70%)`
          : "var(--gradient-meadow)",
      }}
    >
      {background && (
        <span className="absolute inset-0 flex items-center justify-center text-[60%] opacity-20">
          {background}
        </span>
      )}
      <img
        src={pet.image}
        alt={pet.label}
        width={512}
        height={512}
        loading="lazy"
        className="pet-float h-[92%] w-[92%] object-contain drop-shadow-md"
      />
      <span className="absolute -top-1 -right-1 text-2xl">{STAGE_OVERLAY[stage]}</span>
      {accessory && (
        <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-3xl">{accessory}</span>
      )}
    </div>
  );
}
