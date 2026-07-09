# Contexto del proyecto — Hoja de personaje PF2e Elhoss Eastern Lands

> **Para retomar:** menciona este archivo con `@CONTEXT.md` al inicio de cualquier chat nuevo.
> Repositorio público: https://github.com/jfcolladon/pf2e-elhoss-sheet
> App en Docker: http://localhost:8080

---

## 1. Qué es el proyecto

Hoja de personaje interactiva para **Pathfinder Segunda Edición (legacy)** usada en la campaña **Elhoss Eastern Lands**. Es una SPA React + API FastAPI + SQLite corriendo en Docker.

**Características clave:**
- Carga y guarda personajes (backend SQLite con auto-save cada 1,2 s).
- Calcula automáticamente skills, bonus de ataque, CA, HP, tiradas de salvación.
- Catálogo SRD completo de Archives of Nethys (27 099 ítems), filtrado por manuales autorizados.
- House rules desde Google Docs (psiónica, wild talents, ancestries custom).
- Múltiples fuentes de conjuros (clase principal + dedications de archetype).
- Lógica de musas de Bardo (obligatorias, Multifarious Muse da una segunda).
- Pestaña de notas de campaña (NPCs, lugares, facciones, rumores, etc.).
- Modo DM para ver todos los campos sin restricciones.

---

## 2. Fuentes de reglas

