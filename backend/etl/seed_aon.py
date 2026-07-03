"""Descarga el SRD legacy de Pathfinder 2e desde el Elasticsearch de Archives of Nethys
y lo guarda en SQLite. Los manuales autorizados (ver allowed_sources.py) quedan marcados
como `allowed`; el resto se conserva para poder habilitarlo con aprobacion del DM."""
import json
import sys
import time

import httpx

sys.path.insert(0, __import__("os").path.join(__import__("os").path.dirname(__file__), ".."))
from app.allowed_sources import ALLOWED_SOURCES, is_allowed_source  # noqa: E402
from app.db import get_conn, init_db  # noqa: E402

ES_URL = "https://elasticsearch.aonprd.com/aon/_search"

# Tipos de contenido relevantes para un jugador
TYPES = [
    "ancestry", "heritage", "background", "class", "archetype", "feat", "spell", "ritual",
    "action", "skill", "condition", "trait", "item", "class feature", "deity",
]

# Opciones de subclase (musa de bardo, bloodlines, ordenes, etc.).
# Se almacenan bajo el tipo sintetico "class-option" para un unico buscador,
# conservando el tipo real en la columna category.
SUBCLASS_TYPES = [
    "bard muse", "sorcerer bloodline", "wizard arcane school", "wizard arcane thesis",
    "barbarian instinct", "champion cause", "druidic order", "rogue racket",
    "oracle mystery", "witch patron theme", "witch lesson", "magus hybrid study",
    "ranger hunter's edge", "alchemist research field", "investigator methodology",
    "swashbuckler style", "gunslinger way", "cleric doctrine", "summoner eidolon",
    "inventor innovation", "psychic conscious mind", "psychic subconscious mind",
    "thaumaturge implement",
]

EXCLUDED_FIELDS = ["text", "search_markdown"]

PAGE_SIZE = 1000


def fetch_type(client: httpx.Client, type_name: str):
    """Pagina con search_after sobre _doc."""
    hits_all = []
    search_after = None
    while True:
        body = {
            "size": PAGE_SIZE,
            "sort": ["_doc"],
            "_source": {"excludes": EXCLUDED_FIELDS},
            "query": {"bool": {"filter": [{"match_phrase": {"type": type_name}}]}},
        }
        if search_after is not None:
            body["search_after"] = search_after
        for attempt in range(5):
            try:
                r = client.post(ES_URL, json=body, timeout=60)
                r.raise_for_status()
                break
            except Exception as e:  # noqa: BLE001
                if attempt == 4:
                    raise
                print(f"  retry {type_name}: {e}")
                time.sleep(2 * (attempt + 1))
        data = r.json()
        hits = data["hits"]["hits"]
        if not hits:
            break
        hits_all.extend(hits)
        search_after = hits[-1]["sort"]
        if len(hits) < PAGE_SIZE:
            break
    return hits_all


def is_allowed(src) -> bool:
    sources = src.get("source") or []
    return is_allowed_source(sources)


def seed_type(conn, client, es_type: str, stored_type: str | None = None):
    """Descarga un tipo de AoN y lo guarda. stored_type permite re-etiquetar
    (p. ej. todas las subclases bajo 'class-option')."""
    stored_type = stored_type or es_type
    hits = fetch_type(client, es_type)
    rows = []
    for h in hits:
        src = h["_source"]
        if src.get("exclude_from_search"):
            continue
        # match_phrase puede traer tipos compuestos parecidos; exigir igualdad exacta
        if (src.get("type") or "").lower() != es_type:
            continue
        uid = src.get("id") or h["_id"]
        name = src.get("name") or ""
        sources = src.get("source") or []
        if isinstance(sources, str):
            sources = [sources]
        traits = src.get("trait") or []
        if isinstance(traits, str):
            traits = [traits]
        # para subclases conservamos el tipo real (p.ej. "bard muse") en category
        category = es_type if stored_type != es_type else (src.get("category") or "").lower()
        rows.append((
            uid,
            stored_type,
            name,
            name.lower(),
            src.get("level"),
            "; ".join(sources),
            1 if is_allowed(src) else 0,
            src.get("rarity"),
            category,
            json.dumps(traits, ensure_ascii=False),
            src.get("summary") or "",
            json.dumps(src, ensure_ascii=False),
        ))
    conn.executemany(
        """INSERT OR REPLACE INTO srd_items
           (uid, type, name, name_lower, level, source, allowed, rarity, category, traits, summary, data)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
        rows,
    )
    conn.commit()
    allowed_n = sum(1 for r in rows if r[6] == 1)
    print(f"{stored_type} <- {es_type}: {len(rows)} items ({allowed_n} permitidos / {len(ALLOWED_SOURCES)} manuales)")
    return len(rows)


def main():
    conn = get_conn()
    init_db(conn)
    client = httpx.Client()
    total = 0
    for t in TYPES:
        total += seed_type(conn, client, t)
    for t in SUBCLASS_TYPES:
        total += seed_type(conn, client, t, stored_type="class-option")
    conn.close()
    print(f"TOTAL: {total} items")


if __name__ == "__main__":
    main()
