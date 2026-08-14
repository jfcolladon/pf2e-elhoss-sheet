"""Ingesta del documento de house rules de la campana (Elhoss Eastern Lands).

Fuente: el Word/Google Doc de la campana. Extrae:
- Poderes psionicos por disciplina y rank (parser estructurado)
- Tablas de Wild Talents (psionica salvaje estilo Dark Sun)
- Ancestrias custom (stats verificadas contra el doc)
- Secciones de referencia (creacion de personaje, psionica, magia, etc.)
"""
import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

import httpx

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.db import get_conn, init_db  # noqa: E402

DOC_ID = "16EmEq9_nEYG6o5xgtyvk1wodVfFIUD4E9Yf4qJuQLkM"
DOC_URL = f"https://docs.google.com/document/d/{DOC_ID}/export?format=txt"
LOCAL_FALLBACK = os.environ.get(
    "HOUSERULES_TXT",
    os.path.join(os.path.dirname(__file__), "..", "..", "data", "houserules.txt"),
)
LOCAL_DOCX = os.environ.get(
    "HOUSERULES_DOCX",
    os.path.join(os.path.dirname(__file__), "..", "..", "data", "elhoss-houserules.docx"),
)

DISCIPLINES = ["Egoism", "Force", "Mind", "Move", "Seer", "Soul"]

DISCIPLINE_INFO = {
    "Egoism": {"key_ability": "con", "primary_save": "fort", "skills": ["Acrobatics", "Athletics"],
               "foco": "Self-Enhancement: resistencia, regeneracion, supervivencia"},
    "Force": {"key_ability": "str", "primary_save": "ref", "skills": ["Acrobatics", "Stealth"],
              "foco": "Telekinesis: control fisico, dano, manipulacion"},
    "Move": {"key_ability": "dex", "primary_save": "ref", "skills": ["Acrobatics", "Stealth"],
             "foco": "Espacio-tiempo: movilidad, evasion"},
    "Seer": {"key_ability": "int", "primary_save": "will", "skills": ["Diplomacy", "Society"],
             "foco": "Precognicion: informacion, reaccion, deteccion"},
    "Soul": {"key_ability": "wis", "primary_save": "will", "skills": ["Diplomacy", "Occultism"],
             "foco": "Energia vital: curacion, maldiciones, vinculo espiritual"},
    "Mind": {"key_ability": "cha", "primary_save": "will", "skills": ["Diplomacy", "Occultism"],
             "foco": "Control mental: dominacion, sugestion, miedo"},
}

# Stats verificadas contra el documento (seccion Ancestries de Elhoss Eastern Lands)
CUSTOM_ANCESTRIES = [
    {"name": "Humano de Elhoss", "hp": 8, "size": "Medium", "speed": 25, "vision": "Normal",
     "traits": ["Human", "Humanoid"], "boosts": ["free", "free"], "flaw": None,
     "languages": "Lenguaje de los Mercaderes de las Dunas y un idioma regional"},
    {"name": "Dwrvin", "hp": 10, "size": "Medium", "speed": 25, "vision": "Darkvision 60ft",
     "traits": ["Dwarf", "Dwrvin", "Humanoid"], "boosts": ["con", "wis", "free"], "flaw": "cha",
     "languages": "Lenguaje de los Mercaderes de las Dunas, Dwrvin"},
    {"name": "Elfo de las Dunas (Thalan'doro)", "hp": 6, "size": "Medium", "speed": 30,
     "vision": "Low-Light Vision (doble distancia)",
     "traits": ["Elf", "Humanoid", "Thalan'doro"], "boosts": ["dex", "int", "free"], "flaw": "con",
     "languages": "Lenguaje de los Mercaderes de las Dunas"},
    {"name": "Ghurim", "hp": 10, "size": "Medium", "speed": 25, "vision": "Darkvision",
     "traits": ["Humanoid", "Ghurim", "Human", "Dwarf", "Dwrvin"], "boosts": ["str", "con", "free"],
     "flaw": None, "languages": "Lenguaje de los Mercaderes de las Dunas, Dwrvin"},
    {"name": "Elfo de Yolquipan", "hp": 6, "size": "Medium", "speed": 30, "vision": "Darkvision 60ft",
     "traits": ["Elf", "Yolquipan", "Humanoid"], "boosts": ["dex", "wis", "free"], "flaw": "con",
     "languages": "Lenguaje de los Mercaderes de las Dunas, Yolquipan"},
    {"name": "Halfling de Elhoss", "hp": 6, "size": "Small", "speed": 25, "vision": "Low-Light Vision",
     "traits": ["Humanoid", "Halfling"], "boosts": ["dex", "wis", "free"], "flaw": "str",
     "languages": "Lenguaje de los Mercaderes de las Dunas, Halfling"},
    {"name": "Semi-Gigante", "hp": 12, "size": "Large", "speed": 30, "vision": "Darkvision",
     "traits": ["Giant", "Humanoid"], "boosts": ["str", "con", "free"], "flaw": "dex",
     "languages": "Lenguaje de los Mercaderes de las Dunas y uno adicional"},
    {"name": "K'rryl", "hp": 8, "size": "Medium", "speed": 30, "vision": "Low-Light Vision",
     "traits": ["Humanoid", "K'rryl", "Psionic", "Cosmic"], "boosts": ["dex", "wis", "free"],
     "flaw": "int", "languages": "Lenguaje de los Mercaderes de las Dunas, K'rryl"},
]

