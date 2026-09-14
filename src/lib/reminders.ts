import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface ReminderSettings {
  enabled: boolean;
  wakeTime: string; // anchors context-aware timing
  morningGoals: string;
  breakfast: string;
  lunch: string;
  dinner: string;
  hydrationEveryMin: number;
  hydrationStart: string;
  hydrationEnd: string;
  snoozeMin: number;
  contextAware: boolean;
  sound: boolean;
}

export const DEFAULT_REMINDERS: ReminderSettings = {
  enabled: false,
  wakeTime: "07:00",
  morningGoals: "08:00",
  breakfast: "08:30",
  lunch: "13:00",
  dinner: "19:30",
  hydrationEveryMin: 120,
  hydrationStart: "09:00",
  hydrationEnd: "21:00",
  snoozeMin: 15,
  contextAware: true,
  sound: true,
};

const KEY = "habitpet.reminders.v2";
const FIRED = "habitpet.reminders.fired.v2";
const SNOOZE = "habitpet.reminders.snooze.v2";

export function loadReminders(): ReminderSettings {
  if (typeof window === "undefined") return DEFAULT_REMINDERS;
  try {
    return { ...DEFAULT_REMINDERS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return DEFAULT_REMINDERS;
  }
}

export function hhmmToMinutes(v: string) {
  const [h, m] = (v || "00:00").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
export function minutesToHhmm(v: number) {
  const m = ((Math.round(v) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function notify(title: string, body: string, sound: boolean) {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/favicon.png", tag: title });
    }
    if (sound) {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    }
  } catch {
    /* notifications unavailable */
  }
}

export interface ScheduleItem {
  key: string;
  label: string;
  emoji: string;
  minutes: number;
  time: string;
  kind: "goals" | "meal" | "water";
  status: "done" | "snoozed" | "now" | "upcoming" | "passed";
}

/**
 * Context-aware schedule: meal + hydration times shift with the user's wake
 * time, snoozes push an item forward, and anything already logged is marked done.
 */
export function buildSchedule(
  settings: ReminderSettings,
  opts: { nowMinutes: number; snoozes?: Record<string, number>; completed?: string[] } = { nowMinutes: 0 },
): ScheduleItem[] {
  const snoozes = opts.snoozes ?? {};
  const completed = new Set(opts.completed ?? []);
  const shift = settings.contextAware ? hhmmToMinutes(settings.wakeTime) - hhmmToMinutes(DEFAULT_REMINDERS.wakeTime) : 0;

  const base: Array<Omit<ScheduleItem, "status" | "time"> & { minutes: number }> = [
    { key: "morning", label: "Morning goals", emoji: "☀️", minutes: hhmmToMinutes(settings.morningGoals) + shift, kind: "goals" },
    { key: "breakfast", label: "Breakfast", emoji: "🍳", minutes: hhmmToMinutes(settings.breakfast) + shift, kind: "meal" },
    { key: "lunch", label: "Lunch", emoji: "🥗", minutes: hhmmToMinutes(settings.lunch) + Math.round(shift * 0.5), kind: "meal" },
    { key: "dinner", label: "Dinner", emoji: "🍽️", minutes: hhmmToMinutes(settings.dinner) + Math.round(shift * 0.25), kind: "meal" },
  ];

  const start = hhmmToMinutes(settings.hydrationStart) + shift;
  const end = hhmmToMinutes(settings.hydrationEnd);
  const step = Math.max(30, settings.hydrationEveryMin);
  for (let t = start, i = 0; t <= end; t += step, i++) {
    base.push({ key: `water-${i}`, label: "Hydration check", emoji: "💧", minutes: t, kind: "water" });
  }

  return base
    .map((b) => {
      const minutes = snoozes[b.key] ? Math.max(b.minutes, snoozes[b.key]) : b.minutes;
      const status: ScheduleItem["status"] = completed.has(b.key)
        ? "done"
        : snoozes[b.key] && snoozes[b.key] > opts.nowMinutes
          ? "snoozed"
          : Math.abs(minutes - opts.nowMinutes) <= 10
            ? "now"
            : minutes < opts.nowMinutes
              ? "passed"
              : "upcoming";
      return { ...b, minutes, time: minutesToHhmm(minutes), status };
    })
    .sort((a, b) => a.minutes - b.minutes);
}

/** Client-side reminder scheduler with snooze + context-aware timing. */
export function useReminders(opts: { completed?: string[] } = {}) {
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_REMINDERS);
  const [permission, setPermission] = useState<string>("default");
  const [snoozes, setSnoozes] = useState<Record<string, number>>({});
  const [nowMinutes, setNowMinutes] = useState(0);
  const fired = useRef<Record<string, string>>({});

  useEffect(() => {
    setSettings(loadReminders());
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
    try {
      fired.current = JSON.parse(localStorage.getItem(FIRED) || "{}");
    } catch {
      fired.current = {};
    }
    try {
      const raw = JSON.parse(localStorage.getItem(SNOOZE) || "{}");
      if (raw.day === new Date().toISOString().slice(0, 10)) setSnoozes(raw.items ?? {});
    } catch {
      /* ignore */
    }
    const n = new Date();
    setNowMinutes(n.getHours() * 60 + n.getMinutes());
  }, []);

  const save = useCallback((next: Partial<ReminderSettings>) => {
    setSettings((prev) => {
      const merged = { ...prev, ...next };
      localStorage.setItem(KEY, JSON.stringify(merged));
      return merged;
    });
  }, []);

  const snooze = useCallback(
    (key: string, minutes?: number) => {
      const n = new Date();
      const at = n.getHours() * 60 + n.getMinutes() + (minutes ?? settings.snoozeMin);
      setSnoozes((prev) => {
        const items = { ...prev, [key]: at };
        localStorage.setItem(SNOOZE, JSON.stringify({ day: n.toISOString().slice(0, 10), items }));
        return items;
      });
      // allow it to fire again after the snooze window
      delete fired.current[key];
      localStorage.setItem(FIRED, JSON.stringify(fired.current));
    },
    [settings.snoozeMin],
  );

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return "unsupported";
    const p = await Notification.requestPermission();
    setPermission(p);
    return p;
  }, []);

  const schedule = useMemo(
    () => buildSchedule(settings, { nowMinutes, snoozes, completed: opts.completed }),
    [settings, nowMinutes, snoozes, opts.completed],
  );

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const day = now.toISOString().slice(0, 10);
      const mins = now.getHours() * 60 + now.getMinutes();
      setNowMinutes(mins);
      if (!settings.enabled) return;

      const items = buildSchedule(settings, { nowMinutes: mins, snoozes, completed: opts.completed });
      for (const item of items) {
        if (item.status === "done") continue;
        if (mins < item.minutes || mins >= item.minutes + 15) continue;
        if (fired.current[item.key] === day) continue;
        fired.current[item.key] = day;
        localStorage.setItem(FIRED, JSON.stringify(fired.current));
        const body =
          item.kind === "water"
            ? "Drink a glass of water and log it."
            : item.kind === "goals"
              ? "Open HabitPet to see today's AI goals and feed your pet."
              : `Time for ${item.label.toLowerCase()} — scan it to keep your streak alive.`;
        notify(`${item.label} ${item.emoji}`, body, settings.sound);
      }
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [settings, snoozes, opts.completed]);

  return { settings, save, permission, requestPermission, schedule, snooze, snoozes, nowMinutes };
}
