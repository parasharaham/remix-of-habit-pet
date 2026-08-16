/**
 * Shared helper that makes every AI feature answer in the user's language.
 * Server-safe (no browser APIs) so it can be imported by server functions.
 */
const NAMES: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  bn: "Bengali",
  mr: "Marathi",
  gu: "Gujarati",
  ta: "Tamil",
  te: "Telugu",
  kn: "Kannada",
  ml: "Malayalam",
  pa: "Punjabi",
};

export function languageName(code: string | null | undefined): string {
  return NAMES[code ?? "en"] ?? "English";
}

/**
 * Instruction appended to every AI prompt. Numbers/units stay universal so
 * nutrition maths and charts keep working regardless of language.
 */
export function languageInstruction(code: string | null | undefined): string {
  const name = languageName(code);
  if (name === "English") {
    return "Write every user-facing string in natural English.";
  }
  return `Write EVERY user-facing string (titles, descriptions, tips, notes, list items) in natural, fluent ${name}. Do not mix in English sentences. Keep numbers, units (g, ml, kcal) and JSON keys exactly as specified in the schema.`;
}
