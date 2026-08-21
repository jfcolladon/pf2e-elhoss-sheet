import { useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { api } from "./api";
import { clearAuth, hasStoredAuth } from "./auth";
import { APP_VERSION } from "./version";
import { ALLOWED_SOURCES_SHORT } from "./lib/sources";

export default function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [username, setUsername] = useState("");

  useEffect(() => {
    if (!hasStoredAuth()) return;
    api.me().then((m) => {
      setIsAdmin(m.role === "admin");
      setUsername(m.username || "");
    }).catch(() => undefined);
  }, []);

  function logout() {
    clearAuth();
    window.location.reload();
  }

  return (
    <div>
      <div className="topbar">
        <h1>PATHFINDER 2E — ELHOSS EASTERN LANDS</h1>
        <span className="muted" style={{ color: "#d8c9a3" }}>
          {ALLOWED_SOURCES_SHORT} + House Rules · v{APP_VERSION}
        </span>
        <div className="spacer" />
        <nav className="topbar-nav">
          <Link to="/">Personajes</Link>
          <Link to="/new">+ Nuevo</Link>
          {isAdmin ? <Link to="/users">Usuarios</Link> : null}
        </nav>
        {username ? <span className="muted" style={{ color: "#d8c9a3" }}>{username}</span> : null}
        {hasStoredAuth() ? (
          <button type="button" className="ghost" onClick={logout} style={{ color: "#f3e6c8", borderColor: "#d8c9a3" }}>
            Salir
          </button>
        ) : null}
      </div>
      <div className="page">
        <Outlet />
      </div>
    </div>
  );
}
