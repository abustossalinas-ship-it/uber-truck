# Onboarding piloto — rubros, confianza y discurso comercial

**Producto:** Cubik · **Alcance:** registro transportistas y empresas · **Piloto:** corredor RM–V  
**Actualizado:** 16 jun 2026 · **Estado:** estrategia + blueprint (implementación facial/rubros en roadmap)

---

## Resumen ejecutivo

Cubik no compite hoy con operadores cerrados tipo WebCarga en compliance total. El piloto apunta a:

| Actor | Propuesta |
|-------|-----------|
| **Transportista** | Monetizar **viaje de vuelta** y capacidad ociosa sin dejar de trabajar para sus clientes habituales del rubro. |
| **Empresa embarcadora** | Publicar carga con **menor costo marginal** y elegir entre varios camiones ya verificados por rubro y seguro. |

La confianza se construye con **registro riguroso** (identidad + documentos + rubro + seguro acotado) y **curaduría manual** en piloto (modelo Cornershop: operación de respaldo).

---

## 1. Sesión transportista — registro objetivo

### 1.1 Flujo de alta (producto objetivo)

| Paso | Qué captura | Para qué sirve |
|------|-------------|----------------|
| 1. Cuenta | Email, contraseña, rol `carrier`, nombre empresa transporte | Acceso app |
| 2. **Identidad** | **Login facial** + foto **cédula de identidad** (anverso/reverso) | Persona real; base anti-fraude |
| 3. **Conductor** | Foto **licencia de conducir** (clase y vigencia legibles) | Solo quien puede conducir oferta en ruta |
| 4. **Seguro** | Selección de póliza / tipo de cobertura + foto o PDF acotado | Validación acotada → **qué puede ofertar** |
| 5. **Rubro** | Uno o más rubros + tipo de flota (camión, tolva, frío, etc.) | Matching y restricciones de carga |
| 6. **Vehículo(s)** | Patente, capacidad (ton / m³), fotos opcionales | Oferta por corredor |
| 7. **Banco** | Cuenta para cobros (ya en app) | Operar tras KYC |
| 8. **Revisión** | Admin aprueba `kyc_status = approved` | Semi-curado piloto |

> **Hoy en prod (16 jun 2026):** email + contraseña, empresa, banco, KYC manual admin. Pasos 2–5 son **roadmap C3+**; en piloto se pueden completar por WhatsApp/formulario y cargar en panel admin.

### 1.2 Seguro — validación acotada (sin prometer API completa)

Objetivo: saber si el transportista **puede ofertar** y **qué tipo de servicio**, no sustituir una aseguradora.

| Nivel | Qué revisamos (manual o checklist) | Puede ofertar |
|-------|-----------------------------------|---------------|
| **A — Básico** | SOAP al día, póliza RC vehículo vigente (foto legible) | Carga general no peligrosa, mismo rubro declarado |
| **B — Rubro** | Póliza carga / RC transporte acorde al rubro (ej. alimentos, construcción) | Cargas del rubro seleccionado |
| **C — Especial** | Certificaciones o pólizas específicas (explosivos, químicos, cadena frío certificada) | Solo tras revisión admin explícita; **no automático en piloto** |

Regla producto: si la carga publicada exige `requires_cargo_insurance` o rubro restringido, solo ven el match transportistas con nivel B/C aprobado para ese rubro.

### 1.3 Rubros y flotas (matching)

Cada rubro tiene **flotas conocidas** en Chile. Cubik agrupa por rubro para buscar los mismos perfiles, pero **el servicio entre rubros difiere** (no es lo mismo mover cemento que alimentos o explosivos).

| Rubro (piloto sugerido) | Flota típica | Restricciones |
|-------------------------|--------------|---------------|
| **Construcción / materiales** | Tolva, plataforma, semi | Polvo, peso; no alimentos |
| **Alimentos secos** | Furgón cerrado, semi lonado | Limpieza; no mezclar con químicos |
| **Refrigerados / congelados** | Thermo, semi frío | Cadena de frío; seguro B+ |
| **Retail / general** | Furgón, semi | Carga general |
| **Químicos / explosivos** | Especializado | **Fuera de piloto automático** — solo curaduría C |

En registro el transportista declara **rubro principal** + **tipos de camión**. La app sugiere cargas compatibles; cruce de rubro distinto → bloqueo o revisión manual.

---

## 2. Discurso comercial — transportista

### Público objetivo

Empresas de transporte **PYME** que ya mueven carga para **una o dos empresas fijas** del mismo rubro (ej. solo constructora A, o solo distribuidor B), con camiones que **vuelven vacíos** o con **capacidad libre** en el corredor.

