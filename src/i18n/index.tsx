import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  detectBrowserLanguage,
  getLanguage,
  isSupportedLanguage,
  type LanguageDef,
} from "./config";

import en from "./locales/en.json";
import hi from "./locales/hi.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import de from "./locales/de.json";
import pt from "./locales/pt.json";
import bn from "./locales/bn.json";
import mr from "./locales/mr.json";
import gu from "./locales/gu.json";
import ta from "./locales/ta.json";
import te from "./locales/te.json";
import kn from "./locales/kn.json";
import ml from "./locales/ml.json";
import pa from "./locales/pa.json";

type Dict = Record<string, unknown>;

const DICTS: Record<string, Dict> = {
  en, hi, es, fr, de, pt, bn, mr, gu, ta, te, kn, ml, pa,
};

function lookup(dict: Dict | undefined, path: string): string | undefined {
  if (!dict) return undefined;
  let node: unknown = dict;
  for (const part of path.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Dict)[part];
  }
  return typeof node === "string" ? node : undefined;
}

function interpolate(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) =>
    vars[k] === undefined ? `{{${k}}}` : String(vars[k]),
  );
}

export interface I18nValue {
  /** Active language code, e.g. "hi". */
  language: string;
  languageDef: LanguageDef;
  /** Translate a dotted key; falls back to English, then to the key itself. */
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** Change language everywhere (state + local storage + <html lang>). */
  setLanguage: (code: string) => void;
  /** True until the stored/profile preference has been resolved. */
  ready: boolean;
}

const I18nContext = createContext<I18nValue | null>(null);

export function LanguageProvider({
  children,
  initialLanguage,
}: {
  children: ReactNode;
  initialLanguage?: string;
}) {
  // HabitPet is English-only: the language is fixed regardless of stored/browser prefs.
  void initialLanguage;
  const [language] = useState<string>("en");
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const setLanguage = useCallback((_code: string) => {}, []);

  useEffect(() => {
    const def = getLanguage(language);
    if (typeof document !== "undefined") {
      document.documentElement.lang = def.code;
      document.documentElement.dir = def.dir;
    }
  }, [language]);

  const value = useMemo<I18nValue>(() => {
    const dict = DICTS[language];
    return {
      language,
      languageDef: getLanguage(language),
      ready,
      setLanguage,
      t: (key, vars) => interpolate(lookup(dict, key) ?? lookup(DICTS.en, key) ?? key, vars),
    };
  }, [language, ready, setLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  // Safe fallback so a component can never crash outside the provider.
  return {
    language: DEFAULT_LANGUAGE,
    languageDef: getLanguage(DEFAULT_LANGUAGE),
    ready: true,
    setLanguage: () => {},
    t: (key, vars) => interpolate(lookup(DICTS.en, key) ?? key, vars),
  };
}

export { LANGUAGES, getLanguage, DEFAULT_LANGUAGE } from "./config";
