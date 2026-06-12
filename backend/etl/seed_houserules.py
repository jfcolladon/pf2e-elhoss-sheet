"""Ingesta del documento de house rules de la campana (Elhoss Eastern Lands).

Fuente unica: Google Doc exportado como texto. Extrae:
- Poderes psionicos por disciplina y rank (parser estructurado)
- Tablas de Wild Talents (psionica salvaje estilo Dark Sun)
- Ancestrias custom (stats verificadas contra el doc)
- Secciones de referencia (creacion de personaje, psionica, magia, etc.)
"""
import json
import os
import re
import sys

import httpx

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.db import get_conn, init_db  # noqa: E402

DOC_ID = "16EmEq9_nEYG6o5xgtyvk1wodVfFIUD4E9Yf4qJuQLkM"
DOC_URL = f"https://docs.google.com/document/d/{DOC_ID}/export?format=txt"
LOCAL_FALLBACK = os.environ.get(
    "HOUSERULES_TXT",
    os.path.join(os.path.dirname(__file__), "..", "..", "data", "houserules.txt"),
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
     "languages": "Common y un idioma regional"},
    {"name": "Dwrvin", "hp": 10, "size": "Medium", "speed": 25, "vision": "Darkvision 60ft",
     "traits": ["Dwarf", "Dwrvin", "Humanoid"], "boosts": ["con", "wis", "free"], "flaw": "cha",
     "languages": "Common, Dwrvin"},
    {"name": "Elfo de las Dunas (Thalan'doro)", "hp": 6, "size": "Medium", "speed": 30,
     "vision": "Low-Light Vision (doble distancia)",
     "traits": ["Elf", "Humanoid", "Thalan'doro"], "boosts": ["dex", "int", "free"], "flaw": "con",
     "languages": "Common, Lenguaje de los Mercaderes de las Dunas"},
    {"name": "Ghurim", "hp": 10, "size": "Medium", "speed": 25, "vision": "Darkvision",
     "traits": ["Humanoid", "Ghurim", "Human", "Dwarf", "Dwrvin"], "boosts": ["str", "con", "free"],
     "flaw": None, "languages": "Common, Dwrvin, Lenguaje de los Mercaderes de las Dunas"},
    {"name": "Elfo de Yolquipan", "hp": 6, "size": "Medium", "speed": 30, "vision": "Darkvision 60ft",
     "traits": ["Elf", "Yolquipan", "Humanoid"], "boosts": ["dex", "wis", "free"], "flaw": "con",
     "languages": "Common, Yolquipan"},
    {"name": "Halfling de Elhoss", "hp": 6, "size": "Small", "speed": 25, "vision": "Low-Light Vision",
     "traits": ["Humanoid", "Halfling"], "boosts": ["dex", "wis", "free"], "flaw": "str",
     "languages": "Common, Halfling, Lenguaje de los Mercaderes de las Dunas"},
    {"name": "Semi-Gigante", "hp": 12, "size": "Large", "speed": 30, "vision": "Darkvision",
     "traits": ["Giant", "Humanoid"], "boosts": ["str", "con", "free"], "flaw": "dex",
     "languages": "Common y uno adicional"},
    {"name": "K'rryl", "hp": 8, "size": "Medium", "speed": 30, "vision": "Low-Light Vision",
     "traits": ["Humanoid", "K'rryl", "Psionic", "Cosmic"], "boosts": ["dex", "wis", "free"],
     "flaw": "int", "languages": "Common, K'rryl"},
]

FIELD_KEYS = [
    "Rank", "Traits", "Cost", "Actions", "Trigger", "Range",
    "Area and Targets", "Area and targets", "Area", "Targets",
    "Saving Throw and Duration", "Saving Throw", "Duration",
]

TIER_RE = re.compile(r"\((?:[^\w\s)]*\s*)?(Normal|Intense|Difficult)\)")
RANK_RE = re.compile(r"Rank:\s*([A-Za-z]+)\s*(\d+)")