| Fuente | Uso |
|--------|-----|
| [Archives of Nethys legacy](https://2e.aonprd.com) | SRD vía Elasticsearch en `elasticsearch.aonprd.com:9200` |
| [House rules Google Doc](https://docs.google.com/document/d/16EmEq9_nEYG6o5xgtyvk1wodVfFIUD4E9Yf4qJuQLkM/edit) | Psiónica, wild talents, ancestries custom Elhoss |
| [Manuales autorizados (Drive)](https://drive.google.com/drive/u/0/folders/1CveoM7PWlSF8GWE16UltayP_3SzYLin_) | CRB · APG · Bestiary 1-3 · Book of the Dead · Dark Archive · GMG · Guns & Gears · Secrets of Magic |

Todo contenido fuera de esos manuales aparece como "No permitido" con checkbox de aprobación DM.

---

## 3. Arquitectura

```
d:\Pathfinder personaje\
├── Dockerfile              # 3 etapas: frontend build → seed DB → imagen final
├── docker-compose.yml      # puerto 8080:8000, volumen pf2e_data:/data
├── VERSION                 # 1.3.0
├── CHANGELOG.md
├── README.md
├── data/
│   └── houserules.txt      # copia local del Google Doc (fallback ETL)
├── backend/
│   ├── requirements.txt    # fastapi 0.115.12 · uvicorn 0.34.2 · httpx 0.28.1
│   ├── app/
│   │   ├── main.py         # FastAPI app (version="1.3.0"), endpoints REST + sirve /static
│   │   ├── db.py           # SQLite schema + get_conn()
│   │   ├── allowed_sources.py  # ALLOWED_SOURCES frozenset (10 manuales)
│   │   └── __init__.py
│   └── etl/
│       ├── seed_aon.py         # Fetch AoN Elasticsearch → srd_items (27 099 items)
│       ├── seed_houserules.py  # Parsea Google Doc → psionic_powers, wild_talent_entries, house_rules
│       ├── refresh_catalog.py  # Re-copia tablas catalog desde /seed/app.db al volumen persistente (sin tocar characters)
│       └── __init__.py
└── frontend/
    ├── package.json        # pf2e-elhoss-sheet v1.3.0 · React 18 · Vite 5 · TypeScript
    ├── vite.config.ts      # proxy /api → localhost:8000
    ├── index.html          # Google Fonts: Cinzel + Crimson Text
    └── src/
        ├── main.tsx            # ReactDOM + React Router
        ├── App.tsx             # Layout: topbar (versión + manuales autorizados) + <Outlet>
        ├── api.ts              # Cliente HTTP: catalog, houserules, character CRUD
        ├── types.ts            # Interfaces TS: Character, CampaignNote, FeatEntry, etc.
        ├── version.ts          # APP_VERSION = "1.3.0"
        ├── styles.css          # Tema PF2e (colores Cinzel/parchment), nota-cards, etc.
        ├── pages/
        │   ├── CharacterList.tsx   # Lista de personajes
        │   ├── Sheet.tsx           # Vista principal: tabs + auto-save + merge defaults
        │   └── Wizard.tsx          # Asistente de creación (4d6 ability, ancestry/bg/class, wild talents)
        ├── tabs/
        │   ├── MainTab.tsx         # Identidad, atributos, HP, CA, salvaciones, ataques
        │   ├── SkillsTab.tsx       # Skills y lores con proficiencias
        │   ├── FeatsTab.tsx        # Feats por categoría + efectos automáticos (dedications, musas)
        │   ├── SpellsTab.tsx       # Conjuros, slots, cantrips, foco, fuentes extra (ExtraCaster)
        │   ├── PsionicsTab.tsx     # PFP, disciplina, poderes, wild talents
        │   ├── InventoryTab.tsx    # Items, dinero, bulk
        │   ├── NotesTab.tsx        # Notas de campaña (NPCs, lugares, facciones, rumores…)
        │   └── RulesTab.tsx        # House rules de referencia + manuales autorizados
        ├── components/
        │   └── common.tsx          # Section, Modal, Teml, TraitChips, CatalogSearch, PipTracker…
        └── lib/
            ├── calc.ts     # Derivados: mod atributo, proficiencia, AC, HP, saves, skills, conjuros, psiónica
            ├── rules.ts    # CLASS_PROFILES, applyClassSelection, musas (applyMuseSelection, syncFeatEffects)
            ├── sources.ts  # ALLOWED_SOURCE_LABELS, ALLOWED_SOURCES_SHORT, ALLOWED_SOURCES_DRIVE
            └── markdown.tsx # Renderiza texto AoN con tags custom → HTML
```

---

## 4. Base de datos SQLite

Archivo: `/data/app.db` (volumen Docker `pf2e_data`). Copia seed en `/seed/app.db`.

| Tabla | Contenido |
|-------|-----------|
| `srd_items` | 27 099 items AoN (feat, spell, ancestry, class, item, etc.) con `allowed` flag |
| `psionic_powers` | 237 poderes de 6 disciplinas (Egoism, Force, Mind, Move, Seer, Soul) |
| `wild_talent_entries` | 69 entradas de tabla de wild talents |
| `house_rules` | 99 filas: secciones de referencia, heritages y ancestry feats custom |
| `characters` | Personajes guardados (JSON completo en columna `data`) |

**Para refrescar el catálogo** (tras rebuild de imagen, sin perder personajes):
```bash
docker exec pf2e-elhoss-sheet python etl/refresh_catalog.py
```

---

## 5. API REST (FastAPI en `/api/v1/`)

| Endpoint | Descripción |
|----------|-------------|
| `GET /health` | Estado, versión, conteo de items |
| `GET /catalog/{type}` | Busca items SRD (q, level_min/max, trait, tradition, category, allowed_only) |
| `GET /catalog/{type}/{uid}` | Detalle completo de un item |
| `GET /psionics` | Lista poderes psiónicos (discipline, rank_max) |
| `GET /wild-talents` | Tabla de wild talents (rank) |
| `GET /houserules` | House rules (kind, ancestry, q) |
| `GET /allowed-sources` | Lista de manuales autorizados |
| `GET /characters` | Lista de personajes |
| `POST /characters` | Crear personaje |
| `GET /characters/{id}` | Obtener personaje |
| `PUT /characters/{id}` | Actualizar personaje |
| `DELETE /characters/{id}` | Eliminar personaje |

Tipos de catálogo válidos: `ancestry, heritage, background, class, archetype, feat, spell, ritual, action, skill, condition, trait, item, equipment, class-feature, deity, class-option`

---

## 6. Modelo de datos del personaje (`Character` en `types.ts`)

Campos clave que el AI debe conocer para hacer cambios coherentes:

```typescript
Character {
  // identidad
  name, player, xp, level, heroPoints

  // origen
  ancestry: { uid, name, hp, speed, size, custom }
  heritage:  { uid, name }
  background: { uid, name }
  clazz: { uid, name, keyAbility, hpPerLevel, isCaster, castingType, tradition, isPsionic }

  // estadísticas
  abilities: Record<AbilityKey, number>   // AbilityKey = str|dex|con|int|wis|cha
  perceptionRank: ProfRank                // ProfRank = 0|1|2|3|4 (U/T/E/M/L)
  saves: { fort, ref, will }
  skills: Record<string, { rank, item }>
  lores: [{ name, rank, item, ability?, note? }]
  classDcRank, spellAttackRank
  attacksProf: { unarmed, simple, martial, advanced }
  defensesProf: { unarmored, light, medium, heavy }
  armor, shield, hp, speedBonus, strikes

  // feats y conjuros
  feats: FeatEntry[]            // category: ancestry|class|skill|general|bonus
  spellcasting: {
    enabled, ability, tradition, castingType,
    slots: { [rank]: { max, used } },
    known: KnownSpell[],        // rank=0 → cantrip
    focus: { current, max }
  }
  muses: string[]               // nombres de musas seleccionadas (Bard)
  extraCasters: ExtraCaster[]   // fuentes extra (dedications)

  // psiónica
  psionics: { enabled, mode, discipline, keyAbility, pfp, powers, wildRoll }

  // inventario
  inventory: InventoryItem[]
  money: { cp, sp, gp, pp }

  // notas
  conditions: string[]
  notes: string                 // notas de texto libre del personaje
  campaignNotes: CampaignNote[] // notas de campaña (NPCs, lugares, etc.)
  dmMode: boolean
}
```

---

## 7. Lógica de reglas clave (`frontend/src/lib/rules.ts`)

- **`CLASS_PROFILES`**: perfiles de todas las clases CRB/APG con HP, proficiencias, spellcasting.
- **`applyClassSelection(c, classItem)`**: configura el Character completo al elegir clase.
- **`applyMuseSelection(c, museName)`**: aplica efectos de musa de Bardo (feats, conjuros, skills, lores). Máximo 2 musas si tiene Multifarious Muse.
- **`syncFeatEffects(c)`**: re-deriva todos los efectos automáticos desde la lista de feats actual (dedications, archetype spellcasting, musas). Llamar tras agregar/quitar feats.
- **`primaryClassSlots(className, level)`**: tabla de slots de conjuros por clase y nivel.
- **`applyMuseSkills(c, muses)`**: aplica proficiencias y lores de las musas activas.

---

## 8. Cálculos derivados (`frontend/src/lib/calc.ts`)

Todas las funciones reciben `(c: Character)` y devuelven el valor calculado:

- `abilityMod(score)` → `Math.floor((score - 10) / 2)`
- `profBonus(rank, level)` → `rank > 0 ? rank * 2 + level : 0`
- `ac(c)`, `maxHp(c)`, `save(c, saveKey)`, `perception(c)`
- `skillTotal(c, key)` → incluye Versatile Performance (musa Polymath)
- `loreTotal(c, l)` → usa `l.ability ?? "int"`
- `strikeBonus(c, strike)`, `strikeMap(c)` → `{ bonus, damage }`
- `spellAttack(c)`, `spellDc(c)`
- `extraSpellAttack(c, ec)`, `extraSpellDc(c, ec)` → para ExtraCaster
- `psionicAttack(c)`, `psionicDc(c)`, `psionicPfp(c)`
- `bulkTotal(c)`

---

## 9. Flujo Docker

```bash
# Primera vez
docker compose up -d --build

# Rebuild completo (nueva versión)
docker compose build --no-cache pf2e-sheet
docker compose up -d --force-recreate pf2e-sheet
docker exec pf2e-elhoss-sheet python etl/refresh_catalog.py

# Ver logs
docker logs pf2e-elhoss-sheet -f

# Desarrollo local (sin Docker)
cd frontend && npm install && npm run dev    # http://localhost:5173 (proxy → :8000)
cd backend && uvicorn app.main:app --reload  # requiere: pip install -r requirements.txt
                                              # y DB_PATH=./data/app.db
```

---

## 10. Control de versiones

- **Repositorio:** https://github.com/jfcolladon/pf2e-elhoss-sheet (público)
- **Rama:** `master`
- **Versión actual:** `1.3.0`
- Los archivos de versión son: `VERSION`, `frontend/package.json`, `frontend/src/version.ts`, `backend/app/main.py` (parámetro `version=` del FastAPI constructor).
- Al subir versión, actualizar los 4 archivos + entrada en `CHANGELOG.md`.

### Historial de versiones
| Versión | Fecha | Cambio principal |
|---------|-------|-----------------|
| 1.0.0 | 2026-06 | Versión inicial |
| 1.1.0 | 2026-06-11 | Selector de clase, musas de bardo, dedications, archetype spellcasting |
| 1.2.0 | 2026-07-02 | 10 manuales autorizados, fuentes expandidas, endpoint allowed-sources |
| 1.3.0 | 2026-07-08 | Pestaña Campaña (notas, NPCs, lugares, facciones…) |

---

## 11. Decisiones de diseño importantes

1. **SQLite en volumen Docker**: la tabla `characters` persiste entre rebuilds. Solo las tablas de catálogo se refrescan con `refresh_catalog.py`.
2. **No hay autenticación**: es para uso local/LAN. Si se expone a internet, agregar auth básica.
3. **`allowed` flag**: se calcula en ETL (seed). Los ítems de otros manuales se guardan igualmente en la DB pero con `allowed=0`. El frontend los muestra con badge "No permitido / Aprobación DM".
4. **Cantrips = rank 0**: AoN los almacena con `level: 1` pero con el trait `"Cantrip"`. El frontend los normaliza a `rank: 0` al importarlos.
5. **ExtraCaster**: cada dedication caster genera una entrada separada con sus propios slots, known spells, tradición y proficiencia. No mezcla con el spellcasting principal.
6. **Auto-save debounced**: 1 200 ms tras el último cambio. Indicador visual: "Guardado / Guardando… / Cambios sin guardar".
7. **CRLF issue resuelto**: el `docker-entrypoint.sh` fue eliminado; la lógica de inicialización está inline en el `CMD` del Dockerfile.
8. **Fuente de house rules**: el ETL intenta descargar el Google Doc; si falla, usa `/app/data/houserules.txt` (incluido en la imagen como fallback). Para actualizar el fallback: editar `data/houserules.txt` y rebuildar.

---

## 12. Tareas pendientes conocidas / ideas futuras

- [ ] Mejorar visualización de efectos de musa en FeatsTab (actualmente se aplican pero la UI podría mostrarlos más claramente).
- [ ] Permitir añadir condiciones personalizadas (ahora solo hay checkbox de condiciones conocidas).
- [ ] Exportar / imprimir hoja de personaje como PDF.
- [ ] Soporte multi-personaje simultáneo (actualmente un personaje por sesión en la misma pestaña).
- [ ] Añadir Thaumaturge, Inventor, Psychic, Magus como clases con perfiles completos en `CLASS_PROFILES`.
- [ ] Mejorar el parser de house rules para capturar más secciones estructuradas del Google Doc.
- [ ] Auth básica si se expone más allá de la LAN local.

---

## 13. Información de contexto de la campaña

- **Campaña:** Elhoss Eastern Lands (ambientación custom tipo Dark Sun para psiónica)
- **Jugador / autor:** jfcolladon (GitHub: `jfcolladon`)
- **Personaje activo:** Bardo con Dedication a Clérigo, Multifarious Muse
- **House rules doc:** https://docs.google.com/document/d/16EmEq9_nEYG6o5xgtyvk1wodVfFIUD4E9Yf4qJuQLkM/edit
- **Drive manuales:** https://drive.google.com/drive/u/0/folders/1CveoM7PWlSF8GWE16UltayP_3SzYLin_
