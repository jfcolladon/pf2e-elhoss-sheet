import { AbilityKey, Character, ExtraCaster, FeatEntry, KnownSpell, ProfRank } from "../types";

export interface CasterProfile {
  key: AbilityKey;
  type: "prepared" | "spontaneous";
  tradition: string;
}

export interface ClassProfile {
  key: AbilityKey;
  hpPerLevel: number;
  caster?: CasterProfile;
  needsMuse?: boolean;
  focusMax?: number;
  perception: ProfRank;
  saves: { fort: ProfRank; ref: ProfRank; will: ProfRank };
  classDc: ProfRank;
  spellAttack: ProfRank;
  attacks: { unarmed: ProfRank; simple: ProfRank; martial: ProfRank; advanced: ProfRank };
  defenses: { unarmored: ProfRank; light: ProfRank; medium: ProfRank; heavy: ProfRank };
}

/** Perfiles de clase nivel 1 (CRB/APG legacy): HP, proficiencias y lanzamiento. */
export const CLASS_PROFILES: Record<string, ClassProfile> = {
  barbarian: { key: "str", hpPerLevel: 12, perception: 1, saves: { fort: 2, ref: 1, will: 1 }, classDc: 0, spellAttack: 0, attacks: { unarmed: 1, simple: 1, martial: 1, advanced: 0 }, defenses: { unarmored: 1, light: 0, medium: 0, heavy: 0 } },
  bard: { key: "cha", hpPerLevel: 8, caster: { key: "cha", type: "spontaneous", tradition: "occult" }, needsMuse: true, focusMax: 1, perception: 1, saves: { fort: 1, ref: 1, will: 1 }, classDc: 1, spellAttack: 1, attacks: { unarmed: 1, simple: 1, martial: 0, advanced: 0 }, defenses: { unarmored: 1, light: 1, medium: 0, heavy: 0 } },
  champion: { key: "str", hpPerLevel: 10, perception: 1, saves: { fort: 2, ref: 1, will: 2 }, classDc: 1, spellAttack: 0, attacks: { unarmed: 1, simple: 1, martial: 1, advanced: 0 }, defenses: { unarmored: 1, light: 1, medium: 1, heavy: 1 } },
  cleric: { key: "wis", hpPerLevel: 8, caster: { key: "wis", type: "prepared", tradition: "divine" }, perception: 1, saves: { fort: 2, ref: 1, will: 2 }, classDc: 1, spellAttack: 1, attacks: { unarmed: 1, simple: 1, martial: 0, advanced: 0 }, defenses: { unarmored: 1, light: 1, medium: 0, heavy: 0 } },
  druid: { key: "wis", hpPerLevel: 8, caster: { key: "wis", type: "prepared", tradition: "primal" }, perception: 2, saves: { fort: 2, ref: 1, will: 2 }, classDc: 1, spellAttack: 1, attacks: { unarmed: 1, simple: 1, martial: 0, advanced: 0 }, defenses: { unarmored: 1, light: 1, medium: 0, heavy: 0 } },
  fighter: { key: "str", hpPerLevel: 10, perception: 1, saves: { fort: 2, ref: 1, will: 1 }, classDc: 0, spellAttack: 0, attacks: { unarmed: 1, simple: 1, martial: 1, advanced: 0 }, defenses: { unarmored: 1, light: 1, medium: 1, heavy: 1 } },
  monk: { key: "str", hpPerLevel: 10, perception: 1, saves: { fort: 2, ref: 2, will: 2 }, classDc: 1, spellAttack: 0, attacks: { unarmed: 1, simple: 0, martial: 0, advanced: 0 }, defenses: { unarmored: 1, light: 0, medium: 0, heavy: 0 } },
  ranger: { key: "dex", hpPerLevel: 10, perception: 2, saves: { fort: 2, ref: 2, will: 1 }, classDc: 1, spellAttack: 0, attacks: { unarmed: 1, simple: 1, martial: 1, advanced: 0 }, defenses: { unarmored: 1, light: 1, medium: 1, heavy: 0 } },
  rogue: { key: "dex", hpPerLevel: 8, perception: 2, saves: { fort: 1, ref: 2, will: 1 }, classDc: 1, spellAttack: 0, attacks: { unarmed: 1, simple: 1, martial: 0, advanced: 0 }, defenses: { unarmored: 1, light: 1, medium: 0, heavy: 0 } },
  sorcerer: { key: "cha", hpPerLevel: 6, caster: { key: "cha", type: "spontaneous", tradition: "arcane" }, perception: 1, saves: { fort: 1, ref: 1, will: 2 }, classDc: 1, spellAttack: 1, attacks: { unarmed: 1, simple: 1, martial: 0, advanced: 0 }, defenses: { unarmored: 1, light: 0, medium: 0, heavy: 0 } },
  wizard: { key: "int", hpPerLevel: 6, caster: { key: "int", type: "prepared", tradition: "arcane" }, perception: 1, saves: { fort: 1, ref: 1, will: 2 }, classDc: 1, spellAttack: 1, attacks: { unarmed: 1, simple: 0, martial: 0, advanced: 0 }, defenses: { unarmored: 1, light: 0, medium: 0, heavy: 0 } },
  witch: { key: "int", hpPerLevel: 6, caster: { key: "int", type: "prepared", tradition: "occult" }, perception: 1, saves: { fort: 1, ref: 1, will: 2 }, classDc: 1, spellAttack: 1, attacks: { unarmed: 1, simple: 1, martial: 0, advanced: 0 }, defenses: { unarmored: 1, light: 0, medium: 0, heavy: 0 } },
  oracle: { key: "cha", hpPerLevel: 6, caster: { key: "cha", type: "spontaneous", tradition: "divine" }, perception: 1, saves: { fort: 2, ref: 1, will: 2 }, classDc: 1, spellAttack: 1, attacks: { unarmed: 1, simple: 1, martial: 0, advanced: 0 }, defenses: { unarmored: 1, light: 1, medium: 0, heavy: 0 } },
  alchemist: { key: "int", hpPerLevel: 8, perception: 1, saves: { fort: 2, ref: 1, will: 1 }, classDc: 1, spellAttack: 0, attacks: { unarmed: 1, simple: 1, martial: 0, advanced: 0 }, defenses: { unarmored: 1, light: 1, medium: 0, heavy: 0 } },
  investigator: { key: "int", hpPerLevel: 8, perception: 2, saves: { fort: 1, ref: 2, will: 2 }, classDc: 1, spellAttack: 0, attacks: { unarmed: 1, simple: 1, martial: 0, advanced: 0 }, defenses: { unarmored: 1, light: 1, medium: 0, heavy: 0 } },
  swashbuckler: { key: "dex", hpPerLevel: 10, perception: 1, saves: { fort: 1, ref: 2, will: 1 }, classDc: 1, spellAttack: 0, attacks: { unarmed: 1, simple: 1, martial: 1, advanced: 0 }, defenses: { unarmored: 1, light: 1, medium: 0, heavy: 0 } },
  gunslinger: { key: "dex", hpPerLevel: 10, perception: 1, saves: { fort: 2, ref: 2, will: 1 }, classDc: 1, spellAttack: 0, attacks: { unarmed: 1, simple: 1, martial: 0, advanced: 0 }, defenses: { unarmored: 1, light: 1, medium: 0, heavy: 0 } },
  magus: { key: "int", hpPerLevel: 8, caster: { key: "int", type: "prepared", tradition: "arcane" }, perception: 1, saves: { fort: 2, ref: 1, will: 1 }, classDc: 1, spellAttack: 1, attacks: { unarmed: 1, simple: 1, martial: 0, advanced: 0 }, defenses: { unarmored: 1, light: 1, medium: 1, heavy: 0 } },
  summoner: { key: "cha", hpPerLevel: 10, caster: { key: "cha", type: "spontaneous", tradition: "arcane" }, perception: 1, saves: { fort: 2, ref: 1, will: 2 }, classDc: 1, spellAttack: 1, attacks: { unarmed: 1, simple: 1, martial: 0, advanced: 0 }, defenses: { unarmored: 1, light: 1, medium: 0, heavy: 0 } },
};

