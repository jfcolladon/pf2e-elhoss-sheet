import { Link, Outlet } from "react-router-dom";
import { clearAuth, hasStoredAuth } from "./auth";
import { APP_VERSION } from "./version";
import { ALLOWED_SOURCES_SHORT } from "./lib/sources";

export default function App() {
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
        <Link to="/">Personajes</Link>
        <Link to="/new">+ Nuevo</Link>
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
