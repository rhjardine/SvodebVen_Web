# SVODEB Web · Plan de proyecto

> Documento vivo del orquestador. Última actualización: sprint 1 (septiembre 2026).

## 1. Punto de partida: auditoría del prototipo Manus

Se importó sin cambios el ZIP entregado (commit de línea base) y se auditó contra el informe de Manus.

| Afirmación del informe Manus                                | Estado real en el ZIP                                                                         |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Enlace "Saltar al contenido", foco visible, menú con Escape | **No presente**                                                                               |
| `robots.txt`, sitemap, favicon, manifest                    | **No presentes**                                                                              |
| 404 en español                                              | **En inglés** ("Page Not Found")                                                              |
| Directorio sin perfiles ficticios                           | **Con fichas ficticias**, y además cargos inventados (p. ej. "Ariana · Presidencia")          |
| Formulario marcado como prototipo                           | Mostraba "Solicitud preparada" **sin enviar nada**                                            |
| Hero corregido para producción                              | La imagen dependía de `/manus-storage/…`, un proxy que **solo existe en el entorno de Manus** |

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

| #   | Pregunta                                                                                                                            | Dónde impacta                                                                                                                                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Archivo maestro del logotipo** (SVG, AI, PDF o PNG con fondo transparente) y manual de marca                                      | Hoy se usa el **logo JPG oficial tal cual** (cabecera, pie, hero, favicon, imagen OG); sobre fondos oscuros va en una placa blanca. Con un archivo transparente se podría usar sin placa y con variante para fondo oscuro |
| 2   | ¿El RIF **J-296571635** y el correo **secretaria@svodeb.org** son correctos y están activos? (vienen del prototipo, sin verificar)  | Pie, avisos, SMTP                                                                                                                                                                                                         |
| 3   | Nombre completo y web de **ALODYB**                                                                                                 | Badge del hero, pie                                                                                                                                                                                                       |
| 4   | Categorías de membresía y requisitos **según los Estatutos**: ¿Activo, Asociado y Estudiante? ¿Exigen número de COV o MPPS?         | Esquema de afiliación                                                                                                                                                                                                     |
| 5   | Junta Directiva vigente (nombres, cargos, período)                                                                                  | Sección Institución                                                                                                                                                                                                       |
| 6   | Hitos históricos (año de fundación, primeras jornadas)                                                                              | Reseña histórica                                                                                                                                                                                                          |
| 7   | Fecha y sede de la Asamblea 2026; próximos eventos confirmados                                                                      | Eventos                                                                                                                                                                                                                   |
| 8   | Dominio definitivo y hosting                                                                                                        | `PUBLIC_SITE_URL`, CSP, SMTP                                                                                                                                                                                              |
| 9   | Cuenta de correo para el envío (Gmail con contraseña de aplicación, Google Workspace o proveedor transaccional)                     | Recepción de afiliaciones                                                                                                                                                                                                 |
| 10  | Revisión legal de los documentos legales (Aviso legal y Aviso de privacidad ya son borradores; cookies y términos están pendientes) | `/privacidad`                                                                                                                                                                                                             |

## 4. Plan de sprints

### Sprint 2 · Preparación para producción ✅ (parte técnica entregada)

Entregado:

- **Prerenderizado (SSG):** cada ruta se genera como HTML completo en el build y React la hidrata en el navegador. La planilla se renderiza en el servidor sin dejar límites de Suspense pendientes, así la hidratación no necesita scripts en línea (la CSP los prohíbe).
- **Compresión** gzip en el servidor: el JavaScript inicial baja de 292 KB a 92 KB transferidos.
- **Zod sin JIT** en el navegador (`jitless`): compatible con la CSP sin `'unsafe-eval'`.
- **Resultado medido con Lighthouse** (móvil, 4G lenta simulada):

  | Métrica          | Antes | Después   |
  | ---------------- | ----- | --------- |
  | LCP              | 4,1 s | **1,9 s** |
  | FCP              | 3,6 s | **1,6 s** |
  | Rendimiento      | 88    | **99**    |
  | Accesibilidad    | 100   | **100**   |
  | Buenas prácticas | 93    | **100**   |
  | SEO              | 100   | **100**   |

