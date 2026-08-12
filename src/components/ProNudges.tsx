import { useEffect, useRef, useState } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeToProModal } from "@/components/UpgradeToProModal";
import type { UpgradeSource } from "@/lib/entitlements";

const SEEN_INTRO_KEY = "habitpet-pro-intro-seen";
const LAST_PROMPT_KEY = "habitpet-pro-prompt-at";
/** Don't show another automatic prompt for 6 hours after a dismissal. */
const COOLDOWN_MS = 6 * 60 * 60 * 1000;
/** 15 minutes of *active* usage. */
const ACTIVE_MS_TRIGGER = 15 * 60 * 1000;

function lastPromptAt(): number {
  const raw = window.localStorage.getItem(LAST_PROMPT_KEY);
  return raw ? Number(raw) || 0 : 0;
}

function cooldownPassed(): boolean {
  return Date.now() - lastPromptAt() > COOLDOWN_MS;
}

function markPrompted() {
  window.localStorage.setItem(LAST_PROMPT_KEY, String(Date.now()));
}

/**
 * Non-intrusive Pro promotion:
 *  - first-session introduction after onboarding,
 *  - one prompt after ~15 minutes of ACTIVE (visible, focused) usage,
 *  - a 6-hour cooldown between automatic prompts.
 * Pro users never see any of it.
 */
export function ProNudges() {
  const { isPro, loading } = useSubscription();
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<UpgradeSource>("onboarding");
  const firedRef = useRef(false);

  // First-session Pro introduction.
  useEffect(() => {
    if (loading || isPro || firedRef.current) return;
    const seen = window.localStorage.getItem(SEEN_INTRO_KEY);
    if (seen) return;
    const t = window.setTimeout(() => {
      firedRef.current = true;
      window.localStorage.setItem(SEEN_INTRO_KEY, "1");
      markPrompted();
      setSource("onboarding");
      setOpen(true);
    }, 2500);
    return () => window.clearTimeout(t);
  }, [loading, isPro]);

  // 15-minute active-usage prompt. Only counts time while the tab is visible
  // and the window is focused; the timer pauses otherwise.
  useEffect(() => {
    if (loading || isPro) return;
    let active = 0;
    let last = Date.now();

    const isActive = () => document.visibilityState === "visible" && document.hasFocus();

    const tick = window.setInterval(() => {
      const now = Date.now();
      if (isActive()) active += now - last;
      last = now;
      if (active >= ACTIVE_MS_TRIGGER && !firedRef.current && cooldownPassed()) {
        firedRef.current = true;
        markPrompted();
        setSource("session");
        setOpen(true);
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
  }, [loading, isPro]);

  if (isPro) return null;

  return (
    <UpgradeToProModal
      open={open}
      source={source}
      onClose={() => {
        markPrompted();
        setOpen(false);
      }}
      dismissLabel={source === "onboarding" ? "Continue with Free" : "Maybe Later"}
    />
  );
}
