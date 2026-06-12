import { useState } from "react";
import { api } from "../api";
import { UpdateFn } from "../pages/Sheet";
import { Section, Modal, CatalogSearch, AllowedBadge, PipTracker, Teml } from "../components/common";
import { AonMarkdown } from "../lib/markdown";
import { fmt, maxSpellRank, spellAttack, spellDc, extraSpellAttack, extraSpellDc } from "../lib/calc";
import { syncFeatEffects } from "../lib/rules";
import { Character, ExtraCaster, KnownSpell } from "../types";

type AddTarget = { composition?: boolean; focus?: boolean; cantrip?: boolean; casterId?: string };

export default function SpellsTab({ c, update }: { c: Character; update: UpdateFn }) {
  const [adding, setAdding] = useState<null | AddTarget>(null);
  const [detail, setDetail] = useState<{ name: string; md: string } | null>(null);
  const sc = c.spellcasting;
  const extraCasters = c.extraCasters ?? [];

  if (!sc.enabled && extraCasters.length === 0) {
    return (
      <Section title="Conjuros">
        <p>Este personaje no es lanzador de conjuros.</p>
        <button onClick={() => update((o) => ({ ...o, spellcasting: { ...o.spellcasting, enabled: true } }))}>
          Habilitar lanzamiento de conjuros
        </button>
      </Section>
    );
  }

  const showDetail = async (s: KnownSpell) => {
    if (!s.uid) return;
    const it = await api.item(s.uid);
    setDetail({ name: s.name, md: String(it.markdown ?? "") });
  };

  const updateSpell = (idx: number, patch: Partial<KnownSpell>) =>
    update((o) => {
      const known = [...o.spellcasting.known];
      known[idx] = { ...known[idx], ...patch };
      return { ...o, spellcasting: { ...o.spellcasting, known } };
    });

  const regular = sc.known.filter((s) => !s.composition && !s.focus);
  const compositions = sc.known.filter((s) => s.composition);
  const focusSpells = sc.known.filter((s) => s.focus && !s.composition);
  const maxRank = maxSpellRank(c.level);

  const addSpell = (target: AddTarget, item: { uid: string; name: string; level: number | null; allowed: boolean; traits: string[] }, needsDm: boolean) => {
    const isCantrip = target.cantrip || item.traits.some((t) => t.toLowerCase() === "cantrip");
    const entry: KnownSpell = {
      uid: item.uid, name: item.name, rank: isCantrip ? 0 : (item.level ?? 0),
      signature: false, prepared: 0,
      composition: !!target.composition,
      focus: !!target.focus || !!target.composition,
      allowed: item.allowed, dmApproved: needsDm,
    };
    update((o) => {
      if (target.casterId) {
        const ecs = (o.extraCasters ?? []).map((e) =>
          e.id === target.casterId ? { ...e, known: [...e.known, entry] } : e);
        return { ...o, extraCasters: ecs };
      }
      return { ...o, spellcasting: { ...o.spellcasting, known: [...o.spellcasting.known, entry] } };
    });
  };

  return (
    <>
      <Section title="Lanzamiento de conjuros">
        <button className="small" onClick={() => update((o) => syncFeatEffects(o))}>
          ⟳ Recalcular automáticos (dedicaciones, musas, slots de archetype)
        </button>
        <p className="muted">
          Re-deriva fuentes de conjuros por dedicación, conjuros/feats de musas y slots de archetype según tu nivel ({c.level}). No reduce lo editado a mano.
        </p>
      </Section>
    {sc.enabled && (
    <div className="grid cols-2">
      <div>
        <Section title="Lanzamiento (clase)">
          <div className="row">
            <div className="stat-big"><div className="v">{fmt(spellAttack(c))}</div><div className="l">Ataque de conjuro</div></div>
            <div className="stat-big"><div className="v">{spellDc(c)}</div><div className="l">DC de conjuro</div></div>
            <div className="field">
              <label>Proficiency</label>
              <Teml value={c.spellAttackRank} onChange={(r) => update((o) => ({ ...o, spellAttackRank: r }))} />
            </div>
            <div className="field">
              <label>Atributo de conjuro</label>
              <select value={c.spellcasting.ability}
                onChange={(e) => update((o) => ({ ...o, spellcasting: { ...o.spellcasting, ability: e.target.value as typeof o.spellcasting.ability } }))}>
                {(["str", "dex", "con", "int", "wis", "cha"] as const).map((a) => <option key={a} value={a}>{a.toUpperCase()}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Tipo</label>
              <select value={c.spellcasting.castingType}
                onChange={(e) => update((o) => ({ ...o, spellcasting: { ...o.spellcasting, castingType: e.target.value as "prepared" | "spontaneous" } }))}>
                <option value="spontaneous">Espontáneo</option>
                <option value="prepared">Preparado</option>
              </select>
            </div>
            <div className="field">
              <label>Tradición</label>
              <select value={c.spellcasting.tradition}
                onChange={(e) => update((o) => ({ ...o, spellcasting: { ...o.spellcasting, tradition: e.target.value } }))}>
                {["arcane", "divine", "occult", "primal"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <p className="muted">Rank máximo de conjuro a nivel {c.level}: {maxRank}.</p>
        </Section>

        <Section title="Slots de conjuro por rank">
          <table className="sheet">
            <thead><tr><th>Rank</th><th>Máx.</th><th>Usados</th><th></th></tr></thead>
            <tbody>
              {Array.from({ length: maxRank }, (_, i) => i + 1).map((rank) => {
                const slot = sc.slots[rank] ?? { max: 0, used: 0 };
                return (
                  <tr key={rank}>
                    <td><b>{rank}</b></td>
                    <td>
                      <input type="number" style={{ width: 52 }} value={slot.max}
                        onChange={(e) => update((o) => ({
                          ...o,
                          spellcasting: { ...o.spellcasting, slots: { ...o.spellcasting.slots, [rank]: { ...slot, max: +e.target.value } } },
                        }))} />
                    </td>
                    <td>
                      <PipTracker current={slot.used} max={slot.max}
                        onChange={(v) => update((o) => ({
                          ...o,
                          spellcasting: { ...o.spellcasting, slots: { ...o.spellcasting.slots, [rank]: { ...slot, used: v } } },
                        }))} />
                    </td>
                    <td className="muted">{slot.max - slot.used} libres</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button className="small ghost" style={{ marginTop: 6 }}
            onClick={() => update((o) => {
              const slots = { ...o.spellcasting.slots };
              for (const k of Object.keys(slots)) slots[k] = { ...slots[k], used: 0 };
              return { ...o, spellcasting: { ...o.spellcasting, slots } };
            })}>
            ☀ Descanso diario (restaurar slots)
          </button>
        </Section>

        <Section title="Puntos de foco">
          <PipTracker
            current={sc.focus.current}
            max={Math.min(3, sc.focus.max)}
            onChange={(v) => update((o) => ({ ...o, spellcasting: { ...o.spellcasting, focus: { ...o.spellcasting.focus, current: v } } }))}
          />
          <div className="row" style={{ marginTop: 6 }}>
            <label>Máximo (≤3):</label>
            <input type="number" min={0} max={3} value={sc.focus.max}
              onChange={(e) => update((o) => ({
                ...o,
                spellcasting: { ...o.spellcasting, focus: { ...o.spellcasting.focus, max: Math.min(3, Math.max(0, +e.target.value)) } },
              }))} />
            <button className="small"
              onClick={() => update((o) => ({
                ...o,
                spellcasting: {
                  ...o.spellcasting,
                  focus: { ...o.spellcasting.focus, current: Math.min(o.spellcasting.focus.max, o.spellcasting.focus.current + 1) },
                },
              }))}>
              ⟳ Refocus (10 min, +1)
            </button>
          </div>
          <h4 style={{ marginTop: 10 }}>Focus spells</h4>
          {focusSpells.length === 0 && <p className="muted">Sin focus spells.</p>}
          {focusSpells.map((s) => (
            <SpellRow key={sc.known.indexOf(s)} c={c} s={s} idx={sc.known.indexOf(s)}
              updateSpell={updateSpell} showDetail={showDetail} update={update} />
          ))}
          <button className="small" onClick={() => setAdding({ focus: true })}>+ Añadir focus spell</button>
        </Section>
      </div>

      <div>
        <Section
          title={c.spellcasting.castingType === "spontaneous" ? "Repertorio (signature spells ★)" : "Conjuros conocidos / preparados"}
          extra={
            <span className="row" style={{ gap: 4 }}>
              <button className="small" onClick={() => setAdding({ cantrip: true })}>+ Cantrip</button>
              <button className="small" onClick={() => setAdding({})}>+ Conjuro</button>
            </span>
          }
        >
          {c.spellcasting.castingType === "spontaneous" && (
            <p className="muted">
              ★ Signature spell: puedes lanzarlo heightened a cualquier rank que tengas sin aprenderlo de nuevo.
            </p>
          )}
          {regular.length === 0 && <p className="muted">Sin conjuros aún.</p>}
          {Array.from({ length: maxRank + 1 }, (_, r) => r).map((rank) => {
            const spells = regular.filter((s) => s.rank === rank);
            if (spells.length === 0) return null;
            return (
              <div key={rank}>
                <h4>{rank === 0 ? "Cantrips" : `Rank ${rank}`}</h4>
                {spells.map((s) => (
                  <SpellRow key={sc.known.indexOf(s)} c={c} s={s} idx={sc.known.indexOf(s)}
                    updateSpell={updateSpell} showDetail={showDetail} update={update} />
                ))}
              </div>
            );
          })}
        </Section>

        <Section
          title="Composition spells (bardo)"
          extra={<button className="small" onClick={() => setAdding({ composition: true })}>+ Añadir composition</button>}
        >
          <p className="muted">
            Las composiciones (cantrips y focus spells con trait Composition) usan puntos de foco.
          </p>
          {compositions.length === 0 && <p className="muted">Sin composition spells.</p>}
          {compositions.map((s) => (
            <SpellRow key={sc.known.indexOf(s)} c={c} s={s} idx={sc.known.indexOf(s)}
              updateSpell={updateSpell} showDetail={showDetail} update={update} />
          ))}
        </Section>
      </div>
    </div>
    )}

      {extraCasters.map((ec) => (
        <ExtraCasterBlock key={ec.id} c={c} ec={ec} maxRank={maxRank}
          onAdd={(t) => setAdding(t)} showDetail={showDetail} update={update} />
      ))}

      {adding && (() => {
        const targetCaster = adding.casterId ? extraCasters.find((e) => e.id === adding.casterId) : null;
        const filterTradition = adding.composition || adding.focus
          ? undefined
          : (targetCaster ? targetCaster.tradition : c.spellcasting.tradition);
        return (
          <Modal
            title={adding.composition ? "Añadir composition spell" : adding.focus ? "Añadir focus spell" : adding.cantrip ? "Añadir cantrip" : "Añadir conjuro"}
            onClose={() => setAdding(null)}
          >
            <CatalogSearch
              type="spell"
              dmMode={c.dmMode}
              trait={adding.composition ? "Composition" : adding.cantrip ? "Cantrip" : undefined}
              tradition={filterTradition}
              pickLabel="Aprender"
              onPick={(item, needsDm) => {
                addSpell(adding, item, needsDm);
                setAdding(null);
              }}
            />
            {filterTradition && <p className="muted">Filtrado por tradición {filterTradition}.</p>}
          </Modal>
        );
      })()}

      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(null)}>
          <AonMarkdown md={detail.md} />
        </Modal>
      )}
    </>
  );
}

function ExtraCasterBlock({ c, ec, maxRank, onAdd, showDetail, update }: {
  c: Character; ec: ExtraCaster; maxRank: number;
  onAdd: (t: AddTarget) => void;
  showDetail: (s: KnownSpell) => void;
  update: UpdateFn;
}) {
  const patchEc = (patch: Partial<ExtraCaster>) =>
    update((o) => ({
      ...o,
      extraCasters: (o.extraCasters ?? []).map((e) => (e.id === ec.id ? { ...e, ...patch } : e)),
    }));
  const updateKnown = (idx: number, patch: Partial<KnownSpell>) =>
    update((o) => ({
      ...o,
      extraCasters: (o.extraCasters ?? []).map((e) => {
        if (e.id !== ec.id) return e;
        const known = [...e.known];
        known[idx] = { ...known[idx], ...patch };
        return { ...e, known };
      }),
    }));
  const removeKnown = (idx: number) =>
    update((o) => ({
      ...o,
      extraCasters: (o.extraCasters ?? []).map((e) =>
        e.id === ec.id ? { ...e, known: e.known.filter((_, j) => j !== idx) } : e),
    }));
  const setSlot = (rank: number, patch: { max?: number; used?: number }) =>
    update((o) => ({
      ...o,
      extraCasters: (o.extraCasters ?? []).map((e) => {
        if (e.id !== ec.id) return e;
        const cur = e.slots[rank] ?? { max: 0, used: 0 };
        return { ...e, slots: { ...e.slots, [rank]: { ...cur, ...patch } } };
      }),
    }));
  const removeCaster = () =>
    update((o) => ({ ...o, extraCasters: (o.extraCasters ?? []).filter((e) => e.id !== ec.id) }));

  const attack = extraSpellAttack(c, ec);
  const dc = extraSpellDc(c, ec);

  return (
    <Section
      title={`Conjuros adicionales — ${ec.source} (${ec.tradition})`}
      extra={<button className="small ghost" onClick={removeCaster}>✕ Quitar fuente</button>}
    >
      <div className="row">
        <div className="stat-big"><div className="v">{fmt(attack)}</div><div className="l">Ataque</div></div>
        <div className="stat-big"><div className="v">{dc}</div><div className="l">DC</div></div>
        <div className="field">
          <label>Proficiency</label>
          <Teml value={ec.attackRank} onChange={(r) => patchEc({ attackRank: r })} />
        </div>
        <div className="field">
          <label>Atributo</label>
          <select value={ec.ability} onChange={(e) => patchEc({ ability: e.target.value as ExtraCaster["ability"] })}>
            {(["str", "dex", "con", "int", "wis", "cha"] as const).map((a) => <option key={a} value={a}>{a.toUpperCase()}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Tradición</label>
          <select value={ec.tradition} onChange={(e) => patchEc({ tradition: e.target.value })}>
            {["arcane", "divine", "occult", "primal"].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Tipo</label>
          <select value={ec.castingType} onChange={(e) => patchEc({ castingType: e.target.value as ExtraCaster["castingType"] })}>
            <option value="spontaneous">Espontáneo</option>
            <option value="prepared">Preparado</option>
          </select>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginTop: 8 }}>
        <div>
          <h4>Slots</h4>
          <table className="sheet">
            <thead><tr><th>Rank</th><th>Máx.</th><th>Usados</th><th></th></tr></thead>
            <tbody>
              {Array.from({ length: maxRank }, (_, i) => i + 1).map((rank) => {
                const slot = ec.slots[rank] ?? { max: 0, used: 0 };
                if (slot.max === 0) return null;
                return (
                  <tr key={rank}>
                    <td><b>{rank}</b></td>
                    <td><input type="number" style={{ width: 52 }} value={slot.max}
                      onChange={(e) => setSlot(rank, { max: +e.target.value })} /></td>
                    <td><PipTracker current={slot.used} max={slot.max} onChange={(v) => setSlot(rank, { used: v })} /></td>
                    <td className="muted">{slot.max - slot.used} libres</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button className="small ghost" style={{ marginTop: 6 }}
            onClick={() => update((o) => ({
              ...o,
              extraCasters: (o.extraCasters ?? []).map((e) => {
                if (e.id !== ec.id) return e;
                const slots = { ...e.slots };
                for (const k of Object.keys(slots)) slots[k] = { ...slots[k], used: 0 };
                return { ...e, slots };
              }),
            }))}>
            ☀ Restaurar slots
          </button>
          <p className="muted">Los slots se calculan con Basic/Expert/Master Spellcasting al recalcular automáticos.</p>
        </div>

        <div>
          <h4>
            Conjuros{" "}
            <button className="small" onClick={() => onAdd({ cantrip: true, casterId: ec.id })}>+ Cantrip</button>{" "}
            <button className="small" onClick={() => onAdd({ casterId: ec.id })}>+ Conjuro</button>
          </h4>
          {ec.known.length === 0 && <p className="muted">Sin conjuros aún.</p>}
          {Array.from({ length: maxRank + 1 }, (_, r) => r).map((rank) => {
            const spells = ec.known.map((s, i) => ({ s, i })).filter(({ s }) => s.rank === rank);
            if (spells.length === 0) return null;
            return (
              <div key={rank}>
                <h5 style={{ margin: "6px 0 2px" }}>{rank === 0 ? "Cantrips" : `Rank ${rank}`}</h5>
                {spells.map(({ s, i }) => (
                  <div key={i} className="search-row" style={{ cursor: "default" }}>
                    <span className="nm" style={{ cursor: "pointer" }} onClick={() => showDetail(s)}>{s.name}</span>
                    <span className="muted">{s.rank === 0 ? "cantrip" : `rank ${s.rank}`}</span>
                    <AllowedBadge allowed={s.allowed} dmApproved={s.dmApproved} />
                    {!s.allowed && c.dmMode && (
                      <label style={{ display: "flex", gap: 3, alignItems: "center" }}>
                        <input type="checkbox" checked={s.dmApproved} onChange={(e) => updateKnown(i, { dmApproved: e.target.checked })} />
                        DM
                      </label>
                    )}
                    {ec.castingType === "prepared" && s.rank > 0 && (
                      <span className="row" style={{ gap: 3 }}>
                        <span className="muted">prep.</span>
                        <input type="number" style={{ width: 44 }} min={0} value={s.prepared}
                          onChange={(e) => updateKnown(i, { prepared: +e.target.value })} />
                      </span>
                    )}
                    <span style={{ marginLeft: "auto" }}>
                      <button className="small ghost" onClick={() => removeKnown(i)}>✕</button>
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}

function SpellRow({ c, s, idx, updateSpell, showDetail, update }: {
  c: Character; s: KnownSpell; idx: number;
  updateSpell: (idx: number, patch: Partial<KnownSpell>) => void;
  showDetail: (s: KnownSpell) => void;
  update: UpdateFn;
}) {
  return (
    <div className="search-row" style={{ cursor: "default" }}>
      <span className="nm" style={{ cursor: "pointer" }} onClick={() => showDetail(s)}>{s.name}</span>
      <span className="muted">{s.rank === 0 ? "cantrip" : `rank ${s.rank}`}</span>
      {s.composition && <span className="badge comp">Composition</span>}
      {s.focus && !s.composition && <span className="badge comp">Focus</span>}
      <AllowedBadge allowed={s.allowed} dmApproved={s.dmApproved} />
      {!s.allowed && c.dmMode && (
        <label style={{ display: "flex", gap: 3, alignItems: "center" }}>
          <input type="checkbox" checked={s.dmApproved} onChange={(e) => updateSpell(idx, { dmApproved: e.target.checked })} />
          DM
        </label>
      )}
      {c.spellcasting.castingType === "spontaneous" && !s.composition && !s.focus && s.rank > 0 && (
        <button
          className="small"
          style={{ background: s.signature ? "#4b2882" : undefined }}
          title="Marcar como signature spell"
          onClick={() => updateSpell(idx, { signature: !s.signature })}
        >
          {s.signature ? "★ Signature" : "☆"}
        </button>
      )}
      {c.spellcasting.castingType === "prepared" && !s.composition && !s.focus && (
        <span className="row" style={{ gap: 3 }}>
          <span className="muted">prep.</span>
          <input type="number" style={{ width: 44 }} min={0} value={s.prepared}
            onChange={(e) => updateSpell(idx, { prepared: +e.target.value })} />
        </span>
      )}
      <span style={{ marginLeft: "auto" }}>
        <button className="small ghost"
          onClick={() => update((o) => ({
            ...o,
            spellcasting: { ...o.spellcasting, known: o.spellcasting.known.filter((_, j) => j !== idx) },
          }))}>✕</button>
      </span>
    </div>
  );
}