### Pitch (60 segundos)

> «Ustedes ya tienen clientes fijos y saben operar bien en su rubro. Cubik **no les pide dejar esos contratos**. Les sumamos **cargas extra en el viaje de vuelta** y en los días con camión parado, con precio en CLP y pago trazable en la app.
>
> Publicamos solo en corredores donde ustedes ya circulan — RM, Valparaíso, San Antonio — y **filtramos por rubro**: un tolva de construcción no compite con un thermo de congelados.
>
> El registro es más exigente que un grupo de WhatsApp: **cédula, licencia y seguro** para que el embarcador confíe. Ustedes entran al piloto **verificados**; los que no cumplen documentación no ofertan.
>
> Si mañana hay poca demanda en la app, tenemos **empresas ancla** del mismo rubro para no dejarlos colgados — como cuando Cornershop empezó con reparto propio hasta tener densidad.»

### Objeciones frecuentes

| Objeción | Respuesta |
|----------|-----------|
| «Ya tengo cliente fijo» | Cubik es **complemento** en vuelta y ociosidad, no reemplazo. |
| «No confío en apps» | KYC manual, mismos documentos que ya usan con clientes grandes, soporte WhatsApp Cubik. |
| «Mi seguro no cubre todo» | Solo ven cargas acordes a su **nivel de seguro declarado**; sin sorpresas. |
| «Mucho papeleo» | Una vez en piloto, **ofertar es en minutos** desde el celular. |

---

## 3. Piloto transportistas — metas operativas

Alineado al plan **25 empresas + 50 transportistas**, con foco por rubro:

| Meta | Número | Notas |
|------|--------|-------|
| Camiones activos **por rubro** (piloto inicial) | **10** | Construcción + retail/alimentos como primeros dos rubros RM–V |
| Transportistas verificados totales | 50 | Incluye multi-camión |
| **Empresas ancla (plan B)** | **1–2 por rubro** | Conocidas del fundador; publican carga si cae liquidez orgánica |
| Viajes completados corredor | 20 (M2) → escala | KPI existente |

### Modelo Cornershop (plan B)

- Las **1–2 empresas ancla** son clientes reales del fundador o red directa.
- Si un día no hay match orgánico, ellas publican **carga real o semi-real** para sostener experiencia al transportista piloto.
- Transparencia interna: no inflar GMV falso; objetivo es **aprendizaje y confianza**, no métricas vanity.
- Gradualmente se retira plan B cuando haya **≥ N ofertas/semana** orgánicas por rubro (sugerido: 5).

---

## 4. Sesión empresa — registro objetivo

### 4.1 Flujo de alta

| Paso | Qué captura | Para qué sirve |
|------|-------------|----------------|
| 1. Cuenta | Email, contraseña, rol `shipper`, razón social | Acceso app |
| 2. **Identidad** | **Login facial** + **cédula** del representante | Persona real autorizada |
| 3. **Empresa** | RUT empresa, giro, dirección | Facturación y confianza |
| 4. **Cargo válido** | **Correo corporativo** (no solo Gmail genérico si es PYME mediana), cargo (compras, logística, gerencia) | Evitar publicaciones fraudulentas |
| 5. **Declaración carga** | Términos confianza carga (ya en app) | Responsabilidad mercancía |
| 6. **Revisión** | Admin aprueba KYC | Semi-curado |

> **Hoy:** registro email + empresa + términos carga; KYC admin. Correo corporativo y facial en roadmap.

### 4.2 Discurso comercial — empresa embarcadora

### Público objetivo

PYME que hoy paga **precio pleno** a un transportista dedicado o a intermediario, y busca **flexibilidad** en rutas spot o vuelta.

### Pitch (60 segundos)

> «Publicar una carga en Cubik cuesta **menos que contratar un flete dedicado** cuando solo necesita mover un pedido puntual o aprovechar camiones que **ya van por su corredor**.
>
> Ustedes ven **variedad de camiones verificados** — tolva, cerrado, frío — filtrados por **rubro y seguro**, no un listado anónimo de WhatsApp.
>
> Pedimos **datos rigurosos** — identidad, empresa, correo de contacto real — porque el transportista también arriesga. Eso sube la tasa de respuesta y baja el no-show.
>
> Piloto acotado: corredor RM–Valparaíso, empresas curadas, soporte directo. Empiezan con **una carga de prueba** y escalan si el precio y la trazabilidad cierran.»

### Beneficios concretos para el pitch

- Precio en **CLP**, rango + ofertas comparables.
- **Mapa y estados** en vivo (MVP ya en prod).
- Menor costo en **viajes de vuelta** vs. camión exclusivo ida y vuelta vacío.
- Embarcador elige oferta; no adjudicación opaca.