def load_doc() -> str:
    try:
        r = httpx.get(DOC_URL, timeout=120, follow_redirects=True)
        r.raise_for_status()
        text = r.content.decode("utf-8", errors="replace")
        if len(text) > 10000:
            print(f"House rules descargadas de Google Docs ({len(text)} chars)")
            return text
    except Exception as e:  # noqa: BLE001
        print(f"No se pudo descargar el doc ({e}); usando copia local")
    with open(LOCAL_FALLBACK, encoding="utf-8") as f:
        return f.read()


def find_line(lines, pattern, start=0):
    rx = re.compile(pattern)
    for i in range(start, len(lines)):
        if rx.search(lines[i].strip()):
            return i
    return -1


def parse_field_line(line: str):
    for key in FIELD_KEYS:
        if line.startswith(key + ":"):
            return key, line[len(key) + 1:].strip()
    return None, None


def parse_powers(lines, start, end, discipline):
    """Un poder comienza en una linea cuyo siguiente renglon empieza con 'Rank:'."""
    powers = []
    i = start
    while i < end - 1:
        name = lines[i].strip()
        nxt = lines[i + 1].strip()
        if name and not name.startswith("Rank:") and nxt.startswith("Rank:") and RANK_RE.search(nxt):
            m = RANK_RE.search(nxt)
            rank = int(m.group(2))
            tier_m = TIER_RE.search(nxt)
            power = {
                "name": name, "discipline": discipline, "rank": rank,
                "tier": tier_m.group(1) if tier_m else None,
                "traits": "", "cost_raw": "", "cost": None, "actions": "",
                "range": "", "area": "", "duration": "", "save": "",
                "trigger": "", "description": [], "heightened": [],
            }
            j = i + 2
            in_fields = True
            while j < end:
                ln = lines[j].strip()
                # siguiente poder
                if j + 1 < end and ln and not ln.startswith(("Rank:", "Heightened")) \
                        and lines[j + 1].strip().startswith("Rank:") and RANK_RE.search(lines[j + 1].strip()):
                    break
                key, val = parse_field_line(ln)
                if in_fields and key:
                    if key == "Traits":
                        power["traits"] = val
                    elif key == "Cost":
                        power["cost_raw"] = val
                        nums = re.findall(r"\d+", val)
                        power["cost"] = int(nums[0]) if nums else None
                    elif key == "Actions":
                        power["actions"] = val
                    elif key == "Trigger":
                        power["trigger"] = val
                    elif key == "Range":
                        power["range"] = val
                    elif key in ("Area and Targets", "Area and targets", "Area", "Targets"):
                        power["area"] = (power["area"] + " " + val).strip()
                    elif key == "Duration":
                        power["duration"] = val
                    elif key == "Saving Throw":
                        power["save"] = val
                    elif key == "Saving Throw and Duration":
                        power["save"] = val
                elif ln.startswith("Heightened"):
                    in_fields = False
                    power["heightened"].append(ln)
                elif ln.startswith(("Foco:", "Debilidad:", "Narrativa:")):
                    in_fields = False
                    power["description"].append(ln)
                elif ln:
                    in_fields = False
                    power["description"].append(lines[j].rstrip())
                j += 1
            power["description"] = "\n".join(power["description"]).strip()
            power["heightened"] = "\n".join(power["heightened"]).strip()
            if power["description"] != "<Descripción>" and "<Descripci" not in power["description"]:
                powers.append(power)
            i = j
        else:
            i += 1
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


