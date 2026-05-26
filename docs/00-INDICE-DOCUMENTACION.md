# Índice maestro — Uber Truck

**Producto:** Marketplace de transporte por camión (backhaul / capacidad ociosa)  
**Versión app:** ver `/health` → `version` (actual **0.0.19**)  
**Producción:** https://uber-truck-production.up.railway.app  
**Repo:** https://github.com/abustossalinas-ship-it/uber-truck  
**Supabase:** proyecto `ljinhegtywixtbzjgjfn`

---

## 1. Documento central (leer primero)

| Documento | Formato | Contenido |
|-----------|---------|-----------|
| **[01-MEMORIA-TECNICA.md](./01-MEMORIA-TECNICA.md)** | Markdown | Arquitectura, API, datos, **Gantt integrado**, **estado de avance**, enlaces |
| [Memoria-tecnica-Uber-Truck.html](./Memoria-tecnica-Uber-Truck.html) | HTML / Word | Export Word vía `npm run export:all-docs` |
| **Canvas estado de avance** | Cursor IDE | `canvases/estado-avance.canvas.tsx` — abrir desde panel Canvas |

---

## 2. Estrategia y negocio

| Documento | Enlace |
|-----------|--------|
| Modelo de negocio | [Modelo-Negocio-Uber-Truck.html](./Modelo-Negocio-Uber-Truck.html) |
| Journey usuario | [Journey-Usuario-Uber-Truck.html](./Journey-Usuario-Uber-Truck.html) |
| Kickoff | [KICKOFF.md](./KICKOFF.md) · [Kickoff-Uber-Truck.html](./Kickoff-Uber-Truck.html) |
| Roadmap editable | [ROADMAP.md](./ROADMAP.md) |
| Próximos hitos | [PROXIMOS-HITOS.md](./PROXIMOS-HITOS.md) |

---

## 3. Gantt (dentro de memoria técnica)

El cronograma planificado **no va en un archivo suelto** para consulta diaria: está **incorporado en la memoria técnica** (sección 12) y en el canvas.

| Referencia | Enlace |
|------------|--------|
| Gantt detallado (HTML) | [Gantt-Uber-Truck.html](./Gantt-Uber-Truck.html) |
| Estado real vs plan | [01-MEMORIA-TECNICA.md §12](./01-MEMORIA-TECNICA.md#12-cronograma-gantt-y-estado-de-avance) |

---

## 4. Anexos técnicos (operación)

| Tema | Documento |
|------|-----------|
| **SQL Supabase (todo)** | [SQL-SUPABASE.md](./SQL-SUPABASE.md) · `supabase/migrations/RUN_PENDING.sql` |
| Cancelación y multas | [MATCH-CANCEL-POLICY.md](./MATCH-CANCEL-POLICY.md) |
| Cuenta bancaria y cobros | [PENALTIES-AND-ACCOUNTS.md](./PENALTIES-AND-ACCOUNTS.md) |
| Deploy Railway | [DEPLOY.md](./DEPLOY.md) · [RAILWAY-DEPLOY-FIX.md](./RAILWAY-DEPLOY-FIX.md) |
| Maps | [MAPS.md](./MAPS.md) |
| Demo | [DEMO-GUION.md](./DEMO-GUION.md) |
| Marca | [BRAND.md](./BRAND.md) |

---

## 5. Canvas (Cursor)

| Canvas | Archivo | Uso |
|--------|---------|-----|
| Estado de avance MVP | `canvases/estado-avance.canvas.tsx` | % avance por fase Gantt, versión deploy, checklist |

En Cursor: panel **Canvas** → abrir `estado-avance.canvas.tsx`.

---

## 6. Exportar a Word

```bash
npm run export:all-docs
```

Genera `.docx` desde los HTML en `docs/`.

---

## Orden de lectura (estilo proyecto fintech)

1. Índice (este archivo)  
2. Memoria técnica + Gantt + avance  
3. Modelo de negocio  
4. Journey  
5. Anexos según tarea (SQL, deploy, políticas)
