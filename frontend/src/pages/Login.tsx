import { FormEvent, useState } from "react";
import { api, ApiError } from "../api";
import { setAuth, setBearer } from "../auth";

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      try {
        const r = await api.loginAccount({ username: user.trim(), password });
        setBearer(r.token);
      } catch (err) {
        if (!(err instanceof ApiError) || (err.status !== 401 && err.status !== 404)) {
          throw err;
        }
        setAuth(user.trim(), password);
        await api.characters();
      }
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError("Demasiados intentos. Esperá un minuto y probá de nuevo.");
      } else if (err instanceof ApiError && (err.status === 401 || err.status === 400)) {
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
          <p className="muted">Hoja de personaje Elhoss Eastern Lands. Las cuentas las crea un administrador.</p>
          <form onSubmit={submitLogin} style={{ display: "grid", gap: 12 }}>
            <label>
              Usuario
              <input autoComplete="username" value={user} onChange={(e) => setUser(e.target.value)} style={{ width: "100%", marginTop: 4 }} />
            </label>
            <label>
              Contraseña
              <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%", marginTop: 4 }} />
            </label>
            {error ? <p style={{ color: "var(--bad)", margin: 0 }}>{error}</p> : null}
            <button type="submit" disabled={busy || !user.trim() || !password}>{busy ? "Entrando…" : "Entrar"}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
