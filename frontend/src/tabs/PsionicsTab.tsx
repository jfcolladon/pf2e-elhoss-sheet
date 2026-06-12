import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { UpdateFn } from "../pages/Sheet";
import { Section, Modal, Counter } from "../components/common";
import {
  disciplineWarning, fmt, maxPfp, maxPowerRank, psionicAttack, psionicDc, psionicProfRank,
} from "../lib/calc";
import { AbilityKey, Character, PsionicPower, RANK_LABELS } from "../types";

export default function PsionicsTab({ c, update }: { c: Character; update: UpdateFn }) {
  const [browser, setBrowser] = useState(false);
  const ps = c.psionics;

  if (!ps.enabled) {
    return (
      <Section title="Psiónica (house rules Elhoss)">
        <p>
          Este personaje no tiene habilidades psiónicas. Puedes habilitarlas como <b>clase Psiónico</b> (disciplinas,
          progresión completa) o como <b>Wild Talent</b> (psiónica salvaje innata, estilo Dark Sun: cualquier clase
          puede tenerla).
        </p>
        <div className="row">
          <button onClick={() => update((o) => ({
            ...o, psionics: { ...o.psionics, enabled: true, mode: "class" },
            clazz: { ...o.clazz, isPsionic: true, name: o.clazz.name || "Psiónico" },
          }))}>
            Habilitar como clase Psiónico
          </button>
          <button className="ghost" onClick={() => update((o) => ({ ...o, psionics: { ...o.psionics, enabled: true, mode: "wild" } }))}>
            Habilitar como Wild Talent
          </button>
        </div>
      </Section>
    );
  }

  const pfpMax = maxPfp(c);
  const warning = disciplineWarning(c);
  const maxRank = ps.mode === "class" ? maxPowerRank(c.level) : 2;

  return (
    <div className="grid cols-2">
      <div>
        <Section title="Configuración psiónica">
          <div className="row">
            <div className="field">
              <label>Modo</label>
              <select value={ps.mode} onChange={(e) => update((o) => ({ ...o, psionics: { ...o.psionics, mode: e.target.value as "class" | "wild" } }))}>
                <option value="class">Clase Psiónico</option>
                <option value="wild">Wild Talent (salvaje)</option>
              </select>
            </div>
            {ps.mode === "class" && (
              <div className="field">
                <label>Disciplina primaria</label>
                <DisciplinePicker c={c} update={update} />
              </div>
            )}
            <div className="field">
              <label>Key Ability</label>
              <select value={ps.keyAbility}
                onChange={(e) => update((o) => ({ ...o, psionics: { ...o.psionics, keyAbility: e.target.value as AbilityKey } }))}>
                {["str", "dex", "con", "int", "wis", "cha"].map((a) => <option key={a} value={a}>{a.toUpperCase()}</option>)}
              </select>
            </div>
          </div>
          {ps.mode === "class" && (
            <div className="row" style={{ marginTop: 8 }}>
              <div className="stat-big"><div className="v">{fmt(psionicAttack(c))}</div><div className="l">Psionic Attack</div></div>
              <div className="stat-big"><div className="v">{psionicDc(c)}</div><div className="l">Psionic DC</div></div>
              <span className="muted">
                Proficiency: {RANK_LABELS[psionicProfRank(c.level)]} (Trained 1, Expert 7, Master 15, Legendary 19)
              </span>
            </div>
          )}
          {ps.wildRoll && (
            <p className="muted">Tirada de Wild Talent: 3d100 = {ps.wildRoll.dice.join(" + ")} = {ps.wildRoll.total}</p>
          )}
        </Section>

        <Section title="Psionic Focus Points (PFP)">
          <Counter
            value={ps.pfp.current}
            max={pfpMax}
            onChange={(v) => update((o) => ({ ...o, psionics: { ...o.psionics, pfp: { ...o.psionics.pfp, current: v } } }))}
          />
          <div className="row" style={{ marginTop: 8 }}>
            <button
              className="small"
              title="Meditación activa: 2 PFP por 10 minutos (requiere disciplina)"
              disabled={ps.mode === "wild"}
              onClick={() => update((o) => ({
                ...o,
                psionics: { ...o.psionics, pfp: { ...o.psionics.pfp, current: Math.min(pfpMax, o.psionics.pfp.current + 2) } },
              }))}
            >
              🧘 Meditar 10 min (+2)
            </button>
            <button
              className="small"
              onClick={() => update((o) => ({ ...o, psionics: { ...o.psionics, pfp: { ...o.psionics.pfp, current: pfpMax } } }))}
            >
              🌙 Descanso 8 h (todo)
            </button>
            <span className="row" style={{ gap: 4 }}>
              <label>Máx. manual:</label>
              <input
                type="number"
                style={{ width: 64 }}
                value={ps.pfp.maxOverride ?? ""}
                placeholder={String(pfpMax)}
                onChange={(e) => update((o) => ({
                  ...o,
                  psionics: { ...o.psionics, pfp: { ...o.psionics.pfp, maxOverride: e.target.value === "" ? null : +e.target.value } },
                }))}
              />
            </span>
          </div>
          <p className="muted">
            {ps.mode === "class"
              ? `Pool clase Psiónico: 2 + mod (nivel 1) + mod por nivel. Recuperación: meditación 2 PFP/10 min o descanso 8 h.`
              : `Wild Talent: pool inicial = costo del poder más caro; +2 + ⌈mod/2⌉ por nivel. Sin disciplina: solo recupera con descanso de 8 h.`}
          </p>
          {warning && <div className="warn-box" style={{ marginTop: 6 }}>⚠ {warning}</div>}
        </Section>
      </div>

      <div>
        <Section
          title={`Poderes conocidos (rank máx. ${maxRank})`}
          extra={<button className="small" onClick={() => setBrowser(true)}>+ Aprender poder</button>}
        >
          {ps.powers.length === 0 && <p className="muted">Sin poderes psiónicos.</p>}
          {ps.powers.map((p, i) => (
            <KnownPowerCard key={i} powerId={p.powerId} name={p.name} rank={p.rank} discipline={p.discipline}
              cost={p.cost} wild={p.wild}
              onUse={(cost) => update((o) => ({
                ...o,
                psionics: { ...o.psionics, pfp: { ...o.psionics.pfp, current: Math.max(0, o.psionics.pfp.current - cost) } },
              }))}
              onDelete={() => update((o) => ({ ...o, psionics: { ...o.psionics, powers: o.psionics.powers.filter((_, j) => j !== i) } }))}
            />
          ))}
        </Section>
      </div>

      {browser && (
        <PowerBrowser
          c={c}
          maxRank={maxRank}
          onClose={() => setBrowser(false)}
          onPick={(p, wild) => update((o) => ({
            ...o,
            psionics: {
              ...o.psionics,
              powers: [...o.psionics.powers, {
                powerId: p.id, name: p.name, discipline: p.discipline, rank: p.rank, cost: p.cost, wild,
              }],
            },
          }))}
        />
      )}
    </div>
  );
}

