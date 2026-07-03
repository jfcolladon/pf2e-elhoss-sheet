import { useEffect, useState } from "react";
import { api } from "../api";
import { UpdateFn } from "../pages/Sheet";
import { Section, Teml, Modal, CatalogSearch, HouseRulePicker, PipTracker, Counter } from "../components/common";
import {
  abilityMod, armorClass, classDc, fmt, maxHp, perception, save, speed,
  strikeAttack, strikeDamageBonus, profBonus,
} from "../lib/calc";
import { ABILITY_LABELS, AbilityKey, Character, Strike } from "../types";
import { applyClassSelection, applyMuseSelection, isBard, needsSecondMuse } from "../lib/rules";
import { ALLOWED_SOURCES_SHORT } from "../lib/sources";

const ABILITIES: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

export default function MainTab({ c, update }: { c: Character; update: UpdateFn }) {
  const [armorModal, setArmorModal] = useState(false);
  const [weaponModal, setWeaponModal] = useState(false);
  const [pick, setPick] = useState<null | "ancestry" | "heritage" | "background" | "class" | "muse">(null);

  useEffect(() => {
    if (needsSecondMuse(c)) setPick("muse");
  }, [c.feats, c.muses]);

  return (
    <div className="grid cols-2">
      <div>
        <Section title="Identidad">
          <div className="grid cols-3">
            <div className="field"><label>Nombre</label>
              <input value={c.name} onChange={(e) => update((o) => ({ ...o, name: e.target.value }))} /></div>
            <div className="field"><label>Jugador</label>
              <input value={c.player} onChange={(e) => update((o) => ({ ...o, player: e.target.value }))} /></div>
            <div className="field"><label>XP</label>
              <input type="number" value={c.xp} onChange={(e) => update((o) => ({ ...o, xp: +e.target.value }))} /></div>
            <div className="field"><label>Nivel</label>
              <input type="number" min={1} max={20} value={c.level}
                onChange={(e) => update((o) => ({ ...o, level: Math.max(1, Math.min(20, +e.target.value)) }))} /></div>
            <div className="field"><label>Ancestry</label>
              <div className="row">
                <input style={{ flex: 1 }} value={c.ancestry.name} onChange={(e) => update((o) => ({ ...o, ancestry: { ...o.ancestry, name: e.target.value } }))} />
                <button className="small ghost" onClick={() => setPick("ancestry")}>Elegir</button>
              </div></div>
            <div className="field"><label>Heritage</label>
              <div className="row">
                <input style={{ flex: 1 }} value={c.heritage.name} onChange={(e) => update((o) => ({ ...o, heritage: { ...o.heritage, name: e.target.value } }))} />
                <button className="small ghost" onClick={() => setPick("heritage")}>Elegir</button>
              </div></div>
            <div className="field"><label>Background</label>
              <div className="row">
                <input style={{ flex: 1 }} value={c.background.name} onChange={(e) => update((o) => ({ ...o, background: { ...o.background, name: e.target.value } }))} />
                <button className="small ghost" onClick={() => setPick("background")}>Elegir</button>
              </div></div>
            <div className="field"><label>Clase</label>
              <div className="row">
                <input style={{ flex: 1 }} value={c.clazz.name} readOnly placeholder="Sin clase" />
                <button className="small ghost" onClick={() => setPick("class")}>Elegir</button>
              </div>
              {c.clazz.name && (
                <span className="muted">
                  HP {c.clazz.hpPerLevel}/nivel · key {ABILITY_LABELS[c.clazz.keyAbility]}
                  {c.clazz.isCaster && ` · ${c.spellcasting.tradition} (${c.spellcasting.castingType})`}
                </span>
              )}
            </div>
            {isBard(c.clazz.name) && (
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>Musa del bardo</label>
                {c.muses.length === 0 ? (
                  <div className="warn-box">
                    El bardo debe elegir una musa (Enigma, Maestro, Polymath o Warrior).
                    <button className="small" style={{ marginLeft: 8 }} onClick={() => setPick("muse")}>Elegir musa</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {c.muses.map((m) => (
                      <span key={m} className="chip">{m}</span>
                    ))}
                    {needsSecondMuse(c) && (
                      <div className="warn-box">
                        Multifarious Muse: elige segunda musa.
                        <button className="small" style={{ marginLeft: 8 }} onClick={() => setPick("muse")}>Elegir</button>
                      </div>
                    )}
                    {!needsSecondMuse(c) && c.feats.some((f) => /multifarious\s+muse/i.test(f.name)) && c.muses.length < 2 && (
                      <button className="small" onClick={() => setPick("muse")}>+ Segunda musa</button>
                    )}
                    <button className="small ghost" onClick={() => setPick("muse")}>Cambiar</button>
                  </div>
                )}
              </div>
            )}
            <div className="field"><label>Atributo clave</label>
              <select value={c.clazz.keyAbility}
                onChange={(e) => update((o) => ({ ...o, clazz: { ...o.clazz, keyAbility: e.target.value as AbilityKey } }))}>
                {ABILITIES.map((a) => <option key={a} value={a}>{ABILITY_LABELS[a]}</option>)}
              </select></div>
            <div className="field"><label>Puntos de Héroe</label>
              <PipTracker current={c.heroPoints} max={3} onChange={(v) => update((o) => ({ ...o, heroPoints: v }))} /></div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <div className="row">
                <label style={{ display: "flex", gap: 5, alignItems: "center" }}>
                  <input type="checkbox" checked={c.spellcasting.enabled}
                    onChange={(e) => update((o) => ({ ...o, clazz: { ...o.clazz, isCaster: e.target.checked }, spellcasting: { ...o.spellcasting, enabled: e.target.checked } }))} />
                  Lanzador de conjuros
                </label>
                {c.spellcasting.enabled && (
                  <>
                    <label style={{ display: "flex", gap: 5, alignItems: "center" }}>
                      Tipo:
                      <select value={c.spellcasting.castingType}
                        onChange={(e) => update((o) => ({ ...o, spellcasting: { ...o.spellcasting, castingType: e.target.value as "prepared" | "spontaneous" } }))}>
                        <option value="spontaneous">Espontáneo</option>
                        <option value="prepared">Preparado</option>
                      </select>
                    </label>
                    <label style={{ display: "flex", gap: 5, alignItems: "center" }}>
                      Tradición:
                      <select value={c.spellcasting.tradition}
                        onChange={(e) => update((o) => ({ ...o, spellcasting: { ...o.spellcasting, tradition: e.target.value } }))}>
                        {["arcane", "divine", "occult", "primal"].map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </label>
                  </>
                )}
              </div>
            </div>
          </div>
        </Section>

        <Section title="Características">
          <div className="grid cols-6">
            {ABILITIES.map((a) => (
              <div className="ability-box" key={a}>
                <div className="ab-name">{ABILITY_LABELS[a].slice(0, 3)}</div>
                <div className="ab-mod">{fmt(abilityMod(c, a))}</div>
                <input
                  type="number"
                  value={c.abilities[a]}
                  onChange={(e) => update((o) => ({ ...o, abilities: { ...o.abilities, [a]: +e.target.value } }))}
                />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Defensa y salud">
          <div className="row" style={{ marginBottom: 10 }}>
            <div className="stat-big"><div className="v">{armorClass(c)}</div><div className="l">CA</div></div>
            <div className="field">
              <label>Armadura</label>
              <div className="row">
                <input style={{ width: 150 }} value={c.armor.name} placeholder="Sin armadura"
                  onChange={(e) => update((o) => ({ ...o, armor: { ...o.armor, name: e.target.value } }))} />
                <button className="small ghost" onClick={() => setArmorModal(true)}>Buscar</button>
              </div>
              <span className="muted">
                cat. {c.armor.category} · ítem +{c.armor.itemBonus} · dex cap {c.armor.dexCap ?? "—"} · ACP {c.armor.checkPenalty}
              </span>
            </div>
            <div className="field">
              <label>Escudo (bonus si alzado)</label>
              <div className="row">
                <input style={{ width: 110 }} value={c.shield.name} placeholder="Escudo"
                  onChange={(e) => update((o) => ({ ...o, shield: { ...o.shield, name: e.target.value } }))} />
                <input type="number" style={{ width: 50 }} value={c.shield.bonus}
                  onChange={(e) => update((o) => ({ ...o, shield: { ...o.shield, bonus: +e.target.value } }))} />
                <label style={{ display: "flex", gap: 4 }}>
                  <input type="checkbox" checked={c.shield.raised}
                    onChange={(e) => update((o) => ({ ...o, shield: { ...o.shield, raised: e.target.checked } }))} />
                  Alzado
                </label>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="field" style={{ flex: 1 }}>
              <label>Puntos de golpe — {c.hp.current} / {maxHp(c)} {c.hp.temp > 0 && `(+${c.hp.temp} temp)`}</label>
              <div className="hpbar"><div style={{ width: `${Math.min(100, (c.hp.current / Math.max(1, maxHp(c))) * 100)}%` }} /></div>
              <div className="row" style={{ marginTop: 4 }}>
                <Counter value={c.hp.current} max={maxHp(c)} onChange={(v) => update((o) => ({ ...o, hp: { ...o.hp, current: v } }))} />
                <span className="muted">Temp:</span>
                <Counter value={c.hp.temp} onChange={(v) => update((o) => ({ ...o, hp: { ...o.hp, temp: v } }))} />
              </div>
            </div>
          </div>
        </Section>

        <Section title="Salvaciones, percepción y velocidad">
          <table className="sheet">
            <tbody>
              {(["fort", "ref", "will"] as const).map((s) => (
                <tr key={s}>
                  <td><b>{{ fort: "Fortaleza", ref: "Reflejos", will: "Voluntad" }[s]}</b></td>
                  <td><span className="total-badge">{fmt(save(c, s))}</span></td>
                  <td><Teml value={c.saves[s]} onChange={(r) => update((o) => ({ ...o, saves: { ...o.saves, [s]: r } }))} /></td>
                  <td className="muted">{{ fort: "CON", ref: "DEX", will: "WIS" }[s]} {fmt(abilityMod(c, { fort: "con", ref: "dex", will: "wis" }[s] as AbilityKey))}</td>
                </tr>
              ))}
              <tr>
                <td><b>Percepción</b></td>
                <td><span className="total-badge">{fmt(perception(c))}</span></td>
                <td><Teml value={c.perceptionRank} onChange={(r) => update((o) => ({ ...o, perceptionRank: r }))} /></td>
                <td className="muted">WIS {fmt(abilityMod(c, "wis"))}</td>
              </tr>
              <tr>
                <td><b>Velocidad</b></td>
                <td><span className="total-badge">{speed(c)} ft</span></td>
                <td colSpan={2}>
                  <span className="muted">base {c.ancestry.speed} + </span>
                  <input type="number" style={{ width: 56 }} value={c.speedBonus}
                    onChange={(e) => update((o) => ({ ...o, speedBonus: +e.target.value }))} />
                </td>
              </tr>
              <tr>
                <td><b>DC de clase</b></td>
                <td><span className="total-badge">{classDc(c)}</span></td>
                <td><Teml value={c.classDcRank} onChange={(r) => update((o) => ({ ...o, classDcRank: r }))} /></td>
                <td className="muted">{ABILITY_LABELS[c.clazz.keyAbility]}</td>
              </tr>
            </tbody>
          </table>
        </Section>
      </div>

      <div>
        <Section
          title="Ataques (Strikes)"
          extra={
            <>
              <button className="small" onClick={() => setWeaponModal(true)}>Buscar arma</button>
              <button className="small ghost" style={{ color: "#f3e6c8", borderColor: "#f3e6c8" }}
                onClick={() => update((o) => ({
                  ...o,
                  strikes: [...o.strikes, {
                    name: "Nuevo ataque", ability: "str", profCategory: "simple", itemBonus: 0,
                    damageDice: "1d6", damageType: "B", damageBonusOverride: null, traits: "", range: "",
                  }],
                }))}>
                + Manual
              </button>
            </>
          }
        >
          {c.strikes.length === 0 && <p className="muted">Sin ataques. Busca un arma del SRD o añade uno manual.</p>}
          {c.strikes.map((s, i) => (
            <StrikeRow key={i} c={c} s={s} onChange={(ns) => update((o) => {
              const strikes = [...o.strikes];
              strikes[i] = ns;
              return { ...o, strikes };
            })} onDelete={() => update((o) => ({ ...o, strikes: o.strikes.filter((_, j) => j !== i) }))} />
          ))}
          <h4 style={{ marginTop: 8 }}>Proficiencies de ataque</h4>
          <div className="row">
            {(["unarmed", "simple", "martial", "advanced"] as const).map((k) => (
              <div key={k} className="field">
                <label>{k}</label>
                <Teml value={c.attacksProf[k]} onChange={(r) => update((o) => ({ ...o, attacksProf: { ...o.attacksProf, [k]: r } }))} />
              </div>
            ))}
          </div>
          <h4 style={{ marginTop: 8 }}>Proficiencies de defensa</h4>
          <div className="row">
            {(["unarmored", "light", "medium", "heavy"] as const).map((k) => (
              <div key={k} className="field">
                <label>{k}</label>
                <Teml value={c.defensesProf[k]} onChange={(r) => update((o) => ({ ...o, defensesProf: { ...o.defensesProf, [k]: r } }))} />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Condiciones y notas">
          <div className="field">
            <label>Condiciones (separadas por coma)</label>
            <input
              value={c.conditions.join(", ")}
              onChange={(e) => update((o) => ({ ...o, conditions: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) }))}
            />
          </div>
          <div className="field" style={{ marginTop: 8 }}>
            <label>Notas</label>
            <textarea rows={6} value={c.notes} onChange={(e) => update((o) => ({ ...o, notes: e.target.value }))} />
          </div>
        </Section>
      </div>

      {armorModal && (
        <Modal title="Buscar armadura (SRD legacy)" onClose={() => setArmorModal(false)}>
          <CatalogSearch
            type="item"
            dmMode={c.dmMode}
            pickLabel="Equipar"
            onPick={async (item) => {
              const full = await api.item(item.uid);
              update((o) => ({
                ...o,
                armor: {
                  name: item.name,
                  category: (String(full.armor_category ?? "light").toLowerCase() as Character["armor"]["category"]),
                  itemBonus: Number(full.ac ?? 0),
                  dexCap: full.dex_cap !== undefined && full.dex_cap !== null ? Number(full.dex_cap) : null,
                  checkPenalty: Number(full.check_penalty ?? 0),
                  speedPenalty: Number(full.speed_penalty ?? 0),
                },
              }));
              setArmorModal(false);
            }}
          />
          <p className="muted">Filtra por nombre; los resultados son de categoría armadura del SRD (busca p. ej. "leather", "chain").</p>
        </Modal>
      )}

      {pick && (
        <Modal
          title={`Elegir ${{
            ancestry: "ancestry", heritage: "heritage", background: "background",
            class: "clase", muse: "musa del bardo",
          }[pick]}`}
          onClose={() => {
            if (pick === "muse" && needsSecondMuse(c)) return;
            setPick(null);
          }}
        >
          {pick === "class" && (
            <>
              <div className="char-card" style={{ marginBottom: 10 }}>
                <b>Psiónico (house rule Elhoss)</b>
                <button className="small" style={{ marginLeft: 8 }} onClick={() => {
                  update((o) => applyClassSelection(o, { name: "Psiónico" }));
                  setPick(null);
                }}>Elegir Psiónico</button>
              </div>
              <CatalogSearch
                type="class"
                dmMode={c.dmMode}
                pickLabel="Elegir"
                onPick={async (item) => {
                  const full = await api.item(item.uid);
                  update((o) => applyClassSelection(o, {
                    name: item.name, uid: item.uid, hpPerLevel: Number(full.hp ?? 8),
                  }));
                  setPick(null);
                  if (isBard(item.name)) setTimeout(() => setPick("muse"), 0);
                }}
              />
            </>
          )}
          {pick === "muse" && (
            <>
              <p className="muted">
                {needsSecondMuse(c)
                  ? `Multifarious Muse: elige una segunda musa distinta de ${c.muses[0]}.`
                  : "Cada musa otorga un feat, un conjuro y bonos de skills."}
              </p>
              <CatalogSearch
                type="class-option"
                category="bard muse"
                excludeNames={c.muses}
                dmMode={c.dmMode}
                pickLabel={needsSecondMuse(c) ? "Elegir segunda musa" : "Elegir musa"}
                onPick={(item) => {
                  update((o) => applyMuseSelection(o, item.name, item.uid));
                  setPick(null);
                }}
              />
            </>
          )}
          {(pick === "ancestry" || pick === "heritage") && (
            <>
              <h4>House Rules de Elhoss {pick === "heritage" && c.ancestry.name ? `(${c.ancestry.name})` : ""}</h4>
              <HouseRulePicker
                kind={pick}
                ancestry={pick === "heritage" ? (c.ancestry.custom ? c.ancestry.name : undefined) : undefined}
                onPick={(entry) => {
                  if (pick === "ancestry") {
                    const d = entry.data || {};
                    update((o) => ({
                      ...o,
                      ancestry: {
                        uid: null, name: entry.title,
                        hp: Number(d.hp ?? o.ancestry.hp), speed: Number(d.speed ?? o.ancestry.speed),
                        size: String(d.size ?? o.ancestry.size), custom: true,
                      },
                    }));
                  } else {
                    update((o) => ({ ...o, heritage: { uid: null, name: entry.title } }));
                  }
                  setPick(null);
                }}
              />
              <h4 style={{ marginTop: 12 }}>SRD legacy ({ALLOWED_SOURCES_SHORT})</h4>
            </>
          )}
          {(pick === "ancestry" || pick === "heritage" || pick === "background") && (
          <CatalogSearch
            type={pick}
            dmMode={c.dmMode}
            pickLabel="Elegir"
            onPick={async (item) => {
              if (pick === "ancestry") {
                const full = await api.item(item.uid);
                const rawSpeed = full.speed as number | { land?: number } | undefined;
                const sp = typeof rawSpeed === "number" ? rawSpeed : rawSpeed?.land ?? (full.speed_raw ? parseInt(String(full.speed_raw)) : 25);
                const rawSize = full.size as string[] | string | undefined;
                update((o) => ({
                  ...o,
                  ancestry: {
                    uid: item.uid, name: item.name, hp: Number(full.hp ?? 8),
                    speed: Number(sp) || 25, size: Array.isArray(rawSize) ? rawSize[0] : (rawSize ?? "Medium"), custom: false,
                  },
                }));
              } else if (pick === "heritage") {
                update((o) => ({ ...o, heritage: { uid: item.uid, name: item.name } }));
              } else {
                update((o) => ({ ...o, background: { uid: item.uid, name: item.name } }));
              }
              setPick(null);
            }}
          />
          )}
        </Modal>
      )}

      {weaponModal && (
        <Modal title="Buscar arma (SRD legacy)" onClose={() => setWeaponModal(false)}>
          <CatalogSearch
            type="item"
            dmMode={c.dmMode}
            pickLabel="Añadir strike"
            onPick={async (item) => {
              const full = await api.item(item.uid);
              const dmg = String(full.damage ?? "1d6 B");
              const m = dmg.match(/([\dd+\s]+)\s*([A-Za-z]*)/);
              const wcat = String(full.weapon_category ?? "simple").toLowerCase() as Strike["profCategory"];
              const isRanged = String(full.weapon_type ?? "") === "Ranged";
              update((o) => ({
                ...o,
                strikes: [...o.strikes, {
                  name: item.name,
                  ability: isRanged ? "dex" : "str",
                  profCategory: (["unarmed", "simple", "martial", "advanced"].includes(wcat) ? wcat : "simple"),
                  itemBonus: 0,
                  damageDice: m ? m[1].trim() : "1d6",
                  damageType: m ? m[2] : "B",
                  damageBonusOverride: null,
                  traits: item.traits.join(", "),
                  range: isRanged ? String(full.range ?? "") : "",
                }],
              }));
              setWeaponModal(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function StrikeRow({ c, s, onChange, onDelete }: {
  c: Character; s: Strike; onChange: (s: Strike) => void; onDelete: () => void;
}) {
  const atk = strikeAttack(c, s);
  const dmgBonus = strikeDamageBonus(c, s);
  const prof = profBonus(c.attacksProf[s.profCategory], c.level);
  return (
    <details className="power-card">
      <summary>
        <b>{s.name}</b>
        <span className="total-badge">{fmt(atk)}</span>
        <span className="muted">{fmt(atk - 5)} / {fmt(atk - 10)} (MAP)</span>
        <span>{s.damageDice}{dmgBonus !== 0 ? fmt(dmgBonus) : ""} {s.damageType}</span>
        {s.range && <span className="muted">({s.range} ft)</span>}
      </summary>
      <div className="pc-body">
        <div className="grid cols-4">
          <div className="field"><label>Nombre</label>
            <input value={s.name} onChange={(e) => onChange({ ...s, name: e.target.value })} /></div>
          <div className="field"><label>Característica</label>
            <select value={s.ability} onChange={(e) => onChange({ ...s, ability: e.target.value as AbilityKey })}>
              {ABILITIES.map((a) => <option key={a} value={a}>{a.toUpperCase()}</option>)}
            </select></div>
          <div className="field"><label>Proficiency</label>
            <select value={s.profCategory} onChange={(e) => onChange({ ...s, profCategory: e.target.value as Strike["profCategory"] })}>
              {["unarmed", "simple", "martial", "advanced"].map((p) => <option key={p} value={p}>{p}</option>)}
            </select></div>
          <div className="field"><label>Bonus de ítem</label>
            <input type="number" value={s.itemBonus} onChange={(e) => onChange({ ...s, itemBonus: +e.target.value })} /></div>
          <div className="field"><label>Dados de daño</label>
            <input value={s.damageDice} onChange={(e) => onChange({ ...s, damageDice: e.target.value })} /></div>
          <div className="field"><label>Tipo</label>
            <input value={s.damageType} onChange={(e) => onChange({ ...s, damageType: e.target.value })} /></div>
          <div className="field"><label>Alcance (ft, vacío = melee)</label>
            <input value={s.range} onChange={(e) => onChange({ ...s, range: e.target.value })} /></div>
          <div className="field"><label>Traits</label>
            <input value={s.traits} onChange={(e) => onChange({ ...s, traits: e.target.value })} /></div>
        </div>
        <p className="muted">
          Ataque = {fmt(abilityMod(c, s.ability))} ({s.ability.toUpperCase()}) + {prof} (prof) + {s.itemBonus} (ítem) = {fmt(atk)}
        </p>
        <button className="small ghost" onClick={onDelete}>Eliminar strike</button>
      </div>
    </details>
  );
}