export function detectClassProfile(name: string): ClassProfile | null {
  const low = name.toLowerCase();
  const hit = Object.entries(CLASS_PROFILES).find(([k]) => low.includes(k));
  return hit ? hit[1] : null;
}

export function isBard(name: string): boolean {
  return name.toLowerCase().includes("bard");
}

/** Slots de conjuro de clase principal (simplificado CRB legacy). */
export function primaryClassSlots(level: number, type: "prepared" | "spontaneous"): Record<number, number> {
  const maxRank = Math.min(10, Math.ceil(level / 2));
  const slots: Record<number, number> = {};
  // Tabla simplificada: 2 slots del rank máximo al subir, 1 slot de ranks inferiores según nivel
  if (maxRank >= 1) slots[1] = type === "spontaneous" ? Math.min(4, 1 + level) : Math.min(4, level);
  for (let r = 2; r <= maxRank; r++) {
    const unlock = r * 2 - 1; // rank 2 at lvl 3, rank 3 at lvl 5, etc.
    if (level >= unlock) slots[r] = Math.max(1, Math.floor((level - unlock) / 2) + 1);
  }
  return slots;
}

/** Configura la hoja al elegir una clase (atributo, HP, proficiencias, conjuros). */
export function applyClassSelection(c: Character, opts: { name: string; uid?: string | null; hpPerLevel?: number }): Character {
  const low = opts.name.toLowerCase();
  const profile = detectClassProfile(opts.name);
  const caster = profile?.caster ?? detectCaster(opts.name);
  const key = profile?.key ?? detectClassKey(opts.name) ?? c.clazz.keyAbility;
  const hp = opts.hpPerLevel ?? profile?.hpPerLevel ?? 8;
  const isPsionic = low.includes("psi");

  const slotMap = caster ? primaryClassSlots(c.level, caster.type) : {};
  const slots: Character["spellcasting"]["slots"] = {};
  for (const [rank, max] of Object.entries(slotMap)) {
    slots[rank] = { max, used: c.spellcasting.slots[rank]?.used ?? 0 };
  }

  let out: Character = {
    ...c,
    clazz: {
      uid: opts.uid ?? null,
      name: opts.name,
      keyAbility: isPsionic ? c.psionics.keyAbility : key,
      hpPerLevel: hp,
      isCaster: !!caster,
      castingType: caster?.type ?? c.clazz.castingType,
      tradition: caster?.tradition ?? c.clazz.tradition,
      isPsionic,
    },
    perceptionRank: profile?.perception ?? c.perceptionRank,
    saves: profile ? { ...profile.saves } : c.saves,
    classDcRank: profile?.classDc ?? c.classDcRank,
    spellAttackRank: caster ? (profile?.spellAttack ?? 1) : 0,
    attacksProf: profile ? { ...profile.attacks } : c.attacksProf,
    defensesProf: profile ? { ...profile.defenses } : c.defensesProf,
    spellcasting: {
      ...c.spellcasting,
      enabled: !!caster,
      ability: caster?.key ?? c.spellcasting.ability,
      tradition: caster?.tradition ?? c.spellcasting.tradition,
      castingType: caster?.type ?? c.spellcasting.castingType,
      slots: caster ? slots : c.spellcasting.slots,
      focus: {
        current: c.spellcasting.focus.current,
        max: profile?.focusMax ?? (caster ? c.spellcasting.focus.max : 0),
      },
    },
    psionics: { ...c.psionics, enabled: isPsionic || c.psionics.enabled },
  };

  if (!isBard(opts.name)) {
    out.muses = [];
    out.feats = out.feats.filter((f) => {
      if (museGrant(f.name)) return false;
      if (f.note.includes("Otorgado por musa")) return false;
      return true;
    });
    const museSpells = Object.values(MUSE_GRANTS).map((g) => g.spell.toLowerCase());
    out.spellcasting = {
      ...out.spellcasting,
      known: out.spellcasting.known.filter((s) => !museSpells.includes(s.name.toLowerCase())),
    };
  }

  if (isBard(opts.name)) {
    out = applyMuseSkills(out);
  }

  return out;
}
export function applyMuseSelection(c: Character, museName: string, museUid: string | null = null): Character {
  const grant = museGrant(museName);
  if (!grant) return c;
  const limit = maxMuses(c);
  const already = c.muses.some((m) => m.toLowerCase() === museName.toLowerCase());
  if (!already && c.muses.length >= limit) return c;

  let out: Character = { ...c, muses: [...c.muses], feats: [...c.feats] };
  if (!already) out.muses.push(museName);
  if (!out.feats.some((f) => f.name.toLowerCase() === museName.toLowerCase())) {
    out.feats.push({
      uid: museUid, name: museName, category: "feature", level: 1,
      allowed: true, dmApproved: false, note: grant.note,
    } as FeatEntry);
  }
  out = syncFeatEffects(out);
  return applyMuseSkills(out);
}