# Rank no va en el cuerpo: si aparece, es el siguiente poder.
BODY_FIELD_KEYS = [
    "Traits", "Cost", "Actions", "Trigger", "Range",
    "Area and Targets", "Area and targets", "Area", "Targets", "Target",
    "Saving Throw and Duration", "Saving Throw", "Duration", "Difficulty",
]

SKIP_NAME_PREFIXES = (
    "Rank:", "Traits:", "Cost:", "Actions:", "Trigger:", "Range:",
    "Area", "Targets:", "Target:", "Saving Throw", "Duration:", "Heightened:", "Heightened (",
    "Foco:", "Debilidad:", "Narrativa:", "Difficulty:", "Key Ability:",
    "Poderes Rank", "Poderes de Rank", "Impulsos", "Disciplina ",
    "En combate", "Fuera de combate",
)

SECTION_HEADER_RE = re.compile(
    r"^(Poderes Rank\s+\d+|Poderes de Rank\s+\d+|Impulsos Psi[oó]nicos|"
    r"Disciplina (Egoism|Force|Mind|Move|Seer|Soul)|Tabla de Rank)\b"
)


def is_section_header(line: str) -> bool:
    s = line.strip()
    return bool(s) and bool(SECTION_HEADER_RE.match(s))

TIER_RE = re.compile(r"\((?:[^\w\s)]*\s*)?(Normal|Intense|Difficult)\)")
RANK_RE = re.compile(r"Rank:\s*([A-Za-z]+)\s*(\d+)")
TIER_WORD_RE = re.compile(r"(Normal|Intense|Difficult)")

# Campos de ficha, de mayor a menor, en el orden del manual.
# El export de Word pega Rank/Traits/Cost en un solo parrafo sin saltos.
FIELD_ORDER = [
    "Difficulty", "Rank", "Traits", "Cost", "Actions", "Trigger", "Range",
    "Area and Targets", "Area and targets", "Area", "Targets", "Target",
    "Saving Throw and Duration", "Duration", "Saving Throw",
]
NARRATIVE_LABELS = ["Debilidad", "Narrativa", "Foco"]
NARRATIVE_SPLIT_RE = re.compile(
    r"(?=(?:%s):)" % "|".join(re.escape(k) for k in NARRATIVE_LABELS)
)
EMPTY_FIELD_VALS = {"", "—", "-", "–", "−"}
W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def normalize_newlines(text: str) -> str:
    """Google Docs txt a veces usa \\r\\r\\n; universal newlines lo duplica en blancos."""
    return text.replace("\r\r\n", "\n").replace("\r\n", "\n").replace("\r", "\n")


def explode_stat_line(line: str) -> list[str]:
    """Parte 'Rank: Force 2 (Intense)Traits: PsionicCost: 6 PFP...' en campos.

    No parte el 'Cost:' que va dentro de Duration (mantenimiento).
    """
    s = line.strip()
    if not s:
        return []
    hits: list[int] = []
    pos = 0
    used: set[str] = set()
    duration_started = False
    while pos < len(s):
        found: tuple[int, str] | None = None
        for lab in FIELD_ORDER:
            token = lab + ":"
            i = s.find(token, pos)
            if i < 0:
                continue
            if duration_started and lab == "Cost":
                continue
            skip = False
            for longer in FIELD_ORDER:
                if longer == lab or not longer.endswith(lab):
                    continue
                plen = len(longer) - len(lab)
                if i >= plen and s[i - plen:i + len(token)] == longer + ":":
                    skip = True
                    break
            if skip:
                continue
            if found is None or i < found[0] or (i == found[0] and len(lab) > len(found[1])):
                found = (i, lab)
        if not found:
            break
        i, lab = found
        if lab in used and lab not in ("Area", "Targets", "Target"):
            pos = i + len(lab) + 1
            continue
        hits.append(i)
        used.add(lab)
        if lab in ("Duration", "Saving Throw and Duration"):
            duration_started = True
        pos = i + len(lab) + 1
    if len(hits) <= 1:
        return [s]
    parts = []
    if hits[0] > 0 and s[:hits[0]].strip():
        parts.append(s[:hits[0]].strip())
    for a, b in zip(hits, hits[1:] + [len(s)]):
        parts.append(s[a:b].strip())
    return parts


def explode_narrative_line(line: str) -> list[str]:
    s = line.strip()
    if not s:
        return []
    parts = [p.strip() for p in NARRATIVE_SPLIT_RE.split(s) if p.strip()]
    return parts or [s]


def clean_field_val(val: str) -> str:
    v = (val or "").strip()
    return "" if v in EMPTY_FIELD_VALS else v


def _w_text(el) -> str:
    return "".join(t.text or "" for t in el.iter(W_NS + "t"))


