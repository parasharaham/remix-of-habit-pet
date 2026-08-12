/**
 * Lightweight, privacy-safe subscription funnel analytics.
 * No personal information is recorded — only event names and coarse context.
 */
export type SubEvent =
  | "pricing_viewed"
  | "upgrade_modal_viewed"
  | "upgrade_clicked"
  | "checkout_started"
  | "subscription_activated"
  | "subscription_canceled"
  | "subscription_expired"
  | "feature_limit_reached";

const KEY = "habitpet-sub-events";
const MAX = 100;

export function trackSubEvent(event: SubEvent, props: Record<string, string | number> = {}) {
  if (typeof window === "undefined") return;
  const entry = { event, ...props, at: Date.now() };
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown[]) : [];
    list.push(entry);
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch {
    /* storage unavailable — analytics is best-effort only */
  }
}

export function readSubEvents(): unknown[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}