/** Clases lanzadoras (CRB/APG legacy): atributo clave, tipo y tradicion. */
export const CASTER_INFO: Record<string, CasterProfile> = {
  bard: { key: "cha", type: "spontaneous", tradition: "occult" },
  sorcerer: { key: "cha", type: "spontaneous", tradition: "arcane" },
  wizard: { key: "int", type: "prepared", tradition: "arcane" },
  cleric: { key: "wis", type: "prepared", tradition: "divine" },
  druid: { key: "wis", type: "prepared", tradition: "primal" },
  witch: { key: "int", type: "prepared", tradition: "occult" },
  oracle: { key: "cha", type: "spontaneous", tradition: "divine" },
  magus: { key: "int", type: "prepared", tradition: "arcane" },
  summoner: { key: "cha", type: "spontaneous", tradition: "arcane" },
  psychic: { key: "cha", type: "spontaneous", tradition: "occult" },
};

export const MARTIAL_KEY: Record<string, AbilityKey> = {
  alchemist: "int", barbarian: "str", champion: "str", fighter: "str", investigator: "int",
  monk: "str", ranger: "dex", rogue: "dex", swashbuckler: "dex", gunslinger: "dex",
};

export const CLASS_KEY: Record<string, AbilityKey> = {
  ...MARTIAL_KEY,
  ...Object.fromEntries(Object.entries(CASTER_INFO).map(([k, v]) => [k, v.key])),
};

