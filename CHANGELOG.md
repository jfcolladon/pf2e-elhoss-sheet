# Changelog

## [1.9.5] — 2026-08-14

### Corregido
- Las descripciones de manifestaciones psiónicas se leen del Word de campana (ficha Rank/Traits/Cost a veces pegada en un párrafo).
- Un poder conocido ya no muestra el texto de otro: se resuelve por nombre + disciplina + rank si el `id` del catálogo cambió al reseeder.

## [1.9.4] — 2026-08-13

### Corregido
- Ficha de poderes psiónicos tabulada como en el manual (Rank, Cost, Actions, Range, Area, Duration, Saving Throw) en lugar de un renglón compacto.
- Poderes con todos los campos pegados en la línea `Rank:` (p. ej. Kinetic Implosion, Momentum Shield) se parten y rellenan la ficha.
- `Saving Throw and Duration` se separa en salvación y duración; los "—" vacíos ya no se muestran.
- El fallback `houserules.txt` de Google Docs (`\\r\\r\\n`) ya no duplica líneas en blanco.

## [1.9.3] — 2026-08-13

### Corregido
- **Warp Shield** y otros poderes al final de un rank: ya no incluyen el encabezado "Poderes Rank N" en la descripción.

## [1.9.2] — 2026-08-13

### Corregido
- **Heal** ya no incluye el texto de **Heightened Senses**: el parser tomaba cualquier línea que empezara por "Heightened" como un heightened, no como un poder nuevo.

## [1.9.1] — 2026-08-13

### Corregido
- **Flesh Armour** y otras tablas dentro de poderes: el export de Google Docs las partía en líneas sueltas; ahora se reconstruyen.

## [1.9.0] — 2026-08-13

### Corregido
- Parser de poderes psiónicos: la línea `Difficulty:` ya no sustituye el nombre ni mezcla un poder con el siguiente.
- Descripciones del manual psiónico ordenadas (efecto, grados de salvación, Foco/Debilidad/Narrativa) **sin citar Archives of Nethys**.
- Tablas de la clase Psiónico reconstruidas (el export de Google Docs las dejaba ilegibles).

### Añadido
- Visor de house rules con listas, salvaciones y tablas.
- Características de clase **Psiónico** desde el manual de Elhoss (no Psychic de AoN).

## [1.8.1] — 2026-08-12

### Cambiado
- El idioma común de Elhoss es el **Lenguaje de los Mercaderes de las Dunas**. Se elimina Common de Golarion.
- Personajes que tenían Common lo convierten al idioma de los mercaderes (sin duplicar).

## [1.8.0] — 2026-08-12

### Añadido
- **Idiomas** en la pestaña Principal: chips, lista de Elhoss (Common, Telian, Ushamita, Ramanan, Daxican, Dwrvin, Yolquipan, K'rryl, Mercaderes de las Dunas, Halfling) y sugerencias SRD.
- Elegir ancestría (house rules o SRD) agrega sus idiomas de partida. INT muestra cuántos idiomas adicionales corresponden.
- El asistente de creación también aplica y resume idiomas.

## [1.7.0] — 2026-08-12

### Cambiado
- **Moneda de Thalan'dorœ** según la tabla de campaña:
  - **Thaloré** — 50 Orivan (oro cuadrado con gema; tratados, dotes, tierras).
  - **Orivan** — 100 Thalmar (oro circular 10 g).
  - **Thalmar** — 10 Syran (mármol pulido).
  - **Syran** — base (arcilla circular divisible).
  - **Syri** y **Ran** — mitades de un Syran.
- El antiguo campo `tp` (Talore como fracción de cobre) no se migra a Thaloré.

## [1.6.1] — 2026-08-12

### Añadido
- **Talore** como moneda (fracción del Siran).

### Cambiado
- Nombres de moneda solo en Elhoss: Orivan, Thalmar, Siran, Talore (sin oro/plata/cobre ni equivalencias).
- Corrección de **Talmar** → **Thalmar**.

## [1.6.0] — 2026-08-12

### Cambiado
- **Moneda de Elhoss** en Inventario: Orivan (oro), Talmar (plata) y Siran (cobre). Se elimina el platino.
- Personajes viejos: el platino guardado se convierte a Orivan (1 pp = 10 Orivan).

## [1.5.0] — 2026-08-12

### Añadido
- **Retrato del personaje** en la pestaña Principal (marco 152×200, proporción 3:4, recorte `cover`).
- Miniatura junto al nombre en la barra de la hoja.
- La imagen se redimensiona y comprime en el navegador (máx. 360×480 JPEG) antes de guardarse con el personaje.

## [1.4.0] — 2026-08-12

### Añadido
- **Prerrequisitos de feats**: al elegir un feat, se comprueba si el personaje lo cumple.
- Se evalúan atributos, proficiencia de skills (con Versatile Performance), feats previos (incluidos los que otorga una musa), musas, clase/ancestría implícitas y el candado de dedicación (2 feats del arquetipo antes de otra Dedication).
- Los feats no elegibles se ocultan por defecto; checkbox **Mostrar no elegibles** los deja ver grisados con el requisito que falta.
- Prerrequisitos de texto libre no comprobables se permiten con aviso. El **Modo DM** puede añadir feats que no cumplen.

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
