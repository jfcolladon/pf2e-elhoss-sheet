import json
import os

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .allowed_sources import ALLOWED_SOURCE_LABELS, ALLOWED_SOURCES_SUMMARY
from .auth import AUTH_MULTI, AUTH_USER, BasicAuthMiddleware, auth_required
from .ratelimit import RateLimitMiddleware
from .db import get_conn, init_db
from .progression import granted_features
from .users import (
    create_player_user, create_session, ensure_users,
    get_user_by_email, get_user_by_username, is_admin, list_users,
    user_role, verify_password,
)

app = FastAPI(title="Hoja de Personaje PF2e - Elhoss", version="1.11.0")

_cors = os.environ.get("CORS_ORIGINS", "*").strip()
_cors_origins = ["*"] if _cors == "*" else [o.strip() for o in _cors.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
app.add_middleware(BasicAuthMiddleware)
app.add_middleware(RateLimitMiddleware)

init_db()
ensure_users()

TYPE_ALIASES = {
    "ancestry": "ancestry", "heritage": "heritage", "background": "background",
    "class": "class", "archetype": "archetype", "feat": "feat", "spell": "spell",
    "ritual": "ritual",
    "action": "action", "skill": "skill", "condition": "condition", "trait": "trait",
    "item": "item", "equipment": "item", "class-feature": "class feature", "deity": "deity",
    "class-option": "class-option",
}





def _normalize_prereq(raw) -> str:
    if raw is None:
        return ""
    if isinstance(raw, list):
        return "; ".join(str(x) for x in raw if x)
    text = str(raw).strip()
    if text.startswith("["):
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return "; ".join(str(x) for x in parsed if x)
        except json.JSONDecodeError:
            pass
    return text


def _normalize_archetype(raw) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(x) for x in raw if x]
    text = str(raw).strip()
    if not text:
        return []
    if text.startswith("["):
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return [str(x) for x in parsed if x]
        except json.JSONDecodeError:
            pass
    return [text]


def rows_to_brief(rows):
    out = []
    for r in rows:
        keys = r.keys()
        out.append({
            "uid": r["uid"],
            "type": r["type"],
            "name": r["name"],
            "level": r["level"],
            "source": r["source"],
            "allowed": bool(r["allowed"]),
            "rarity": r["rarity"],
            "traits": json.loads(r["traits"] or "[]"),
            "summary": r["summary"],
            "prerequisite": _normalize_prereq(r["prerequisite"] if "prerequisite" in keys else None),
            "archetype": _normalize_archetype(r["archetype"] if "archetype" in keys else None),
        })
    return out


@app.get("/api/v1/catalog/{rtype}")
def list_catalog(
    rtype: str,
    q: str = "",
    level_min: int | None = None,
    level_max: int | None = None,
    trait: str = "",
    tradition: str = "",
    category: str = "",
    allowed_only: bool = False,
    limit: int = Query(50, le=500),
    offset: int = 0,
):
    if rtype not in TYPE_ALIASES:
        raise HTTPException(404, f"Tipo invalido: {rtype}")
    conn = get_conn()
    sql = (
        "SELECT uid,type,name,level,source,allowed,rarity,traits,summary, "
        "json_extract(data, '$.prerequisite') as prerequisite, "
        "json_extract(data, '$.archetype') as archetype "
        "FROM srd_items WHERE type=?"
    )
    params: list = [TYPE_ALIASES[rtype]]
    if category:
        sql += " AND category=?"
        params.append(category.lower())
    if q:
        sql += " AND name_lower LIKE ?"
        params.append(f"%{q.lower()}%")
    if level_min is not None:
        sql += " AND level >= ?"
        params.append(level_min)
    if level_max is not None:
        sql += " AND level <= ?"
        params.append(level_max)
    if trait:
        sql += " AND traits LIKE ?"
        params.append(f'%"{trait}"%')
    if tradition:
        sql += " AND data LIKE ?"
        params.append(f'%"{tradition}"%')
    if allowed_only:
        sql += " AND allowed=1"
    sql += " ORDER BY allowed DESC, level, name LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return rows_to_brief(rows)