---

## 5. Variedad de camiones en piloto (demostrar mercado)

Para el discurso a **empresas**, el piloto debe mostrar en demo y en operación real:

| Rubro piloto | Mínimo visible en corredor | Mensaje |
|--------------|----------------------------|---------|
| Construcción | 4–6 tolvas / plataformas | «Hay capacidad pesada en RM–V» |
| Retail / general | 4–6 furgones / semi | «Carga general cubierta» |
| Frío (fase 2 piloto) | 2–3 thermo | «Congelados con seguro B» |

Total ~**10 camiones por rubro activo** antes de ampliar marketing masivo.

---

## 6. Roadmap técnico (respecto a hoy)

| Capacidad | Hoy (0.0.129+) | Piloto manual | Producto |
|-----------|----------------|---------------|----------|
| Registro email + rol | Sí | — | — |
| KYC admin `pending` → `approved` | Sí | Completar docs por WhatsApp | Panel checklist C3a ([C3A-CHECKLIST-TRANSPORTISTA.md](./C3A-CHECKLIST-TRANSPORTISTA.md)) |
| Banco / operar | Sí | — | — |
| Login facial + CI | No | Foto por WhatsApp / Drive | SDK verificación (fase 3) |
| Licencia conducir | No | Checklist admin | Upload + OCR manual |
| Seguro por niveles A/B/C | No | Excel interno | Campos + reglas matching |
| Rubros + tipo flota | No | Tag en onboarding | Tabla `carrier_rubros` + filtros carga |
| Correo corporativo embarcador | No | Validación manual dominio | Verificación DNS o lista blanca |

---

## 7. Checklist captación piloto

### Transportista (antes de `approved`)

- [ ] Cédula identidad (representante legal o conductor titular)
- [ ] Licencia vigente (clase compatible con vehículo)
- [ ] SOAP + póliza RC (nivel A mínimo)
- [ ] Rubro(s) y patente(s) declarados
- [ ] Cuenta bancaria
- [ ] App Android instalada + GPS «siempre»

### Empresa embarcadora

- [ ] Cédula representante
- [ ] RUT y razón social
- [ ] Correo corporativo o contacto verificable
- [ ] Cargo en empresa
- [ ] Primera carga con Maps (origen/destino con sugerencia)
- [ ] Términos confianza carga aceptados

### Operación Cubik (plan B)

- [ ] 1–2 empresas ancla identificadas por rubro
- [ ] Contacto directo para publicar si liquidez &lt; umbral semanal
- [ ] Script WhatsApp al transportista cuando entra match ancla

---

## 8. Referencias

- [PLAN-COMERCIAL-PILOTO.md](./PLAN-COMERCIAL-PILOTO.md) — 25/50 y fases
- [Piloto M2 KPIs](./Piloto-M2-Corredor-KPIs-Riesgos.html) — 20 viajes corredor
- [SQL Supabase — KYC](./SQL-SUPABASE.md) — aprobación admin
- [Checklist operativo C3a](./C3A-CHECKLIST-TRANSPORTISTA.md) — WhatsApp + panel admin
- [CARGO-TRUST.md](./CARGO-TRUST.md) — declaración carga embarcador
- [Journey usuario](./Journey-Usuario-Uber-Truck.html) — flujo actual app
- [WHATSAPP-META-CLOUD.md](./WHATSAPP-META-CLOUD.md) — captación y soporte

---

## 9. Links producción

| Recurso | URL |
|---------|-----|
| Hub documentación | https://www.getcubik.cl/docs/ |
| Este documento | https://www.getcubik.cl/docs/ONBOARDING-PILOTO-RUBROS.md |
| Landing transportistas | https://www.getcubik.cl/transportistas |
| Landing empresas | https://www.getcubik.cl/empresas |
| App | https://www.getcubik.cl/app |

---

## 10. Roadmap verificación (O1–O4)

| ID | Entrega | Descripción |
|----|---------|-------------|
| **O1** | CI + reconocimiento facial | SDK tipo BCI Mach / Onfido / Verifik; piloto C3a usa WhatsApp + checklist manual |
| **O2** | Licencia + póliza en app | Upload, OCR, match datos; clasificación seguro A/B/C automática sugerida |
| **O3** | Rubros + matching | Restricciones por rubro y nivel de seguro en emparejamientos |
| **O4** | Cola docs admin | Panel con fotos/PDFs, estados y auditoría (sustituye checkboxes) |

**Tour app (jun 2026):** transportista pendiente ve pasos 1–4 con herramienta correcta (app vs WhatsApp) y progreso 0/7 hasta aprobación.
