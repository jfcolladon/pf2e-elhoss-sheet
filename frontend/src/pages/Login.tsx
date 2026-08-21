import { FormEvent, useState } from "react";
import { api, ApiError } from "../api";
import { setAuth, setBearer } from "../auth";

type Mode = "login" | "register" | "otp";

export default function Login({ onSuccess, allowRegister }: { onSuccess: () => void; allowRegister?: boolean }) {
  const [mode, setMode] = useState<Mode>("login");
  const [user, setUser] = useState("elhoss");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (allowRegister && user.includes("@")) {
        const r = await api.loginAccount({ username: user.trim(), password });
        setBearer(r.token);
      } else {
        setAuth(user.trim(), password);
        try {
          await api.characters();
        } catch (err) {
          if (allowRegister && err instanceof ApiError && err.status === 401) {
            const r = await api.loginAccount({ username: user.trim(), password });
            setBearer(r.token);
          } else {
            throw err;
          }
        }
      }
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 400)) {
        setError("Usuario o contraseña incorrectos.");
      } else {
        setError("No se pudo entrar. Probá de nuevo.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitRegister(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      await api.register({ email: email.trim(), username: user.trim(), password });
      setInfo("Te enviamos un código al correo.");
      setMode("otp");
    } catch (err) {
      setError(err instanceof ApiError ? err.message.replace(/^\d+\s+/, "") : "No se pudo registrar.");
    } finally {
      setBusy(false);
    }
  }

  async function submitOtp(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const r = await api.verifyOtp({ email: email.trim(), code: code.trim() });
      setBearer(r.token);
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message.replace(/^\d+\s+/, "") : "Código inválido.");
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
          {allowRegister && (
            <div className="row" style={{ gap: 8, margin: "8px 0 12px" }}>
              <button type="button" className={mode === "login" ? "" : "ghost"} onClick={() => setMode("login")}>Entrar</button>
              <button type="button" className={mode === "register" || mode === "otp" ? "" : "ghost"} onClick={() => setMode("register")}>Crear cuenta</button>
            </div>
          )}

          {mode === "login" && (
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
              <button type="submit" disabled={busy || !password}>{busy ? "Entrando…" : "Entrar"}</button>
            </form>
          )}

          {mode === "register" && (
            <form onSubmit={submitRegister} style={{ display: "grid", gap: 12 }}>
              <label>
                Usuario
                <input value={user === "elhoss" ? "" : user} onChange={(e) => setUser(e.target.value)} style={{ width: "100%", marginTop: 4 }} required />
              </label>
              <label>
                Email
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%", marginTop: 4 }} required />
              </label>
              <label>
                Contraseña
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%", marginTop: 4 }} required minLength={8} />
              </label>
              {error ? <p style={{ color: "var(--bad)", margin: 0 }}>{error}</p> : null}
              <button type="submit" disabled={busy}> {busy ? "Enviando…" : "Crear cuenta"}</button>
            </form>
          )}

          {mode === "otp" && (
            <form onSubmit={submitOtp} style={{ display: "grid", gap: 12 }}>
              <p className="muted">{info || "Revisá tu correo e ingresá el código."}</p>
              <label>
                Código
                <input value={code} onChange={(e) => setCode(e.target.value)} style={{ width: "100%", marginTop: 4 }} required />
              </label>
              {error ? <p style={{ color: "var(--bad)", margin: 0 }}>{error}</p> : null}
              <button type="submit" disabled={busy || code.length < 4}>{busy ? "Validando…" : "Validar"}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