@app.get("/api/v1/item/{uid}")
def get_item(uid: str):
    conn = get_conn()
    r = conn.execute("SELECT * FROM srd_items WHERE uid=?", (uid,)).fetchone()
    conn.close()
    if not r:
        raise HTTPException(404, "No encontrado")
    data = json.loads(r["data"])
    data["_allowed"] = bool(r["allowed"])
    return data


# ---------------- Psionica ----------------

@app.get("/api/v1/psionics/powers")
def list_powers(discipline: str = "", rank: int | None = None, q: str = "", max_rank: int | None = None):
    conn = get_conn()
    sql = "SELECT * FROM psionic_powers WHERE 1=1"
    params: list = []
    if discipline:
        sql += " AND discipline=?"
        params.append(discipline)
    if rank is not None:
        sql += " AND rank=?"
        params.append(rank)
    if max_rank is not None:
        sql += " AND rank<=?"
        params.append(max_rank)
    if q:
        sql += " AND name_lower LIKE ?"
        params.append(f"%{q.lower()}%")
    sql += " ORDER BY discipline, rank, name"
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/api/v1/psionics/powers/{power_id}")
def get_power(power_id: int):
    conn = get_conn()
    r = conn.execute("SELECT * FROM psionic_powers WHERE id=?", (power_id,)).fetchone()
    conn.close()
    if not r:
        raise HTTPException(404, "Poder no encontrado")
    return dict(r)


@app.get("/api/v1/psionics/wild-talents")
def wild_talent_tables():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM wild_talent_entries ORDER BY rank, prob_min").fetchall()
    powers = {r["name_lower"]: r["id"] for r in conn.execute("SELECT id, name_lower FROM psionic_powers")}
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["power_id"] = powers.get(r["name"].lower())
        out.append(d)
    return out


@app.get("/api/v1/psionics/disciplines")
def disciplines():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM house_rules WHERE kind='discipline'").fetchall()
    conn.close()
    return [{"name": r["title"], "foco": r["content"], **json.loads(r["data"] or "{}")} for r in rows]


# ---------------- House rules ----------------

@app.get("/api/v1/houserules")
def list_houserules(kind: str = "", ancestry: str = ""):
    conn = get_conn()
    sql = "SELECT id, kind, title, content, data FROM house_rules"
    params: list = []
    if kind:
        sql += " WHERE kind=?"
        params.append(kind)
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    out = []
    for r in rows:
        data = json.loads(r["data"]) if r["data"] else None
        if ancestry and (not data or data.get("ancestry") != ancestry):
            continue
        out.append({"id": r["id"], "kind": r["kind"], "title": r["title"],
                    "content": r["content"], "data": data})
    return out


@app.get("/api/v1/houserules/{rule_id}")
def get_houserule(rule_id: int):
    conn = get_conn()
    r = conn.execute("SELECT * FROM house_rules WHERE id=?", (rule_id,)).fetchone()
    conn.close()
    if not r:
        raise HTTPException(404, "No encontrado")
    return {"id": r["id"], "kind": r["kind"], "title": r["title"], "content": r["content"],
            "data": json.loads(r["data"]) if r["data"] else None}


# ---------------- Personajes ----------------

def _actor(request: Request):
    return getattr(request.state, "user", None)


def _can_access_row(request: Request, user_id) -> bool:
    user = _actor(request)
    if not AUTH_MULTI or not user:
        return True
    return user_id == user["id"]


