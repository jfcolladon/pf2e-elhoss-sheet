import { useEffect, useState } from "react";
import { api } from "../api";
import { CatalogBrief } from "../types";
import { UpdateFn } from "../pages/Sheet";
import { Section, Modal, CatalogSearch, HouseRulePicker, AllowedBadge } from "../components/common";
import { AonMarkdown } from "../lib/markdown";
import { CASTER_DEDICATIONS, detectCaster, museGrant, detectSpellTier, syncFeatEffects, applyMuseSelection, isBard, isMultifariousMuseFeat, needsSecondMuse, maxMuses } from "../lib/rules";
import { Character, FeatEntry } from "../types";

const CATEGORIES = [
  { key: "ancestry", label: "Ancestry Feats", trait: "" },
  { key: "class", label: "Class Feats", trait: "" },
  { key: "feature", label: "Características de clase y Subclase (musa, bloodline...)", trait: "" },
  { key: "skill", label: "Skill Feats", trait: "Skill" },
  { key: "general", label: "General Feats", trait: "General" },
  { key: "bonus", label: "Bonus / Otros", trait: "" },
];

export default function FeatsTab({ c, update }: { c: Character; update: UpdateFn }) {
  const [adding, setAdding] = useState<string | null>(null);
  const [source, setSource] = useState<"srd" | "house">("srd");
  const [featureType, setFeatureType] = useState<"class-option" | "class-feature">("class-option");
  const [detail, setDetail] = useState<{ name: string; md: string } | null>(null);
  const [forceSecondMuse, setForceSecondMuse] = useState(false);

  const secondMuseRequired = needsSecondMuse(c);
  useEffect(() => {
    if (secondMuseRequired) setForceSecondMuse(true);
  }, [secondMuseRequired]);
  const museWarning =
    c.muses.length > maxMuses(c)
      ? `Tienes ${c.muses.length} musas pero el máximo es ${maxMuses(c)}.`
      : secondMuseRequired
      ? `Multifarious Muse requiere una segunda musa distinta de "${c.muses[0]}".`
      : c.muses.length > 1 && !c.feats.some((f) => /multifarious\s+muse/i.test(f.name))
      ? `Tienes ${c.muses.length} musas (${c.muses.join(", ")}) pero falta el feat "Multifarious Muse".`
      : "";

  const addFeat = (entry: Partial<FeatEntry>) =>
    update((o) => ({
      ...o,
      feats: [...o.feats, {
        uid: null, name: "", category: adding!, level: 1, allowed: true, dmApproved: false, note: "",
        ...entry,
      }],
    }));

  /** Aplica un feat/feature elegido del SRD. Tras añadirlo, re-deriva los efectos
   *  automáticos (dedicación caster, musas, slots de archetype) con syncFeatEffects. */
  const pickFromCatalog = (item: CatalogBrief, needsDm: boolean, category: string) => {
    const traits = item.traits.map((t) => t.toLowerCase());
    const isDedication = traits.includes("dedication") || /dedication/i.test(item.name);
    const dedCaster = isDedication ? detectCaster(item.name, CASTER_DEDICATIONS) : null;
    const muse = category === "feature" ? museGrant(item.name) : null;
    const spellTier = detectSpellTier(item.name);
    const multifarious = isMultifariousMuseFeat(item.name);

    update((o) => {
      const withFeat: Character = {
        ...o,
        feats: [...o.feats, {
          uid: item.uid, name: item.name, category, level: item.level ?? 1,
          allowed: item.allowed, dmApproved: needsDm,
          note: dedCaster
            ? `Dedication caster: fuente de conjuros ${dedCaster.tradition} (atributo ${dedCaster.key.toUpperCase()}), entrenado, 2 cantrips.`
            : spellTier
            ? `${item.name}: otorga slots de conjuro de archetype según tu nivel y sube la proficiencia.`
            : multifarious
            ? "Multifarious Muse: debes elegir una segunda musa distinta de la primera."
            : (muse?.note ?? ""),
        } as FeatEntry],
      };
      if (muse && category === "feature") return applyMuseSelection(withFeat, item.name, item.uid);
      return syncFeatEffects(withFeat);
    });

    if (multifarious) {
      setForceSecondMuse(true);
      setAdding(null);
    } else {
      setAdding(null);
    }
  };

  const showDetail = async (f: FeatEntry) => {
    if (!f.uid) {
      setDetail({ name: f.name, md: f.note || "(Sin descripción)" });
      return;
    }
    const it = await api.item(f.uid);
    setDetail({ name: f.name, md: String(it.markdown ?? "") });
  };

  return (
    <div>
      <Section title="Efectos automáticos">
        <p className="muted">
          Re-deriva musas (feat + conjuro), fuentes de conjuros por dedicación y slots de archetype a partir de tus feats actuales.
          Útil para personajes creados antes o tras subir de nivel. No reduce ni borra lo que edites a mano.
        </p>
        <button className="small" onClick={() => update((o) => syncFeatEffects(o))}>
          ⟳ Recalcular efectos automáticos
        </button>
      </Section>
      {(isBard(c.clazz.name) || c.muses.length > 0) && (
        <Section title="Musas del bardo" extra={
          isBard(c.clazz.name) && (
            <button className="small" onClick={() => { setAdding("feature"); setFeatureType("class-option"); }}>
              {c.muses.length === 0 ? "Elegir musa" : "+ Musa"}
            </button>
          )
        }>
          {secondMuseRequired && (
            <div className="warn-box" style={{ marginBottom: 8 }}>
              Multifarious Muse requiere una <b>segunda musa</b> distinta de {c.muses[0]}.
              <button className="small" style={{ marginLeft: 8 }}
                onClick={() => { setForceSecondMuse(true); setAdding("feature"); setFeatureType("class-option"); }}>
                Elegir segunda musa
              </button>
            </div>
          )}
          {c.muses.length === 0 && <p className="warn">⚠ El bardo debe elegir al menos una musa.</p>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {c.muses.map((m) => (
              <span key={m} className="chip">
                {m}
                <button className="small ghost" style={{ marginLeft: 4 }}
                  onClick={() => update((o) => ({ ...o, muses: o.muses.filter((x) => x !== m) }))}>✕</button>
              </span>
            ))}
          </div>
          {museWarning && <p className="warn">⚠ {museWarning}</p>}
        </Section>
      )}
      {CATEGORIES.map((cat) => {
        const feats = c.feats.filter((f) => f.category === cat.key);
        return (
          <Section
            key={cat.key}
            title={cat.label}
            extra={<button className="small" onClick={() => setAdding(cat.key)}>+ Añadir</button>}
          >
            {feats.length === 0 && <p className="muted">Ninguno.</p>}
            <table className="sheet">
              <tbody>
                {feats.map((f) => {
                  const idx = c.feats.indexOf(f);
                  return (
                    <tr key={idx}>
                      <td style={{ cursor: "pointer" }} onClick={() => showDetail(f)}><b>{f.name}</b></td>
                      <td>
                        nivel{" "}
                        <input type="number" style={{ width: 50 }} value={f.level}
                          onChange={(e) => update((o) => {
                            const feats2 = [...o.feats];
                            feats2[idx] = { ...f, level: +e.target.value };
                            return { ...o, feats: feats2 };
                          })} />
                      </td>
                      <td><AllowedBadge allowed={f.allowed} dmApproved={f.dmApproved} /></td>
                      <td>
                        {!f.allowed && (
                          <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            <input
                              type="checkbox"
                              checked={f.dmApproved}
                              disabled={!c.dmMode}
                              title={c.dmMode ? "" : "Activa Modo DM para aprobar"}
                              onChange={(e) => update((o) => {
                                const feats2 = [...o.feats];
                                feats2[idx] = { ...f, dmApproved: e.target.checked };
                                return { ...o, feats: feats2 };
                              })}
                            />
                            Aprobación DM
                          </label>
                        )}
                      </td>
                      <td>
                        <button className="small ghost"
                          onClick={() => update((o) => ({ ...o, feats: o.feats.filter((_, j) => j !== idx) }))}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Section>
        );
      })}

      {forceSecondMuse && (
        <Modal title="Segunda musa — obligatorio (Multifarious Muse)" onClose={() => {}}>
          <div className="warn-box" style={{ marginBottom: 10 }}>
            Debes elegir una <b>segunda musa</b> distinta de <b>{c.muses[0] ?? "la primera"}</b>.
            Se aplicarán automáticamente su feat, conjuro y bonos de skills.
          </div>
          <CatalogSearch
            type="class-option"
            category="bard muse"
            excludeNames={c.muses}
            dmMode={c.dmMode}
            pickLabel="Elegir segunda musa"
            onPick={(item) => {
              update((o) => applyMuseSelection(o, item.name, item.uid));
              setForceSecondMuse(false);
            }}
          />
        </Modal>
      )}

      {adding && !forceSecondMuse && (
        <Modal title={`Añadir (${CATEGORIES.find((x) => x.key === adding)?.label})`} onClose={() => setAdding(null)}>
          {adding === "feature" ? (
            <>
              <div className="tabs" style={{ marginBottom: 8 }}>
                <button className={featureType === "class-option" ? "active" : ""} onClick={() => setFeatureType("class-option")}>
                  Subclase / Musa
                </button>
                <button className={featureType === "class-feature" ? "active" : ""} onClick={() => setFeatureType("class-feature")}>
                  Característica de clase
                </button>
              </div>
              <CatalogSearch
                type={featureType}
                category={featureType === "class-option" && isBard(c.clazz.name) ? "bard muse" : undefined}
                excludeNames={featureType === "class-option" ? c.muses : undefined}
                dmMode={c.dmMode}
                maxLevel={featureType === "class-feature" ? c.level : undefined}
                pickLabel="Añadir"
                onPick={(item, needsDm) => {
                  if (featureType === "class-option" && museGrant(item.name)) {
                    update((o) => applyMuseSelection(o, item.name, item.uid));
                    setAdding(null);
                  } else {
                    pickFromCatalog(item, needsDm, "feature");
                  }
                }}
              />
              <p className="muted">
                Subclase incluye musa de bardo, bloodlines, instintos, órdenes, etc. (busca p. ej. "enigma", "maestro").
                Al elegir una musa se añaden su feat y conjuro otorgados.
              </p>
              {museWarning && <p className="warn">⚠ {museWarning}</p>}
            </>
          ) : (
            <>
              {adding === "ancestry" && (
                <div className="tabs" style={{ marginBottom: 8 }}>
                  <button className={source === "srd" ? "active" : ""} onClick={() => setSource("srd")}>SRD (CRB/APG)</button>
                  <button className={source === "house" ? "active" : ""} onClick={() => setSource("house")}>House Rules de Elhoss</button>
                </div>
              )}
              {adding === "ancestry" && source === "house" ? (
                <HouseRulePicker
                  kind="ancestry_feat"
                  ancestry={c.ancestry.custom ? c.ancestry.name : undefined}
                  pickLabel="Añadir"
                  onPick={(entry) => {
                    addFeat({ uid: null, name: entry.title, level: Number(entry.data?.level ?? 1), allowed: true, dmApproved: false, note: entry.content.slice(0, 400) });
                    setAdding(null);
                  }}
                />
              ) : (
                <CatalogSearch
                  type="feat"
                  dmMode={c.dmMode}
                  trait={CATEGORIES.find((x) => x.key === adding)?.trait || undefined}
                  maxLevel={c.level}
                  pickLabel="Añadir"
                  onPick={(item, needsDm) => {
                    pickFromCatalog(item, needsDm, adding!);
                  }}
                />
              )}
              <p className="muted">
                Los feats fuera de Core Rulebook / APG aparecen como "No permitido": solo se pueden añadir con Modo DM
                (quedan marcados como aprobados por el DM).
              </p>
            </>
          )}
        </Modal>
      )}

      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(null)}>
          <AonMarkdown md={detail.md} />
        </Modal>
      )}
    </div>
  );
}