def _docx_table_lines(tbl) -> list[str]:
    rows = []
    for tr in tbl.findall(W_NS + "tr"):
        cells = []
        for tc in tr.findall(W_NS + "tc"):
            bits = [_w_text(p).strip() for p in tc.findall(W_NS + "p")]
            cells.append(" ".join(b for b in bits if b))
        if any(cells):
            rows.append(cells)
    if not rows:
        return []
    header = [c.strip() for c in rows[0]]
    if any(h.lower() == "poder" for h in header) and len(header) >= 3:
        out = []
        for row in rows:
            out.extend(row)
        return out
    if len(header) == 2 and len(rows) >= 2:
        out = []
        for a, b in rows:
            lab = a.rstrip(":")
            if b:
                out.append(f"{lab}: {b}" if lab else b)
            elif lab:
                out.append(f"{lab}:")
        return out
    ncols = max(len(r) for r in rows)
    for r in rows:
        while len(r) < ncols:
            r.append("")
    out = [
        "",
        "| " + " | ".join(rows[0]) + " |",
        "| " + " | ".join("---" for _ in rows[0]) + " |",
    ]
    for row in rows[1:]:
        out.append("| " + " | ".join(row) + " |")
    out.append("")
    return out


def extract_docx_lines(path: str) -> list[str]:
    """Word: nombres en Heading 4; la ficha suele ir pegada en un parrafo."""
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read("word/document.xml"))
    body = root.find(W_NS + "body")
    lines: list[str] = []
    for child in list(body):
        if child.tag == W_NS + "tbl":
            lines.extend(_docx_table_lines(child))
            continue
        if child.tag != W_NS + "p":
            continue
        t = _w_text(child).strip()
        if not t:
            lines.append("")
            continue
        parts = explode_stat_line(t)
        if len(parts) > 1:
            lines.extend(parts)
            continue
        if child.find(f"{W_NS}pPr/{W_NS}numPr") is not None and not t.startswith("*"):
            lines.append("* " + t)
        else:
            lines.append(t)
    return lines


def load_full_doc() -> str:
    """Documento completo (ancestrias, magia, etc.). El Word de poderes es otra pestana."""
    try:
        r = httpx.get(DOC_URL, timeout=120, follow_redirects=True)
        r.raise_for_status()
        text = r.content.decode("utf-8", errors="replace")
        if len(text) > 10000:
            print(f"House rules descargadas de Google Docs ({len(text)} chars)")
            return normalize_newlines(text)
    except Exception as e:  # noqa: BLE001
        print(f"No se pudo descargar el doc ({e}); usando copia local")
    with open(LOCAL_FALLBACK, encoding="utf-8", newline="") as f:
        return normalize_newlines(f.read())


def load_power_lines() -> list[str]:
    if os.path.isfile(LOCAL_DOCX):
        lines = extract_docx_lines(LOCAL_DOCX)
        if len(lines) > 100:
            print(f"Poderes desde Word ({len(lines)} lineas)")
            return lines
    return load_full_doc().split("\n")


def load_doc() -> str:
    if os.path.isfile(LOCAL_DOCX):
        lines = extract_docx_lines(LOCAL_DOCX)
        text = "\n".join(lines)
        if len(text) > 10000:
            print(f"House rules desde Word ({len(text)} chars, {len(lines)} lineas)")
            return text
    return load_full_doc()


def find_line(lines, pattern, start=0):
    rx = re.compile(pattern)
    for i in range(start, len(lines)):
        if rx.search(lines[i].strip()):
            return i
    return -1


def parse_body_field(line: str):
    for key in BODY_FIELD_KEYS:
        if line.startswith(key + ":"):
            return key, line[len(key) + 1:].strip()
    return None, None


def _next_content(lines, i, end):
    j = i
    while j < end:
        if lines[j].strip():
            return j
        j += 1
    return -1


def power_header_at(lines, i, end):
    """Nombre del poder, con 'Difficulty:' opcional entre el titulo y 'Rank:'."""
    name = lines[i].strip()
    if not name or len(name) > 80:
        return None
    if name.startswith("<") or name in ("—", "-"):
        return None
    if any(name.startswith(p) for p in SKIP_NAME_PREFIXES):
        return None
    j = _next_content(lines, i + 1, end)
    if j < 0:
        return None
    nxt = lines[j].strip()
    if nxt.startswith("Difficulty:"):
        j = _next_content(lines, j + 1, end)
        if j < 0:
            return None
        nxt = lines[j].strip()
    if nxt.startswith("Rank:") and RANK_RE.search(nxt):
        return name, j
    return None


def normalize_bullet(line: str) -> str:
    raw = line.rstrip()
    m = re.match(r"^[\s\u00a0]*[\*\u2022]\s+(.*)$", raw)
    if m:
        return "* " + m.group(1).strip()
    return raw.strip()