@app.get("/api/v1/characters")
def list_characters(request: Request):
    conn = get_conn()
    user = _actor(request)
    if AUTH_MULTI and user:
        rows = conn.execute(
            "SELECT id, name, data, updated_at FROM characters WHERE user_id=? ORDER BY updated_at DESC",
            (user["id"],),
        ).fetchall()
    else:
        rows = conn.execute("SELECT id, name, data, updated_at FROM characters ORDER BY updated_at DESC").fetchall()
    conn.close()
    out = []
    for r in rows:
        d = json.loads(r["data"])
        out.append({
            "id": r["id"], "name": r["name"], "updated_at": r["updated_at"],
            "level": d.get("level", 1),
            "ancestry": (d.get("ancestry") or {}).get("name", ""),
            "className": (d.get("clazz") or {}).get("name", ""),
        })
    return out


@app.post("/api/v1/characters")
def create_character(payload: dict, request: Request):
    name = payload.get("name") or "Sin nombre"
    conn = get_conn()
    user = _actor(request)
    uid = user["id"] if user else None
    cur = conn.execute(
        "INSERT INTO characters (name, data, user_id) VALUES (?,?,?)",
        (name, json.dumps(payload, ensure_ascii=False), uid),
    )
    conn.commit()
    cid = cur.lastrowid
    conn.close()
    return {"id": cid}


def remap_known_powers(data: dict, conn) -> dict:
    """Tras reseeder el catalogo los id cambian; el nombre/disciplina/rank no."""
    ps = data.get("psionics") or {}
    known = ps.get("powers") or []
    if not known:
        return data
    rows = conn.execute(
        "SELECT id, name, discipline, rank FROM psionic_powers"
    ).fetchall()
    by_id = {r["id"]: r for r in rows}
    by_key = {(r["name"].lower(), r["discipline"], r["rank"]): r for r in rows}
    by_name: dict[str, list] = {}
    for r in rows:
        by_name.setdefault(r["name"].lower(), []).append(r)
    changed = False
    for p in known:
        name = str(p.get("name") or "")
        disc = p.get("discipline") or ""
        rank = p.get("rank")
        rid = p.get("powerId")
        row = by_id.get(rid) if rid else None
        if row is not None and row["name"] == name:
            continue
        match = by_key.get((name.lower(), disc, rank))
        if match is None:
            cands = by_name.get(name.lower()) or []
            if disc:
                cands = [x for x in cands if x["discipline"] == disc] or cands
            if rank is not None:
                ranked = [x for x in cands if x["rank"] == rank]
                if ranked:
                    cands = ranked
            match = cands[0] if len(cands) == 1 else None
        if match is None:
            continue
        p["powerId"] = match["id"]
        p["discipline"] = match["discipline"]
        p["rank"] = match["rank"]
        if match["name"] != name:
            p["name"] = match["name"]
        changed = True
    if changed:
        data["psionics"] = {**ps, "powers": known}
    return data


@app.get("/api/v1/characters/{cid}")
def get_character(cid: int, request: Request):
    conn = get_conn()
    r = conn.execute("SELECT * FROM characters WHERE id=?", (cid,)).fetchone()
    if not r:
        conn.close()
        raise HTTPException(404, "Personaje no encontrado")
    if not _can_access_row(request, r["user_id"] if "user_id" in r.keys() else None):
        conn.close()
        raise HTTPException(404, "Personaje no encontrado")
    d = json.loads(r["data"])
    d = remap_known_powers(d, conn)
    conn.close()
    d["id"] = r["id"]
    return d


