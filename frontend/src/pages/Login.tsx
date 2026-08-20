import { FormEvent, useState } from "react";
import { api, ApiError } from "../api";
import { setAuth } from "../auth";

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [user, setUser] = useState("elhoss");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    setAuth(user.trim(), password);
    try {
      await api.characters();
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Usuario o contraseña incorrectos.");
      } else {
        setError("No se pudo entrar. Probá de nuevo.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page" style={{ maxWidth: 420, margin: "40px auto" }}>
      <div className="section">
        <div className="section-head">Acceso</div>
        <div className="section-body">
          <p className="muted">Hoja de personaje Elhoss Eastern Lands.</p>
          <form onSubmit={submit} style={{ display: "grid", gap: 12, marginTop: 12 }}>
            <label>
              Usuario
              <input
                autoComplete="username"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                style={{ width: "100%", marginTop: 4 }}
              />
            </label>
            <label>
              Contraseña
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: "100%", marginTop: 4 }}
              />
            </label>
            {error ? <p style={{ color: "var(--bad)", margin: 0 }}>{error}</p> : null}
            <button type="submit" disabled={busy || !password}>
              {busy ? "Entrando…" : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