def assemble_description(desc_lines):
    """Orden fijo: efecto mecanico, luego Foco / Debilidad / Narrativa si tienen texto."""
    body = []
    foco = debilidad = narrativa = ""
    for ln in format_gdoc_tables(desc_lines):
        for chunk in explode_narrative_line(ln) or [ln]:
            s = chunk.strip()
            if s.startswith("Foco:"):
                foco = clean_field_val(s[5:])
                continue
            if s.startswith("Debilidad:"):
                debilidad = clean_field_val(s[10:])
                continue
            if s.startswith("Narrativa:"):
                narrativa = clean_field_val(s[10:])
                continue
            if s in ("—", "-", "Heightened: —", "Heightened: -"):
                continue
            if "escripci" in s.lower() and s.startswith("<"):
                continue
            if is_section_header(s):
                continue
            body.append(normalize_bullet(chunk))
    text = re.sub(r"\n{3,}", "\n\n", "\n".join(body)).strip()
    extras = []
    if foco:
        extras.append(f"**Foco:** {foco}")
    if debilidad:
        extras.append(f"**Debilidad:** {debilidad}")
    if narrativa:
        extras.append(f"**Narrativa:** {narrativa}")
    if extras:
        text = (text + "\n\n" + "\n".join(extras)).strip()
    return text


def apply_power_field(power, key, val):
    if key == "Saving Throw and Duration":
        if ";" in (val or ""):
            save_part, dur_part = val.split(";", 1)
            save_part, dur_part = clean_field_val(save_part), clean_field_val(dur_part)
            if save_part:
                power["save"] = save_part
            if dur_part:
                power["duration"] = dur_part
        else:
            v = clean_field_val(val)
            if v:
                power["save"] = v
        return
    v = clean_field_val(val)
    if key == "Difficulty":
        tm = TIER_WORD_RE.search(val or "")
        if tm and not power["tier"]:
            power["tier"] = tm.group(1)
        return
    if not v:
        return
    if key == "Traits":
        power["traits"] = v
    elif key == "Cost":
        power["cost_raw"] = v
        nums = re.findall(r"\d+", v)
        power["cost"] = int(nums[0]) if nums else None
    elif key == "Actions":
        power["actions"] = v
    elif key == "Trigger":
        power["trigger"] = v
    elif key == "Range":
        power["range"] = v
    elif key in ("Area and Targets", "Area and targets", "Area", "Targets", "Target"):
        power["area"] = (power["area"] + "; " + v).strip("; ")
    elif key == "Duration":
        power["duration"] = v
    elif key == "Saving Throw":
        power["save"] = v


def parse_powers(lines, start, end, discipline):
    """Un poder es un titulo seguido (opcionalmente de Difficulty:) de una linea Rank:."""
    powers = []
    i = start
    while i < end - 1:
        header = power_header_at(lines, i, end)
        if not header:
            i += 1
            continue
        name, rank_idx = header
        nxt = lines[rank_idx].strip()
        m = RANK_RE.search(nxt)
        rank = int(m.group(2))
        tier_m = TIER_RE.search(nxt)
        tier = tier_m.group(1) if tier_m else None
        if not tier:
            for k in range(i + 1, rank_idx):
                dm = TIER_WORD_RE.search(lines[k])
                if dm:
                    tier = dm.group(1)
                    break
        power = {
            "name": name, "discipline": discipline, "rank": rank, "tier": tier,
            "traits": "", "cost_raw": "", "cost": None, "actions": "",
            "range": "", "area": "", "duration": "", "save": "",
            "trigger": "", "description": [], "heightened": [],
        }
        for part in explode_stat_line(nxt):
            key, val = parse_body_field(part)
            if key:
                apply_power_field(power, key, val)
        j = rank_idx + 1
        in_fields = True
        in_heightened = False
        desc_lines = []
        while j < end:
            if power_header_at(lines, j, end):
                break
            ln = lines[j].strip()
            if is_section_header(ln):
                j += 1
                continue
            if ln.startswith("Heightened:") or ln.startswith("Heightened ("):
                in_fields = False
                in_heightened = True
                if not re.match(r"Heightened:\s*[—\-–]\s*$", ln):
                    power["heightened"].append(ln)
                j += 1
                continue
            if in_heightened and re.match(r"^[\s\u00a0]*[\*\u2022]\s+", lines[j]):
                power["heightened"].append(normalize_bullet(lines[j]))
                j += 1
                continue
            parts = explode_stat_line(ln) if ln else []
            first_key = parse_body_field(parts[0])[0] if parts else None
            if in_fields and first_key:
                for part in parts:
                    key, val = parse_body_field(part)
                    if not key:
                        if part:
                            in_fields = False
                            desc_lines.append(part)
                        continue
                    if not val.strip():
                        nxtc = _next_content(lines, j + 1, end)
                        if nxtc >= 0:
                            nln = lines[nxtc].strip()
                            nk, _ = parse_body_field(nln)
                            if (
                                nln
                                and not nk
                                and not nln.startswith("Heightened:")
                                and not nln.startswith("Heightened (")
                                and not is_section_header(nln)
                                and not power_header_at(lines, nxtc, end)
                            ):
                                val = nln
                                j = nxtc
                    apply_power_field(power, key, val)
                j += 1
                continue
            if ln:
                in_fields = False
                in_heightened = False
                if len(parts) > 1:
                    desc_lines.extend(parts)
                else:
                    desc_lines.append(lines[j])
            elif desc_lines:
                desc_lines.append("")
            j += 1
        power["description"] = assemble_description(desc_lines)
        power["heightened"] = "\n".join(power["heightened"]).strip()
        if power["description"] and "<Descripci" not in power["description"]:
            powers.append(power)
        i = j
    return powers


