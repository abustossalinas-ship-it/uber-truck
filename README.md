# Uber Truck — Optimización de capacidad logística ociosa

> **Tesis:** monetizar cubicación disponible en rutas activas (backhaul), no solo “Uber de camiones”.

## Documentación

**Índice maestro:** [docs/00-INDICE-DOCUMENTACION.md](docs/00-INDICE-DOCUMENTACION.md)

| Documento | Markdown / HTML | Notas |
|-----------|-----------------|--------|
| **Memoria técnica + Gantt + avance** | [docs/01-MEMORIA-TECNICA.md](docs/01-MEMORIA-TECNICA.md) | Documento central (estilo fintech) |
| **Canvas estado avance** | `canvases/estado-avance.canvas.tsx` | Abrir en Cursor → panel Canvas |
| **SQL Supabase (004–008)** | [docs/SQL-SUPABASE.md](docs/SQL-SUPABASE.md) | Pegar en SQL Editor |
| Índice HTML | `docs/Indice-Documentacion-Uber-Truck.html` | |
| Gantt detalle | `docs/Gantt-Uber-Truck.html` | También integrado en memoria §12 |
| Journey / modelo / kickoff | `docs/*.html` | Export Word abajo |

### Word (.docx)

### Regenerar todos los .docx

```bash
npm run export:all-docs
```

## Arranque técnico

```bash
npm install
npm run dev
```

→ http://localhost:3001 · `/health`

## Marca y UI

- Logo: `public/brand/logo.png`
- Colorimetría: `docs/BRAND.md` · estilos `public/theme.css` (naranja `#F26522`)

## Despliegue (proyectos separados)

| Servicio | Documentación |
|----------|----------------|
| **Railway** (repo `uber-truck`, no `wa-fintech-mvp`) | `docs/DEPLOY.md` |
| **Supabase** (proyecto `uber-truck` nuevo) | `docs/DEPLOY.md` · `supabase/README.md` |

## Próximo paso (informe estratégico)

1. **Descubrimiento:** 15 transportistas + 10 gerentes PYME (nodo San Bernardo).
2. **Concierge MVP:** WhatsApp + Airtable → 20 emparejamientos.
3. **Legal:** términos mínimos + seguro de carga piloto.

Ver `docs/Gantt-Uber-Truck.docx` y `docs/PROXIMOS-HITOS.md`.

## Cursor

Abrir en Cursor: `C:\Users\Ariel Bustos\.cursor\projects\uber-truck` · leer `AGENTS.md`.
