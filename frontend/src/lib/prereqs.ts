import { AbilityKey, CatalogBrief, Character, FeatEntry, ProfRank, SKILLS } from "../types";
import { CLASS_PROFILES, versatilePerformanceSkills } from "./rules";

export type FeatSlot = "ancestry" | "class" | "skill" | "general" | "bonus" | "feature";

export interface PrereqResult {
  ok: boolean;
  missing: string[];
  warnings: string[];
}

const ABILITY_NAMES: Record<string, AbilityKey> = {
  strength: "str", str: "str",
  dexterity: "dex", dex: "dex",
  constitution: "con", con: "con",
  intelligence: "int", int: "int",
  wisdom: "wis", wis: "wis",
  charisma: "cha", cha: "cha",
};

const RANK_WORDS: Record<string, ProfRank> = {
  untrained: 0, trained: 1, expert: 2, master: 3, legendary: 4,
};

const RANK_LABELS_ES: Record<number, string> = {
  0: "untrained", 1: "trained", 2: "expert", 3: "master", 4: "legendary",
};

const SKILL_BY_NAME: Record<string, string> = Object.fromEntries(
  SKILLS.flatMap((s) => [
    [s.key, s.key],
    [s.label.toLowerCase(), s.key],
  ])
);

const CLASS_KEYS = [
  ...Object.keys(CLASS_PROFILES),
  "inventor", "psychic", "thaumaturge",
];

const ANCESTRY_TRAITS = new Set([
  "dwarf", "elf", "gnome", "goblin", "halfling", "human", "orc", "leshy",
  "hobgoblin", "lizardfolk", "iruxi", "catfolk", "kobold", "tengu", "ratfolk",
  "fetchling", "changeling", "dhampir", "duskwalker", "aasimar", "tiefling",
  "android", "automaton", "fleshwarp", "skeleton", "sprite", "strix", "gnoll",
  "grippli", "kitsune", "nagaji", "vanara", "poppet", "conrasu", "fleshwarp",
  "azarketi", "anadi", "shisk", "kholo",
]);

const WEAPON_PROF: Record<string, keyof Character["attacksProf"]> = {
  "unarmed attacks": "unarmed",
  "unarmed attack": "unarmed",
  "simple weapons": "simple",
  "simple weapon": "simple",
  "martial weapons": "martial",
  "martial weapon": "martial",
  "advanced weapons": "advanced",
  "advanced weapon": "advanced",
};

const ARMOR_PROF: Record<string, keyof Character["defensesProf"]> = {
  "unarmored defense": "unarmored",
  "light armor": "light",
  "medium armor": "medium",
  "heavy armor": "heavy",
};

const SIZE_RE = /^(tiny|small|medium|large|huge|gargantuan)(?:\s+or\s+(tiny|small|medium|large|huge|gargantuan))*\s+size$/i;

type Clause =
  | { kind: "ability"; key: AbilityKey; score: number; label: string }
  | { kind: "skill"; skill: string; rank: ProfRank; label: string }
  | { kind: "perception"; rank: ProfRank; label: string }
  | { kind: "weapon"; cat: keyof Character["attacksProf"]; rank: ProfRank; label: string }
  | { kind: "armor"; cat: keyof Character["defensesProf"]; rank: ProfRank; label: string }
  | { kind: "muse"; name: string; label: string }
  | { kind: "feat"; name: string; label: string }
  | { kind: "size"; sizes: string[]; label: string }
  | { kind: "special"; text: string; label: string };

