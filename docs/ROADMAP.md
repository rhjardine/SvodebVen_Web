# SVODEB Web · Plan de proyecto

> Documento vivo del orquestador. Última actualización: sprint 1 (septiembre 2026).

## 1. Punto de partida: auditoría del prototipo Manus

Se importó sin cambios el ZIP entregado (commit de línea base) y se auditó contra el informe de Manus.

| Afirmación del informe Manus | Estado real en el ZIP |
|---|---|
| Enlace "Saltar al contenido", foco visible, menú con Escape | **No presente** |
| `robots.txt`, sitemap, favicon, manifest | **No presentes** |
| 404 en español | **En inglés** ("Page Not Found") |
| Directorio sin perfiles ficticios | **Con fichas ficticias**, y además cargos inventados (p. ej. "Ariana · Presidencia") |
| Formulario marcado como prototipo | Mostraba "Solicitud preparada" **sin enviar nada** |
| Hero corregido para producción | La imagen dependía de `/manus-storage/…`, un proxy que **solo existe en el entorno de Manus** |

Otros hallazgos:

- Home monolítico de 311 líneas.
- 53 componentes de interfaz sin uso y unas 40 dependencias innecesarias.
- Plugins de depuración de Manus que registraban la consola y la red.
- Un parche a `wouter` que exponía rutas en `window`.
- `maximum-scale=1`, que impedía hacer zoom y afecta la accesibilidad.
- El error boundary mostraba trazas en producción.
- Texto gris con contraste de 3,84:1 (WCAG AA exige 4,5:1).

## 2. Qué se entregó en el sprint 1

**Arquitectura**

- Separación `shared` (contrato), `server` (caso de uso con puertos y adaptadores) y `client` (organizado por features).
- Contenido tipado e inmutable en `client/src/content/`.

**Marca**

- Paleta tomada de la portada de los Estatutos y del isotipo: marino, azul real y aguamarina.
- Franjas de la portada usadas como recurso gráfico.
- Hero sin imagen externa: el elemento LCP es el titular.

**Honestidad del contenido**

- Se eliminaron personas y cargos inventados, pseudo-métricas y la tarjeta "fase futura".
- Donde falta información hay estados vacíos explícitos.

**Afiliación de punta a punta**

- Esquema Zod compartido con unión discriminada por categoría.
- El teléfono se normaliza a formato E.164.
- Consentimiento obligatorio, honeypot y límite de tasa por IP.
- Límite de 16 KB por solicitud, control de `Origin` y errores tipados.
- Referencia `SVD-AAAA-XXXXXX`.
- Adaptador SMTP con acuse al postulante.
- Si no hay SMTP configurado, la API responde **503 real** y el sitio ofrece un correo ya redactado. Nunca se simula un éxito.

**Seguridad**

- CSP estricta sin orígenes externos: fuentes auto-alojadas, sin `data:`.
- HSTS, `nosniff`, `frame-ancestors 'none'` y `Permissions-Policy`.
- Respuestas 404 reales para rutas desconocidas.
- `pnpm audit` limpio (nodemailer se actualizó de la v7 a la v10 por advertencias altas).

**Accesibilidad**

- Enlace para saltar al contenido.
- Menú móvil con `aria-expanded`, cierre con Escape y devolución del foco.
- Errores en línea con `aria-describedby`, resumen con `role=alert` y foco en el primer campo inválido.
- Inputs de 16 px (iOS no hace zoom), contraste AA y respeto de `prefers-reduced-motion`.

**Rendimiento**

- El formulario y Zod se cargan diferidos.
- JS inicial de unos 92 KB gzip.
- Assets con hash e `immutable`.

**SEO**

- `lang="es-VE"`, meta description, Open Graph con imagen 1200×630 y JSON-LD `Organization`.
- `robots.txt` y `sitemap.xml` se generan a partir de `PUBLIC_SITE_URL`.

**Calidad**

- 26 pruebas: esquema, API HTTP, configuración, directorio y planilla.
- CI en GitHub Actions: typecheck, pruebas, build y audit.

## 3. Preguntas abiertas (bloquean la publicación)

