import {
  useEffect as useReactEffect,
  useRef,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { activatePlanSandbox } from "@/lib/subscription.functions";
import { SUBSCRIPTION_QUERY_KEY } from "@/hooks/useSubscription";
import { AnimatePresence, motion } from "motion/react";
import { Check, Sparkles, X } from "lucide-react";
import { PRICING, YEARLY_PER_MONTH, type UpgradeSource } from "@/lib/entitlements";
import { trackSubEvent } from "@/lib/sub-analytics";
import { useSubscription } from "@/hooks/useSubscription";
import { useTranslation } from "@/i18n";

/** Copy key per trigger, resolved through the translation dictionary. */
const HEADLINE_KEY: Partial<Record<UpgradeSource, string>> = {
  onboarding: "upgrade.src_app_open",
  session: "upgrade.src_app_open",
  dashboard: "upgrade.src_app_open",
  food_scan_limit: "upgrade.src_food_scan",
  habit_limit: "upgrade.src_add_habit",
  ai_meal_plan: "upgrade.src_meal_plan",
  ai_workout: "upgrade.src_workout_plan",
  ai_coach: "upgrade.src_ai_coach",
  analytics: "upgrade.src_analytics",
  premium_pet: "upgrade.src_app_open",
  pricing: "upgrade.header",
};

const BENEFIT_KEYS = ["upgrade.b1", "upgrade.b2", "upgrade.b3", "upgrade.b5", "upgrade.b8"];

const LAST_SHOWN_KEY = "habitpet-pro-sheet-at";
/** Never interrupt the same user twice within this window. */
const COOLDOWN_MS = 3 * 60 * 60 * 1000;

function cooldownPassed() {
  try {
    const raw = Number(window.localStorage.getItem(LAST_SHOWN_KEY) ?? 0);
    return Date.now() - raw > COOLDOWN_MS;
  } catch {
    return true;
  }
}

function markShown() {
  try {
    window.localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
  } catch {
    /* storage unavailable — sheet still works, just without a cooldown */
  }
}

interface SheetApi {
  /** Show the sheet for a trigger. Pro users and cooled-down users are skipped. */
  show: (source: UpgradeSource, options?: { force?: boolean }) => void;
  hide: () => void;
}

const Ctx = createContext<SheetApi>({ show: () => {}, hide: () => {} });

export function useUpgradeSheet() {
  return useContext(Ctx);
}

export function UpgradeSheetProvider({ children }: { children: ReactNode }) {
  const { isPro, loading } = useSubscription();
  const [source, setSource] = useState<UpgradeSource | null>(null);

  const show = useCallback<SheetApi["show"]>(
    (src, options) => {
      if (loading || isPro) return;
      if (!options?.force && !cooldownPassed()) return;
      markShown();
      trackSubEvent("upgrade_modal_viewed", { source: src });
      setSource(src);
    },
    [isPro, loading],
  );

  const hide = useCallback(() => setSource(null), []);
  const api = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <ProUpgradeSheet source={source} onClose={hide} />
    </Ctx.Provider>
  );
}

function ProUpgradeSheet({ source, onClose }: { source: UpgradeSource | null; onClose: () => void }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { status } = useSubscription();
  const expired = status === "pro_expired";

  const open = source !== null;
  const headline = expired
    ? t("upgrade.expiredTitle")
    : t(HEADLINE_KEY[source ?? "dashboard"] ?? "upgrade.header");

  const qc = useQueryClient();
  const activate = useServerFn(activatePlanSandbox);
  const [busy, setBusy] = useState<null | "MONTHLY_PRO" | "YEARLY_PRO">(null);
  void navigate;

  async function upgrade(plan: "MONTHLY_PRO" | "YEARLY_PRO") {
    if (source) trackSubEvent("upgrade_clicked", { source });
    setBusy(plan);
    try {
      await activate({ data: { plan_code: plan } });
      await qc.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
      toast.success("Welcome to HabitPet Pro! All premium features are unlocked.");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upgrade failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="presentation"
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t("upgrade.header")}
            className="relative flex h-[52vh] max-h-[560px] min-h-[380px] w-full flex-col overflow-hidden rounded-t-[2rem] bg-card px-6 pb-6 pt-3 shadow-pet sm:h-auto sm:max-w-md sm:rounded-[2rem] sm:p-7"
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted sm:hidden" />
            <button
              onClick={onClose}
              aria-label={t("common.close")}
              className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground transition hover:bg-muted"
            >
              <X size={18} />
            </button>

            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
              <Sparkles size={13} /> HabitPet {t("common.pro")}
            </span>

            <h2 className="mt-3 text-2xl font-bold leading-tight">{headline}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {expired ? t("upgrade.expiredBody") : t("upgrade.subtitle")}
            </p>

            <ul className="mt-4 flex-1 space-y-2 overflow-y-auto">
              {BENEFIT_KEYS.map((k) => (
                <li key={k} className="flex items-start gap-2 text-sm font-medium">
                  <Check size={16} className="mt-0.5 shrink-0 text-primary" />
                  {t(k)}
                </li>
              ))}
            </ul>

            <div className="mt-4 space-y-2">
              <button
                onClick={() => upgrade("MONTHLY_PRO")}
                disabled={busy !== null}
                className="w-full rounded-full bg-primary px-6 py-3.5 font-bold text-primary-foreground shadow-card transition hover:-translate-y-0.5 disabled:opacity-60"
              >
                {busy === "MONTHLY_PRO" ? "Upgrading…" : `${expired ? t("upgrade.renewCta") : t("upgrade.cta")} · ${PRICING.monthly.label}${PRICING.monthly.suffix}`}
              </button>
              <button
                onClick={() => upgrade("YEARLY_PRO")}
                disabled={busy !== null}
                className="w-full rounded-full border-2 border-foreground px-6 py-3 font-bold transition hover:bg-muted disabled:opacity-60"
              >
                {busy === "YEARLY_PRO" ? "Upgrading…" : `Yearly Pro · $64.99/yr (${"$"}${YEARLY_PER_MONTH.toFixed(2)}/mo)`}
              </button>
              <button
                onClick={onClose}
                className="w-full rounded-full px-6 py-2.5 font-semibold text-muted-foreground transition hover:bg-muted"
              >
                {t("common.maybeLater")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Declarative trigger — render inside <AppShell> and flip `when` to true to
 * open the sheet once (cooldown and Pro state are handled by the provider).
 */
export function UpgradeTrigger({ source, when }: { source: UpgradeSource; when: boolean }) {
  const { show } = useUpgradeSheet();
  const fired = useRef(false);

  useReactEffect(() => {
    if (!when || fired.current) return;
    fired.current = true;
    show(source);
  }, [when, source, show]);

  return null;
}
