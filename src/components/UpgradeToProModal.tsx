import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { Check, X } from "lucide-react";
import {
  PRICING,
  PRO_FEATURE_LIST,
  UPGRADE_COPY,
  YEARLY_PER_MONTH,
  type UpgradeSource,
} from "@/lib/entitlements";
import { trackSubEvent } from "@/lib/sub-analytics";

interface Props {
  open: boolean;
  source: UpgradeSource;
  onClose: () => void;
  /** Optional line describing the exact limit that was hit. */
  detail?: string;
  dismissLabel?: string;
}

/** Reusable, context-aware upgrade modal. */
export function UpgradeToProModal({ open, source, onClose, detail, dismissLabel = "Maybe Later" }: Props) {
  const navigate = useNavigate();
  const copy = UPGRADE_COPY[source];

  useEffect(() => {
    if (open) trackSubEvent("upgrade_modal_viewed", { source });
  }, [open, source]);

  function upgrade() {
    trackSubEvent("upgrade_clicked", { source });
    onClose();
    navigate({ to: "/pricing" });
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 p-4 backdrop-blur-sm sm:items-center"
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            initial={{ y: 24, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Upgrade to HabitPet Pro"
            className="relative w-full max-w-md overflow-hidden rounded-[2rem] bg-card p-7 shadow-pet"
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground transition hover:bg-muted"
            >
              <X size={18} />
            </button>

            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
              🐾 HabitPet Pro
            </span>
            <h2 className="mt-3 text-2xl font-bold leading-tight">{copy.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{detail ?? copy.subtitle}</p>

            <ul className="mt-5 space-y-2">
              {PRO_FEATURE_LIST.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm font-medium">
                  <Check size={16} className="mt-0.5 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>

            <div className="mt-5 rounded-2xl bg-muted/50 p-4 text-center">
              <p className="text-lg font-bold">
                {PRICING.monthly.label}
                <span className="text-sm font-medium text-muted-foreground">{PRICING.monthly.suffix}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                or {PRICING.yearly.label}/year (${YEARLY_PER_MONTH.toFixed(2)}/month)
              </p>
            </div>

            <div className="mt-5 space-y-2">
              <button
                onClick={upgrade}
                className="w-full rounded-full bg-primary px-6 py-3.5 font-bold text-primary-foreground shadow-card transition hover:-translate-y-0.5"
              >
                Upgrade to Pro
              </button>
              <button
                onClick={onClose}
                className="w-full rounded-full px-6 py-3 font-semibold text-muted-foreground transition hover:bg-muted"
              >
                {dismissLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
