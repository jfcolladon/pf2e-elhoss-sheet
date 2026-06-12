import { useState } from "react";
import { api } from "../api";
import { UpdateFn } from "../pages/Sheet";
import { Section, Modal, CatalogSearch } from "../components/common";
import { bulkLimit, bulkUsed } from "../lib/calc";
import { Character } from "../types";

export default function InventoryTab({ c, update }: { c: Character; update: UpdateFn }) {
  const [adding, setAdding] = useState(false);
  const used = bulkUsed(c);
  const limit = bulkLimit(c);

  return (
    <div className="grid cols-2">
      <Section
        title="Inventario"
        extra={
          <>
            <button className="small" onClick={() => setAdding(true)}>Buscar en SRD</button>
            <button className="small ghost" style={{ color: "#f3e6c8", borderColor: "#f3e6c8" }}
              onClick={() => update((o) => ({ ...o, inventory: [...o.inventory, { uid: null, name: "", qty: 1, bulk: "-", note: "" }] }))}>
              + Manual
            </button>
          </>
        }
      >
        <table className="sheet">
          <thead><tr><th>Objeto</th><th>Cant.</th><th>Bulk</th><th>Nota</th><th></th></tr></thead>
          <tbody>
            {c.inventory.map((it, i) => (
              <tr key={i}>
                <td><input style={{ width: "100%" }} value={it.name}
                  onChange={(e) => update((o) => {
                    const inv = [...o.inventory]; inv[i] = { ...it, name: e.target.value }; return { ...o, inventory: inv };
                  })} /></td>
                <td><input type="number" style={{ width: 52 }} value={it.qty}
                  onChange={(e) => update((o) => {
                    const inv = [...o.inventory]; inv[i] = { ...it, qty: +e.target.value }; return { ...o, inventory: inv };
                  })} /></td>
                <td><input style={{ width: 48 }} value={it.bulk}
                  onChange={(e) => update((o) => {
                    const inv = [...o.inventory]; inv[i] = { ...it, bulk: e.target.value }; return { ...o, inventory: inv };
                  })} /></td>
                <td><input style={{ width: "100%" }} value={it.note}
                  onChange={(e) => update((o) => {
                    const inv = [...o.inventory]; inv[i] = { ...it, note: e.target.value }; return { ...o, inventory: inv };
                  })} /></td>
                <td><button className="small ghost"
                  onClick={() => update((o) => ({ ...o, inventory: o.inventory.filter((_, j) => j !== i) }))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted" style={{ marginTop: 6 }}>
          Bulk: <b>{used}</b> / sobrecargado a {limit.encumbered}, máx. {limit.max}
          {used > limit.encumbered && <span className="badge blocked" style={{ marginLeft: 6 }}>Sobrecargado</span>}
        </p>
      </Section>

      <Section title="Dinero">
        <div className="row">
          {(["pp", "gp", "sp", "cp"] as const).map((m) => (
            <div className="field" key={m}>
              <label>{m.toUpperCase()}</label>
              <input type="number" value={c.money[m]}
                onChange={(e) => update((o) => ({ ...o, money: { ...o.money, [m]: +e.target.value } }))} />
            </div>
          ))}
        </div>
      </Section>

      {adding && (
        <Modal title="Buscar equipo (SRD legacy)" onClose={() => setAdding(false)}>
          <CatalogSearch
            type="item"
            dmMode={c.dmMode}
            pickLabel="Añadir"
            onPick={async (item) => {
              const full = await api.item(item.uid);
              update((o) => ({
                ...o,
                inventory: [...o.inventory, {
                  uid: item.uid, name: item.name, qty: 1,
                  bulk: String(full.bulk_raw ?? "-"),
                  note: String(full.price_raw ?? ""),
                }],
              }));
              setAdding(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
