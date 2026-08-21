"""Caracteristicas automaticas de clase/ancestry segun nivel."""
from __future__ import annotations

import json
import re

GENERIC_FEATURES = {
    "ancestry feat", "class feat", "skill feat", "general feat",
    "skill increase", "ability boosts", "ability boost", "attribute boosts",
    "boosts", "free feat",
}


def _classes_of(data: dict) -> list[str]:
    raw = data.get("class") or data.get("classes") or data.get("class_name")
    if raw is None:
        return []
    if isinstance(raw, str):
        return [raw]
    if isinstance(raw, list):
        return [str(x) for x in raw]
    return []


def class_matches(class_name: str, data: dict, name: str) -> bool:
    low = class_name.lower().strip()
    if not low:
        return False
    if "psi" in low:
        return False
    for c in _classes_of(data):
        if low == str(c).lower() or low in str(c).lower() or str(c).lower() in low:
            return True
    blob = json.dumps(data, ensure_ascii=False).lower()
    # fallback: el nombre de clase aparece como campo, no solo en markdown largo
    if f'"{low}"' in blob or f": {low}" in blob:
        return True
    if name.lower().startswith(low + " "):
        return True
    return False


def granted_features(conn, class_name: str, ancestry: str, level: int, custom_ancestry: bool, deity: str = ""):
    out = []
    level = max(1, min(20, int(level or 1)))
    if class_name:
        rows = conn.execute(
            "SELECT uid, name, level, summary, data FROM srd_items "
            "WHERE type='class feature' AND allowed=1 AND (level IS NULL OR level<=?)",
            (level,),
        ).fetchall()
        for r in rows:
            nm = (r["name"] or "").strip()
            if nm.lower() in GENERIC_FEATURES:
                continue
            data = json.loads(r["data"] or "{}")
            if not class_matches(class_name, data, nm):
                continue
            md = data.get("markdown") or r["summary"] or ""
            out.append({
                "uid": r["uid"], "name": nm, "level": r["level"] or 1,
                "kind": "class_feature", "note": (md or "")[:500],
            })

        if re.search(r"psi", class_name, re.I):
            for r in conn.execute(
                "SELECT id, title, content, data FROM house_rules WHERE kind='psionic_feature'"
            ):
                meta = json.loads(r["data"] or "{}")
                feat_level = int(meta.get("level") or 1)
                if feat_level > level:
                    continue
                out.append({
                    "uid": f"house:psionic_feature:{r['id']}",
                    "name": r["title"], "level": feat_level,
                    "kind": "psionic_feature", "note": r["content"][:500],
                })

    if ancestry:
        kinds = ("ancestry_feature",)
        for r in conn.execute(
            "SELECT id, title, content, data FROM house_rules WHERE kind IN ('ancestry_feature')"
        ):
            meta = json.loads(r["data"] or "{}")
            if (meta.get("ancestry") or "").lower() != ancestry.lower():
                continue
            feat_level = int(meta.get("level") or 1)
            if feat_level > level:
                continue
            out.append({
                "uid": f"house:ancestry_feature:{r['id']}",
                "name": r["title"], "level": feat_level,
                "kind": "ancestry_feature", "note": r["content"][:500],
            })

    if deity:
        for r in conn.execute(
            "SELECT id, title, content, data FROM house_rules WHERE kind='doctrine_trait'"
        ):
            meta = json.loads(r["data"] or "{}")
            if (meta.get("deity") or "").lower() != deity.lower():
                continue
            feat_level = int(meta.get("level") or 1)
            if feat_level > level:
                continue
            out.append({
                "uid": f"house:doctrine_trait:{r['id']}",
                "name": r["title"], "level": feat_level,
                "kind": "doctrine_trait", "note": r["content"][:500],
            })
    return out