- **Contenedor Docker** multi-etapa, usuario sin privilegios y healthcheck; blueprint `render.yaml` para Render.
- **Scripts de operación:**
  - `pnpm smoke <url>`: 7 verificaciones de producción.
  - `pnpm smtp:check`: valida credenciales sin enviar correos.
  - `pnpm content:audit [--strict]`: lista los datos institucionales aún no confirmados.
- **CI ampliado:**
  - El job `verify` suma la prueba de humo sobre el build y la auditoría de contenido.
  - Nuevo job `lighthouse` con presupuestos que bloquean el merge si se incumplen.
- 29 pruebas automatizadas (se agregó la verificación de páginas prerenderizadas, los 404 reales y la compresión).
- Guía paso a paso en `docs/DESPLIEGUE.md`.

Pendiente (depende de la directiva, ver §3):

- Cargar las respuestas 1–7 y sustituir el JPG por el archivo maestro del logotipo.
- Elegir hosting y dominio, configurar SMTP y ejecutar la verificación de `docs/DESPLIEGUE.md` §5.
- Validar la imagen Docker con el pipeline de prerender en el primer despliegue. En este entorno, Docker Hub limitó las descargas (429) y no se pudo reconstruir la imagen final.

### Sprint 3 · Identidad, datos y expedientes ✅ (entregado)

- **Fundaciones:** `Result<T, E>` sin `throw` en la lógica de negocio (ESLint lo hace cumplir), contratos Zod de ruta compartidos por servidor y cliente, taxonomía única de errores.
- **Datos:** PostgreSQL con RLS activada y forzada; dos roles (`svodeb_owner` para DDL, `svodeb_app` sin BYPASSRLS); "proxy de identidad" con `set_config(..., true)` dentro de una transacción; tablas de bitácora de solo inserción. Probado contra Postgres real, incluida una prueba de mutación de políticas.
- **Sesión:** enlace mágico por correo (un solo uso, 15 min, token en el fragmento y canje por POST), JWT HS256 de 15 min en cookie `HttpOnly; Secure; SameSite=Strict`, refresh opaco rotatorio con detección de reutilización (revoca la familia), CSRF por cabecera, límites por IP y por correo, rotación de secreto con `kid`.
- **Idempotencia:** `Idempotency-Key` en la misma transacción que la operación; concurrentes producen un solo efecto; otra carga útil con la misma clave → 422; retención de 24 h. Aplicada a la afiliación.
- **Expedientes:** persistencia con notificación por SMTP posterior (si el correo falla no se pierde nada), máquina de estados pura, panel `/secretaria` (noindex), transición con `FOR UPDATE`, auditoría y alta del miembro al aprobar.
- **Cuentas de personal:** solo por CLI (`pnpm admin:create`); ninguna pantalla escala privilegios.

**Límites conocidos (honestos):**

- RLS protege de errores de lógica (IDOR, `WHERE` olvidado); no protege ante una inyección SQL total (por eso solo hay consultas parametrizadas y el rol de la app no tiene DDL).
- El rol `system` (flujos de autenticación) es de confianza: lo fija la aplicación, no el cliente.
- El JWT de acceso no se puede revocar: un cambio de rol o una suspensión tardan hasta 15 min en surtir efecto en la API (el refresh sí relee el rol y el estado).
- Si se pierde la respuesta de un refresh, la reutilización del token anterior se trata como robo y obliga a iniciar sesión de nuevo (preferimos fallar cerrado).
- El limitador de tasa es en memoria: con varias réplicas hay que moverlo a Redis/Postgres.
- Carga de documentos (bucket privado, URLs firmadas) pasó al sprint 5.

### Sprint 4 · Directorio ✅ (entregado) · CMS pendiente

