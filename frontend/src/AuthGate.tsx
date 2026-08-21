import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";
import { clearAuth, hasStoredAuth } from "./auth";
import Login from "./pages/Login";

export default function AuthGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [allowRegister, setAllowRegister] = useState(false);

  const probe = useCallback(async () => {
    try {
      const health = await api.health();
      setAllowRegister(!!health.auth_multi);
      if (!health.auth_required) {
        setNeedsLogin(false);
        setReady(true);
        return;
      }
      if (!hasStoredAuth()) {
        setNeedsLogin(true);
        setReady(true);
        return;
      }
      await api.characters();
      setNeedsLogin(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearAuth();
        setNeedsLogin(true);
      } else {
        setNeedsLogin(hasStoredAuth() === false);
      }
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void probe();
  }, [probe]);

  if (!ready) {
    return (
      <div className="page">
        <p className="muted">Cargando…</p>
      </div>
    );
  }
  if (needsLogin) {
    return <Login onSuccess={() => setNeedsLogin(false)} allowRegister={allowRegister} />;
  }
  return <>{children}</>;
}
