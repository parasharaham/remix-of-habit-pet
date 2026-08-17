import { useEffect, useRef } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { useUpgradeSheet } from "@/components/ProUpgradeSheet";

const SEEN_INTRO_KEY = "habitpet-pro-intro-seen";
/** 15 minutes of *active* usage. */
const ACTIVE_MS_TRIGGER = 15 * 60 * 1000;

/**
 * Non-intrusive Pro promotion, rendered through the shared upgrade sheet:
 *  - first-session introduction shortly after the app opens,
 *  - one prompt after ~15 minutes of ACTIVE (visible, focused) usage.
 * The sheet itself enforces the global cooldown and skips Pro users.
 */
export function ProNudges() {
  const { isPro, loading } = useSubscription();
  const { show } = useUpgradeSheet();
  const firedRef = useRef(false);

  // First-session Pro introduction.
  useEffect(() => {
    if (loading || isPro || firedRef.current) return;
    if (window.localStorage.getItem(SEEN_INTRO_KEY)) return;
    const t = window.setTimeout(() => {
      firedRef.current = true;
      window.localStorage.setItem(SEEN_INTRO_KEY, "1");
      show("onboarding", { force: true });
    }, 2500);
    return () => window.clearTimeout(t);
  }, [loading, isPro, show]);

  // 15-minute active-usage prompt; the timer pauses when the tab is hidden.
  useEffect(() => {
    if (loading || isPro) return;
    let active = 0;
    let last = Date.now();

    const isActive = () => document.visibilityState === "visible" && document.hasFocus();

    const tick = window.setInterval(() => {
      const now = Date.now();
      if (isActive()) active += now - last;
      last = now;
      if (active >= ACTIVE_MS_TRIGGER && !firedRef.current) {
        firedRef.current = true;
        show("session");
      }
    }, 5000);

    const resync = () => {
      last = Date.now();
    };
    document.addEventListener("visibilitychange", resync);
    window.addEventListener("focus", resync);
    window.addEventListener("blur", resync);

    return () => {
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", resync);
      window.removeEventListener("focus", resync);
      window.removeEventListener("blur", resync);
    };
  }, [loading, isPro, show]);

  return null;
}