| # | Pregunta | Dónde impacta |
|---|---|---|
| 1 | **Vector oficial del logotipo** (SVG, AI o PDF) | Cabecera, pie, favicon, imagen OG. Hoy se usa un logotipo tipográfico y una ilustración inspirada en el isotipo |
| 2 | ¿El RIF **J-296571635** y el correo **secretaria@svodeb.org** son correctos y están activos? (vienen del prototipo, sin verificar) | Pie, avisos, SMTP |
| 3 | Nombre completo y web de **ALODYB** | Badge del hero, pie |
| 4 | Categorías de membresía y requisitos **según los Estatutos**: ¿Activo, Asociado y Estudiante? ¿Exigen número de COV o MPPS? | Esquema de afiliación |
| 5 | Junta Directiva vigente (nombres, cargos, período) | Sección Institución |
| 6 | Hitos históricos (año de fundación, primeras jornadas) | Reseña histórica |
| 7 | Fecha y sede de la Asamblea 2026; próximos eventos confirmados | Eventos |
| 8 | Dominio definitivo y hosting | `PUBLIC_SITE_URL`, CSP, SMTP |
| 9 | Cuenta de correo para el envío (Gmail con contraseña de aplicación, Google Workspace o proveedor transaccional) | Recepción de afiliaciones |
| 10 | Revisión legal del Aviso de privacidad (hoy es un borrador) | `/privacidad` |

## 4. Plan de sprints

### Sprint 2 · Contenido oficial y puesta en línea (1–2 semanas)

- Cargar las respuestas 1–7 y sustituir el logotipo provisional.
- Desplegar en un host con Node (Render, Railway o un VPS) con HTTPS, `.env` real y SMTP.
- Prueba de humo en producción: envío real de afiliación, acuse recibido y cabeceras verificadas con securityheaders.com.
- Métricas de campo con Lighthouse CI (objetivo LCP < 2,5 s en 4G lenta).

### Sprint 3 · Gestión de expedientes (3–4 semanas)

- Decisión de persistencia (ver §5). Recomendación: PostgreSQL con RLS.
- Nuevo adaptador `PostgresApplicationIntake` detrás del mismo puerto `ApplicationIntake`. El caso de uso no cambia.
- Máquina de estados del expediente: `RECIBIDA → EN_REVISION → REQUIERE_INFORMACION → APROBADA | RECHAZADA`, con bitácora inmutable (solo inserciones).
- Panel de secretaría con autenticación y roles (secretaría, directiva).
- Carga de documentos: bucket privado, URL firmadas, validación del tipo real y límite de tamaño.

### Sprint 4 · CMS y directorio (3 semanas)

- CMS para directiva, eventos, hitos y fichas.
- Directorio: consentimiento por miembro, fecha de verificación, URL por perfil (`/especialistas/:slug`) y solicitud de baja.

### Sprint 5 · Eventos e inscripciones

- Páginas de evento con `schema.org/Event`, exportación `.ics` e inscripción.
- Constancias de asistencia con código QR verificable.

### Sprint 6 · Pagos (tras asesoría)

- Primero, un flujo de **reporte de pago**: método (Pago Móvil, transferencia u otros), referencia y comprobante, con conciliación de tesorería.
- Montos en Bs. con la tasa BCV del día, guardada junto a cada pago.
- Validar con asesoría los aspectos cambiarios y regulatorios antes de integrar pasarelas.
- Nunca manejar datos de tarjeta propios: solo checkout alojado.

## 5. Decisiones de arquitectura

| Decisión | Elección | Motivo | Alternativa |
|---|---|---|---|
| Stack front | Se mantiene Vite + React | Funciona, es ligero y migrarlo no aporta valor todavía | Next.js o Astro si se necesita SSR/SSG para SEO de perfiles (sprint 4) |
| Recepción | SMTP detrás del puerto `ApplicationIntake` | Coste cero y operable por secretaría desde el día 1 | Postgres (sprint 3) sin tocar el dominio |
| Validación | Zod compartido cliente/servidor | Una sola fuente de verdad | — |
| Rate limit | En memoria, por IP | Una sola instancia | Redis o Postgres con varias réplicas |
| Persistencia futura | PostgreSQL + RLS | Aislamiento por rol a nivel de base de datos | Payload CMS (control de acceso en la app, con panel incluido) |

## 6. Orquestación por especialidad

Cada sprint se reparte en frentes con criterios de aceptación verificables. Todo cambio entra por PR con CI en verde.

| Frente | Responsabilidad | Criterio de salida |
|---|---|---|
| Contenido / Marca | Datos oficiales, logotipo, textos | Cero `PENDIENTE` en `content/site.ts` |
| Frontend / A11y | Secciones, estados, WCAG 2.2 AA | axe sin violaciones; navegación completa con teclado |
| Backend / Seguridad | Casos de uso, adaptadores, cabeceras | Pruebas de integración de la API; audit limpio |
| Plataforma | Deploy, dominio, SMTP, monitoreo | `/api/health` monitoreado; alertas si falla la entrega de correo |
| QA | Pruebas de extremo a extremo, humo en producción | Flujo de afiliación real verificado |