/** Dedications multiclase que otorgan lanzamiento de conjuros (Basic Spellcasting). */
export const CASTER_DEDICATIONS: Record<string, CasterProfile> = {
  bard: CASTER_INFO.bard,
  cleric: CASTER_INFO.cleric,
  druid: CASTER_INFO.druid,
  sorcerer: CASTER_INFO.sorcerer,
  wizard: CASTER_INFO.wizard,
  witch: CASTER_INFO.witch,
  oracle: CASTER_INFO.oracle,
};

/** Detecta el perfil caster a partir del nombre de una clase o dedication. */
export function detectCaster(name: string, table = CASTER_INFO): CasterProfile | null {
  const low = name.toLowerCase();
  const hit = Object.entries(table).find(([k]) => low.includes(k));
  return hit ? hit[1] : null;
}

export function detectClassKey(name: string): AbilityKey | null {
  const low = name.toLowerCase();
  const hit = Object.entries(CLASS_KEY).find(([k]) => low.includes(k));
  return hit ? hit[1] : null;
}

/** Lo que otorga cada musa de bardo (CRB/APG legacy): feat, conjuro y efectos en skills. */
export interface MuseGrant {
  feat: string;
  spell: string;
  spellRank: number;
  note: string;
  /** Skills que deben quedar al menos entrenados. */
  skillMins?: { key: string; rank: ProfRank }[];
  /** Lore adicional (p. ej. Bardic Lore usa CHA). */
  lore?: { name: string; ability: AbilityKey; rank: ProfRank; note: string };
  /** Skills que pueden usar el rank de Performance (Versatile Performance). */
  versatilePerformance?: string[];
}

export const MUSE_GRANTS: Record<string, MuseGrant> = {
  enigma: {
    feat: "Bardic Lore", spell: "True Strike", spellRank: 1,
    note: "Enigma: feat Bardic Lore + True Strike al repertorio.",
    lore: { name: "Bardic Lore", ability: "cha", rank: 1, note: "Lore con CHA (Bardic Lore)." },
  },
  maestro: {
    feat: "Lingering Composition", spell: "Soothe", spellRank: 1,
    note: "Maestro: feat Lingering Composition + Soothe al repertorio.",
    skillMins: [{ key: "performance", rank: 1 }],
  },
  polymath: {
    feat: "Versatile Performance", spell: "Unseen Servant", spellRank: 1,
    note: "Polymath: feat Versatile Performance + Unseen Servant al repertorio.",
    skillMins: [{ key: "performance", rank: 1 }],
    versatilePerformance: ["diplomacy", "deception", "intimidation"],
  },
  warrior: {
    feat: "Martial Performance", spell: "Fear", spellRank: 1,
    note: "Warrior: feat Martial Performance + Fear al repertorio.",
    skillMins: [{ key: "performance", rank: 1 }],
  },
};

