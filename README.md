# Uber Truck — Optimización de capacidad logística ociosa

> **Tesis:** monetizar cubicación disponible en rutas activas (backhaul), no solo “Uber de camiones”.

## Documentación (Word)

Carpeta: `docs/`

| Documento | Archivo |
|-----------|---------|
| **Índice** | `Indice-Documentacion-Uber-Truck.docx` |
| **Informe estratégico (origen)** | `Informe_Evaluacion_Estrategica_Uber_Truck.docx` |
| **Journey usuario** | `Journey-Usuario-Uber-Truck.docx` |
| **Memoria técnica** | `Memoria-tecnica-Uber-Truck.docx` |
| **Gantt** | `Gantt-Uber-Truck.docx` |
| **Modelo de negocio** | `Modelo-Negocio-Uber-Truck.docx` |
| **Kickoff** | `Kickoff-Uber-Truck.docx` |

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