function DisciplinePicker({ c, update }: { c: Character; update: UpdateFn }) {
  const [disciplines, setDisciplines] = useState<Awaited<ReturnType<typeof api.disciplines>>>([]);
  useEffect(() => { api.disciplines().then(setDisciplines); }, []);
  return (
    <select
      value={c.psionics.discipline}
      onChange={(e) => {
        const d = disciplines.find((x) => x.name === e.target.value);
        update((o) => ({
          ...o,
          psionics: { ...o.psionics, discipline: e.target.value, keyAbility: (d?.key_ability as AbilityKey) ?? o.psionics.keyAbility },
        }));
      }}
    >
      <option value="">—</option>
      {disciplines.map((d) => <option key={d.name} value={d.name}>{d.name} ({d.key_ability.toUpperCase()})</option>)}
    </select>
  );
}

function KnownPowerCard({ powerId, name, rank, discipline, cost, wild, onUse, onDelete }: {
  powerId: number; name: string; rank: number; discipline: string; cost: number | null; wild: boolean;
  onUse: (cost: number) => void; onDelete: () => void;
}) {
  const [full, setFull] = useState<PsionicPower | null>(null);
  return (
    <details className="power-card" onToggle={(e) => {
      if ((e.target as HTMLDetailsElement).open && !full && powerId > 0) {
        api.powers().then((all) => setFull(all.find((x) => x.id === powerId) ?? null));
      }
    }}>
      <summary>
        <b>{name}</b>
        <span className="muted">{discipline} · Rank {rank}</span>
        {cost !== null && <span className="badge dm">{cost} PFP</span>}
        {wild && <span className="badge sig">Wild Talent</span>}
        {cost !== null && (
          <button className="small" onClick={(e) => { e.preventDefault(); onUse(cost); }}>
            Manifestar (−{cost})
          </button>
        )}
        <button className="small ghost" style={{ marginLeft: "auto" }} onClick={(e) => { e.preventDefault(); onDelete(); }}>✕</button>
      </summary>
      <div className="pc-body">
        {full ? <PowerDetail p={full} /> : powerId > 0 ? "Cargando…" : "Poder manual (sin detalle)."}
      </div>
    </details>
  );
}

