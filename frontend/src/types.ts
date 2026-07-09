export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";
export type ProfRank = 0 | 1 | 2 | 3 | 4; // U T E M L

export interface CatalogBrief {
  uid: string;
  type: string;
  name: string;
  level: number | null;
  source: string;
  allowed: boolean;
  rarity: string | null;
  traits: string[];
  summary: string;
}

export interface SkillState {
  rank: ProfRank;
  item: number;
}

export interface LoreSkill {
  name: string;
  rank: ProfRank;
  item: number;
  ability?: AbilityKey; // por defecto INT; Bardic Lore usa CHA
  note?: string;
}

export interface Strike {
  name: string;
  ability: AbilityKey;
  profCategory: "unarmed" | "simple" | "martial" | "advanced";
  itemBonus: number;
  damageDice: string;
  damageType: string;
  damageBonusOverride: number | null;
  traits: string;
  range: string;
}

export interface FeatEntry {
  uid: string | null;
  name: string;
  category: string; // ancestry | class | skill | general | bonus
  level: number;
  allowed: boolean;
  dmApproved: boolean;
  note: string;
}

/** Fuente de conjuros adicional (p. ej. dedicación a clase caster), separada del lanzamiento de clase. */
export interface ExtraCaster {
  id: string;
  source: string; // nombre del feat origen, p. ej. "Cleric Dedication"
  tradition: string;
  ability: AbilityKey;
  attackRank: ProfRank;
  castingType: "prepared" | "spontaneous";
  slots: SpellSlots;
  known: KnownSpell[];
}

export interface KnownSpell {
  uid: string | null;
  name: string;
  rank: number; // 0 = cantrip
  signature: boolean;
  prepared: number; // cantidad preparada (lanzadores preparados)
  composition: boolean;
  focus: boolean;
  allowed: boolean;
  dmApproved: boolean;
}

export interface SpellSlots {
  [rank: string]: { max: number; used: number };
}

export interface PsionicPower {
  id: number;
  name: string;
  discipline: string;
  rank: number;
  tier: string | null;
  cost_raw: string;
  cost: number | null;
  actions: string;
  range: string;
  area: string;
  duration: string;
  save: string;
  trigger: string;
  traits: string;
  description: string;
  heightened: string;
}

export interface KnownPower {
  powerId: number;
  name: string;
  discipline: string;
  rank: number;
  cost: number | null;
  wild: boolean; // adquirido como wild talent
}

export interface InventoryItem {
  uid: string | null;
  name: string;
  qty: number;
  bulk: string;
  note: string;
}

export type NoteCategory = "npc" | "location" | "faction" | "rumor" | "note" | "other";

export interface CampaignNote {
  id: string;           // uuid local
  category: NoteCategory;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;    // ISO date
}

export interface Character {
  id?: number;
  name: string;
  player: string;
  xp: number;
  level: number;
  heroPoints: number;
  ancestry: { uid: string | null; name: string; hp: number; speed: number; size: string; custom: boolean };
  heritage: { uid: string | null; name: string };
  background: { uid: string | null; name: string };
  clazz: {
    uid: string | null;
    name: string;
    keyAbility: AbilityKey;
    hpPerLevel: number;
    isCaster: boolean;
    castingType: "prepared" | "spontaneous";
    tradition: string;
    isPsionic: boolean;
  };
  abilities: Record<AbilityKey, number>;
  perceptionRank: ProfRank;
  saves: { fort: ProfRank; ref: ProfRank; will: ProfRank };
  skills: Record<string, SkillState>;
  lores: LoreSkill[];
  classDcRank: ProfRank;
  spellAttackRank: ProfRank;
  attacksProf: { unarmed: ProfRank; simple: ProfRank; martial: ProfRank; advanced: ProfRank };
  defensesProf: { unarmored: ProfRank; light: ProfRank; medium: ProfRank; heavy: ProfRank };
  armor: { name: string; category: "unarmored" | "light" | "medium" | "heavy"; itemBonus: number; dexCap: number | null; checkPenalty: number; speedPenalty: number };
  shield: { name: string; bonus: number; hardness: number; hp: number; maxHp: number; raised: boolean };
  hp: { current: number; temp: number; maxOverride: number | null };
  speedBonus: number;
  strikes: Strike[];
  feats: FeatEntry[];
  spellcasting: {
    enabled: boolean;
    ability: AbilityKey;
    tradition: string;
    castingType: "prepared" | "spontaneous";
    slots: SpellSlots;
    known: KnownSpell[];
    focus: { current: number; max: number };
  };
  muses: string[];
  extraCasters: ExtraCaster[];
  psionics: {
    enabled: boolean;
    mode: "class" | "wild";
    discipline: string;
    keyAbility: AbilityKey;
    pfp: { current: number; maxOverride: number | null };
    powers: KnownPower[];
    wildRoll: { dice: number[]; total: number } | null;
  };
  inventory: InventoryItem[];
  money: { cp: number; sp: number; gp: number; pp: number };
  conditions: string[];
  notes: string;
  campaignNotes: CampaignNote[];
  dmMode: boolean;
}

