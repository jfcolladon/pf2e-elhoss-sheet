import { FormEvent, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api, ApiError } from "../api";

export default function UsersAdmin() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [users, setUsers] = useState<{ username: string; role: string; created_at?: string }[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const me = await api.me();
      if (me.role !== "admin") {
        setAllowed(false);
        return;
      }
      setAllowed(true);
      setUsers(await api.adminUsers());
    } catch {
      setAllowed(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      const r = await api.createUser({ username: username.trim(), password, role });
      setInfo(`Creado ${r.username} (${r.role === "admin" ? "administrador" : "usuario"}).`);
      setUsername("");
      setPassword("");
      setRole("user");
      setUsers(await api.adminUsers());
    } catch (err) {
      setError(err instanceof ApiError ? err.message.replace(/^\d+\s+/, "") : "No se pudo crear.");
    } finally {
      setBusy(false);
    }
  }

  if (allowed === null) return <p className="muted">Cargando…</p>;
  if (!allowed) return <Navigate to="/" replace />;

  return (
    <div>
      <h2>Usuarios</h2>
      <p className="muted">Solo un administrador puede crear cuentas. Nadie ve hojas de otro jugador.</p>
      <form onSubmit={submit} className="section" style={{ marginBottom: 20 }}>
        <div className="section-head">Crear usuario</div>
        <div className="section-body" style={{ display: "grid", gap: 12, maxWidth: 420 }}>
          <label>
            Usuario
            <input value={username} onChange={(e) => setUsername(e.target.value)} style={{ width: "100%", marginTop: 4 }} required minLength={3} />
          </label>
          <label>
            Contraseña
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%", marginTop: 4 }} required minLength={8} />
          </label>
          <label>
            Rol
            <select value={role} onChange={(e) => setRole(e.target.value as "user" | "admin")} style={{ width: "100%", marginTop: 4 }}>
              <option value="user">Usuario (hoja propia)</option>
              <option value="admin">Administrador (crear usuarios)</option>
            </select>
          </label>
          {error ? <p style={{ color: "var(--bad)", margin: 0 }}>{error}</p> : null}
          {info ? <p style={{ color: "var(--ok, #2a6)", margin: 0 }}>{info}</p> : null}
          <button type="submit" disabled={busy}>{busy ? "Creando…" : "Crear"}</button>
        </div>
      </form>
      <h3>Cuentas</h3>
      <div className="grid cols-3">
        {users.map((u) => (
          <div className="char-card" key={u.username}>
            <h3>{u.username}</h3>
            <div>{u.role === "admin" ? "Administrador" : "Usuario"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
