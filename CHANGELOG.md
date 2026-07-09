# Changelog

## [1.3.0] — 2026-07-08

### Añadido
- **Pestaña Campaña**: cuaderno de notas de campaña con categorías (Personajes, Lugares, Facciones, Rumores, Notas, Varios).
- Tarjetas de notas con título, contenido, etiquetas y opción de fijar (`📌`).
- Filtrado por categoría, búsqueda de texto libre y ordenamiento (fijadas primero, luego por fecha).
- Modal de creación/edición de notas con selector de categoría visual.
- Las notas se almacenan en el personaje (campo `campaignNotes`) y se auto-guardan como el resto de datos.

## [1.2.0] — 2026-07-02

### Añadido
- **10 manuales autorizados** (sin aprobación DM): Core Rulebook, Advanced Player's Guide, Bestiary 1–3, Book of the Dead, Dark Archive, Gamemastery Guide, Guns & Gears, Secrets of Magic.
- Lista alineada con la [carpeta de rulebooks de la campaña](https://drive.google.com/drive/u/0/folders/1CveoM7PWlSF8GWE16UltayP_3SzYLin_).
- Endpoint `GET /api/v1/allowed-sources` y sección en pestaña Reglas.
- Tipo `ritual` en el catálogo (Secrets of Magic).

### Cambiado
- ETL re-marca como `allowed` todo contenido de esos manuales en Archives of Nethys legacy.

## [1.1.0] — 2026-06-11

### Añadido
- Selector de clase con configuración automática (HP, proficiencias, conjuros, atributo clave).
- Musas de bardo obligatorias al elegir Bard; segunda musa obligatoria con **Multifarious Muse**.
- Efectos automáticos de musas: feats, conjuros, lores y skills (Bardic Lore, Versatile Performance, etc.).
- Dedications de clase caster → fuente de conjuros adicional separada del lanzamiento de clase.
- Basic / Expert / Master Spellcasting: slots de archetype y proficiencia automáticos.
- Botón **Recalcular efectos automáticos** en Feats y Conjuros.
- Cantrips detectados por trait `Cantrip` (rank 0).
- Versión visible en la barra superior (`v1.1.0`).

### Cambiado
- Configuración de conjuros movida a `spellcasting` (ability, tradition, castingType) con override manual.

## [1.0.0] — Versión inicial

- Hoja interactiva PF2e legacy (CRB + APG) con house rules Elhoss Eastern Lands.
- Docker, SQLite sembrado desde Archives of Nethys, psiónica y wild talents.
