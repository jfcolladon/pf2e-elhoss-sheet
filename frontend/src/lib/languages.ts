import { Character } from "../types";

/** Idioma común de Elhoss (reemplaza Common de Golarion). */
export const COMMON_LANGUAGE = "Lenguaje de los Mercaderes de las Dunas";

/** Idiomas regionales y de ancestría de Elhoss Eastern Lands (house rules). */
export const ELHOSS_LANGUAGES = [
  COMMON_LANGUAGE,
  "Telian",
  "Ushamita",
  "Ramanan",
  "Daxican",
  "Dwrvin",
  "Yolquipan",
  "K'rryl",
  "Halfling",
] as const;

/** Idiomas frecuentes de CRB / APG legacy (por si el DM aprueba o hay contacto). */
export const SRD_LANGUAGES = [
  "Draconic", "Dwarven", "Elven", "Gnomish", "Goblin", "Jotun", "Orcish",
  "Sylvan", "Undercommon", "Abyssal", "Aklo", "Aquan", "Auran", "Celestial",
  "Ignan", "Infernal", "Necril", "Shadowtongue", "Terran",
] as const;

export const ALL_LANGUAGE_SUGGESTIONS = [...ELHOSS_LANGUAGES, ...SRD_LANGUAGES];

export function normalizeLanguage(name: string): string {
  const n = name.replace(/\s+/g, " ").trim();
  if (/^common$/i.test(n)) return COMMON_LANGUAGE;
  return n;
}

export function parseLanguageList(raw: string | string[] | null | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.flatMap((x) => parseLanguageList(String(x)));
  }
  let text = raw
    .replace(/idiomas adicionales[^.|]*/gi, "")
    .replace(/\s+y\s+un(o)?\s+idioma[^.|]*/gi, "")
    .replace(/\s+y\s+uno\s+adicional[^.|]*/gi, "");
  return mergeLanguages([], text
    .split(/[,;]/)
    .map((s) => normalizeLanguage(s))
    .filter((s) => s.length > 1 && !/^(y|and)$/i.test(s) && !/adicional|elecci[oó]n|determinado|seg[uú]n/i.test(s)));
}

export function mergeLanguages(current: string[] | undefined, incoming: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const name of [...(current ?? []), ...incoming]) {
    const n = normalizeLanguage(name);
    if (!n || seen.has(n.toLowerCase())) continue;
    seen.add(n.toLowerCase());
    out.push(n);
  }
  return out;
}

export function migrateLanguages(raw: unknown): string[] {
  if (Array.isArray(raw) && raw.length > 0) {
    const mapped = mergeLanguages([], raw.map((x) => String(x)));
    return mapped.length > 0 ? mapped : [COMMON_LANGUAGE];
  }
  return [COMMON_LANGUAGE];
}

export function languagesFromAncestryData(data: Record<string, unknown> | null | undefined): string[] {
  if (!data) return [];
  const raw = data.languages ?? data.language ?? data.granted_languages;
  return parseLanguageList(raw as string | string[] | undefined);
}

export function withAncestryLanguages(c: Character, incoming: string[]): Character {
  return { ...c, languages: mergeLanguages(c.languages, incoming) };
}
