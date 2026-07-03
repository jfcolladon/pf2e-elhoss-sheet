"""Manuales autorizados para la campaña (nombres en AoN legacy, minusculas).

Corresponden a los PDFs en:
https://drive.google.com/drive/u/0/folders/1CveoM7PWlSF8GWE16UltayP_3SzYLin_
"""

# Nombres exactos tal como aparecen en el campo `source` de Archives of Nethys (legacy).
ALLOWED_SOURCES: frozenset[str] = frozenset({
    "core rulebook",
    "advanced player's guide",
    "bestiary",
    "bestiary 2",
    "bestiary 3",
    "book of the dead",
    "dark archive",
    "gamemastery guide",
    "guns & gears",
    "secrets of magic",
})

# Etiquetas legibles para la UI / documentacion.
ALLOWED_SOURCE_LABELS: list[str] = [
    "Core Rulebook",
    "Advanced Player's Guide",
    "Bestiary",
    "Bestiary 2",
    "Bestiary 3",
    "Book of the Dead",
    "Dark Archive",
    "Gamemastery Guide",
    "Guns & Gears",
    "Secrets of Magic",
]

ALLOWED_SOURCES_SUMMARY = " · ".join(ALLOWED_SOURCE_LABELS)


def is_allowed_source(sources) -> bool:
    """True si al menos una fuente del item esta en la lista autorizada."""
    if isinstance(sources, str):
        sources = [sources]
    if not sources:
        return False
    return any(s.strip().lower() in ALLOWED_SOURCES for s in sources)
