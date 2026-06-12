import json
import os

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .db import get_conn, init_db

app = FastAPI(title="Hoja de Personaje PF2e - Elhoss", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

TYPE_ALIASES = {
    "ancestry": "ancestry", "heritage": "heritage", "background": "background",
    "class": "class", "archetype": "archetype", "feat": "feat", "spell": "spell",
    "action": "action", "skill": "skill", "condition": "condition", "trait": "trait",
    "item": "item", "equipment": "item", "class-feature": "class feature", "deity": "deity",
    "class-option": "class-option",
}


def rows_to_brief(rows):
    out = []
    for r in rows:
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
    sql = "SELECT uid,type,name,level,source,allowed,rarity,traits,summary FROM srd_items WHERE type=?"
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

@app.get("/api/v1/characters")
def list_characters():
    conn = get_conn()
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
def create_character(payload: dict):
    name = payload.get("name") or "Sin nombre"
    conn = get_conn()
    cur = conn.execute(
        "INSERT INTO characters (name, data) VALUES (?,?)",
        (name, json.dumps(payload, ensure_ascii=False)),
    )
    conn.commit()
    cid = cur.lastrowid
    conn.close()
    return {"id": cid}


@app.get("/api/v1/characters/{cid}")
def get_character(cid: int):
    conn = get_conn()
    r = conn.execute("SELECT * FROM characters WHERE id=?", (cid,)).fetchone()
    conn.close()
    if not r:
        raise HTTPException(404, "Personaje no encontrado")
    d = json.loads(r["data"])
    d["id"] = r["id"]
    return d


@app.put("/api/v1/characters/{cid}")
def update_character(cid: int, payload: dict):
    name = payload.get("name") or "Sin nombre"
    conn = get_conn()
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
def delete_character(cid: int):
    conn = get_conn()
    conn.execute("DELETE FROM characters WHERE id=?", (cid,))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.get("/api/v1/health")
def health():
    conn = get_conn()
    n = conn.execute("SELECT COUNT(*) c FROM srd_items").fetchone()["c"]
    p = conn.execute("SELECT COUNT(*) c FROM psionic_powers").fetchone()["c"]
    conn.close()
    return {"status": "ok", "srd_items": n, "psionic_powers": p}


# ---------------- Frontend estatico ----------------
STATIC_DIR = os.environ.get("STATIC_DIR", os.path.join(os.path.dirname(__file__), "..", "static"))
if os.path.isdir(STATIC_DIR):
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
else:
    @app.get("/")
    def root():
        return JSONResponse({"info": "API de hoja de personaje PF2e. Frontend no compilado."})