- **Directorio público:** `GET /api/v1/directory` con búsqueda (sin acentos, varias palabras), filtros por área y estado, `pageSize` ≤ 20, página ≤ 50 (máximo 1000 fichas alcanzables), límite de 60 consultas/min por IP y `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`. La ficha pública **no contiene correo, teléfono ni el identificador del miembro**.
- **Privacidad impuesta por la base (RLS):** solo se ve una ficha publicada, con consentimiento y verificación vigente (fecha de Caracas). Un miembro suspendido sale del directorio al instante (disparador). Nadie puede publicar sin consentimiento (restricción `CHECK`).
- **Autogestión:** `/mi-ficha` (noindex) — el miembro decide si aparece, edita sus datos y puede eliminarse. Cambiar nombre, ciudad, estado o áreas **invalida la verificación** (nadie conserva el sello bajo otro nombre). Un miembro no puede tocar los campos de verificación (RLS + disparador, probado).
- **Verificación:** en `/secretaria`, secretaría/admin fija la vigencia (hasta 400 días) o despublica; despublicar borra la verificación, así que el miembro no reaparece solo. Todo queda en `audit_log`.
- **Cliente:** búsqueda con debounce de 300 ms, estado en la URL (leído con el mismo esquema Zod que la API; valores manipulados se ignoran campo a campo), paginación, botón Atrás y respuestas viejas descartadas. Verificado en navegador real: una sola petición por búsqueda, sin errores de consola ni CSP.
- **Endurecimiento tras la revisión de seguridad del sprint 3:** la secretaría ya no puede crear ni promover cuentas de personal (solo admin; migración 0003); la lectura de datos de un postulante queda auditada; el limitador de tasa tiene memoria acotada.
- **Fuera de este sprint:** CMS de directiva, eventos e hitos (el contenido sigue en `client/src/content`); URL por perfil (`/especialistas/:slug`); visor PDF y URLs firmadas del área de miembros (necesitan almacenamiento R2, sprint 5).
- **Límite conocido:** la búsqueda usa `LIKE` sobre un texto normalizado. Es adecuado para cientos o pocos miles de fichas; con más, conviene `pg_trgm` (requiere permiso de extensiones en el proveedor).

### Sprint 5 · Eventos e inscripciones

- Páginas de evento con `schema.org/Event`, exportación `.ics` e inscripción.
- Constancias de asistencia con código QR verificable.

### Sprint 6 · Pagos (tras asesoría)

- Primero, un flujo de **reporte de pago**: método (Pago Móvil, transferencia u otros), referencia y comprobante, con conciliación de tesorería.
- Montos en Bs. con la tasa BCV del día, guardada junto a cada pago.
- Validar con asesoría los aspectos cambiarios y regulatorios antes de integrar pasarelas.
- Nunca manejar datos de tarjeta propios: solo checkout alojado.

## 5. Decisiones de arquitectura

| Decisión            | Elección                                   | Motivo                                                 | Alternativa                                                            |
| ------------------- | ------------------------------------------ | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| Stack front         | Se mantiene Vite + React                   | Funciona, es ligero y migrarlo no aporta valor todavía | Next.js o Astro si se necesita SSR/SSG para SEO de perfiles (sprint 4) |
| Recepción           | SMTP detrás del puerto `ApplicationIntake` | Coste cero y operable por secretaría desde el día 1    | Postgres (sprint 3) sin tocar el dominio                               |
| Validación          | Zod compartido cliente/servidor            | Una sola fuente de verdad                              | —                                                                      |
| Rate limit          | En memoria, por IP                         | Una sola instancia                                     | Redis o Postgres con varias réplicas                                   |
| Persistencia futura | PostgreSQL + RLS                           | Aislamiento por rol a nivel de base de datos           | Payload CMS (control de acceso en la app, con panel incluido)          |

## 6. Orquestación por especialidad

Cada sprint se reparte en frentes con criterios de aceptación verificables. Todo cambio entra por PR con CI en verde.

| Frente              | Responsabilidad                                  | Criterio de salida                                               |
| ------------------- | ------------------------------------------------ | ---------------------------------------------------------------- |
| Contenido / Marca   | Datos oficiales, logotipo, textos                | Cero `PENDIENTE` en `content/site.ts`                            |
| Frontend / A11y     | Secciones, estados, WCAG 2.2 AA                  | axe sin violaciones; navegación completa con teclado             |
| Backend / Seguridad | Casos de uso, adaptadores, cabeceras             | Pruebas de integración de la API; audit limpio                   |
| Plataforma          | Deploy, dominio, SMTP, monitoreo                 | `/api/health` monitoreado; alertas si falla la entrega de correo |
| QA                  | Pruebas de extremo a extremo, humo en producción | Flujo de afiliación real verificado                              |
