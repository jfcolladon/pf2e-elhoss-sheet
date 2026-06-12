import { Link, Outlet } from "react-router-dom";
import { APP_VERSION } from "./version";

export default function App() {
  return (
    <div>
      <div className="topbar">
        <h1>PATHFINDER 2E — ELHOSS EASTERN LANDS</h1>
        <span className="muted" style={{ color: "#d8c9a3" }}>
          Core Rulebook + APG (legacy) + House Rules · v{APP_VERSION}
        </span>
        <div className="spacer" />
        <Link to="/">Personajes</Link>
        <Link to="/new">+ Nuevo</Link>
      </div>
      <div className="page">
        <Outlet />
      </div>
    </div>
  );
}
