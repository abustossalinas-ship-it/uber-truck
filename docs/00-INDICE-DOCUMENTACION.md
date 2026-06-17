# Índice maestro — Uber Truck / Cubik

**Producción:** https://www.getcubik.cl  
**Hub docs:** https://www.getcubik.cl/docs/  
**Railway directo:** https://uber-truck-production.up.railway.app/docs/

---

## Documento central (leer primero)

| Documento | Enlace |
|-----------|--------|
| **Memoria técnica** | [Memoria-tecnica-Uber-Truck.html](./Memoria-tecnica-Uber-Truck.html) |

Incluye en un solo archivo: visión producto (app tipo Uber), paridad UX **MVP cerrada**, hitos, **Gantt 16 sem**, **backlog vivo**, Cubik Saldo piloto, QA automatizado, plan comercial piloto 25/50, auth/correo/dominio, **captación (landing v3 + prospectos + bot WhatsApp Meta)**, **onboarding piloto por rubros (C3a–O4)**. La tabla **Post-MVP** es backlog planificado (no bugs). **Última actualización:** 25 may 2026 · software **0.0.129** (frontend captación **v0.0.168**) · memoria **v4.5.3**.

No hay archivos separados de kickoff, gantt, roadmap, próximos hitos ni bitácora MVP digital (evita duplicados).

---

## Auth, correo y dominio (piloto)

| Tema | Documento |
|------|-----------|
| **Dominio + Resend (bloqueante piloto)** | [DOMAIN-AND-EMAIL.md](./DOMAIN-AND-EMAIL.md) |
| Auth, OAuth futuro, contraseña | [AUTH-AND-EMAIL-ROADMAP.md](./AUTH-AND-EMAIL-ROADMAP.md) |
| Checklist Post-MVP | [POST-MVP-CHECKLIST.md](./POST-MVP-CHECKLIST.md) |

## Comercial y piloto (may 2026)

| Tema | Documento |
|------|-----------|
| Plan piloto 25 empresas + 50 transportistas · escala | [PLAN-COMERCIAL-PILOTO.md](./PLAN-COMERCIAL-PILOTO.md) · Canvas `cubik-plan-native-escala.canvas.tsx` |
| **Onboarding rubros, seguros, discurso captación** | [ONBOARDING-PILOTO-RUBROS.md](./ONBOARDING-PILOTO-RUBROS.md) |
| Piloto M2 corredor, KPIs, riesgos | [Piloto-M2-Corredor-KPIs-Riesgos.html](./Piloto-M2-Corredor-KPIs-Riesgos.html) |
| Próximos pasos estratégicos | [PROXIMOS-PASOS-ESTRATEGIA.md](./PROXIMOS-PASOS-ESTRATEGIA.md) |
| Demo / pitch | [DEMO-GUION.md](./DEMO-GUION.md) |
| **Captación / bot WhatsApp (Meta Cloud)** | [WHATSAPP-META-CLOUD.md](./WHATSAPP-META-CLOUD.md) · [WHATSAPP-BOT-FAQ.md](./WHATSAPP-BOT-FAQ.md) · landing `/transportistas`·`/empresas` → `prospectos` |

---

## QA y Android

| Tema | Documento |
|------|-----------|
| **QA automatizado** | [QA-AUTOMATIZADO.md](./QA-AUTOMATIZADO.md) · Laboratorio: `/qa-lab` (`npm run qa:lab`) |
| **Checklist Post-MVP** | [POST-MVP-CHECKLIST.md](./POST-MVP-CHECKLIST.md) · [/post-mvp-checklist.html](/post-mvp-checklist.html) |
| UX app móvil | [CUBIK-APP-UX.md](./CUBIK-APP-UX.md) |
| Play Store | [CUBIK-PLAY-STORE.md](./CUBIK-PLAY-STORE.md) |
| Push FCM | [CUBIK-PUSH-FCM.md](./CUBIK-PUSH-FCM.md) |

---

## Anexos HTML

| Tema | HTML |
|------|------|
| Modelo de negocio | [Modelo-Negocio-Uber-Truck.html](./Modelo-Negocio-Uber-Truck.html) |
| Journey usuario | [Journey-Usuario-Uber-Truck.html](./Journey-Usuario-Uber-Truck.html) (v3.2 · 25 may 2026) |
| Resumen canvas | [Canvas-Resumen-Uber-Truck.html](./Canvas-Resumen-Uber-Truck.html) (v1.6 · 25 may 2026) |
| Cancelación / multas | [Politica-Cancelacion-Uber-Truck.html](./Politica-Cancelacion-Uber-Truck.html) · [Multas-Cuenta-Uber-Truck.html](./Multas-Cuenta-Uber-Truck.html) |
| SQL Supabase | [Sql-Supabase-Uber-Truck.html](./Sql-Supabase-Uber-Truck.html) · [SQL-SUPABASE.md](./SQL-SUPABASE.md) |
| Confianza y carga | [CARGO-TRUST.md](./CARGO-TRUST.md) · [Terminos-Confianza-Carga-Uber-Truck.html](./Terminos-Confianza-Carga-Uber-Truck.html) |

---

## Operación

| Tema | Documento |
|------|-----------|
| **Probar (testers)** | [Probar-Uber-Truck.html](./Probar-Uber-Truck.html) · [Journey](./Journey-Usuario-Uber-Truck.html) |
| Deploy | [DEPLOY.md](./DEPLOY.md) |
| Marca | [BRAND.md](./BRAND.md) |

---

## Word

```bash
npm run export:memoria-docx
npm run export:all-docs
```

---

## Canvas (Cursor IDE)

| Canvas | Uso |
|--------|-----|
| `estado-avance.canvas.tsx` | % fases, releases, hitos |
| `comparacion-costos-transporte.canvas.tsx` | Tarifas sugeridas |
| `cubik-plan-native-escala.canvas.tsx` | Piloto/escala, Gantt, costos, nativo vs híbrido |
