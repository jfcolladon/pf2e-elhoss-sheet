import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { mod, fmt } from "../lib/calc";
import { applyClassSelection, applyMuseSelection, isBard } from "../lib/rules";
import { ALLOWED_SOURCES_SHORT } from "../lib/sources";
import { Section, CatalogSearch, AllowedBadge } from "../components/common";
import {
  ABILITY_LABELS, AbilityKey, Character, defaultCharacter, KnownPower, PsionicPower,
} from "../types";

const ABILITIES: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
const STEPS = ["Concepto", "Características", "Ancestry", "Background", "Clase", "Wild Talents", "Final"];

const d6 = () => 1 + Math.floor(Math.random() * 6);
const d100 = () => 1 + Math.floor(Math.random() * 100);
const roll4d6DropLowest = () => {
  const dice = [d6(), d6(), d6(), d6()].sort((a, b) => b - a);
  return dice[0] + dice[1] + dice[2];
};

// Tabla 3d100 de Wild Talents (house rules Elhoss)
function wildComposition(total: number): number[] {
  if (total <= 30) return [];
  if (total <= 60) return [0];
  if (total <= 90) return [0, 0];
  if (total <= 120) return [0, 0, 0];
  if (total <= 150) return [0, 0, 1];
  if (total <= 180) return [0, 1, 1];
  if (total <= 210) return [1, 1, 1];
  if (total <= 235) return [1, 1, 2];
  if (total <= 260) return [1, 2, 2];
  if (total <= 285) return [2, 2, 2];
  if (total <= 295) return [2, 2, 3];
  return [0, 2, 3];
}

interface CustomAncestry {
  name: string; hp: number; size: string; speed: number; vision: string;
  traits: string[]; boosts: string[]; flaw: string | null; languages: string;
}

