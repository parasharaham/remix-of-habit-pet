import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "motion/react";
import { X, Heart } from "lucide-react";
import { getDailyMotivation } from "@/lib/motivation.functions";
import { useUpgradeSheet } from "@/components/ProUpgradeSheet";
import sunrise from "@/assets/motivation/sunrise.jpg";
import desk from "@/assets/motivation/desk.jpg";
import steps from "@/assets/motivation/steps.jpg";
import ocean from "@/assets/motivation/ocean.jpg";

const IMAGES = [sunrise, steps, desk, ocean];

/**
 * Shows one motivation when the app is opened. The line itself is stored
 * server-side, so the same words are never shown to the same person twice.
 */
export function MotivationPopup() {
  const fetchMotivation = useServerFn(getDailyMotivation);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { show } = useUpgradeSheet();

  useEffect(() => setMounted(true), []);

  const { data } = useQuery({
    queryKey: ["daily-motivation"],
    queryFn: () => fetchMotivation(),
    staleTime: Infinity,
    retry: 0,
  });

  useEffect(() => {
    if (data?.is_new) setOpen(true);
  }, [data]);

  if (!mounted || !data) return null;

  const image = IMAGES[data.image_index % IMAGES.length];

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/85 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            role="dialog"
            aria-label="Your motivation for today"
            className="relative w-full max-w-md overflow-hidden rounded-[2rem] bg-card shadow-pet"
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 rounded-full bg-background/70 p-2 backdrop-blur transition hover:bg-background"
            >
              <X size={18} />
            </button>
            <img src={image} alt="" width={1024} height={640} className="h-48 w-full object-cover" />
            <div className="space-y-4 p-6">
              <p className="text-xl font-extrabold leading-snug">{data.quote}</p>
              <p className="text-sm font-semibold text-muted-foreground">— {data.author ?? "HabitPet"}</p>
              <button
                onClick={() => {
                  setOpen(false);
                  // Free users see the Pro upgrade right after their motivation.
                  setTimeout(() => show("session", { force: true }), 350);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[image:var(--gradient-primary)] py-3 font-bold text-primary-foreground shadow-glow transition active:scale-[0.98]"
              >
                <Heart size={18} /> I'm ready
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
