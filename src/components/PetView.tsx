import { useEffect, useRef, useState } from "react";
import petEgg from "@/assets/pet-egg.png";
import petBaby from "@/assets/pet-baby.png";
import petChild from "@/assets/pet-child.png";
import petAdult from "@/assets/pet-adult.png";

type Stage = "egg" | "baby" | "child" | "adult";

const STAGE_SRC: Record<Stage, string> = {
  egg: petEgg,
  baby: petBaby,
  child: petChild,
  adult: petAdult,
};

const STAGE_LABEL: Record<Stage, string> = {
  egg: "Egg",
  baby: "Baby",
  child: "Child",
  adult: "Adult",
};

interface Props {
  name: string;
  stage: Stage;
  level: number;
  pulseKey?: number; // bump to trigger pop animation
  leveledUp?: boolean;
}

export function PetView({ name, stage, level, pulseKey, leveledUp }: Props) {
  const [pop, setPop] = useState(false);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setPop(true);
    const t = setTimeout(() => setPop(false), 700);
    return () => clearTimeout(t);
  }, [pulseKey]);

  return (
    <div className="relative mx-auto flex flex-col items-center gap-2">
      <div className="absolute -inset-6 -z-10 rounded-full bg-[var(--gradient-meadow)] blur-2xl" />
      <div className={pop ? "pet-pop" : "pet-float"}>
        <img
          src={STAGE_SRC[stage]}
          alt={`${name}, currently a ${STAGE_LABEL[stage].toLowerCase()}`}
          width={768}
          height={768}
          className="h-48 w-48 select-none drop-shadow-xl md:h-56 md:w-56"
        />
      </div>

      {leveledUp && (
        <>
          <span className="sparkle absolute left-1/4 top-2 text-3xl">✨</span>
          <span className="sparkle absolute right-1/4 top-6 text-3xl" style={{ animationDelay: "120ms" }}>⭐</span>
          <span className="sparkle absolute left-1/2 top-0 text-3xl" style={{ animationDelay: "240ms" }}>💫</span>
        </>
      )}

      <div className="text-center">
        <div className="text-2xl font-bold">{name}</div>
        <div className="text-sm font-medium text-muted-foreground">
          Lv. {level} · {STAGE_LABEL[stage]}
        </div>
      </div>
    </div>
  );
}
