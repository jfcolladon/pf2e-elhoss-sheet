"""Parsea conjuros, feats y bloodlines homebrew de la seccion Magia del Google Doc.

No pisa items SRD que ya existan por nombre (minusculas). Inserta en srd_items
con source Elhoss House Rules y allowed=1, y ancestrias innatas en house_rules.
"""
from __future__ import annotations

import json
import re
import unicodedata

HOUSE_SOURCE = "Elhoss House Rules"

_ANCESTRY_KEYS = [
    (("k'rryl", "k\u2019rryl", "krryl"), "K'rryl"),
    (("halfling",), "Halfling de Elhoss"),
    (("semi-gigante", "semigigante", "semi gigante"), "Semi-Gigante"),
    (("yolquipan",), "Elfo de Yolquipan"),
    (("thalan", "elfos de las dunas", "dunas"), "Elfo de las Dunas (Thalan'doro)"),
    (("ghurim",), "Ghurim"),
    (("dwrvin", "enanos"), "Dwrvin"),
    (("human", "humano"), "Humano de Elhoss"),
]


def _match_ancestry(line: str):
    low = line.lower()
    for keys, name in _ANCESTRY_KEYS:
        if any(k in low for k in keys):
            return name
    return None

SPELL_KIND_RE = re.compile(r"^(Cantrip|Spell|Ritual)\s+(\d+)(?:\s*\(([^)]+)\))?\s*$", re.I)
STAR_NAME_RE = re.compile(r"^[\u2726✦*]\s+(.+)$")
FEAT_HEAD_RE = re.compile(
    r"^(?:Wizard/Sorcerer\s+)?Class Feat\s*[—\-–]\s*Level\s+(\d+)\s*$", re.I
)
LEVEL_HEAD_RE = re.compile(r"^Level\s+\d+\s*$", re.I)
FIELD_KEYS = [
    "Traditions", "Tradition", "Traits", "Cast", "Trigger", "Range",
    "Area", "Targets", "Target", "Defense", "Duration", "Cost",
]
SKIP_TITLES = {
    "cantrips", "bloodline spells", "blood magic", "granted spells",
    "spell list", "limitaciones de la hechicería y hechicería prohibida",
    "hechizos particulares de elhoss", "hechizos prohibidos de elhoss",
    "magifoqi", "ritual de vínculo",
}


def _slug(name: str) -> str:
    nfkd = unicodedata.normalize("NFKD", name)
    ascii_name = "".join(ch for ch in nfkd if not unicodedata.combining(ch))
    s = re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")
    return s or "item"


def _looks_title(line: str) -> bool:
    s = line.strip()
    if not s or len(s) > 80:
        return False
    if s.startswith(("*", "\u2022", "-", "\u2013", "\t")):
        return False
    if s.endswith((".", ",", ";", ":")):
        return False
    low = s.lower()
    if low in SKIP_TITLES:
        return False
    if low.startswith(("beneficio", "heritage", "traits", "rasgos", "cast ", "range",
                       "duration", "heightened", "on success", "on failure",
                       "critical ", "damage", "usuario típico", "usuario tipico",
                       "tema mecánico", "rasgos frecuentes", "filosofía")):
        return False
    if SPELL_KIND_RE.match(s) or LEVEL_HEAD_RE.match(s) or FEAT_HEAD_RE.match(s):
        return False
    if s.startswith("🔹") or s.startswith("✦ Expuls"):
        return False
    return True


def _parse_field_line(line: str):
    s = line.strip()
    for key in FIELD_KEYS:
        token = key + ":"
        if s.lower().startswith(token.lower()):
            return key, s[len(token):].strip().rstrip(";")
        compact = key + " "
        if s.lower().startswith(compact.lower()) and key in ("Traditions", "Cast", "Range", "Duration"):
            rest = s[len(key):].strip()
            if rest and not rest.startswith(":"):
                return key, rest
    m = re.match(r"^Cast\s+(\[.+\].*)$", s, re.I)
    if m:
        return "Cast", m.group(1).strip()
    m = re.match(r"^(\d+)\s+actions?\s*$", s, re.I)
    if m:
        return "Cast", s
    if re.match(r"^\[(?:one|two|three)-action", s, re.I):
        return "Cast", s
    return None, None