export const SKILLS: { key: string; label: string; ability: AbilityKey }[] = [
  { key: "acrobatics", label: "Acrobatics", ability: "dex" },
  { key: "arcana", label: "Arcana", ability: "int" },
  { key: "athletics", label: "Athletics", ability: "str" },
  { key: "crafting", label: "Crafting", ability: "int" },
  { key: "deception", label: "Deception", ability: "cha" },
  { key: "diplomacy", label: "Diplomacy", ability: "cha" },
  { key: "intimidation", label: "Intimidation", ability: "cha" },
  { key: "medicine", label: "Medicine", ability: "wis" },
  { key: "nature", label: "Nature", ability: "wis" },
  { key: "occultism", label: "Occultism", ability: "int" },
  { key: "performance", label: "Performance", ability: "cha" },
  { key: "religion", label: "Religion", ability: "wis" },
  { key: "society", label: "Society", ability: "int" },
  { key: "stealth", label: "Stealth", ability: "dex" },
  { key: "survival", label: "Survival", ability: "wis" },
  { key: "thievery", label: "Thievery", ability: "dex" },
];

export const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: "Fuerza", dex: "Destreza", con: "Constitución",
  int: "Inteligencia", wis: "Sabiduría", cha: "Carisma",
};

export const RANK_LABELS = ["U", "T", "E", "M", "L"];

export function defaultCharacter(): Character {
  const skills: Record<string, SkillState> = {};
  for (const s of SKILLS) skills[s.key] = { rank: 0, item: 0 };
  return {
    name: "", player: "", xp: 0, level: 1, heroPoints: 1,
    ancestry: { uid: null, name: "", hp: 8, speed: 25, size: "Medium", custom: false },
    heritage: { uid: null, name: "" },
    background: { uid: null, name: "" },
    clazz: {
      uid: null, name: "", keyAbility: "str", hpPerLevel: 8,
      isCaster: false, castingType: "spontaneous", tradition: "arcane", isPsionic: false,
    },
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    perceptionRank: 1,
    saves: { fort: 1, ref: 1, will: 1 },
    skills,
    lores: [],
    classDcRank: 1,
    spellAttackRank: 0,
    attacksProf: { unarmed: 1, simple: 1, martial: 0, advanced: 0 },
    defensesProf: { unarmored: 1, light: 0, medium: 0, heavy: 0 },
    armor: { name: "", category: "unarmored", itemBonus: 0, dexCap: null, checkPenalty: 0, speedPenalty: 0 },
    shield: { name: "", bonus: 0, hardness: 0, hp: 0, maxHp: 0, raised: false },
    hp: { current: 0, temp: 0, maxOverride: null },
    speedBonus: 0,
    strikes: [],
    feats: [],
    spellcasting: {
      enabled: false, ability: "cha", tradition: "arcane", castingType: "spontaneous",
      slots: {}, known: [], focus: { current: 0, max: 0 },
    },
    muses: [],
    extraCasters: [],
    psionics: {
      enabled: false, mode: "class", discipline: "", keyAbility: "con",
      pfp: { current: 0, maxOverride: null }, powers: [], wildRoll: null,
    },
    inventory: [],
    money: { cp: 0, sp: 0, gp: 0, pp: 0 },
    conditions: [],
    notes: "",
    campaignNotes: [],
    dmMode: false,
  };
}
