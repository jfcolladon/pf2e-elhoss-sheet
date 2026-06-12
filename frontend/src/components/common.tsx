import { ReactNode, useEffect, useState } from "react";
import { api } from "../api";
import { AonMarkdown } from "../lib/markdown";
import { CatalogBrief, ProfRank, RANK_LABELS } from "../types";

export function Section({ title, extra, children }: { title: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <div className="section">
      <div className="section-head">
        {title}
        <div style={{ flex: 1 }} />
        {extra}
      </div>
      <div className="section-body">{children}</div>
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          {title}
          <div className="spacer" />
          <button className="small" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/** Selector de proficiency U/T/E/M/L estilo hoja oficial. */
export function Teml({ value, onChange }: { value: ProfRank; onChange: (r: ProfRank) => void }) {
  return (
    <span className="teml">
      {RANK_LABELS.slice(1).map((l, i) => {
        const r = (i + 1) as ProfRank;
        return (
          <button
            key={l}
            className={value >= r ? "on" : ""}
            title={["Trained", "Expert", "Master", "Legendary"][i]}
            onClick={() => onChange(value === r ? ((r - 1) as ProfRank) : r)}
          >
            {l}
          </button>
        );
      })}
    </span>
  );
}

export function TraitChips({ traits }: { traits: string[] }) {
  return (
    <>
      {traits.map((t) => (
        <span key={t} className="trait-chip">{t}</span>
      ))}
    </>
  );
}

export function AllowedBadge({ allowed, dmApproved }: { allowed: boolean; dmApproved?: boolean }) {
  if (allowed) return <span className="badge ok">Permitido</span>;
  if (dmApproved) return <span className="badge dm">Aprobado por DM</span>;
  return <span className="badge blocked">No permitido</span>;
}

/** Buscador del catálogo SRD con detalle expandible. */
export function CatalogSearch({
  type,
  trait,
  tradition,
  category,
  excludeNames,
  maxLevel,
  onPick,
  pickLabel = "Añadir",
  dmMode = false,
}: {
  type: string;
  trait?: string;
  tradition?: string;
  category?: string;
  excludeNames?: string[];
  maxLevel?: number;
  onPick: (item: CatalogBrief, dmApproved: boolean) => void;
  pickLabel?: string;
  dmMode?: boolean;
}) {
  const [q, setQ] = useState("");
  const [onlyAllowed, setOnlyAllowed] = useState(true);
  const [results, setResults] = useState<CatalogBrief[]>([]);
  const [detail, setDetail] = useState<{ uid: string; md: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    const t = setTimeout(() => {
      api
        .catalog(type, {
          q,
          trait,
          tradition,
          category,
          level_max: maxLevel,
          allowed_only: onlyAllowed,
          limit: 100,
        })
        .then((r) => { if (live) { setResults(r); setLoading(false); } })
        .catch(() => live && setLoading(false));
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [q, type, trait, tradition, category, maxLevel, onlyAllowed]);

  const excluded = new Set((excludeNames ?? []).map((n) => n.toLowerCase()));
  const visible = results.filter((r) => !excluded.has(r.name.toLowerCase()));

  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <input
          style={{ flex: 1, minWidth: 180 }}
          placeholder={`Buscar ${type}...`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input type="checkbox" checked={onlyAllowed} onChange={(e) => setOnlyAllowed(e.target.checked)} />
          Solo permitido (CRB/APG)
        </label>
      </div>
      <div className="search-results">
        {loading && <div style={{ padding: 10 }}>Buscando…</div>}
        {!loading && visible.length === 0 && <div style={{ padding: 10 }}>Sin resultados.</div>}
        {visible.map((r) => (
          <div key={r.uid}>
            <div className="search-row" onClick={async () => {
              if (detail?.uid === r.uid) { setDetail(null); return; }
              const it = await api.item(r.uid);
              setDetail({ uid: r.uid, md: String(it.markdown ?? it.summary ?? "") });
            }}>
              <span className="nm">{r.name}</span>
              {r.level !== null && <span className="muted">niv. {r.level}</span>}
              <AllowedBadge allowed={r.allowed} />
              <span className="src">{r.source}</span>
              <button
                className="small"
                disabled={!r.allowed && !dmMode}
                title={!r.allowed && !dmMode ? "Requiere aprobación del DM (activa Modo DM)" : ""}
                onClick={(e) => { e.stopPropagation(); onPick(r, !r.allowed); }}
              >
                {!r.allowed ? `${pickLabel} (DM)` : pickLabel}
              </button>
            </div>
            {detail?.uid === r.uid && (
              <div style={{ padding: "6px 14px", background: "#fffdf6", borderBottom: "1px solid var(--line)" }}>
                <TraitChips traits={r.traits} />
                <AonMarkdown md={detail.md} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Lista de entradas de house rules (heritages, ancestry feats) con detalle expandible. */
export function HouseRulePicker({
  kind,
  ancestry,
  onPick,
  pickLabel = "Elegir",
}: {
  kind: string;
  ancestry?: string;
  onPick: (entry: { id: number; title: string; content: string; data: Record<string, unknown> | null }) => void;
  pickLabel?: string;
}) {
  const [items, setItems] = useState<Awaited<ReturnType<typeof api.houserules>>>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.houserules(kind, ancestry).then((r) => { setItems(r); setLoading(false); });
  }, [kind, ancestry]);

  if (loading) return <div style={{ padding: 8 }}>Cargando…</div>;
  if (items.length === 0)
    return <p className="muted" style={{ padding: 8 }}>No hay opciones de house rules{ancestry ? ` para ${ancestry}` : ""}.</p>;

  return (
    <div className="search-results">
      {items.map((it) => (
        <div key={it.id}>
          <div className="search-row">
            <span className="nm" style={{ cursor: "pointer" }} onClick={() => setOpen(open === it.id ? null : it.id)}>
              {it.title}
            </span>
            {it.data?.level ? <span className="muted">niv. {String(it.data.level)}</span> : null}
            <span className="badge ok">House Rule</span>
            <button className="small" style={{ marginLeft: "auto" }} onClick={() => onPick(it)}>{pickLabel}</button>
          </div>
          {open === it.id && (
            <div style={{ padding: "6px 14px", background: "#fffdf6", borderBottom: "1px solid var(--line)", whiteSpace: "pre-wrap" }}>
              {it.content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Tracker de puntos con pips clicables (foco, héroe...). */
export function PipTracker({ current, max, onChange }: { current: number; max: number; onChange: (v: number) => void }) {
  return (
    <span className="tracker">
      <span className="pips">
        {Array.from({ length: Math.max(max, 0) }).map((_, i) => (
          <button
            key={i}
            className={`pip ${i < current ? "full" : ""}`}
            onClick={() => onChange(i < current ? i : i + 1)}
            title={`${i + 1}/${max}`}
          />
        ))}
      </span>
      <b>{current}/{max}</b>
    </span>
  );
}

/** Contador numérico con botones +/- para pools grandes (PFP, HP). */
export function Counter({ value, max, onChange, step = 1 }: { value: number; max?: number; onChange: (v: number) => void; step?: number }) {
  return (
    <span className="tracker">
      <button className="small ghost" onClick={() => onChange(Math.max(0, value - step))}>−{step > 1 ? step : ""}</button>
      <b style={{ fontSize: 18, minWidth: 64, textAlign: "center" }}>
        {value}{max !== undefined ? ` / ${max}` : ""}
      </b>
      <button className="small ghost" onClick={() => onChange(max !== undefined ? Math.min(max, value + step) : value + step)}>+{step > 1 ? step : ""}</button>
    </span>
  );
}