def parse_wild_talent_table(lines, header_idx, rank):
    """Tabla en celdas secuenciales: Poder / Tag / Cost PFP / Probabilidad."""
    cells = []
    i = header_idx + 1
    blanks = 0
    while i < len(lines):
        ln = lines[i].strip()
        if re.match(r"^Tabla de Rank", ln) or (blanks >= 2 and cells):
            break
        if not ln:
            blanks += 1
            i += 1
            continue
        blanks = 0
        cells.append(ln)
        i += 1
    # quitar encabezados
    while cells and cells[0] in ("Poder", "Tag", "Cost PFP", "Probabilidad"):
        cells.pop(0)
    entries = []
    for k in range(0, len(cells) - 3, 4):
        name, tag, cost, prob = cells[k], cells[k + 1], cells[k + 2], cells[k + 3]
        tier_m = re.search(r"(Normal|Intense|Difficult)", tag)
        cost_m = re.search(r"\d+", cost)
        prob_m = re.search(r"(\d+)\s*[-\u2013]\s*(\d+)", prob)
        if not prob_m:
            continue
        entries.append({
            "rank": rank, "name": name,
            "tier": tier_m.group(1) if tier_m else None,
            "cost": int(cost_m.group(0)) if cost_m else None,
            "prob_min": int(prob_m.group(1)), "prob_max": int(prob_m.group(2)),
        })
    return entries


def looks_like_table_data(cell: str) -> bool:
    s = cell.strip()
    return bool(s) and bool(re.match(r"^[+\-]?\d", s))


def infer_table_ncols(first: str, tab_cells: list[str]) -> int | None:
    """Cabecera = primera celda + celdas con tab hasta el primer valor numerico."""
    if len(tab_cells) < 2:
        return None
    headers = [first]
    for c in tab_cells:
        if looks_like_table_data(c) or len(c) > 60:
            break
        headers.append(c)
        if len(headers) > 12:
            break
    ncols = len(headers)
    if ncols < 2:
        return None
    if 1 + len(tab_cells) < ncols * 2:
        return None
    return ncols


def detect_gdoc_table(lines, i):
    """Google Docs txt: primera celda sin tab; el resto de celdas van con tab al inicio.
    El export a menudo inserta lineas en blanco entre celdas."""
    if lines[i].startswith("\t"):
        return None
    first = lines[i].strip()
    if not first:
        return None
    cells = [first]
    j = i + 1
    while j < len(lines):
        raw = lines[j]
        if not raw.strip():
            j += 1
            continue
        if raw.startswith("\t"):
            cells.append(raw.strip())
            j += 1
            continue
        break
    if len(cells) < 3:
        return None
    second = cells[1]
    ncols = None
    if first == "Disciplina" and second == "Key Ability":
        ncols = 6
    elif first == "Level" and second == "Gains":
        ncols = 2
    elif first == "Primary Discipline" and second == "Primary Save":
        ncols = 4
    elif first == "Level" and "Psionic Attack" in second:
        ncols = 2
    elif first == "Level" and second == "Improvement":
        ncols = 2
    elif first == "Level" and second == "Impulse":
        ncols = 11
    else:
        ncols = infer_table_ncols(cells[0], cells[1:])
    if not ncols:
        return None
    return ncols, cells, j


