import { useState } from "react";
import { CampaignNote, NoteCategory } from "../types";
import { UpdateFn } from "../pages/Sheet";
import { Character } from "../types";
import { Section } from "../components/common";

const CATEGORIES: { key: NoteCategory; label: string; icon: string; color: string }[] = [
  { key: "npc",      label: "Personajes",  icon: "👤", color: "#8b4a2b" },
  { key: "location", label: "Lugares",     icon: "🏛️", color: "#2b5a8b" },
  { key: "faction",  label: "Facciones",   icon: "⚔️", color: "#6b2b8b" },
  { key: "rumor",    label: "Rumores",     icon: "👂", color: "#8b7a2b" },
  { key: "note",     label: "Notas",       icon: "📜", color: "#2b8b5a" },
  { key: "other",    label: "Varios",      icon: "📌", color: "#555" },
];

function catMeta(key: NoteCategory) {
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[5];
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

interface Props {
  c: Character;
  update: UpdateFn;
}

interface NoteFormState {
  id: string | null;
  category: NoteCategory;
  title: string;
  content: string;
  tags: string;
  pinned: boolean;
}

const blank = (): NoteFormState => ({
  id: null,
  category: "note",
  title: "",
  content: "",
  tags: "",
  pinned: false,
});

export default function NotesTab({ c, update }: Props) {
  const notes: CampaignNote[] = c.campaignNotes ?? [];

  const [filter, setFilter] = useState<NoteCategory | "all" | "pinned">("all");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<NoteFormState | null>(null);

  function save() {
    if (!form) return;
    const now = new Date().toISOString();
    const tagArr = form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    if (form.id) {
      update((old) => ({
        ...old,
        campaignNotes: old.campaignNotes.map((n) =>
          n.id === form.id
            ? { ...n, category: form.category, title: form.title, content: form.content, tags: tagArr, pinned: form.pinned }
            : n
        ),
      }));
    } else {
      const newNote: CampaignNote = {
        id: uid(),
        category: form.category,
        title: form.title || "Sin título",
        content: form.content,
        tags: tagArr,
        pinned: form.pinned,
        createdAt: now,
      };
      update((old) => ({ ...old, campaignNotes: [newNote, ...old.campaignNotes] }));
    }
    setForm(null);
  }

  function remove(id: string) {
    if (!confirm("¿Eliminar esta nota?")) return;
    update((old) => ({ ...old, campaignNotes: old.campaignNotes.filter((n) => n.id !== id) }));
  }

  function editNote(n: CampaignNote) {
    setForm({ id: n.id, category: n.category, title: n.title, content: n.content, tags: n.tags.join(", "), pinned: n.pinned });
  }

  function togglePin(id: string) {
    update((old) => ({
      ...old,
      campaignNotes: old.campaignNotes.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)),
    }));
  }

  const q = search.toLowerCase();
  const visible = notes
    .filter((n) => {
      if (filter === "pinned") return n.pinned;
      if (filter !== "all" && n.category !== filter) return false;
      return true;
    })
    .filter((n) => {
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.createdAt.localeCompare(a.createdAt);
    });

  const counts = Object.fromEntries(
    CATEGORIES.map((cat) => [cat.key, notes.filter((n) => n.category === cat.key).length])
  );
  const pinnedCount = notes.filter((n) => n.pinned).length;

  return (
    <div>
      {/* Barra superior */}
      <div className="row" style={{ marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <button className="btn-primary" onClick={() => setForm(blank())}>+ Nueva nota</button>
        <input
          type="text"
          placeholder="Buscar…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 160 }}
        />
      </div>

      {/* Filtro por categoría */}
      <div className="tabs" style={{ marginBottom: 14 }}>
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
          Todas ({notes.length})
        </button>
        <button className={filter === "pinned" ? "active" : ""} onClick={() => setFilter("pinned")}>
          📌 Fijadas ({pinnedCount})
        </button>
        {CATEGORIES.map((cat) => (
          <button key={cat.key} className={filter === cat.key ? "active" : ""} onClick={() => setFilter(cat.key)}>
            {cat.icon} {cat.label} ({counts[cat.key] ?? 0})
          </button>
        ))}
      </div>

      {/* Grid de tarjetas */}
      {visible.length === 0 ? (
        <p className="muted" style={{ textAlign: "center", padding: "2rem 0" }}>
          {search ? "No hay notas que coincidan con la búsqueda." : "No hay notas todavía. Crea una con el botón de arriba."}
        </p>
      ) : (
        <div className="notes-grid">
          {visible.map((n) => {
            const meta = catMeta(n.category);
            return (
              <div key={n.id} className="note-card" style={{ borderTopColor: meta.color }}>
                <div className="note-card-header">
                  <span className="note-cat-badge" style={{ background: meta.color }}>
                    {meta.icon} {meta.label}
                  </span>
                  {n.pinned && <span title="Fijada">📌</span>}
                  <div style={{ flex: 1 }} />
                  <button className="icon-btn" title="Fijar / desfijar" onClick={() => togglePin(n.id)}>
                    {n.pinned ? "📌" : "📍"}
                  </button>
                  <button className="icon-btn" title="Editar" onClick={() => editNote(n)}>✏️</button>
                  <button className="icon-btn danger" title="Eliminar" onClick={() => remove(n.id)}>🗑️</button>
                </div>
                <h3 className="note-title">{n.title}</h3>
                {n.content && (
                  <p className="note-content">{n.content}</p>
                )}
                {n.tags.length > 0 && (
                  <div className="note-tags">
                    {n.tags.map((t) => (
                      <span key={t} className="chip">{t}</span>
                    ))}
                  </div>
                )}
                <div className="note-date muted">{n.createdAt.slice(0, 10)}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de edición / creación */}
      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{form.id ? "Editar nota" : "Nueva nota"}</h3>

            <div className="row" style={{ gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setForm({ ...form, category: cat.key })}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 12,
                    border: `2px solid ${cat.color}`,
                    background: form.category === cat.key ? cat.color : "transparent",
                    color: form.category === cat.key ? "#fff" : cat.color,
                    cursor: "pointer",
                    fontWeight: form.category === cat.key ? 700 : 400,
                    fontSize: "0.82rem",
                  }}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>

            <label>Título
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Nombre del PNJ, lugar, facción…"
                autoFocus
              />
            </label>

            <label style={{ marginTop: 8, display: "block" }}>Contenido
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={7}
                placeholder="Descripción, notas, datos de color…"
                style={{ width: "100%", resize: "vertical", fontFamily: "inherit", fontSize: "0.92rem" }}
              />
            </label>

            <label style={{ marginTop: 8, display: "block" }}>Etiquetas (separadas por coma)
              <input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="aliado, peligroso, ciudad capital…"
              />
            </label>

            <label style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
              />
              Fijar esta nota (aparece primero)
            </label>

            <div className="row" style={{ marginTop: 16, gap: 8 }}>
              <button className="btn-primary" onClick={save}>
                {form.id ? "Guardar cambios" : "Crear nota"}
              </button>
              <button onClick={() => setForm(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