def section_text(lines, start, end):
    return "\n".join(lines[start:end]).strip()


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
    text = load_doc()
    lines = text.split("\n")

    conn.execute("DELETE FROM psionic_powers")
    conn.execute("DELETE FROM wild_talent_entries")
    conn.execute("DELETE FROM house_rules")

    # --- Limites de secciones principales ---
    idx_ancestries = find_line(lines, r"^Ancestries de Elhoss")
    idx_psionics = find_line(lines, r"^Psi\u00f3nica & Psi\u00f3nicos en Elhoss")
    idx_wild = find_line(lines, r"^Wild Talents$", idx_psionics)
    # la primera "Disciplina X" despues del inicio de psionica
    idx_first_disc = find_line(lines, r"^Disciplina (Egoism|Force|Mind|Move|Seer|Soul)$", idx_psionics)
    idx_magic = find_line(lines, r"^Magia$", idx_wild if idx_wild > 0 else 0)

    # --- Poderes por disciplina ---
    disc_bounds = []
    pos = idx_first_disc
    while pos >= 0:
        m = re.match(r"^Disciplina (\w+)$", lines[pos].strip())
        nxt = find_line(lines, r"^Disciplina (Egoism|Force|Mind|Move|Seer|Soul)$", pos + 1)
        end = nxt if nxt > 0 else (idx_wild if idx_wild > 0 else len(lines))
        disc_bounds.append((m.group(1), pos, end))
        pos = nxt

    all_powers = []
    for disc, s, e in disc_bounds:
        powers = parse_powers(lines, s, e, disc)
        all_powers.extend(powers)
        print(f"Disciplina {disc}: {len(powers)} poderes")

    conn.executemany(
        """INSERT INTO psionic_powers
           (name, name_lower, discipline, rank, tier, cost_raw, cost, actions, range, area,
            duration, save, trigger, traits, description, heightened)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        [(p["name"], p["name"].lower(), p["discipline"], p["rank"], p["tier"], p["cost_raw"],
          p["cost"], p["actions"], p["range"], p["area"], p["duration"], p["save"],
          p["trigger"], p["traits"], p["description"], p["heightened"]) for p in all_powers],
    )

    # --- Wild talents ---
    wt_entries = []
    for rank in (0, 1, 2):
        hidx = find_line(lines, rf"^Tabla de Rank {rank}$", idx_wild if idx_wild > 0 else 0)
        if hidx > 0:
            wt_entries.extend(parse_wild_talent_table(lines, hidx, rank))
    conn.executemany(
        """INSERT INTO wild_talent_entries (rank, name, tier, cost, prob_min, prob_max)
           VALUES (?,?,?,?,?,?)""",
        [(w["rank"], w["name"], w["tier"], w["cost"], w["prob_min"], w["prob_max"]) for w in wt_entries],
    )
    print(f"Wild talents: {len(wt_entries)} entradas de tabla")

    # --- Heritages y ancestry feats custom ---
    if idx_ancestries > 0:
        anc_end = idx_psionics if idx_psionics > 0 else len(lines)
        parse_heritages_and_feats(lines, idx_ancestries, anc_end, conn)

    # --- Ancestrias custom ---
    for a in CUSTOM_ANCESTRIES:
        conn.execute(
            "INSERT INTO house_rules (kind, title, content, data) VALUES (?,?,?,?)",
            ("ancestry", a["name"],
             f"HP {a['hp']} | {a['size']} | Speed {a['speed']} ft | {a['vision']} | "
             f"Boosts: {', '.join(a['boosts'])}" + (f" | Flaw: {a['flaw']}" if a["flaw"] else "") +
             f" | Traits: {', '.join(a['traits'])} | Idiomas: {a['languages']}",
             json.dumps(a, ensure_ascii=False)),
        )

    # --- Info de disciplinas ---
    for d, info in DISCIPLINE_INFO.items():
        conn.execute(
            "INSERT INTO house_rules (kind, title, content, data) VALUES (?,?,?,?)",
            ("discipline", d, info["foco"], json.dumps(info, ensure_ascii=False)),
        )

    # --- Secciones de referencia ---
    sections = []
    if idx_ancestries > 0:
        sections.append(("reference", "Creación de Personaje (House Rules)", 0, idx_ancestries))
    if idx_psionics > 0:
        sections.append(("reference", "Ancestrías de Elhoss", idx_ancestries, idx_psionics))
    if idx_first_disc > 0:
        sections.append(("reference", "Psiónica: Reglas Generales", idx_psionics, idx_first_disc))
    if idx_wild > 0:
        end_wild = idx_magic if idx_magic > 0 else len(lines)
        sections.append(("reference", "Wild Talents (Psiónica Salvaje)", idx_wild, end_wild))
    if idx_magic > 0:
        sections.append(("reference", "Magia y Leylines", idx_magic, len(lines)))
    for kind, title, s, e in sections:
        conn.execute(
            "INSERT INTO house_rules (kind, title, content, data) VALUES (?,?,?,NULL)",
            (kind, title, section_text(lines, s, e)),
        )
    print(f"Secciones de referencia: {len(sections)}")

    conn.commit()
    conn.close()


if __name__ == "__main__":
    main()
