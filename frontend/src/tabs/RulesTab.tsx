import { useEffect, useState } from "react";
import { api } from "../api";
import { Section } from "../components/common";
import { ALLOWED_SOURCE_LABELS, ALLOWED_SOURCES_DRIVE } from "../lib/sources";

export default function RulesTab() {
  const [sections, setSections] = useState<Awaited<ReturnType<typeof api.houserules>>>([]);
  const [open, setOpen] = useState<{ id: number; title: string; content: string } | null>(null);
  const [ancestries, setAncestries] = useState<Awaited<ReturnType<typeof api.houserules>>>([]);

  useEffect(() => {
    api.houserules("reference").then(setSections);
    api.houserules("ancestry").then(setAncestries);
  }, []);

  return (
    <div className="grid cols-2">
      <div>
        <Section title="Manuales autorizados (SRD)">
          <p className="muted">
            Todo contenido de estos manuales aparece como <b>Permitido</b> sin aprobación del DM.
            Lista alineada con la carpeta de rulebooks de la campaña.
          </p>
          <ul style={{ margin: "8px 0", paddingLeft: 20 }}>
            {ALLOWED_SOURCE_LABELS.map((l) => <li key={l}>{l}</li>)}
          </ul>
          <p className="muted">
            <a href={ALLOWED_SOURCES_DRIVE} target="_blank" rel="noreferrer">Carpeta de rulebooks (Google Drive)</a>
          </p>
        </Section>
        <Section title="House Rules — Elhoss Eastern Lands">
          <p className="muted">
            Fuente única de house rules: el documento de campaña del DM. Lo que no esté aquí ni en
            los manuales autorizados arriba requiere aprobación del DM.
          </p>
          {sections.map((s) => (
            <div key={s.id} className="search-row" onClick={async () => {
              const full = await api.houserule(s.id);
              setOpen({ id: s.id, title: full.title, content: full.content });
            }}>
              <span className="nm">{s.title}</span>
              <span className="src">ver →</span>
            </div>
          ))}
        </Section>
        <Section title="Ancestrías custom de Elhoss">
          {ancestries.map((a) => (
            <div key={a.id} style={{ marginBottom: 6 }}>
              <b>{a.title}</b>
              <div className="muted">
                {a.data ? `HP ${a.data.hp} · ${a.data.size} · ${a.data.speed} ft · Boosts: ${(a.data.boosts as string[]).join(", ")}${a.data.flaw ? ` · Flaw: ${a.data.flaw}` : ""}` : ""}
              </div>
            </div>
          ))}
        </Section>
      </div>
      <div>
        {open ? (
          <Section title={open.title}>
            <button className="small ghost" onClick={() => setOpen(null)}>Cerrar</button>
            <div style={{ whiteSpace: "pre-wrap", maxHeight: "70vh", overflowY: "auto", marginTop: 8 }}>
              {open.content}
            </div>
          </Section>
        ) : (
          <Section title="Visor">
            <p className="muted">Selecciona una sección para leerla.</p>
          </Section>
        )}
      </div>
    </div>
  );
}