export function PowerDetail({ p }: { p: PsionicPower }) {
  return (
    <div>
      <div className="row" style={{ marginBottom: 4 }}>
        {p.traits.split(",").map((t) => t.trim()).filter(Boolean).map((t) => <span key={t} className="trait-chip">{t}</span>)}
        {p.tier && <span className={`badge tier-${p.tier}`}>{p.tier}</span>}
      </div>
      <p className="muted">
        <b>Costo:</b> {p.cost_raw || "—"} · <b>Acciones:</b> {p.actions || "—"} · <b>Alcance:</b> {p.range || "—"}
        {p.area && <> · <b>Área/objetivos:</b> {p.area}</>}
        {p.duration && <> · <b>Duración:</b> {p.duration}</>}
        {p.save && <> · <b>Salvación:</b> {p.save}</>}
        {p.trigger && <> · <b>Trigger:</b> {p.trigger}</>}
      </p>
      <div style={{ whiteSpace: "pre-wrap" }}>{p.description}</div>
      {p.heightened && <p style={{ whiteSpace: "pre-wrap" }}><b>{p.heightened}</b></p>}
    </div>
  );
}

function PowerBrowser({ c, maxRank, onClose, onPick }: {
  c: Character; maxRank: number; onClose: () => void;
  onPick: (p: PsionicPower, wild: boolean) => void;
}) {
  const [powers, setPowers] = useState<PsionicPower[]>([]);
  const [disc, setDisc] = useState(c.psionics.discipline || "");
  const [rank, setRank] = useState<number | "">("");
  const [q, setQ] = useState("");
  const [asWild, setAsWild] = useState(c.psionics.mode === "wild");

  useEffect(() => { api.powers().then(setPowers); }, []);

  const filtered = useMemo(
    () => powers.filter((p) =>
      (!disc || p.discipline === disc) &&
      (rank === "" || p.rank === rank) &&
      p.rank <= maxRank &&
      (!q || p.name.toLowerCase().includes(q.toLowerCase()))
    ),
    [powers, disc, rank, q, maxRank]
  );

  return (
    <Modal title="Aprender poder psiónico (house rules Elhoss)" onClose={onClose}>
      <div className="row" style={{ marginBottom: 8 }}>
        <input placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
        <select value={disc} onChange={(e) => setDisc(e.target.value)}>
          <option value="">Todas las disciplinas</option>
          {["Egoism", "Force", "Mind", "Move", "Seer", "Soul"].map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={rank} onChange={(e) => setRank(e.target.value === "" ? "" : +e.target.value)}>
          <option value="">Todos los ranks</option>
          {Array.from({ length: maxRank + 1 }, (_, r) => <option key={r} value={r}>Rank {r}</option>)}
        </select>
        <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input type="checkbox" checked={asWild} onChange={(e) => setAsWild(e.target.checked)} />
          Como Wild Talent
        </label>
      </div>
      <div style={{ maxHeight: "55vh", overflowY: "auto" }}>
        {filtered.map((p) => (
          <details className="power-card" key={p.id}>
            <summary>
              <b>{p.name}</b>
              <span className="muted">{p.discipline} · Rank {p.rank}</span>
              {p.tier && <span className={`badge tier-${p.tier}`}>{p.tier}</span>}
              {p.cost !== null && <span className="badge dm">{p.cost} PFP</span>}
              <button className="small" style={{ marginLeft: "auto" }}
                onClick={(e) => { e.preventDefault(); onPick(p, asWild); onClose(); }}>
                Aprender
              </button>
            </summary>
            <div className="pc-body"><PowerDetail p={p} /></div>
          </details>
        ))}
        {filtered.length === 0 && <p className="muted">Sin resultados.</p>}
      </div>
    </Modal>
  );
}