export function museGrant(name: string): MuseGrant | null {
  const low = name.toLowerCase();
  const hit = Object.entries(MUSE_GRANTS).find(([k]) => low.includes(k));
  return hit ? hit[1] : null;
}

export function hasMultifariousMuse(c: Character): boolean {
  return c.feats.some((f) => /multifarious\s+muse/i.test(f.name));
}

export function maxMuses(c: Character): number {
  return hasMultifariousMuse(c) ? 2 : 1;
}

export function needsSecondMuse(c: Character): boolean {
  return hasMultifariousMuse(c) && c.muses.length < 2;
}

export function isMultifariousMuseFeat(name: string): boolean {
  return /multifarious\s+muse/i.test(name);
}

/** Skills que pueden usar el rank de Performance (Versatile Performance de Polymath). */
export function versatilePerformanceSkills(c: Character): string[] {
  for (const m of c.muses) {
    const g = museGrant(m);
    if (g?.versatilePerformance) return g.versatilePerformance;
  }
  if (c.feats.some((f) => /versatile\s+performance/i.test(f.name))) {
    return MUSE_GRANTS.polymath.versatilePerformance ?? [];
  }
  return [];
}

/** Aplica efectos de musas en skills y lores (sin reducir ranks existentes). */
export function applyMuseSkills(c: Character): Character {
  const skills = { ...c.skills };
  let lores = [...c.lores];

  for (const museName of c.muses) {
    const g = museGrant(museName);
    if (!g) continue;
    for (const sm of g.skillMins ?? []) {
      const cur = skills[sm.key] ?? { rank: 0 as ProfRank, item: 0 };
      if (cur.rank < sm.rank) skills[sm.key] = { ...cur, rank: sm.rank };
    }
    if (g.lore) {
      const idx = lores.findIndex((l) => l.name.toLowerCase() === g.lore!.name.toLowerCase());
      if (idx >= 0) {
        const cur = lores[idx];
        lores[idx] = {
          ...cur,
          rank: cur.rank < g.lore.rank ? g.lore.rank : cur.rank,
          ability: g.lore.ability,
          note: g.lore.note,
        };
      } else {
        lores.push({
          name: g.lore.name, rank: g.lore.rank, item: 0,
          ability: g.lore.ability, note: g.lore.note,
        });
      }
    }
  }

  // Bardo: Performance entrenada por defecto
  if (isBard(c.clazz.name)) {
    const perf = skills.performance ?? { rank: 0 as ProfRank, item: 0 };
    if (perf.rank < 1) skills.performance = { ...perf, rank: 1 };
  }

  return { ...c, skills, lores };
}

/* ---- Spellcasting archetype: Basic / Expert / Master Spellcasting ---- */

export type SpellTier = "basic" | "expert" | "master";

/** Detecta el nivel del feat de lanzamiento de archetype por su nombre. */
export function detectSpellTier(name: string): SpellTier | null {
  const low = name.toLowerCase();
  if (!low.includes("spellcasting")) return null;
  if (low.includes("master")) return "master";
  if (low.includes("expert")) return "expert";
  if (low.includes("basic")) return "basic";
  return null;
}

/** Nivel de personaje requerido para obtener un slot de cada rank (progresión de archetype). */
export const ARCHETYPE_SLOT_LEVEL: Record<number, number> = {
  1: 4, 2: 6, 3: 8, 4: 12, 5: 14, 6: 16, 7: 18, 8: 20,
};

const TIER_MAX_RANK: Record<SpellTier, number> = { basic: 3, expert: 6, master: 8 };
const TIER_PROF: Record<SpellTier, number> = { basic: 1, expert: 2, master: 3 };

/** Mayor tier de lanzamiento de archetype presente entre los feats del PJ. */
export function highestSpellTier(featNames: string[]): SpellTier | null {
  let best: SpellTier | null = null;
  const order: SpellTier[] = ["basic", "expert", "master"];
  for (const n of featNames) {
    const t = detectSpellTier(n);
    if (t && (best === null || order.indexOf(t) > order.indexOf(best))) best = t;
  }
  return best;
}

/** Calcula slots (1 por rank) y proficiencia que otorga el archetype según nivel y tier. */
export function archetypeSpellcasting(level: number, tier: SpellTier): { slots: Record<number, number>; prof: number } {
  const cap = TIER_MAX_RANK[tier];
  const slots: Record<number, number> = {};
  for (let rank = 1; rank <= cap; rank++) {
    if (level >= ARCHETYPE_SLOT_LEVEL[rank]) slots[rank] = 1;
  }
  return { slots, prof: TIER_PROF[tier] };
}