@app.put("/api/v1/characters/{cid}")
def update_character(cid: int, payload: dict, request: Request):
    name = payload.get("name") or "Sin nombre"
    conn = get_conn()
    row = conn.execute("SELECT user_id FROM characters WHERE id=?", (cid,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Personaje no encontrado")
    if not _can_access_row(request, row["user_id"]):
        conn.close()
        raise HTTPException(404, "Personaje no encontrado")
    cur = conn.execute(
        "UPDATE characters SET name=?, data=?, updated_at=datetime('now') WHERE id=?",
        (name, json.dumps(payload, ensure_ascii=False), cid),
    )
    conn.commit()
    conn.close()
    if cur.rowcount == 0:
        raise HTTPException(404, "Personaje no encontrado")
    return {"ok": True}


@app.delete("/api/v1/characters/{cid}")
def delete_character(cid: int, request: Request):
    conn = get_conn()
    row = conn.execute("SELECT user_id FROM characters WHERE id=?", (cid,)).fetchone()
    if not row:
        conn.close()
        return {"ok": True}
    if not _can_access_row(request, row["user_id"]):
        conn.close()
        raise HTTPException(404, "Personaje no encontrado")
    conn.execute("DELETE FROM characters WHERE id=?", (cid,))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.get("/api/v1/health")
def health():
    conn = get_conn()
    n = conn.execute("SELECT COUNT(*) c FROM srd_items").fetchone()["c"]
    allowed = conn.execute("SELECT COUNT(*) c FROM srd_items WHERE allowed=1").fetchone()["c"]
    p = conn.execute("SELECT COUNT(*) c FROM psionic_powers").fetchone()["c"]
    conn.close()
    return {
        "status": "ok",
        "version": app.version,
        "srd_items": n,
        "srd_items_allowed": allowed,
        "psionic_powers": p,
        "auth_required": auth_required(),
        "auth_multi": AUTH_MULTI,
    }


@app.get("/api/v1/progression")
def progression(
    class_name: str = "",
    ancestry: str = "",
    level: int = 1,
    custom_ancestry: bool = False,
    deity: str = "",
):
    conn = get_conn()
    items = granted_features(conn, class_name, ancestry, level, custom_ancestry, deity)
    conn.close()
    return {"features": items}


def _public_user(user: dict) -> dict:
    return {"username": user["username"], "role": user_role(user)}


def _require_admin(request: Request) -> dict:
    user = _actor(request)
    if not AUTH_MULTI or not is_admin(user):
        raise HTTPException(403, "Solo un administrador puede gestionar usuarios")
    return user


@app.get("/api/v1/auth/me")
def auth_me(request: Request):
    user = _actor(request)
    if not user:
        return {"username": None, "role": None}
    return _public_user(user)


@app.post("/api/v1/auth/login")
def auth_login(payload: dict):
    if not AUTH_MULTI:
        raise HTTPException(404, "Login de cuenta no habilitado")
    ident = str(payload.get("username") or payload.get("email") or "").strip()
    password = str(payload.get("password") or "")
    user = get_user_by_email(ident.lower()) if "@" in ident else get_user_by_username(ident)
    if not user or not user.get("email_verified") or not verify_password(password, user["password_hash"]):
        raise HTTPException(401, "Usuario o contraseña incorrectos")
    token = create_session(user["id"])
    return {"ok": True, "token": token, **_public_user(user)}


@app.get("/api/v1/admin/users")
def admin_list_users(request: Request):
    _require_admin(request)
    return [{"username": u["username"], "role": user_role(u), "created_at": u.get("created_at")} for u in list_users()]


@app.post("/api/v1/admin/users")
def admin_create_user(payload: dict, request: Request):
    _require_admin(request)
    username = str(payload.get("username") or "").strip()
    password = str(payload.get("password") or "")
    role = str(payload.get("role") or "user").strip().lower() or "user"
    if username.lower() == AUTH_USER.lower():
        raise HTTPException(400, "No se puede recrear el usuario de campana desde aqui")
    if get_user_by_username(username):
        raise HTTPException(400, "Ese usuario ya existe")
    try:
        user = create_player_user(username, password, role)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    return {"ok": True, "username": user["username"], "role": user_role(user)}


@app.get("/api/v1/allowed-sources")
def allowed_sources():
    return {"labels": ALLOWED_SOURCE_LABELS, "summary": ALLOWED_SOURCES_SUMMARY}


# ---------------- Frontend estatico ----------------
STATIC_DIR = os.environ.get("STATIC_DIR", os.path.join(os.path.dirname(__file__), "..", "static"))
if os.path.isdir(STATIC_DIR):
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
else:
    @app.get("/")
    def root():
        return JSONResponse({"info": "API de hoja de personaje PF2e. Frontend no compilado."})