export default function Wizard() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [c, setC] = useState<Character>(defaultCharacter());
  const up = (patch: Partial<Character>) => setC((old) => ({ ...old, ...patch }));

  // ----- paso 2: tiradas -----
  const [rolls, setRolls] = useState<number[]>([]);
  const [assignment, setAssignment] = useState<Partial<Record<AbilityKey, number>>>({});

  // ----- ancestrías custom -----
  const [customAncestries, setCustomAncestries] = useState<CustomAncestry[]>([]);
  useEffect(() => {
    api.houserules("ancestry").then((rows) =>
      setCustomAncestries(rows.map((r) => r.data as unknown as CustomAncestry))
    );
  }, []);

  // ----- boosts -----
  const [ancestryBoostsApplied, setAncestryBoostsApplied] = useState(false);
  const [bgBoost, setBgBoost] = useState<AbilityKey | null>(null);
  const [showMusePicker, setShowMusePicker] = useState(false);

  // ----- wild talents -----
  const [wildDice, setWildDice] = useState<number[] | null>(null);
  const [wtTable, setWtTable] = useState<Awaited<ReturnType<typeof api.wildTalents>>>([]);
  const [allPowers, setAllPowers] = useState<PsionicPower[]>([]);
  useEffect(() => {
    api.wildTalents().then(setWtTable);
    api.powers().then(setAllPowers);
  }, []);

  const applyBoost = (key: AbilityKey, delta: number) => {
    setC((old) => {
      const cur = old.abilities[key];
      let next = cur + delta;
      if (delta > 0) next = Math.min(18, next); // tope 18 en creación (house rule)
      return { ...old, abilities: { ...old.abilities, [key]: next } };
    });
  };

  const wildResult = useMemo(() => {
    if (!wildDice) return null;
    const total = wildDice[0] + wildDice[1] + wildDice[2];
    const comp = wildComposition(total);
    const picks: { rank: number; die: number; entry: typeof wtTable[number] | null }[] = comp.map((rank, i) => {
      const die = wildDice[i];
      const entry = wtTable.find((e) => e.rank === rank && die >= e.prob_min && die <= e.prob_max) ?? null;
      return { rank, die, entry };
    });
    return { total, comp, picks };
  }, [wildDice, wtTable]);

  const addWildPowers = () => {
    if (!wildResult) return;
    const powers: KnownPower[] = [];
    for (const p of wildResult.picks) {
      if (!p.entry) continue;
      const pw = allPowers.find((x) => x.name.toLowerCase() === p.entry!.name.toLowerCase());
      powers.push({
        powerId: pw?.id ?? -1,
        name: p.entry.name,
        discipline: pw?.discipline ?? "?",
        rank: p.entry.rank,
        cost: p.entry.cost,
        wild: true,
      });
    }
    setC((old) => ({
      ...old,
      psionics: {
        ...old.psionics,
        enabled: powers.length > 0 || old.psionics.enabled,
        mode: old.clazz.isPsionic ? "class" : "wild",
        powers: [...old.psionics.powers, ...powers],
        wildRoll: { dice: wildDice!, total: wildResult.total },
      },
    }));
  };

  const finish = async () => {
    const max = c.ancestry.hp + (c.clazz.hpPerLevel + mod(c.abilities.con)) * c.level;
    const final: Character = { ...c, hp: { ...c.hp, current: max } };
    const { id } = await api.createCharacter(final);
    nav(`/c/${id}`);
  };

  return (
    <div>
      <h2 style={{ marginBottom: 10 }}>Creación de personaje — House Rules Elhoss</h2>
      <div className="wizard-steps">
        {STEPS.map((s, i) => (
          <span key={s} className={`step ${i === step ? "active" : i < step ? "done" : ""}`}>{i + 1}. {s}</span>
        ))}
      </div>

      {step === 0 && (
        <Section title="Paso 1 — Concepto del personaje">
          <p className="muted">Define el concepto general: rol, estilo de combate o enfoque narrativo.</p>
          <div className="grid cols-2">
            <div className="field"><label>Nombre del personaje</label>
              <input value={c.name} onChange={(e) => up({ name: e.target.value })} /></div>
            <div className="field"><label>Jugador</label>
              <input value={c.player} onChange={(e) => up({ player: e.target.value })} /></div>
            <div className="field" style={{ gridColumn: "1 / -1" }}><label>Concepto / notas</label>
              <textarea rows={3} value={c.notes} onChange={(e) => up({ notes: e.target.value })} /></div>
          </div>
        </Section>
      )}

      {step === 1 && (
        <Section title="Paso 2 — Generación de características (12 × 4d6, descarta el menor)">
          <p className="muted">
            Tira 12 veces 4d6 descartando el dado más bajo. Elige 6 resultados y asígnalos
            libremente. Los 6 restantes se descartan.
          </p>
          <button onClick={() => { setRolls(Array.from({ length: 12 }, roll4d6DropLowest)); setAssignment({}); }}>
            🎲 Tirar 12 × 4d6
          </button>
          {rolls.length > 0 && (
            <>
              <div className="dice-pool" style={{ margin: "12px 0" }}>
                {rolls.map((r, i) => {
                  const usedBy = ABILITIES.find((a) => assignment[a] === i);
                  return (
                    <div key={i} className={`die ${usedBy ? "used" : ""}`} title={usedBy ? ABILITY_LABELS[usedBy] : ""}>
                      {r}{usedBy ? <span style={{ fontSize: 9 }}>&nbsp;{usedBy.toUpperCase()}</span> : ""}
                    </div>
                  );
                })}
              </div>
              <div className="grid cols-6">
                {ABILITIES.map((a) => (
                  <div className="field" key={a}>
                    <label>{ABILITY_LABELS[a]}</label>
                    <select
                      value={assignment[a] ?? ""}
                      onChange={(e) => {
                        const idx = e.target.value === "" ? undefined : Number(e.target.value);
                        setAssignment((old) => {
                          const next = { ...old };
                          if (idx === undefined) delete next[a];
                          else next[a] = idx;
                          return next;
                        });
                      }}
                    >
                      <option value="">—</option>
                      {rolls.map((r, i) => {
                        const taken = ABILITIES.some((x) => x !== a && assignment[x] === i);
                        return <option key={i} value={i} disabled={taken}>{r}</option>;
                      })}
                    </select>
                  </div>
                ))}
              </div>
              <button
                style={{ marginTop: 10 }}
                disabled={Object.keys(assignment).length !== 6}
                onClick={() => {
                  const ab = { ...c.abilities };
                  for (const a of ABILITIES) ab[a] = rolls[assignment[a]!];
                  up({ abilities: ab });
                  setStep(2);
                }}
              >
                Confirmar características
              </button>
            </>
          )}
        </Section>
      )}

      {step === 2 && (
        <Section title={`Paso 3 — Ancestry (custom de Elhoss o ${ALLOWED_SOURCES_SHORT})`}>
          <p className="muted">
            House rule: si la ancestry otorga boosts libres, recibe uno menos de lo normal. Tope 18.
          </p>
          <h4>Ancestrías de Elhoss (house rules)</h4>
          <div className="grid cols-2" style={{ marginBottom: 12 }}>
            {customAncestries.map((a) => (
              <div key={a.name} className="char-card">
                <b>{a.name}</b>
                <span className="muted">
                  HP {a.hp} · {a.size} · {a.speed} ft · {a.vision} · Boosts: {a.boosts.join(", ")}
                  {a.flaw ? ` · Flaw: ${a.flaw}` : ""}
                </span>
                <button
                  className="small"
                  onClick={() => {
                    up({ ancestry: { uid: null, name: a.name, hp: a.hp, speed: a.speed, size: a.size, custom: true } });
                    setAncestryBoostsApplied(false);
                  }}
                >
                  Elegir
                </button>
              </div>
            ))}
          </div>
          <h4>Ancestrías del SRD (manuales autorizados)</h4>
          <CatalogSearch
            type="ancestry"
            dmMode={c.dmMode}
            pickLabel="Elegir"
            onPick={async (item) => {
              const full = await api.item(item.uid);
              const rawSpeed = full.speed as number | { land?: number } | undefined;
              const speed =
                typeof rawSpeed === "number" ? rawSpeed :
                rawSpeed?.land ?? (full.speed_raw ? parseInt(String(full.speed_raw)) : 25);
              const rawSize = full.size as string[] | string | undefined;
              up({
                ancestry: {
                  uid: item.uid, name: item.name,
                  hp: Number(full.hp ?? 8), speed: Number(speed) || 25,
                  size: Array.isArray(rawSize) ? rawSize[0] : (rawSize ?? "Medium"), custom: false,
                },
              });
              setAncestryBoostsApplied(false);
            }}
          />
          {c.ancestry.name && (
            <div style={{ marginTop: 12 }}>
              <div className="warn-box" style={{ marginBottom: 8 }}>
                Seleccionada: <b>{c.ancestry.name}</b> (HP {c.ancestry.hp}, {c.ancestry.speed} ft).
                Aplica ahora los boosts/flaws con los botones (+2 / −2). Recuerda: un boost libre menos.
              </div>
              <AbilityAdjuster c={c} applyBoost={applyBoost} />
              <label style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <input type="checkbox" checked={ancestryBoostsApplied} onChange={(e) => setAncestryBoostsApplied(e.target.checked)} />
                Boosts de ancestry aplicados
              </label>
            </div>
          )}
        </Section>
      )}

      {step === 3 && (
        <Section title="Paso 4 — Background (solo UNO de los dos boosts)">
          <p className="muted">House rule: aplica solo uno de los dos boosts del background (el fijo o el libre). Tope 18.</p>
          <CatalogSearch
            type="background"
            dmMode={c.dmMode}
            pickLabel="Elegir"
            onPick={(item) => up({ background: { uid: item.uid, name: item.name } })}
          />
          {c.background.name && (
            <div style={{ marginTop: 12 }}>
              <div className="warn-box" style={{ marginBottom: 8 }}>
                Background: <b>{c.background.name}</b>. Elige a qué característica aplicas el único boost (+2):
              </div>
              <div className="row">
                {ABILITIES.map((a) => (
                  <button
                    key={a}
                    className={bgBoost === a ? "" : "ghost"}
                    onClick={() => {
                      if (bgBoost) applyBoost(bgBoost, -2);
                      applyBoost(a, +2);
                      setBgBoost(a);
                    }}
                  >
                    {ABILITY_LABELS[a]} {fmt(mod(c.abilities[a]))}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {step === 4 && (
        <Section title="Paso 5 — Clase (manuales autorizados o Psiónico de Elhoss)">
          <div className="char-card" style={{ marginBottom: 12 }}>
            <b>Psiónico (house rule de Elhoss)</b>
            <span className="muted">
              d8 HP · Disciplinas: Force (STR), Move (DEX), Egoism (CON), Seer (INT), Soul (WIS), Mind (CHA).
              Usa Psionic Focus Points en lugar de spell slots.
            </span>
            <PsionicClassPicker c={c} setC={setC} applyBoost={applyBoost} />
          </div>
          <h4>Clases del SRD (manuales autorizados)</h4>
          <CatalogSearch
            type="class"
            dmMode={c.dmMode}
            pickLabel="Elegir"
            onPick={async (item) => {
              const full = await api.item(item.uid);
              setC((old) => applyClassSelection(old, {
                name: item.name, uid: item.uid, hpPerLevel: Number(full.hp ?? 8),
              }));
              setShowMusePicker(isBard(item.name));
            }}
          />
          {c.clazz.name && (
            <div className="warn-box" style={{ marginTop: 10 }}>
              Clase: <b>{c.clazz.name}</b> (HP {c.clazz.hpPerLevel}/nivel, key: {ABILITY_LABELS[c.clazz.keyAbility]}).
              {c.clazz.isCaster && <> Lanzador {c.spellcasting.tradition} ({c.spellcasting.castingType}).</>}
              Aplica el boost de clase:
              <button className="small" style={{ marginLeft: 8 }} onClick={() => applyBoost(c.clazz.keyAbility, +2)}>
                +2 a {ABILITY_LABELS[c.clazz.keyAbility]}
              </button>
            </div>
          )}
          {isBard(c.clazz.name) && (
            <div style={{ marginTop: 12 }}>
              <h4>Musa del bardo *</h4>
              {c.muses.length === 0 ? (
                <>
                  <p className="muted">El bardo debe elegir una musa. Cada una otorga un feat y un conjuro.</p>
                  {!showMusePicker && (
                    <button className="small" onClick={() => setShowMusePicker(true)}>Elegir musa</button>
                  )}
                </>
              ) : (
                <p>Musa elegida: <b>{c.muses.join(", ")}</b></p>
              )}
              {showMusePicker && c.muses.length === 0 && (
                <CatalogSearch
                  type="class-option"
                  category="bard muse"
                  dmMode={c.dmMode}
                  pickLabel="Elegir musa"
                  onPick={(item) => {
                    setC((old) => applyMuseSelection(old, item.name, item.uid));
                    setShowMusePicker(false);
                  }}
                />
              )}
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            <AbilityAdjuster c={c} applyBoost={applyBoost} />
          </div>
        </Section>
      )}

      {step === 5 && (
        <Section title="Paso 6 — Wild Talents (psiónica salvaje, 3d100)">
          <p className="muted">
            Toda persona en Elhoss puede tener talentos psiónicos innatos. Tira 3d100: el total define
            cuántos poderes obtienes y cada dado individual determina qué poder según las tablas.
          </p>
          <button onClick={() => setWildDice([d100(), d100(), d100()])}>🎲 Tirar 3d100</button>
          {wildResult && (
            <div style={{ marginTop: 10 }}>
              <div className="dice-pool">
                {wildDice!.map((d, i) => <div key={i} className="die">{d}</div>)}
                <div className="die selected">{wildResult.total}</div>
              </div>
              <p>
                <b>Total {wildResult.total}:</b>{" "}
                {wildResult.comp.length === 0
                  ? "Sin talentos salvajes."
                  : wildResult.comp.map((r) => `Rank ${r}`).join(" + ")}
              </p>
              {wildResult.picks.map((p, i) => (
                <div key={i} className="row" style={{ marginBottom: 4 }}>
                  <span className="badge dm">d100 = {p.die}</span>
                  {p.entry
                    ? <span><b>{p.entry.name}</b> (Rank {p.entry.rank}, {p.entry.cost} PFP{p.entry.tier ? `, ${p.entry.tier}` : ""})</span>
                    : <span className="muted">Rank {p.rank}: elige manualmente un poder con el DM (sin tabla para este rank).</span>}
                </div>
              ))}
              {wildResult.picks.some((p) => p.entry) && (
                <button style={{ marginTop: 6 }} onClick={addWildPowers}>Añadir estos poderes al personaje</button>
              )}
              {c.psionics.powers.filter((p) => p.wild).length > 0 && (
                <p className="muted">Añadidos: {c.psionics.powers.filter((p) => p.wild).map((p) => p.name).join(", ")}</p>
              )}
            </div>
          )}
        </Section>
      )}

      {step === 6 && (
        <Section title="Paso 7 — Finalización">
          <table className="sheet">
            <tbody>
              <tr><td><b>Nombre</b></td><td>{c.name || "—"}</td></tr>
              <tr><td><b>Ancestry</b></td><td>{c.ancestry.name || "—"} {c.ancestry.custom && <AllowedBadge allowed={true} />}</td></tr>
              <tr><td><b>Background</b></td><td>{c.background.name || "—"}</td></tr>
              <tr><td><b>Clase</b></td><td>{c.clazz.name || "—"}</td></tr>
              <tr>
                <td><b>Características</b></td>
                <td>{ABILITIES.map((a) => `${a.toUpperCase()} ${c.abilities[a]} (${fmt(mod(c.abilities[a]))})`).join(" · ")}</td>
              </tr>
              <tr>
                <td><b>HP iniciales</b></td>
                <td>{c.ancestry.hp + c.clazz.hpPerLevel + mod(c.abilities.con)}</td>
              </tr>
              <tr>
                <td><b>Wild Talents</b></td>
                <td>{c.psionics.powers.filter((p) => p.wild).map((p) => p.name).join(", ") || "Ninguno"}</td>
              </tr>
            </tbody>
          </table>
          <button style={{ marginTop: 12 }} onClick={finish} disabled={!c.name}>
            ✔ Crear personaje
          </button>
          {!c.name && <p className="muted">Falta el nombre (paso 1).</p>}
        </Section>
      )}

      <div className="row" style={{ marginTop: 8 }}>
        <button className="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>← Anterior</button>
        <button disabled={step === STEPS.length - 1} onClick={() => setStep(step + 1)}>Siguiente →</button>
      </div>
    </div>
  );
}

function AbilityAdjuster({ c, applyBoost }: { c: Character; applyBoost: (k: AbilityKey, d: number) => void }) {
  return (
    <div className="grid cols-6">
      {ABILITIES.map((a) => (
        <div className="ability-box" key={a}>
          <div className="ab-name">{ABILITY_LABELS[a]}</div>
          <div className="ab-mod">{fmt(mod(c.abilities[a]))}</div>
          <div>{c.abilities[a]}</div>
          <div className="row" style={{ justifyContent: "center", gap: 4 }}>
            <button className="small ghost" onClick={() => applyBoost(a, -2)}>−2</button>
            <button className="small ghost" onClick={() => applyBoost(a, +2)} disabled={c.abilities[a] >= 18}>+2</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function PsionicClassPicker({
  c, setC, applyBoost,
}: {
  c: Character;
  setC: React.Dispatch<React.SetStateAction<Character>>;
  applyBoost: (k: AbilityKey, d: number) => void;
}) {
  const [disciplines, setDisciplines] = useState<Awaited<ReturnType<typeof api.disciplines>>>([]);
  useEffect(() => { api.disciplines().then(setDisciplines); }, []);
  return (
    <div className="row">
      {disciplines.map((d) => (
        <button
          key={d.name}
          className={c.clazz.isPsionic && c.psionics.discipline === d.name ? "" : "ghost"}
          title={d.foco}
          onClick={() => {
            const key = d.key_ability as AbilityKey;
            setC((old) => ({
              ...old,
              clazz: {
                uid: null, name: "Psiónico", keyAbility: key, hpPerLevel: 8,
                isCaster: false, castingType: "spontaneous", tradition: "", isPsionic: true,
              },
              psionics: { ...old.psionics, enabled: true, mode: "class", discipline: d.name, keyAbility: key },
            }));
            applyBoost(key, +2);
          }}
        >
          {d.name} ({d.key_ability.toUpperCase()})
        </button>
      ))}
    </div>
  );
}
