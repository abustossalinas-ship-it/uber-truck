# Comparación de documentación — Uber Truck vs Chanchi (wa-fintech-mvp)

Referencia local: `C:\Users\Ariel Bustos\.cursor\projects\empty-window\wa-fintech-mvp`

**Objetivo:** mismo patrón de navegación y “documento vivo” que Chanchi, adaptado a marketplace logístico.

---

## Resumen

| Aspecto | Chanchi (wa-fintech-mvp) | Uber Truck (este repo) |
|---------|--------------------------|-------------------------|
| **Hub en producción** | `/docs/index.html` | `/docs/index.html` (alineado) |
| **Documento central** | `Memoria-tecnica-MVP-Fintech-IA.html` — Parte I (hitos + Gantt coloreado) + Parte II (stack) | `Memoria-tecnica-Uber-Truck.html` — arquitectura + **Parte I** (§12 Gantt coloreado) |
| **Markdown vivo** | Menos central; hitos en MD sueltos | `01-MEMORIA-TECNICA.md` + `00-INDICE` |
| **Hitos / bitácoras** | `HITO-1.md` … `HITO-4-*.md`, `BITACORA-HORAS.md` | `HITO-DIGITAL-MVP.md` (+ Gantt por fases 0–4) |
| **Backlog operativo** | `PROXIMOS-HITOS.md` | `PROXIMOS-HITOS.md` |
| **Roadmap estratégico** | `ROADMAP-RECOMENDACIONES-CHANCHI.md` + opinión HTML | `ROADMAP.md` |
| **Modelo negocio** | HTML aparte + canvas | `Modelo-Negocio-Uber-Truck.html` |
| **Canvas** | Varios `.canvas.tsx` + `Canvas-Resumen-Chanchi.html` | `estado-avance.canvas.tsx` + `Canvas-Resumen-Uber-Truck.html` |
| **Capturas** | `docs/img/` con README por sección | `docs/img/README.md` (placeholder) |
| **Export Word** | `export:memoria-docx`, `export:all-docx` | `export:all-docs` (varios HTML) |
| **Servir docs** | Express `/docs` | Express `/docs` (`src/app.js`) |

---

## Patrón Chanchi (qué copiar)

1. **Una memoria HTML** que el equipo actualiza con versión, Gantt con celdas `.g-done` / `.g-doing` / `.g-todo`, e interpretación “estado al mes X”.
2. **`docs/index.html`** como índice navegable en Railway (no solo Markdown en GitHub).
3. **Hitos en MD** separados para entregas grandes (import bancos, WA, etc.) — en Uber Truck: bitácora del MVP digital adelantado.
4. **`PROXIMOS-HITOS.md`** con prioridades P0/P1 (Chanchi usa esto dentro de la memoria también).
5. **Canvas-Resumen-*.html** para exportar a Word lo que está en Cursor Canvas.
6. **AGENTS.md** con tabla de URLs `/docs/...` en producción.

---

## Gaps que quedan (opcional)

| Gap | Acción sugerida |
|-----|-----------------|
| Memoria HTML con Parte I **antes** de arquitectura (orden Chanchi) | Reordenar secciones en un solo HTML (refactor grande) |
| Más hitos MD (HITO-0 concierge, HITO-3 piloto) | Crear cuando arranque piloto WhatsApp |
| `export:memoria-docx` dedicado | Alias en `package.json` → mismo script |
| Capturas en `docs/img/` | Añadir al cerrar M2/M3 |
| Opinión roadmap HTML separado | Solo si hay documento externo de feedback |

---

## Enlaces rápidos Uber Truck (prod)

- Hub: https://uber-truck-production.up.railway.app/docs/
- Memoria: https://uber-truck-production.up.railway.app/docs/Memoria-tecnica-Uber-Truck.html

## Enlaces Chanchi (referencia)

- Hub: servido desde su app en `/docs/` (mismo patrón Express).
