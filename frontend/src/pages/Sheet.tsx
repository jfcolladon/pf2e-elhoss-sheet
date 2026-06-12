import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { Character, defaultCharacter } from "../types";
import MainTab from "../tabs/MainTab";
import SkillsTab from "../tabs/SkillsTab";
import FeatsTab from "../tabs/FeatsTab";
import SpellsTab from "../tabs/SpellsTab";
import PsionicsTab from "../tabs/PsionicsTab";
import InventoryTab from "../tabs/InventoryTab";
import RulesTab from "../tabs/RulesTab";

export type UpdateFn = (mutator: (c: Character) => Character) => void;

const TABS = ["Principal", "Skills", "Feats", "Conjuros", "Psiónica", "Inventario", "House Rules"];

export default function Sheet() {
  const { id } = useParams();
  const cid = Number(id);
  const [c, setC] = useState<Character | null>(null);
  const [tab, setTab] = useState(0);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty">("saved");
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    api.character(cid).then((data) => {
      // mezclar con defaults para personajes guardados con versiones anteriores del modelo
      const merged = { ...defaultCharacter(), ...data };
      merged.spellcasting = { ...defaultCharacter().spellcasting, ...data.spellcasting };
      merged.psionics = { ...defaultCharacter().psionics, ...data.psionics };
      merged.muses = data.muses ?? [];
      merged.extraCasters = data.extraCasters ?? [];
      // compat: si no hay atributo de conjuro guardado, hereda el de la clase
      if (!data.spellcasting?.ability) merged.spellcasting.ability = merged.clazz.keyAbility;
      if (!data.spellcasting?.tradition) merged.spellcasting.tradition = merged.clazz.tradition;
      if (!data.spellcasting?.castingType) merged.spellcasting.castingType = merged.clazz.castingType;
      setC(merged);
    });
  }, [cid]);

  const update: UpdateFn = useCallback((mutator) => {
    setC((old) => {
      if (!old) return old;
      const next = mutator(old);
      setSaveState("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        setSaveState("saving");
        await api.updateCharacter(cid, next);
        setSaveState("saved");
      }, 1200);
      return next;
    });
  }, [cid]);

  if (!c) return <p>Cargando personaje…</p>;

  return (
    <div>
      <div className="row" style={{ marginBottom: 10 }}>
        <h2>{c.name || "Sin nombre"}</h2>
        <span className="muted">
          {c.ancestry.name} {c.background.name} {c.clazz.name} — nivel {c.level}
        </span>
        <div style={{ flex: 1 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <input
            type="checkbox"
            checked={c.dmMode}
            onChange={(e) => update((old) => ({ ...old, dmMode: e.target.checked }))}
          />
          Modo DM
        </label>
        <span className="save-indicator">
          {saveState === "saved" ? "✔ Guardado" : saveState === "saving" ? "Guardando…" : "Cambios sin guardar"}
        </span>
      </div>

      <div className="tabs">
        {TABS.map((t, i) => (
          <button key={t} className={i === tab ? "active" : ""} onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>

      {tab === 0 && <MainTab c={c} update={update} />}
      {tab === 1 && <SkillsTab c={c} update={update} />}
      {tab === 2 && <FeatsTab c={c} update={update} />}
      {tab === 3 && <SpellsTab c={c} update={update} />}
      {tab === 4 && <PsionicsTab c={c} update={update} />}
      {tab === 5 && <InventoryTab c={c} update={update} />}
      {tab === 6 && <RulesTab />}
    </div>
  );
}
