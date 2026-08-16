/**
 * Central language registry. Adding a language = add a locale JSON file and
 * one entry here — no application logic changes anywhere else.
 */
export interface LanguageDef {
  /** ISO code stored in the database and in local storage. */
  code: string;
  /** Native name shown in pickers. */
  native: string;
  /** English name, for secondary labels. */
  english: string;
  /** BCP-47 tag used for Intl date/number formatting. */
  locale: string;
  dir: "ltr" | "rtl";
}

export const LANGUAGES: LanguageDef[] = [
  { code: "en", native: "English", english: "English", locale: "en-US", dir: "ltr" },
  { code: "hi", native: "हिन्दी", english: "Hindi", locale: "hi-IN", dir: "ltr" },
  { code: "es", native: "Español", english: "Spanish", locale: "es-ES", dir: "ltr" },
  { code: "fr", native: "Français", english: "French", locale: "fr-FR", dir: "ltr" },
  { code: "de", native: "Deutsch", english: "German", locale: "de-DE", dir: "ltr" },
  { code: "pt", native: "Português", english: "Portuguese", locale: "pt-BR", dir: "ltr" },
  { code: "bn", native: "বাংলা", english: "Bengali", locale: "bn-IN", dir: "ltr" },
  { code: "mr", native: "मराठी", english: "Marathi", locale: "mr-IN", dir: "ltr" },
  { code: "gu", native: "ગુજરાતી", english: "Gujarati", locale: "gu-IN", dir: "ltr" },
  { code: "ta", native: "தமிழ்", english: "Tamil", locale: "ta-IN", dir: "ltr" },
  { code: "te", native: "తెలుగు", english: "Telugu", locale: "te-IN", dir: "ltr" },
  { code: "kn", native: "ಕನ್ನಡ", english: "Kannada", locale: "kn-IN", dir: "ltr" },
  { code: "ml", native: "മലയാളം", english: "Malayalam", locale: "ml-IN", dir: "ltr" },
  { code: "pa", native: "ਪੰਜਾਬੀ", english: "Punjabi", locale: "pa-IN", dir: "ltr" },
];

export const DEFAULT_LANGUAGE = "en";
export const LANGUAGE_STORAGE_KEY = "habitpet-language";

export function isSupportedLanguage(code: string | null | undefined): boolean {
  return !!code && LANGUAGES.some((l) => l.code === code);
}

export function getLanguage(code: string | null | undefined): LanguageDef {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0]!;
}

/** Best-effort browser detection; manual selection always wins over this. */
export function detectBrowserLanguage(): string {
  if (typeof navigator === "undefined") return DEFAULT_LANGUAGE;
  const candidates = [navigator.language, ...(navigator.languages ?? [])];
  for (const tag of candidates) {
    const base = tag?.split("-")[0]?.toLowerCase();
    if (isSupportedLanguage(base)) return base!;
  }
  return DEFAULT_LANGUAGE;
}