def _existing_names(conn, types: tuple[str, ...]) -> set[str]:
    if not types:
        return set()
    q = ",".join("?" * len(types))
    rows = conn.execute(f"SELECT name_lower FROM srd_items WHERE type IN ({q})", types)
    return {r["name_lower"] for r in rows}


def _upsert_item(conn, *, uid: str, stored_type: str, name: str, level: int | None,
                 category: str, traits: list[str], summary: str, data: dict, rarity: str | None = None):
    conn.execute(
        """INSERT OR REPLACE INTO srd_items
           (uid, type, name, name_lower, level, source, allowed, rarity, category, traits, summary, data)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            uid, stored_type, name, name.lower(), level, HOUSE_SOURCE, 1, rarity or "common",
            category, json.dumps(traits, ensure_ascii=False), summary[:400],
            json.dumps(data, ensure_ascii=False),
        ),
    )


def _collect_block(lines: list[str], start: int, end: int) -> tuple[list[str], int]:
    body = []
    j = start
    while j < end:
        s = lines[j].strip()
        if j > start:
            if STAR_NAME_RE.match(s) and j + 1 < end and SPELL_KIND_RE.match(lines[j + 1].strip()):
                break
            if _looks_title(s) and j + 1 < end:
                nxt = lines[j + 1].strip()
                if SPELL_KIND_RE.match(nxt) or nxt.lower().startswith("traits:") or FEAT_HEAD_RE.match(s):
                    break
            if FEAT_HEAD_RE.match(s) or s.startswith("Dominio del") or s.startswith("Hechizos "):
                break
            if s in ("Sorcerers Bloodlines", "Religiones en Elhoss Eastern Lands", "Magifoqi"):
                break
        body.append(lines[j])
        j += 1
    return body, j


def _statblock_and_markdown(body_lines: list[str], extra_fields: dict[str, str] | None = None):
    fields: dict[str, str] = dict(extra_fields or {})
    desc: list[str] = []
    heightened: list[str] = []
    in_h = False
    traits: list[str] = []
    for raw in body_lines:
        s = raw.strip()
        if not s:
            if desc and not in_h:
                desc.append("")
            continue
        if s.lower().startswith("heightened"):
            in_h = True
            heightened.append(s)
            continue
        if in_h:
            heightened.append(s)
            continue
        key, val = _parse_field_line(s)
        if key and val:
            if key == "Traits":
                traits = [t.strip() for t in re.split(r"[,/]", val) if t.strip()]
                fields["Traits"] = val
            elif key == "Traditions" or key == "Tradition":
                fields["Traditions"] = val
            else:
                fields[key] = val
            continue
        # Traits without label: "Divine, Abjuration, Aura, Spirit"
        if not fields and "," in s and len(s) < 120 and not s.endswith("."):
            bits = [t.strip() for t in s.split(",") if t.strip()]
            if 2 <= len(bits) <= 8 and all(b[0].isupper() or b[0] in "[]" for b in bits):
                traits = bits
                fields["Traits"] = s
                continue
        desc.append(s)
    md = re.sub(r"\n{3,}", "\n\n", "\n".join(desc)).strip()
    htxt = "\n".join(heightened).strip()
    if htxt:
        md = (md + "\n\n" + htxt).strip()
    return fields, traits, md


def parse_star_spells(lines: list[str], start: int, end: int) -> list[dict]:
    out = []
    i = start
    while i < end - 1:
        m = STAR_NAME_RE.match(lines[i].strip())
        kind_m = SPELL_KIND_RE.match(lines[i + 1].strip()) if m else None
        if not (m and kind_m):
            i += 1
            continue
        name = m.group(1).strip()
        kind = kind_m.group(1).lower()
        level = int(kind_m.group(2))
        extra = (kind_m.group(3) or "").strip()
        stored = "ritual" if kind == "ritual" or "ritual" in extra.lower() else "spell"
        body, nxt = _collect_block(lines, i + 2, end)
        fields, traits, md = _statblock_and_markdown(body)
        if kind == "cantrip" and "Cantrip" not in traits:
            traits = ["Cantrip", *traits]
        summary = md.split("\n", 1)[0][:240]
        out.append({
            "name": name, "level": 0 if kind == "cantrip" else level, "type": stored,
            "traits": traits, "fields": fields, "markdown": md, "summary": summary,
            "rarity": "uncommon",
        })
        i = nxt
    return out


def parse_named_spells(lines: list[str], start: int, end: int) -> list[dict]:
    """Needle Darts / Elemental Stone Fist: titulo + (Spell N | 2 actions)."""
    out = []
    i = start
    while i < end - 1:
        s = lines[i].strip()
        if not _looks_title(s) or STAR_NAME_RE.match(s):
            i += 1
            continue
        nxts = lines[i + 1].strip() if i + 1 < end else ""
        kind_m = SPELL_KIND_RE.match(nxts)
        is_actions = bool(re.match(r"^\d+\s+actions?", nxts, re.I))
        if not kind_m and not is_actions:
            i += 1
            continue
        name = s
        if kind_m:
            kind = kind_m.group(1).lower()
            level = int(kind_m.group(2))
            extra = (kind_m.group(3) or "").strip()
            body_start = i + 2
        else:
            kind = "cantrip"
            level = 1
            extra = ""
            body_start = i + 1
        stored = "ritual" if kind == "ritual" or "ritual" in extra.lower() else "spell"
        body, nxt = _collect_block(lines, body_start, end)
        fields, traits, md = _statblock_and_markdown(body)
        if kind == "cantrip" or "cantrip" in " ".join(traits).lower():
            level = 0
            if "Cantrip" not in traits:
                traits = ["Cantrip", *traits]
        summary = md.split("\n", 1)[0][:240]
        out.append({
            "name": name, "level": level, "type": stored,
            "traits": traits, "fields": fields, "markdown": md, "summary": summary,
            "rarity": "uncommon",
        })
        i = nxt
    return out


def parse_magifoqi_feats(lines: list[str], start: int, end: int) -> list[dict]:
    out = []
    i = start
    while i < end - 1:
        m = FEAT_HEAD_RE.match(lines[i].strip())
        if not m:
            i += 1
            continue
        level = int(m.group(1))
        j = i + 1
        while j < end and not lines[j].strip():
            j += 1
        if j >= end or not _looks_title(lines[j]):
            i += 1
            continue
        name = lines[j].strip()
        body, nxt = _collect_block(lines, j + 1, end)
        _fields, traits, md = _statblock_and_markdown(body)
        traits = list(dict.fromkeys(["Class", "Wizard", "Sorcerer", *traits]))
        out.append({
            "name": name, "level": level, "type": "feat",
            "traits": traits, "fields": {"Level": str(level)},
            "markdown": md, "summary": md.split("\n", 1)[0][:240],
            "rarity": "uncommon", "category": "class",
        })
        i = nxt
    return out


BLOODLINE_STOP = (
    "Limitaciones de la Hechicería", "Magifoqi", "Religiones en Elhoss",
)


def parse_bloodlines(lines: list[str], start: int, end: int) -> list[dict]:
    out = []
    i = start
    while i < end:
        s = lines[i].strip()
        if any(s.startswith(x) for x in BLOODLINE_STOP):
            break
        nxt_nonempty = ""
        for peek in lines[i + 1:i + 6]:
            if peek.strip():
                nxt_nonempty = peek.strip()
                break
        starts_ok = nxt_nonempty.lower().startswith(
            ("tradition:", "spell list:", "lista de conjuros:", "concepto elhoss")
        )
        if not (
            _looks_title(s)
            and starts_ok
            and not s.startswith("(")
            and "feat:" not in s.lower()
            and "speed" not in s.lower()
        ):
            i += 1
            continue
        name = s
        body = []
        nxt = i + 1
        while nxt < end:
            ns = lines[nxt].strip()
            if any(ns.startswith(x) for x in BLOODLINE_STOP):
                break
            if nxt > i + 2 and _looks_title(ns):
                peek_n = ""
                for p in lines[nxt + 1:nxt + 6]:
                    if p.strip():
                        peek_n = p.strip()
                        break
                if peek_n.lower().startswith(("tradition:", "spell list:", "lista de conjuros:", "concepto elhoss")):
                    break
            body.append(lines[nxt])
            nxt += 1
        md = re.sub(r"\n{3,}", "\n\n", "\n".join(x.rstrip() for x in body)).strip()
        out.append({
            "name": name, "level": 1, "type": "class-option",
            "traits": ["Sorcerer"], "fields": {},
            "markdown": md, "summary": md.split("\n", 1)[0][:240],
            "rarity": "uncommon", "category": "sorcerer bloodline",
        })
        i = nxt
    return out


def parse_ancestry_innate(lines: list[str], start: int, end: int, ancestry: str) -> list[dict]:
    out = []
    i = start
    while i < end:
        s = lines[i].strip()
        if s.upper().startswith("HERITAGE") or s.upper().startswith("FEATS") or s.startswith("________________"):
            break
        if _looks_title(s) and i + 1 < end and lines[i + 1].strip() and not _looks_title(lines[i + 1]):
            name = s
            body = []
            j = i + 1
            while j < end:
                ls = lines[j].strip()
                if ls.upper().startswith("HERITAGE") or ls.upper().startswith("FEATS"):
                    break
                if j > i + 1 and _looks_title(ls):
                    break
                body.append(lines[j])
                j += 1
            md = re.sub(r"\n{3,}", "\n\n", "\n".join(x.rstrip() for x in body)).strip()
            if len(md) > 20 and not any(
                k in name.lower() for k in ("nombres", "relación", "relacion", "zh’karé", "zh'kare")
            ):
                out.append({"name": name, "ancestry": ancestry, "content": md})
            i = j
            continue
        i += 1
    return out


STAT_LINE_RE = re.compile(
    r"^(Edad|Esperanza|Altura|Peso|HP:|Size:|Speed:|Vision:|Visión:|Languages:|Idiomas:|"
    r"Traits:|Rasgos:|Ability Boosts:|Ability Flaw:|Tamaño:|Velocidad:)",
    re.I,
)
MECH_RE = re.compile(
    r"(obtienes|ganas|bonus|trained|1 vez|una vez|resistance|\+\s*\d|"
    r"darkvision|circumstance|fortune|rerol|repetir|ignoras|tratas tu|"
    r"puedes moverte|recall knowledge|terreno dif[ií]cil|trata las armas)",
    re.I,
)
ANC_SKIP = (
    "nombres", "relación", "relacion", "zh’karé", "zh'kare", "rasgos culturales",
    "rasgos cultura", "recomendaciones", "ejemplos de nombres", "idioma ",
    "físicamente", "fisicamente",
)
FAITH_STOP = (
    "SPELLS",
    "SUGGESTION",
    "Dominio del Cosmos",
    "✨ Items",
)


def _is_faith_header(lines: list[str], i: int, end: int) -> bool:
    s = lines[i].strip()
    if not _looks_title(s) or len(s) < 6:
        return False
    low = s.lower()
    if low.startswith((
        "dominios", "favored", "arma favorecida", "hechizos", "rasgo doctrinal",
        "edict", "anath", "filosofía", "religiones", "doctrinas y", "credos religiosos",
        "doctrina de", "la doctrina primordial", "los cuatro principios",
        "sacerdotes elementales",
    )):
        return False
    if s.startswith("Doctrina de"):
        return False
    if not re.match(
        r"^(Los |Las |Sacerdotes |El |La Orden|Cobrand|Martra|Akasune|Fonsae)",
        s, re.I,
    ):
        return False
    window = "\n".join(lines[i:min(end, i + 22)])
    return bool(re.search(r"^Dominios(?: disponibles)?:", window, re.M))


def parse_cleric_faiths(lines: list[str], start: int, end: int) -> list[dict]:
    out = []
    i = start
    while i < end:
        if any(lines[i].strip().startswith(x) for x in FAITH_STOP):
            break
        if not _is_faith_header(lines, i, end):
            i += 1
            continue
        name = re.sub(r"\s*\(.*\)$", "", lines[i].strip()).strip()
        nxt = i + 1
        while nxt < end:
            ns = lines[nxt].strip()
            if any(ns.startswith(x) for x in FAITH_STOP):
                break
            if nxt > i and _is_faith_header(lines, nxt, end):
                break
            nxt += 1
        body = lines[i + 1:nxt]
        text = "\n".join(x.rstrip() for x in body)
        domains_m = re.search(r"^Dominios(?: disponibles)?:\s*(.+)$", text, re.M)
        weapon_m = re.search(r"^(?:Favored weapon|Arma favorecida):\s*(.+)$", text, re.M | re.I)
        rasgo_name, rasgo_body = "", ""
        for bi, raw in enumerate(body):
            s = raw.strip()
            if s.lower() == "rasgo doctrinal" or s.lower().startswith("rasgo doctrinal:"):
                if ":" in s and s.lower() != "rasgo doctrinal:":
                    rasgo_body = s.split(":", 1)[1].strip()
                    rasgo_name = "Rasgo doctrinal"
                else:
                    k = bi + 1
                    while k < len(body) and not body[k].strip():
                        k += 1
                    if k < len(body):
                        chunk = body[k].strip()
                        if ":" in chunk[:80]:
                            rasgo_name, rasgo_body = chunk.split(":", 1)
                            rasgo_name, rasgo_body = rasgo_name.strip(), rasgo_body.strip()
                        else:
                            rasgo_name = chunk
                            rasgo_body = "\n".join(
                                x.strip() for x in body[k + 1:k + 6]
                                if x.strip() and not x.strip().startswith(("Favored", "Arma", "Edict", "Anath"))
                            )
                break
        edicts, anathema = [], []
        mode = None
        for raw in body:
            s = raw.strip().lstrip("* ").strip()
            low = s.lower()
            if low in ("edicts", "edictos"):
                mode = "e"
                continue
            if low in ("anathema", "anatemas"):
                mode = "a"
                continue
            if mode and s and not s.endswith(":") and not STAT_LINE_RE.match(s):
                if low.startswith(("favored", "arma ", "dominios", "filosofía", "hechizos")):
                    mode = None
                    continue
                (edicts if mode == "e" else anathema).append(s)
        domains = domains_m.group(1).strip().rstrip(".") if domains_m else ""
        weapon = weapon_m.group(1).strip() if weapon_m else ""
        parts = []
        if domains:
            parts.append(f"**Dominios:** {domains}")
        if weapon:
            parts.append(f"**Arma favorecida:** {weapon}")
        if rasgo_name:
            parts.append(f"**Rasgo doctrinal — {rasgo_name}:** {rasgo_body}".strip())
        if edicts:
            parts.append("**Edictos:**\n" + "\n".join(f"* {e}" for e in edicts))
        if anathema:
            parts.append("**Anatemas:**\n" + "\n".join(f"* {a}" for a in anathema))
        flavor = []
        for raw in body:
            s = raw.strip()
            if not s or STAT_LINE_RE.match(s):
                continue
            if s.lower().startswith(("dominios", "favored", "arma favorecida", "rasgo doctrinal",
                                     "edict", "anath", "hechizos favorecidos", "filosofía")):
                continue
            if s.startswith("*"):
                continue
            flavor.append(s)
        md = "\n\n".join(parts)
        if flavor:
            md = (md + "\n\n" + "\n\n".join(flavor[:6])).strip()
        out.append({
            "name": name,
            "domains": [d.strip() for d in re.split(r"[,/]", domains) if d.strip()] if domains else [],
            "weapon": weapon,
            "rasgo_name": rasgo_name,
            "rasgo_body": rasgo_body,
            "markdown": md,
            "summary": (rasgo_body or domains or md.split("\n", 1)[0])[:240],
        })
        i = nxt
    return out


def parse_cosmos_domain(lines: list[str], start: int, end: int) -> dict | None:
    if start < 0:
        return None
    body = []
    for j in range(start + 1, min(end, start + 40)):
        s = lines[j].strip()
        if s.lower() in ("cantrips",) or STAR_NAME_RE.match(s) or SPELL_KIND_RE.match(s):
            break
        if s:
            body.append(s)
    md = "\n".join(body).strip()
    if len(md) < 40:
        return None
    return {
        "name": "Dominio del Cosmos",
        "markdown": md,
        "summary": md.split("\n", 1)[0][:240],
        "traits": ["Cleric", "Divine", "Domain"],
    }


def parse_ancestry_specials(lines: list[str], start: int, end: int) -> list[dict]:
    """Habilidades innatas de todas las ancestrias (no heritages ni feats)."""
    out: list[dict] = []
    current = None
    in_heritage = False
    in_feats = False
    i = start
    while i < end:
        s = lines[i].strip()
        if not s:
            i += 1
            continue
        up = s.upper()
        if "HERITAGE" in up:
            in_heritage = True
            in_feats = False
            i += 1
            continue
        if up.startswith("FEATS") or "ANCESTRY FEATS" in up:
            in_feats = True
            in_heritage = False
            i += 1
            continue
        anc = _match_ancestry(s)
        section = bool(re.match(
            r"^(Humanos|Enanos \(Dwrvin\)|Elfos de|Halflings? de|Semi-Gigantes|Ghurim|K['’]rryl)(\b|$)",
            s, re.I,
        ))
        if anc and (s.isupper() or section or re.search(r"rasgos (de |raciales de )?ancestr|^ancestries\b", s, re.I)):
            current = anc
            in_heritage = False
            in_feats = False
        if in_heritage or in_feats or not current:
            i += 1
            continue
        if STAT_LINE_RE.match(s) or any(k in s.lower() for k in ANC_SKIP):
            i += 1
            continue
        if s.lower().startswith(("frequency", "prerequisite", "traits:", "rasgos:", "sacerdotes elementales", "estas tres")):
            i += 1
            continue
        m_bullet = re.match(r"^[\*\u2022\u00b7•\-]\s+([^:]{3,70}):\s*(.*)$", s)
        if m_bullet:
            name = m_bullet.group(1).strip()
            rest = m_bullet.group(2).strip()
            body = [rest] if rest else []
            j = i + 1
            while j < end and not rest:
                ls = lines[j].strip()
                cont = re.match(r"^[\*\u2022\u00b7•\-]\s+(?![^:]{3,70}:)(.+)$", ls)
                if not cont:
                    break
                body.append(cont.group(1).strip())
                j += 1
            blob = "\n".join(body).strip()
            if blob and MECH_RE.search(blob):
                out.append({"name": name, "ancestry": current, "content": blob})
                i = j if j > i + 1 else i + 1
                continue
            if rest and MECH_RE.search(s):
                out.append({"name": name, "ancestry": current, "content": rest})
                i += 1
                continue
        m_inline = re.match(r"^([^:]{3,70}):\s+(.{25,})$", s)
        if (
            m_inline
            and MECH_RE.search(m_inline.group(2))
            and not STAT_LINE_RE.match(s)
            and not m_inline.group(1).strip().startswith(("*", "•"))
        ):
            out.append({"name": m_inline.group(1).strip().lstrip("*•- ").strip(), "ancestry": current, "content": m_inline.group(2).strip()})
            i += 1
            continue
        if "ancestry features" in s.lower() or "habilidades ancestrales" in s.lower():
            i += 1
            continue
        if _looks_title(s) and i + 1 < end:
            nxt = lines[i + 1].strip()
            peek = "\n".join(lines[i + 1:i + 6])
            if nxt and not _looks_title(nxt) and MECH_RE.search(peek):
                body, j = [], i + 1
                while j < end:
                    ls = lines[j].strip()
                    if ls.upper().startswith("HERITAGE") or ls.upper().startswith("FEATS"):
                        break
                    if j > i + 1 and _looks_title(ls):
                        break
                    if STAT_LINE_RE.match(ls):
                        break
                    body.append(lines[j])
                    j += 1
                md = re.sub(r"\n{3,}", "\n\n", "\n".join(x.rstrip() for x in body)).strip()
                if len(md) > 20 and not any(k in s.lower() for k in ANC_SKIP):
                    out.append({"name": s, "ancestry": current, "content": md})
                i = j
                continue
        i += 1
    return out


def find_line(lines, pattern, start=0):
    rx = re.compile(pattern)
    for i in range(start, len(lines)):
        if rx.search(lines[i].strip()):
            return i
    return -1


def seed_homebrew_magic(conn, lines: list[str]) -> dict[str, int]:
    idx_magic = find_line(lines, r"^🪄 Magia$|^Magia$")
    if idx_magic < 0:
        idx_magic = find_line(lines, r"^La Magia en Elhoss")
    if idx_magic < 0:
        print("No se encontro seccion Magia")
        return {}

    idx_blood = find_line(lines, r"^Sorcerers Bloodlines", idx_magic)
    idx_magifoqi = find_line(lines, r"^Magifoqi$", idx_magic)
    idx_cosmos = find_line(lines, r"^Dominio del Cosmos", idx_magic)
    idx_part = find_line(lines, r"^Hechizos Particulares de Elhoss", idx_magic)
    idx_forb = find_line(lines, r"^Hechizos Prohibidos de Elhoss", idx_magic)

    spells: list[dict] = []
    if idx_cosmos > 0:
        end = idx_part if idx_part > 0 else (idx_forb if idx_forb > 0 else len(lines))
        spells.extend(parse_star_spells(lines, idx_cosmos, end))
    if idx_part > 0:
        end = idx_forb if idx_forb > 0 else len(lines)
        spells.extend(parse_named_spells(lines, idx_part, end))
    if idx_forb > 0:
        spells.extend(parse_named_spells(lines, idx_forb, min(len(lines), idx_forb + 400)))

    feats: list[dict] = []
    if idx_magifoqi > 0:
        end = find_line(lines, r"^Religiones en Elhoss", idx_magifoqi)
        feats.extend(parse_magifoqi_feats(lines, idx_magifoqi, end if end > 0 else len(lines)))

    bloods: list[dict] = []
    if idx_blood > 0:
        end = idx_magifoqi if idx_magifoqi > 0 else len(lines)
        bloods.extend(parse_bloodlines(lines, idx_blood + 1, end))

    exist_spells = _existing_names(conn, ("spell", "ritual"))
    exist_feats = _existing_names(conn, ("feat",))
    exist_opt = {
        r["name_lower"]
        for r in conn.execute("SELECT name_lower FROM srd_items WHERE type='class-option'")
    }

    n_spell = n_feat = n_blood = 0
    for sp in spells:
        if sp["name"].lower() in exist_spells:
            continue
        uid = f"elhoss:{sp['type']}:{_slug(sp['name'])}"
        data = {
            "house": True,
            "markdown": sp["markdown"],
            "statblock": sp["fields"],
            "name": sp["name"],
            "type": sp["type"],
            "trait": sp["traits"],
            "source": [HOUSE_SOURCE],
        }
        _upsert_item(
            conn, uid=uid, stored_type=sp["type"], name=sp["name"], level=sp["level"],
            category="", traits=sp["traits"], summary=sp["summary"], data=data,
            rarity=sp.get("rarity"),
        )
        exist_spells.add(sp["name"].lower())
        n_spell += 1

    for ft in feats:
        if ft["name"].lower() in exist_feats:
            continue
        uid = f"elhoss:feat:{_slug(ft['name'])}"
        data = {
            "house": True,
            "markdown": ft["markdown"],
            "statblock": ft["fields"],
            "name": ft["name"],
            "type": "feat",
            "trait": ft["traits"],
            "source": [HOUSE_SOURCE],
        }
        _upsert_item(
            conn, uid=uid, stored_type="feat", name=ft["name"], level=ft["level"],
            category=ft.get("category") or "class", traits=ft["traits"],
            summary=ft["summary"], data=data, rarity=ft.get("rarity"),
        )
        exist_feats.add(ft["name"].lower())
        n_feat += 1

    for bl in bloods:
        if bl["name"].lower() in exist_opt:
            continue
        uid = f"elhoss:bloodline:{_slug(bl['name'])}"
        data = {
            "house": True,
            "markdown": bl["markdown"],
            "name": bl["name"],
            "type": "sorcerer bloodline",
            "source": [HOUSE_SOURCE],
        }
        _upsert_item(
            conn, uid=uid, stored_type="class-option", name=bl["name"], level=1,
            category="sorcerer bloodline", traits=bl["traits"],
            summary=bl["summary"], data=data, rarity=bl.get("rarity"),
        )
        exist_opt.add(bl["name"].lower())
        n_blood += 1

    idx_rel = find_line(lines, r"^Religiones en Elhoss", idx_magic)
    exist_deity = _existing_names(conn, ("deity",))
    n_faith = n_domain = 0
    if idx_rel > 0:
        faith_end = idx_cosmos if idx_cosmos > 0 else len(lines)
        for faith in parse_cleric_faiths(lines, idx_rel, faith_end):
            if faith["name"].lower() in exist_deity:
                continue
            uid = f"elhoss:deity:{_slug(faith['name'])}"
            data = {
                "house": True,
                "markdown": faith["markdown"],
                "statblock": {
                    "Dominios": ", ".join(faith["domains"]),
                    "Arma favorecida": faith["weapon"],
                },
                "name": faith["name"],
                "type": "deity",
                "domain": faith["domains"],
                "source": [HOUSE_SOURCE],
            }
            _upsert_item(
                conn, uid=uid, stored_type="deity", name=faith["name"], level=None,
                category="elhoss", traits=["Divine"], summary=faith["summary"],
                data=data, rarity="uncommon",
            )
            exist_deity.add(faith["name"].lower())
            if not conn.execute(
                "SELECT 1 FROM house_rules WHERE kind='deity' AND title=?", (faith["name"],)
            ).fetchone():
                conn.execute(
                    "INSERT INTO house_rules (kind, title, content, data) VALUES (?,?,?,?)",
                    ("deity", faith["name"], faith["markdown"],
                     json.dumps({"domains": faith["domains"], "weapon": faith["weapon"]}, ensure_ascii=False)),
                )
            if faith["rasgo_name"] and faith["rasgo_body"]:
                rasgo_title = faith["rasgo_name"]
                if rasgo_title.lower() == "rasgo doctrinal":
                    rasgo_title = f"Rasgo doctrinal ({faith['name']})"
                if not conn.execute(
                    "SELECT 1 FROM house_rules WHERE kind='doctrine_trait' AND title=? AND json_extract(data,'$.deity')=?",
                    (rasgo_title, faith["name"]),
                ).fetchone():
                    conn.execute(
                        "INSERT INTO house_rules (kind, title, content, data) VALUES (?,?,?,?)",
                        ("doctrine_trait", rasgo_title, faith["rasgo_body"],
                         json.dumps({"deity": faith["name"], "level": 1}, ensure_ascii=False)),
                    )
            n_faith += 1

    cosmos = parse_cosmos_domain(lines, idx_cosmos, idx_part if idx_part > 0 else len(lines))
    if cosmos and cosmos["name"].lower() not in exist_opt:
        uid = f"elhoss:domain:{_slug(cosmos['name'])}"
        data = {
            "house": True,
            "markdown": cosmos["markdown"],
            "name": cosmos["name"],
            "type": "cleric domain",
            "source": [HOUSE_SOURCE],
        }
        _upsert_item(
            conn, uid=uid, stored_type="class-option", name=cosmos["name"], level=1,
            category="cleric domain", traits=cosmos["traits"],
            summary=cosmos["summary"], data=data, rarity="uncommon",
        )
        if not conn.execute(
            "SELECT 1 FROM house_rules WHERE kind='cleric_domain' AND title=?", (cosmos["name"],)
        ).fetchone():
            conn.execute(
                "INSERT INTO house_rules (kind, title, content, data) VALUES (?,?,?,?)",
                ("cleric_domain", cosmos["name"], cosmos["markdown"],
                 json.dumps({"level": 1}, ensure_ascii=False)),
            )
        n_domain += 1

    # Habilidades ancestrales innatas (no feats)
    n_anc = 0
    idx_anc = find_line(lines, r"^Ancestries de Elhoss")
    anc_end = find_line(lines, r"^Psi[oó]nica", idx_anc if idx_anc > 0 else 0)
    if anc_end < 0:
        anc_end = idx_magic if idx_magic > 0 else len(lines)
    specials = []
    if idx_anc > 0:
        specials.extend(parse_ancestry_specials(lines, idx_anc, anc_end))
    idx = 0
    while True:
        pos = find_line(lines, r"^Habilidades Ancestrales", idx)
        if pos < 0:
            break
        anc = None
        for b in range(pos, max(0, pos - 40), -1):
            a = _match_ancestry(lines[b])
            if a:
                anc = a
                break
        stop = find_line(lines, r"^HERITAGES|^FEATS", pos + 1)
        block_end = stop if stop > 0 else min(len(lines), pos + 80)
        specials.extend(parse_ancestry_innate(lines, pos + 1, block_end, anc or ""))
        idx = pos + 1
    seen_anc: set[tuple[str, str]] = set()
    for it in specials:
        anc_name = it.get("ancestry") or "Elhoss"
        key = (it["name"].lower(), anc_name.lower())
        if key in seen_anc:
            continue
        seen_anc.add(key)
        exists = conn.execute(
            "SELECT 1 FROM house_rules WHERE kind='ancestry_feature' AND title=? AND json_extract(data,'$.ancestry')=?",
            (it["name"], anc_name),
        ).fetchone()
        if exists:
            continue
        conn.execute(
            "INSERT INTO house_rules (kind, title, content, data) VALUES (?,?,?,?)",
            ("ancestry_feature", it["name"], it["content"],
             json.dumps({"ancestry": anc_name, "level": 1}, ensure_ascii=False)),
        )
        n_anc += 1

    print(
        f"Homebrew magia: {n_spell} conjuros, {n_feat} feats, {n_blood} bloodlines, "
        f"{n_faith} doctrinas, {n_domain} dominios, {n_anc} habilidades ancestrales (solo nuevos)"
    )
    return {
        "spells": n_spell, "feats": n_feat, "bloodlines": n_blood,
        "faiths": n_faith, "domains": n_domain, "ancestry_features": n_anc,
    }
