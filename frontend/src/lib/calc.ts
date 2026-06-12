import { AbilityKey, Character, ExtraCaster, ProfRank, SKILLS, Strike } from "../types";
import { versatilePerformanceSkills } from "./rules";

export const mod = (score: number) => Math.floor((score - 10) / 2);

export const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** Bono de proficiency PF2e: rank*2 + nivel (0 si untrained). */
export function profBonus(rank: ProfRank, level: number): number {
  return rank > 0 ? rank * 2 + level : 0;
}

export function abilityMod(c: Character, key: AbilityKey): number {
  return mod(c.abilities[key]);
}

export function perception(c: Character): number {
  return abilityMod(c, "wis") + profBonus(c.perceptionRank, c.level);
}

export function save(c: Character, which: "fort" | "ref" | "will"): number {
  const ab: AbilityKey = which === "fort" ? "con" : which === "ref" ? "dex" : "wis";
  return abilityMod(c, ab) + profBonus(c.saves[which], c.level);
}

export function skillTotal(c: Character, key: string): number {
  const def = SKILLS.find((s) => s.key === key)!;
  const st = c.skills[key] ?? { rank: 0 as ProfRank, item: 0 };
  const vpSkills = versatilePerformanceSkills(c);
  let ability = def.ability;
  let rank = st.rank;
  if (vpSkills.includes(key)) {
    const perf = c.skills.performance ?? { rank: 0 as ProfRank, item: 0 };
    if (perf.rank > rank) {
      rank = perf.rank;
      ability = "cha";
    }
  }
  let total = abilityMod(c, ability) + profBonus(rank, c.level) + st.item;
  if ((ability === "str" || ability === "dex") && c.armor.checkPenalty) {
    total -= Math.abs(c.armor.checkPenalty);
  }
  return total;
}

export function loreTotal(c: Character, idx: number): number {
  const l = c.lores[idx];
  const ab = l.ability ?? "int";
  return abilityMod(c, ab) + profBonus(l.rank, c.level) + l.item;
}

export function armorClass(c: Character): number {
  const dexMod = abilityMod(c, "dex");
  const cappedDex = c.armor.dexCap === null ? dexMod : Math.min(dexMod, c.armor.dexCap);
  const prof = profBonus(c.defensesProf[c.armor.category], c.level);
  const shield = c.shield.raised ? c.shield.bonus : 0;
  return 10 + cappedDex + prof + c.armor.itemBonus + shield;
}

export function maxHp(c: Character): number {
  if (c.hp.maxOverride !== null) return c.hp.maxOverride;
  return c.ancestry.hp + (c.clazz.hpPerLevel + abilityMod(c, "con")) * c.level;
}

export function speed(c: Character): number {
  return c.ancestry.speed + c.speedBonus - Math.abs(c.armor.speedPenalty);
}

export function classDc(c: Character): number {
  return 10 + abilityMod(c, c.clazz.keyAbility) + profBonus(c.classDcRank, c.level);
}

export function strikeAttack(c: Character, s: Strike): number {
  return abilityMod(c, s.ability) + profBonus(c.attacksProf[s.profCategory], c.level) + s.itemBonus;
}

export function strikeDamageBonus(c: Character, s: Strike): number {
  if (s.damageBonusOverride !== null) return s.damageBonusOverride;
  // Por defecto Fuerza al daño cuerpo a cuerpo; armas a distancia sin bono
  if (s.range && s.range.trim() !== "" && !s.traits.toLowerCase().includes("thrown")) return 0;
  return abilityMod(c, "str");
}

export function spellAttack(c: Character): number {
  const ab = spellAbility(c);
  return abilityMod(c, ab) + profBonus(c.spellAttackRank, c.level);
}

export function spellDc(c: Character): number {
  return 10 + spellAttack(c);
}

export function spellAbility(c: Character): AbilityKey {
  return c.spellcasting.ability ?? c.clazz.keyAbility;
}

/** Ataque/DC de una fuente de conjuros adicional (dedicación). */
export function extraSpellAttack(c: Character, ec: ExtraCaster): number {
  return abilityMod(c, ec.ability) + profBonus(ec.attackRank, c.level);
}

export function extraSpellDc(c: Character, ec: ExtraCaster): number {
  return 10 + extraSpellAttack(c, ec);
}

/** PFP máximos según house rules de Elhoss.
 *  Clase Psiónico: nivel 1 = 2 + keyMod; cada nivel adicional + keyMod.
 *  Wild Talent: inicial = costo del poder más caro; por nivel adicional 2 + ceil(keyMod/2). */
export function maxPfp(c: Character): number {
  if (c.psionics.pfp.maxOverride !== null) return c.psionics.pfp.maxOverride;
  const key = mod(c.abilities[c.psionics.keyAbility]);
  if (c.psionics.mode === "class") {
    return Math.max(0, 2 + key + key * (c.level - 1));
  }
  const maxCost = Math.max(0, ...c.psionics.powers.filter((p) => p.wild).map((p) => p.cost ?? 0));
  const perLevel = 2 + Math.ceil(Math.max(0, key) / 2);
  return maxCost + perLevel * (c.level - 1);
}

/** Validación house rule: la disciplina primaria debe tener más poderes que cualquier otra. */
export function disciplineWarning(c: Character): string | null {
  if (!c.psionics.enabled || c.psionics.mode !== "class" || !c.psionics.discipline) return null;
  const counts: Record<string, number> = {};
  for (const p of c.psionics.powers) counts[p.discipline] = (counts[p.discipline] ?? 0) + 1;
  const primary = counts[c.psionics.discipline] ?? 0;
  for (const [d, n] of Object.entries(counts)) {
    if (d !== c.psionics.discipline && n >= primary && n > 0) {
      return `La disciplina primaria (${c.psionics.discipline}: ${primary}) debe tener más poderes conocidos que ${d} (${n}).`;
    }
  }
  return null;
}

/** Proficiency de Psionic Attack/DC por nivel (house rule). */
export function psionicProfRank(level: number): ProfRank {
  if (level >= 19) return 4;
  if (level >= 15) return 3;
  if (level >= 7) return 2;
  return 1;
}

export function psionicAttack(c: Character): number {
  return mod(c.abilities[c.psionics.keyAbility]) + profBonus(psionicProfRank(c.level), c.level);
}

export function psionicDc(c: Character): number {
  return 10 + psionicAttack(c);
}

/** Rank máximo de poder conocible por nivel (tabla de progresión house rule). */
export function maxPowerRank(level: number): number {
  if (level >= 17) return 9;
  if (level >= 15) return 8;
  if (level >= 13) return 7;
  if (level >= 11) return 6;
  if (level >= 9) return 5;
  if (level >= 7) return 4;
  if (level >= 5) return 3;
  if (level >= 3) return 2;
  return 1;
}

/** Rank máximo de conjuro por nivel de personaje (mitad redondeada arriba). */
export function maxSpellRank(level: number): number {
  return Math.min(10, Math.ceil(level / 2));
}

export function bulkUsed(c: Character): number {
  let total = 0;
  for (const it of c.inventory) {
    const b = it.bulk.trim().toUpperCase();
    if (b === "L") total += 0.1 * it.qty;
    else {
      const n = parseFloat(b);
      if (!isNaN(n)) total += n * it.qty;
    }
  }
  return Math.round(total * 10) / 10;
}

export function bulkLimit(c: Character): { encumbered: number; max: number } {
  const str = abilityMod(c, "str");
  return { encumbered: 5 + str, max: 10 + str };
}
