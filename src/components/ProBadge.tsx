import { Sparkles } from "lucide-react";

/** Compact Pro marker shown near the account area. */
export function ProBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-background ${className}`}
    >
      <Sparkles size={10} /> Pro
    </span>
  );
}
