import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Globe } from "lucide-react";
import { toast } from "sonner";
import { LANGUAGES, useTranslation } from "@/i18n";
import { updateProfile } from "@/lib/profile.functions";

/**
 * Language selector used in Settings. Switches the UI instantly and persists
 * the choice to the profile so AI answers use it on every device.
 */
export function LanguagePicker() {
  const { language, setLanguage, t } = useTranslation();
  const save = useServerFn(updateProfile);
  const qc = useQueryClient();
  const [saving, setSaving] = useState<string | null>(null);

  async function pick(code: string) {
    if (code === language) return;
    setLanguage(code);
    setSaving(code);
    try {
      await save({ data: { preferred_language: code } });
      qc.invalidateQueries();
      toast.success(t("onboarding.languageSaved"));
    } catch {
      toast.error(t("errors.generic"));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <Globe size={18} className="text-primary" />
        <h2 className="text-lg font-bold">{t("settings.language")}</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t("settings.languageHelp")}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {LANGUAGES.map((l) => {
          const active = l.code === language;
          return (
            <button
              key={l.code}
              onClick={() => pick(l.code)}
              disabled={saving !== null}
              className={`flex items-center justify-between rounded-2xl border-2 px-4 py-3 text-left transition disabled:opacity-60 ${
                active ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40"
              }`}
            >
              <span>
                <span className="block font-semibold">{l.native}</span>
                <span className="block text-xs text-muted-foreground">{l.english}</span>
              </span>
              {active && <Check size={18} className="text-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