def cells_to_markdown_table(ncols, cells):
    while cells and cells[-1] == "":
        cells.pop()
    full = (len(cells) // ncols) * ncols
    leftover = cells[full:]
    rows = [cells[k:k + ncols] for k in range(0, full, ncols)]
    if not rows:
        return [], leftover
    header = rows[0]
    out = [
        "",
        "| " + " | ".join(header) + " |",
        "| " + " | ".join("---" for _ in header) + " |",
    ]
    for row in rows[1:]:
        while len(row) < ncols:
            row.append("")
        out.append("| " + " | ".join(row) + " |")
    out.append("")
    return out, leftover


def format_gdoc_tables(lines):
    out = []
    i = 0
    n = len(lines)
    while i < n:
        spec = detect_gdoc_table(lines, i)
        if spec:
            ncols, cells, nxt = spec
            table, leftover = cells_to_markdown_table(ncols, cells)
            out.extend(table)
            for cell in leftover:
                if cell:
                    out.append(cell)
            i = nxt
            continue
        out.append(normalize_bullet(lines[i]) if lines[i].strip() else "")
        i += 1
    return out


def section_text(lines, start, end):
    formatted = format_gdoc_tables(lines[start:end])
    return re.sub(r"\n{3,}", "\n\n", "\n".join(formatted)).strip()


PSIONIC_FEATURE_HEADINGS = [
    (r"^Naturaleza de los Poderes Psi[oó]nicos$", "Naturaleza de los Poderes Psiónicos", 1),
    (r"^Psionic Focus Points \(PFP\)$", "Psionic Focus Points (PFP)", 1),
    (r"^Key Ability por Disciplina$", "Key Ability por Disciplina", 1),
    (r"^Psionic Class Progression", "Progresión de clase Psiónico", 1),
    (r"^Nivel 1 — Fundación Mental$", "Fundación Mental", 1),
    (r"^Initial Proficiencies$", "Initial Proficiencies", 1),
    (r"^Powers$", "Poderes conocidos", 1),
    (r"^Psionic Proficiency Scaling$", "Psionic Proficiency Scaling", 1),
    (r"^Saving Throw Improvements$", "Saving Throw Improvements", 1),
    (r"^Poderes de Rank 0$", "Impulsos psiónicos (Rank 0)", 1),
]


def parse_psionic_class_features(lines, start, end, conn):
    """Caracteristicas de clase del manual psionico (no Psychic de AoN)."""
    hits = []
    for i in range(start, end):
        s = lines[i].strip()
        for rx, title, level in PSIONIC_FEATURE_HEADINGS:
            if re.match(rx, s):
                hits.append((i, title, level))
                break
    n = 0
    for idx, (pos, title, level) in enumerate(hits):
        stop = hits[idx + 1][0] if idx + 1 < len(hits) else end
        content = section_text(lines, pos + 1, stop)
        if not content or len(content) < 20:
            continue
        conn.execute(
            "INSERT INTO house_rules (kind, title, content, data) VALUES (?,?,?,?)",
            ("psionic_feature", title, content,
             json.dumps({"level": level, "class": "Psiónico"}, ensure_ascii=False)),
        )
        n += 1
    print(f"Características de clase Psiónico: {n}")


# Orden de chequeo: del mas especifico al mas general
ANCESTRY_KEYWORDS = [
    (("k'rryl", "k\u2019rryl", "krryl"), "K'rryl"),
    (("halfling",), "Halfling de Elhoss"),
    (("semi-gigante", "semigigante", "semi gigante"), "Semi-Gigante"),
    (("yolquipan",), "Elfo de Yolquipan"),
    (("thalan", "elfos de las dunas", "dunas"), "Elfo de las Dunas (Thalan'doro)"),
    (("ghurim",), "Ghurim"),
    (("dwrvin", "enanos"), "Dwrvin"),
    (("human", "humano"), "Humano de Elhoss"),
]

FEAT_LEVEL_RE = re.compile(r"FEATS?\s*[-\u2013]\s*LEVEL\s*(\d+)", re.IGNORECASE)


def match_ancestry(line: str):
    low = line.lower()
    for keys, name in ANCESTRY_KEYWORDS:
        if any(k in low for k in keys):
            return name
    return None


def looks_like_title(line: str) -> bool:
    s = line.strip()
    if not s or len(s) > 70:
        return False
    if s.startswith(("*", "\u2022", "-", "\u2013")):
        return False
    if s.endswith((".", ":", ",", "\u2026", ";")):
        return False
    low = s.lower()
    if low.startswith(("beneficio", "heritage effect", "traits", "rasgos", "prerequisite",
                        "frequency", "ejemplo", "ejemplos", "obtienes", "recibes", "elige",
                        "adem\u00e1s", "ademas")):
        return False
    if s.startswith("Heritage Ghurim") or s.startswith("Heritage \u2013") or s.startswith("Heritage -"):
        return False
    return True


def parse_heritages_and_feats(lines, start, end, conn):
    """Recorre la seccion de ancestries y extrae:
    - Heritages: bloque que contiene 'Beneficio Mecanico' o 'Heritage Effect:'.
    - Ancestry feats: bajo encabezados 'FEATS - LEVEL N', cada feat es la linea
      previa a una linea 'Traits:'/'Rasgos:'.
    Asocia cada entrada a la ancestry segun el ultimo encabezado de seccion."""
    current_anc = None
    current_feat_level = None
    in_feats = False
    heritages = 0
    feats = 0

    def stop_back(idx):
        s = lines[idx].strip()
        return (s == "" or s == "\t" or set(s) <= {"_"} or s.isupper() and len(s) > 3)

    for i in range(start, end):
        raw = lines[i]
        s = raw.strip()
        if not s:
            continue

        # Cambios de contexto por encabezados de seccion
        is_header = s.isupper() or any(
            h in s.upper() for h in ("HERITAGE", "ANCESTRY FEAT")
        )
        if is_header:
            anc = match_ancestry(s)
            if anc and ("HERITAGE" in s.upper() or "ANCESTRY FEAT" in s.upper() or s.isupper()):
                current_anc = anc
            in_feats = "ANCESTRY FEAT" in s.upper() or "FEATS" in s.upper()

        # Encabezado de nivel de feats
        m = FEAT_LEVEL_RE.search(s)
        if m:
            current_feat_level = int(m.group(1))
            in_feats = True
            continue

        # Heritage: anclas
        if s == "Beneficio Mec\u00e1nico" or s.startswith("Heritage Effect"):
            # buscar nombre hacia atras
            name = None
            j = i - 1
            steps = 0
            while j >= start and steps < 8:
                if stop_back(j):
                    break
                if looks_like_title(lines[j]):
                    name = lines[j].strip()
                    break
                j -= 1
                steps += 1
            if name and current_anc:
                # descripcion: hasta el proximo titulo/encabezado
                desc_lines = []
                k = i
                while k < end and k < i + 25:
                    ls = lines[k].strip()
                    if k > i and (ls == "Beneficio Mec\u00e1nico" or ls.startswith("Heritage Effect")):
                        break
                    if k > i + 1 and looks_like_title(lines[k]) and match_ancestry(lines[k]) is None:
                        # posible siguiente heritage; cortar si seguido de ancla
                        nxt = next((lines[x].strip() for x in range(k + 1, min(end, k + 6)) if lines[x].strip()), "")
                        if nxt == "Beneficio Mec\u00e1nico" or nxt.startswith("Heritage Effect") or nxt.startswith("Heritage"):
                            break
                    if ls.isupper() and len(ls) > 4:
                        break
                    desc_lines.append(lines[k].rstrip())
                    k += 1
                conn.execute(
                    "INSERT INTO house_rules (kind, title, content, data) VALUES (?,?,?,?)",
                    ("heritage", name, "\n".join(desc_lines).strip(),
                     json.dumps({"ancestry": current_anc}, ensure_ascii=False)),
                )
                heritages += 1
            continue

        # Ancestry feat: linea previa a "Traits:"/"Rasgos:"
        if in_feats and (s.startswith("Traits:") or s.startswith("Rasgos:")):
            # el nombre es la linea no vacia anterior
            j = i - 1
            while j >= start and not lines[j].strip():
                j -= 1
            name = lines[j].strip() if j >= start else None
            if name and looks_like_title(lines[j]) and current_anc:
                desc_lines = []
                k = i  # incluir traits
                while k < end and k < i + 20:
                    ls = lines[k].strip()
                    if k > i and (ls.startswith("Traits:") or ls.startswith("Rasgos:")):
                        break
                    if k > i and FEAT_LEVEL_RE.search(ls):
                        break
                    if k > i and ls.isupper() and len(ls) > 4:
                        break
                    # corte si la siguiente linea es nombre de feat (seguido de Traits)
                    if k > i and looks_like_title(lines[k]):
                        nxt = next((lines[x].strip() for x in range(k + 1, min(end, k + 4)) if lines[x].strip()), "")
                        if nxt.startswith("Traits:") or nxt.startswith("Rasgos:"):
                            break
                    desc_lines.append(lines[k].rstrip())
                    k += 1
                conn.execute(
                    "INSERT INTO house_rules (kind, title, content, data) VALUES (?,?,?,?)",
                    ("ancestry_feat", name, "\n".join(desc_lines).strip(),
                     json.dumps({"ancestry": current_anc, "level": current_feat_level or 1},
                                ensure_ascii=False)),
                )
                feats += 1
            continue

    print(f"Heritages custom: {heritages} | Ancestry feats custom: {feats}")


def main():
    conn = get_conn()
    init_db(conn)
    power_lines = load_power_lines()
    full_lines = load_full_doc().split("\n")

    conn.execute("DELETE FROM wild_talent_entries")
    conn.execute("DELETE FROM house_rules")

    # --- Poderes: Word de campana (ficha Rank/Traits/Cost) ---
    idx_psionics = find_line(power_lines, r"^Psi\u00f3nica & Psi\u00f3nicos en Elhoss")
    idx_wild = find_line(power_lines, r"^Wild Talents$", idx_psionics if idx_psionics > 0 else 0)
    idx_first_disc = find_line(
        power_lines, r"^Disciplina (Egoism|Force|Mind|Move|Seer|Soul)$",
        idx_psionics if idx_psionics > 0 else 0,
    )

    disc_bounds = []
    pos = idx_first_disc
    while pos >= 0:
        m = re.match(r"^Disciplina (\w+)$", power_lines[pos].strip())
        nxt = find_line(power_lines, r"^Disciplina (Egoism|Force|Mind|Move|Seer|Soul)$", pos + 1)
        end = nxt if nxt > 0 else (idx_wild if idx_wild > 0 else len(power_lines))
        disc_bounds.append((m.group(1), pos, end))
        pos = nxt

    all_powers = []
    for disc, s, e in disc_bounds:
        powers = parse_powers(power_lines, s, e, disc)
        all_powers.extend(powers)
        print(f"Disciplina {disc}: {len(powers)} poderes")

    existing = {
        (r["name_lower"], r["discipline"], r["rank"]): r["id"]
        for r in conn.execute("SELECT id, name_lower, discipline, rank FROM psionic_powers")
    }
    seen: set[tuple] = set()
    inserted = updated = 0
    for p in all_powers:
        key = (p["name"].lower(), p["discipline"], p["rank"])
        seen.add(key)
        vals = (
            p["name"], p["name"].lower(), p["discipline"], p["rank"], p["tier"], p["cost_raw"],
            p["cost"], p["actions"], p["range"], p["area"], p["duration"], p["save"],
            p["trigger"], p["traits"], p["description"], p["heightened"],
        )
        if key in existing:
            conn.execute(
                """UPDATE psionic_powers SET name=?, name_lower=?, discipline=?, rank=?, tier=?,
                   cost_raw=?, cost=?, actions=?, range=?, area=?, duration=?, save=?, trigger=?,
                   traits=?, description=?, heightened=? WHERE id=?""",
                (*vals, existing[key]),
            )
            updated += 1
        else:
            conn.execute(
                """INSERT INTO psionic_powers
                   (name, name_lower, discipline, rank, tier, cost_raw, cost, actions, range, area,
                    duration, save, trigger, traits, description, heightened)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                vals,
            )
            inserted += 1
    obsolete = [pid for key, pid in existing.items() if key not in seen]
    for pid in obsolete:
        conn.execute("DELETE FROM psionic_powers WHERE id=?", (pid,))
    print(f"Poderes: {len(all_powers)} (nuevos {inserted}, actualizados {updated}, bajas {len(obsolete)})")

    # --- Wild talents (en el Word de psionica) ---
    wt_entries = []
    for rank in (0, 1, 2):
        hidx = find_line(power_lines, rf"^Tabla de Rank {rank}$", idx_wild if idx_wild > 0 else 0)
        if hidx > 0:
            wt_entries.extend(parse_wild_talent_table(power_lines, hidx, rank))
    conn.executemany(
        """INSERT INTO wild_talent_entries (rank, name, tier, cost, prob_min, prob_max)
           VALUES (?,?,?,?,?,?)""",
        [(w["rank"], w["name"], w["tier"], w["cost"], w["prob_min"], w["prob_max"]) for w in wt_entries],
    )
    print(f"Wild talents: {len(wt_entries)} entradas de tabla")

    # --- Ancestrias / magia: documento completo ---
    idx_ancestries = find_line(full_lines, r"^Ancestries de Elhoss")
    idx_full_psionics = find_line(full_lines, r"^Psi\u00f3nica & Psi\u00f3nicos en Elhoss")
    idx_full_wild = find_line(full_lines, r"^Wild Talents$", idx_full_psionics if idx_full_psionics > 0 else 0)
    idx_magic = find_line(full_lines, r"^Magia$", idx_full_wild if idx_full_wild > 0 else 0)

    if idx_ancestries > 0:
        anc_end = idx_full_psionics if idx_full_psionics > 0 else len(full_lines)
        parse_heritages_and_feats(full_lines, idx_ancestries, anc_end, conn)

    for a in CUSTOM_ANCESTRIES:
        conn.execute(
            "INSERT INTO house_rules (kind, title, content, data) VALUES (?,?,?,?)",
            ("ancestry", a["name"],
             f"HP {a['hp']} | {a['size']} | Speed {a['speed']} ft | {a['vision']} | "
             f"Boosts: {', '.join(a['boosts'])}" + (f" | Flaw: {a['flaw']}" if a["flaw"] else "") +
             f" | Traits: {', '.join(a['traits'])} | Idiomas: {a['languages']}",
             json.dumps(a, ensure_ascii=False)),
        )

    if idx_psionics >= 0 and idx_first_disc > idx_psionics:
        parse_psionic_class_features(power_lines, idx_psionics, idx_first_disc, conn)

    for d, info in DISCIPLINE_INFO.items():
        conn.execute(
            "INSERT INTO house_rules (kind, title, content, data) VALUES (?,?,?,?)",
            ("discipline", d, info["foco"], json.dumps(info, ensure_ascii=False)),
        )

    sections = []
    if idx_ancestries > 0:
        sections.append(("reference", "Creación de Personaje (House Rules)", full_lines, 0, idx_ancestries))
        if idx_full_psionics > 0:
            sections.append(("reference", "Ancestrías de Elhoss", full_lines, idx_ancestries, idx_full_psionics))
    if idx_first_disc > 0:
        sections.append(("reference", "Psiónica: Reglas Generales", power_lines, idx_psionics, idx_first_disc))
    if idx_wild > 0:
        sections.append(("reference", "Wild Talents (Psiónica Salvaje)", power_lines, idx_wild, len(power_lines)))
    elif idx_full_wild > 0:
        end_wild = idx_magic if idx_magic > 0 else len(full_lines)
        sections.append(("reference", "Wild Talents (Psiónica Salvaje)", full_lines, idx_full_wild, end_wild))
    if idx_magic > 0:
        sections.append(("reference", "Magia y Leylines", full_lines, idx_magic, len(full_lines)))
    for kind, title, src, s, e in sections:
        conn.execute(
            "INSERT INTO house_rules (kind, title, content, data) VALUES (?,?,?,NULL)",
            (kind, title, section_text(src, s, e)),
        )
    print(f"Secciones de referencia: {len(sections)}")

    conn.commit()
    conn.close()


if __name__ == "__main__":
    main()
