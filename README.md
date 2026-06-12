# Hoja de Personaje PF2e — Elhoss Eastern Lands

**Versión:** 1.1.0

Aplicación web dockerizada de hoja de personaje para **Pathfinder 2e (legacy)**, restringida a **Core Rulebook + Advanced Player's Guide** más las **house rules** de la campaña **Elhoss Eastern Lands** (psiónica salvaje estilo Dark Sun).

Repositorio: [github.com/jfcolladon/pf2e-elhoss-sheet](https://github.com/jfcolladon/pf2e-elhoss-sheet)

---

## Requisitos

| Entorno | Requisito |
|---------|-----------|
| **Producción (recomendado)** | [Docker Desktop](https://www.docker.com/products/docker-desktop/) |
| **Desarrollo local** | Python 3.11+, Node.js 20+, npm |

---

## Instalación y ejecución con Docker (recomendado)

Clona el repositorio y levanta el contenedor:

```bash
git clone https://github.com/jfcolladon/pf2e-elhoss-sheet.git
cd pf2e-elhoss-sheet
docker compose up --build -d
```

Abre en el navegador: **http://localhost:8080**

### Comandos útiles

```bash
# Ver estado del contenedor
docker compose ps

# Ver logs
docker compose logs -f pf2e-sheet

# Detener
docker compose down

# Detener y borrar personajes guardados (volumen)
docker compose down -v
```

### Persistencia de datos

Los personajes se guardan en el volumen Docker `pf2e_data` (`/data/app.db` dentro del contenedor). Reconstruir la imagen **no** borra personajes; borrar el volumen sí.

### Health check

```bash
curl http://localhost:8080/api/v1/health
```

Respuesta esperada: `{"status":"ok","srd_items":...,"psionic_powers":...}`

---

## Desarrollo local (sin Docker)

### 1. Backend y base de datos

```bash
# Windows (PowerShell)
python -m venv .venv
.venv\Scripts\pip install -r backend\requirements.txt

# Sembrar catálogo SRD + house rules (requiere internet la primera vez)
.venv\Scripts\python backend\etl\seed_aon.py
.venv\Scripts\python backend\etl\seed_houserules.py

# API en http://localhost:8000
.venv\Scripts\uvicorn app.main:app --app-dir backend --reload --port 8000
```

```bash
# Linux / macOS
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
python backend/etl/seed_aon.py
python backend/etl/seed_houserules.py
uvicorn app.main:app --app-dir backend --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Abre **http://localhost:5173** (Vite proxyea `/api` → `localhost:8000`).

### 3. Build de producción del frontend

```bash
cd frontend
npm run build
```

El build queda en `frontend/dist/`; en Docker se copia automáticamente a `static/`.

---

## Características principales

- **Catálogo SRD** (SQLite): feats, conjuros, clases, musas, equipo… filtrado CRB/APG; resto marcado *No permitido* con aprobación DM.
- **Cálculo automático**: skills, salvaciones, CA, HP, DC de clase, ataques, conjuros, psiónica (PFP).
- **Bardo**: musa obligatoria; **Multifarious Muse** exige segunda musa; feats/conjuros/skills de musa aplicados automáticamente.
- **Multiclase caster**: dedications (p. ej. Cleric Dedication) crean fuente de conjuros adicional; Basic/Expert/Master Spellcasting calcula slots.
- **Conjuros**: cantrips, signature spells, composition, focus points, fuentes múltiples.
- **Psiónica (house rules)**: clase Psiónico, wild talents 3d100, 237 poderes del doc de campaña.
- **Asistente de creación** con reglas de mesa (4d6, ancestries custom, etc.).

---

## Fuentes de datos

| Fuente | Uso |
|--------|-----|
| [Archives of Nethys](https://2e.aonprd.com/) (Elasticsearch legacy) | SRD: CRB + APG |
| [House rules Elhoss](https://docs.google.com/document/d/16EmEq9_nEYG6o5xgtyvk1wodVfFIUD4E9Yf4qJuQLkM/edit) | Psiónica, wild talents, ancestries custom |
| `data/houserules.txt` | Copia local usada en el build Docker |

La base se **siembra durante el build de Docker**; en runtime la app no depende de internet salvo que re-ejecutes el ETL.

---

## Estructura del proyecto

```
├── backend/
│   ├── app/          # API FastAPI + sirve frontend estático
│   └── etl/          # seed_aon.py, seed_houserules.py
├── frontend/         # React + Vite + TypeScript
├── data/             # houserules.txt (+ app.db generado localmente)
├── docker-compose.yml
├── Dockerfile
├── VERSION           # 1.1.0
└── CHANGELOG.md
```

---

## Actualizar catálogo (mantener personajes)

Tras `docker compose build`, el volumen conserva la DB antigua. Para refrescar solo catálogo/house rules sin perder personajes, copia las tablas de catálogo desde la imagen nueva o re-ejecuta los scripts ETL sobre `/data/app.db` (ver `backend/etl/refresh_catalog.py` si existe en tu checkout).

---

## Licencia y aviso

Contenido de Pathfinder © Paizo Inc.; uso via [Archives of Nethys](https://2e.aonprd.com/) bajo [ORC / PF2e legacy](https://2e.aonprd.com/License.aspx). House rules © mesa Elhoss Eastern Lands.

---

## Autor

[Jfcolladon](https://github.com/jfcolladon) — campaña Elhoss Eastern Lands.
