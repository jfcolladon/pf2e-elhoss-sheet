import { Character } from "../types";

/** Idiomas regionales y de ancestría de Elhoss Eastern Lands (house rules). */
export const ELHOSS_LANGUAGES = [
  "Common",
  "Telian",
  "Ushamita",
  "Ramanan",
  "Daxican",
  "Dwrvin",
  "Yolquipan",
  "K'rryl",
  "Lenguaje de los Mercaderes de las Dunas",
  "Halfling",
] as const;

/** Idiomas frecuentes de CRB / APG legacy (por si el DM aprueba o hay contacto). */
export const SRD_LANGUAGES = [
  "Draconic", "Dwarven", "Elven", "Gnomish", "Goblin", "Jotun", "Orcish",
  "Sylvan", "Undercommon", "Abyssal", "Aklo", "Aquan", "Auran", "Celestial",
  "Ignan", "Infernal", "Necril", "Shadowtongue", "Terran",
] as const;

export const ALL_LANGUAGE_SUGGESTIONS = [...ELHOSS_LANGUAGES, ...SRD_LANGUAGES];

export function parseLanguageList(raw: string | string[] | null | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.flatMap((x) => parseLanguageList(String(x)));
  }
  let text = raw
    .replace(/idiomas adicionales[^.|]*/gi, "")
    .replace(/\s+y\s+un(o)?\s+idioma[^.|]*/gi, "")
    .replace(/\s+y\s+uno\s+adicional[^.|]*/gi, "");
  return text
    .split(/[,;]/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 1 && !/^(y|and)$/i.test(s) && !/adicional|elecci[oó]n|determinado|seg[uú]n/i.test(s));
}

export function mergeLanguages(current: string[] | undefined, incoming: string[]): string[] {
  const out = [...(current ?? [])];
  const seen = new Set(out.map((x) => x.toLowerCase()));
  for (const name of incoming) {
    const n = name.trim();
    if (!n || seen.has(n.toLowerCase())) continue;
    seen.add(n.toLowerCase());
    out.push(n);
  }
  return out;
}

export function languagesFromAncestryData(data: Record<string, unknown> | null | undefined): string[] {
  if (!data) return [];
  const raw = data.languages ?? data.language ?? data.granted_languages;
  return parseLanguageList(raw as string | string[] | undefined);
}

export function withAncestryLanguages(c: Character, incoming: string[]): Character {
  return { ...c, languages: mergeLanguages(c.languages, incoming) };
}
