import petEgg from "@/assets/pet-egg.png";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("grid shrink-0 place-items-center overflow-hidden rounded-xl bg-primary", className)}>
      <img src={petEgg} alt="" className="h-full w-full object-contain p-0.5" />
    </span>
  );
}