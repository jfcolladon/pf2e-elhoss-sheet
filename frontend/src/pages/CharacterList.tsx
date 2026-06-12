import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";

export default function CharacterList() {
  const [chars, setChars] = useState<Awaited<ReturnType<typeof api.characters>>>([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  const load = () => api.characters().then((c) => { setChars(c); setLoading(false); });
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="row" style={{ marginBottom: 16 }}>
        <h2>Personajes</h2>
        <div style={{ flex: 1 }} />
        <button onClick={() => nav("/new")}>+ Crear personaje</button>
      </div>
      {loading && <p>Cargando…</p>}
      {!loading && chars.length === 0 && (
        <p>No hay personajes todavía. Crea el primero con el asistente (incluye las house rules de Elhoss: tiradas 4d6 y wild talents).</p>
      )}
      <div className="grid cols-3">
        {chars.map((c) => (
          <div className="char-card" key={c.id}>
            <h3>{c.name || "Sin nombre"}</h3>
            <div>{c.ancestry} {c.className} — nivel {c.level}</div>
            <div className="muted">Actualizado: {c.updated_at}</div>
            <div className="row">
              <Link to={`/c/${c.id}`}><button>Abrir hoja</button></Link>
              <button
                className="ghost"
                onClick={async () => {
                  if (confirm(`¿Eliminar a ${c.name}?`)) { await api.deleteCharacter(c.id); load(); }
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