function norm(s: string): string {
  return s.toLowerCase().replace(/['’]/g, "").replace(/\s+/g, " ").trim();
}

function splitAnd(raw: string): string[] {
  return raw.split(";").map((p) => p.trim()).filter(Boolean);
}

function splitOr(group: string): string[] {
  return group.split(/\s*,\s*|\s+or\s+/i).map((p) => p.trim()).filter(Boolean);
}

function parseClause(text: string): Clause {
  const raw = text.trim().replace(/\.$/, "");
  const n = norm(raw);
  if (!n) return { kind: "special", text: raw, label: raw };

  const sizeMatch = n.match(SIZE_RE);
  if (sizeMatch) {
    const sizes = n.replace(/\s+size$/, "").split(/\s+or\s+/).map((s) => s.trim());
    return { kind: "size", sizes, label: raw };
  }

  const abScore = n.match(/^(strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha)\s+(\d+)$/i);
  if (abScore) {
    const key = ABILITY_NAMES[abScore[1].toLowerCase()];
    return { kind: "ability", key, score: Number(abScore[2]), label: raw };
  }
  const abMod = n.match(/^(strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha)\s+\+(\d+)$/i);
  if (abMod) {
    const key = ABILITY_NAMES[abMod[1].toLowerCase()];
    const score = 10 + Number(abMod[2]) * 2;
    return { kind: "ability", key, score, label: raw };
  }

  const prof = n.match(/^(untrained|trained|expert|master|legendary)\s+in\s+(.+)$/i);
  if (prof) {
    const rank = RANK_WORDS[prof[1].toLowerCase()];
    const target = prof[2].trim();
    if (target === "perception") {
      return { kind: "perception", rank, label: raw };
    }
    const skill = SKILL_BY_NAME[target];
    if (skill) {
      return { kind: "skill", skill, rank, label: raw };
    }
    const weapon = WEAPON_PROF[target];
    if (weapon) {
      return { kind: "weapon", cat: weapon, rank, label: raw };
    }
    const armor = ARMOR_PROF[target];
    if (armor) {
      return { kind: "armor", cat: armor, rank, label: raw };
    }
    if (/lore/.test(target)) {
      return { kind: "special", text: raw, label: raw };
    }
  }

  const muse = n.match(/^(.+?)\s+muse$/);
  if (muse) {
    return { kind: "muse", name: muse[1], label: raw };
  }

  if (/^(you |at least |access |member |worship |familiar|darkvision|low-light|scent|holy|unholy)/.test(n)) {
    return { kind: "special", text: raw, label: raw };
  }

  // Un solo adjetivo / rasgo suelto no es un feat comprobable.
  if (!/\s/.test(n) && n.length < 16) {
    return { kind: "special", text: raw, label: raw };
  }

  return { kind: "feat", name: raw, label: raw };
}

function skillRank(c: Character, skill: string): ProfRank {
  const st = c.skills[skill] ?? { rank: 0 as ProfRank, item: 0 };
  let rank = st.rank;
  const vp = versatilePerformanceSkills(c);
  if (vp.includes(skill)) {
    const perf = c.skills.performance?.rank ?? 0;
    if (perf > rank) rank = perf;
  }
  return rank;
}

function hasFeatNamed(c: Character, name: string): boolean {
  const n = norm(name);
  if (c.feats.some((f) => {
    const fn = norm(f.name);
    if (fn === n) return true;
    const shorter = fn.length <= n.length ? fn : n;
    const longer = fn.length <= n.length ? n : fn;
    return shorter.length >= 8 && longer.includes(shorter);
  })) {
    return true;
  }
  if (c.muses.some((m) => {
    const mn = norm(m).replace(/\s+muse$/, "");
    return mn === n || n === `${mn} muse`;
  })) {
    return true;
  }
  return false;
}

function hasMuse(c: Character, name: string): boolean {
  const n = norm(name);
  return c.muses.some((m) => {
    const mn = norm(m).replace(/\s+muse$/, "");
    return mn === n || mn.includes(n) || n.includes(mn);
  });
}

function classKey(name: string): string {
  const low = name.toLowerCase();
  if (!low.trim()) return "";
  return CLASS_KEYS.find((k) => low.includes(k)) ?? low.trim();
}

function dedicationArchetype(name: string): string {
  return name.replace(/dedication/ig, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function isDedicationFeat(name: string, traits: string[] = []): boolean {
  if (traits.some((t) => t.toLowerCase() === "dedication")) return true;
  return /dedication/i.test(name) && !/spellcasting/i.test(name);
}

function featArchetypes(f: FeatEntry): string[] {
  const fromField = (f.archetype ?? []).map((a) => a.toLowerCase());
  const inferred = dedicationArchetype(f.name);
  if (inferred && inferred !== f.name.toLowerCase() && /dedication/i.test(f.name)) {
    return [...new Set([...fromField, inferred])];
  }
  return fromField;
}

function belongsToArchetype(f: FeatEntry, arch: string): boolean {
  const a = arch.toLowerCase();
  if (featArchetypes(f).some((x) => x === a || x.includes(a) || a.includes(x))) return true;
  const n = f.name.toLowerCase();
  if (/dedication/i.test(f.name)) return false;
  return a.length >= 4 && n.includes(a);
}

/** Dedicaciones que aún no tienen 2 feats del arquetipo. */
export function unfinishedDedications(c: Character): { name: string; have: number }[] {
  const deds = c.feats.filter((f) => isDedicationFeat(f.name, []));
  const out: { name: string; have: number }[] = [];
  for (const d of deds) {
    const arch = dedicationArchetype(d.name);
    if (!arch) continue;
    const have = c.feats.filter((f) => f.name !== d.name && belongsToArchetype(f, arch)).length;
    if (have < 2) out.push({ name: d.name, have });
  }
  return out;
}

function checkClause(c: Character, clause: Clause): { ok: boolean; special: boolean; detail?: string } {
  switch (clause.kind) {
    case "ability": {
      const have = c.abilities[clause.key];
      if (have >= clause.score) return { ok: true, special: false };
      return { ok: false, special: false, detail: `${clause.label} (tienes ${have})` };
    }
    case "skill": {
      const have = skillRank(c, clause.skill);
      if (have >= clause.rank) return { ok: true, special: false };
      return { ok: false, special: false, detail: `${clause.label} (tienes ${RANK_LABELS_ES[have]})` };
    }
    case "perception": {
      if (c.perceptionRank >= clause.rank) return { ok: true, special: false };
      return { ok: false, special: false, detail: `${clause.label} (tienes ${RANK_LABELS_ES[c.perceptionRank]})` };
    }
    case "weapon": {
      const have = c.attacksProf[clause.cat];
      if (have >= clause.rank) return { ok: true, special: false };
      return { ok: false, special: false, detail: `${clause.label} (tienes ${RANK_LABELS_ES[have]})` };
    }
    case "armor": {
      const have = c.defensesProf[clause.cat];
      if (have >= clause.rank) return { ok: true, special: false };
      return { ok: false, special: false, detail: `${clause.label} (tienes ${RANK_LABELS_ES[have]})` };
    }
    case "muse": {
      if (hasMuse(c, clause.name)) return { ok: true, special: false };
      return { ok: false, special: false, detail: `musa ${clause.name}` };
    }
    case "feat": {
      if (hasFeatNamed(c, clause.name)) return { ok: true, special: false };
      return { ok: false, special: false, detail: `feat «${clause.name}»` };
    }
    case "size": {
      const size = (c.ancestry.size || "").toLowerCase();
      if (clause.sizes.some((s) => size.includes(s))) return { ok: true, special: false };
      return { ok: false, special: false, detail: `${clause.label} (tienes ${c.ancestry.size || "?"})` };
    }
    case "special":
      return { ok: true, special: true, detail: clause.text };
  }
}

function implicitClass(c: Character, item: CatalogBrief, slot?: FeatSlot): string | null {
  if (slot !== "class") return null;
  const classTraits = item.traits
    .map((t) => t.toLowerCase())
    .filter((t) => CLASS_KEYS.includes(t));
  if (classTraits.length === 0) return null;
  const mine = classKey(c.clazz.name);
  if (mine && classTraits.some((t) => mine.includes(t) || t.includes(mine))) return null;
  return `ser ${classTraits.map((t) => t[0].toUpperCase() + t.slice(1)).join(" o ")} (tu clase es ${c.clazz.name || "—"})`;
}

function implicitAncestry(c: Character, item: CatalogBrief, slot?: FeatSlot): string | null {
  if (slot !== "ancestry") return null;
  const ancTraits = item.traits
    .map((t) => t.toLowerCase())
    .filter((t) => ANCESTRY_TRAITS.has(t));
  if (ancTraits.length === 0) return null;
  const haystack = `${c.ancestry.name} ${c.heritage.name}`.toLowerCase();
  if (ancTraits.some((t) => haystack.includes(t))) return null;
  return `ancestría ${ancTraits.map((t) => t[0].toUpperCase() + t.slice(1)).join(" o ")} (tienes ${c.ancestry.name || "—"})`;
}

function dedicationLock(c: Character, item: CatalogBrief): string | null {
  if (!isDedicationFeat(item.name, item.traits)) return null;
  const unfinished = unfinishedDedications(c);
  const incoming = dedicationArchetype(item.name);
  const blocking = unfinished.filter((u) => dedicationArchetype(u.name) !== incoming);
  if (blocking.length === 0) return null;
  return blocking
    .map((u) => `${u.name} incompleta (${u.have}/2 feats del arquetipo)`)
    .join("; ");
}

export function evaluateFeatPrereqs(c: Character, item: CatalogBrief, slot?: FeatSlot): PrereqResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  const cls = implicitClass(c, item, slot);
  if (cls) missing.push(cls);
  const anc = implicitAncestry(c, item, slot);
  if (anc) missing.push(anc);
  const lock = dedicationLock(c, item);
  if (lock) missing.push(lock);

  const raw = (item.prerequisite ?? "").trim();
  if (raw) {
    for (const group of splitAnd(raw)) {
      if (SIZE_RE.test(norm(group))) {
        const r = checkClause(c, parseClause(group));
        if (!r.ok && r.detail) missing.push(r.detail);
        continue;
      }
      const alts = splitOr(group).map(parseClause);
      if (alts.length === 0) continue;
      const results = alts.map((cl) => checkClause(c, cl));
      const checkable = results.filter((r) => !r.special);
      const specials = results.filter((r) => r.special);
      if (checkable.length === 0) {
        for (const s of specials) {
          if (s.detail) warnings.push(`Especial (no verificado): ${s.detail}`);
        }
        continue;
      }
      if (checkable.some((r) => r.ok)) continue;
      const bits = checkable.map((r) => r.detail).filter(Boolean) as string[];
      missing.push(bits.length > 1 ? bits.join(" o ") : bits[0]);
    }
  }

  return { ok: missing.length === 0, missing, warnings };
}