/** Palabra de clase a partir del nombre de una dedicación: "Cleric Dedication" -> "cleric". */
function classWord(source: string): string {
  return source.toLowerCase().replace(/dedication/g, "").trim().split(/\s+/)[0] ?? "";
}

/**
 * Re-deriva de forma idempotente todos los efectos automáticos a partir de los feats actuales:
 *  - Dedications a clase caster -> fuente de conjuros adicional (tradición/atributo, entrenado).
 *  - Basic/Expert/Master Spellcasting -> slots por nivel y proficiencia de esa fuente.
 *  - Musas de bardo -> registra la musa y agrega su feat y conjuro otorgados (al repertorio principal).
 * Nunca reduce valores existentes ni duplica entradas; todo queda editable a mano.
 */
export function syncFeatEffects(c: Character): Character {
  const out: Character = {
    ...c,
    muses: [...c.muses],
    feats: [...c.feats],
    extraCasters: (c.extraCasters ?? []).map((e) => ({ ...e, slots: { ...e.slots }, known: [...e.known] })),
    spellcasting: { ...c.spellcasting, known: [...c.spellcasting.known], slots: { ...c.spellcasting.slots } },
  };
  const featNames = c.feats.map((f) => f.name);

  // 1) Dedications a clase caster -> fuente adicional
  for (const f of c.feats) {
    if (!/dedication/i.test(f.name)) continue;
    const ded = detectCaster(f.name, CASTER_DEDICATIONS);
    if (!ded) continue;
    let ec = out.extraCasters.find((e) => e.source.toLowerCase() === f.name.toLowerCase());
    if (!ec) {
      ec = {
        id: f.name.toLowerCase().replace(/\s+/g, "-"),
        source: f.name, tradition: ded.tradition, ability: ded.key,
        attackRank: 1, castingType: ded.type, slots: {}, known: [],
      };
      out.extraCasters.push(ec);
    } else if (ec.attackRank < 1) {
      ec.attackRank = 1;
    }
  }

  // 2) Basic/Expert/Master Spellcasting -> slots + proficiencia de la fuente correspondiente
  for (const ec of out.extraCasters) {
    const word = classWord(ec.source);
    const tierFeats = featNames.filter((n) => detectSpellTier(n) && (word ? n.toLowerCase().includes(word) : true));
    const tier = highestSpellTier(tierFeats);
    if (!tier) continue;
    const { slots, prof } = archetypeSpellcasting(out.level, tier);
    for (const [rank, count] of Object.entries(slots)) {
      const cur = ec.slots[rank] ?? { max: 0, used: 0 };
      ec.slots[rank] = { ...cur, max: Math.max(cur.max, count) };
    }
    if (ec.attackRank < prof) ec.attackRank = prof as ProfRank;
  }

  // 3) Musas de bardo -> registro + feat y conjuro otorgados al repertorio principal
  const museNames = new Set<string>(out.muses);
  for (const f of out.feats) {
    if (museGrant(f.name)) museNames.add(f.name);
  }
  out.muses = [...museNames];
  for (const museName of museNames) {
    const m = museGrant(museName);
    if (!m) continue;
    if (!out.feats.some((f) => f.name.toLowerCase() === museName.toLowerCase())) {
      out.feats.push({
        uid: null, name: museName, category: "feature", level: 1,
        allowed: true, dmApproved: false, note: m.note,
      } as FeatEntry);
    }
    if (!out.feats.some((x) => x.name.toLowerCase() === m.feat.toLowerCase())) {
      out.feats.push({
        uid: null, name: m.feat, category: "class", level: 1,
        allowed: true, dmApproved: false, note: `Otorgado por musa ${museName}.`,
      } as FeatEntry);
    }
    if (!out.spellcasting.known.some((s) => s.name.toLowerCase() === m.spell.toLowerCase())) {
      out.spellcasting.known.push({
        uid: null, name: m.spell, rank: m.spellRank, signature: false,
        prepared: 0, composition: false, focus: false, allowed: true, dmApproved: false,
      } as KnownSpell);
    }
    out.spellcasting.enabled = true;
  }

  return applyMuseSkills(out);
}
