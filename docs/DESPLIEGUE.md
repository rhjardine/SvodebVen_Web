# Guía de despliegue · Sitio SVODEB

Esta guía explica cómo publicar el sitio en producción y cómo comprobar que funciona.

## 1. Requisitos previos (los decide la directiva)

| Recurso               | Para qué                               | Ejemplo                                                           |
| --------------------- | -------------------------------------- | ----------------------------------------------------------------- |
| Dominio               | Dirección pública del sitio            | `svodeb.org`                                                      |
| Cuenta de correo SMTP | Recibir afiliaciones y enviar el acuse | Google Workspace, Gmail con contraseña de aplicación, Zoho, Brevo |
| Correo de secretaría  | Destino de las solicitudes             | `secretaria@svodeb.org`                                           |
| Hosting con Docker    | Ejecutar el contenedor                 | Render (incluido `render.yaml`), Railway, Fly.io o un VPS         |

## 2. Variables de entorno

Parte de `.env.example`. **Nunca** subas el `.env` real al repositorio.

| Variable                                                                                               | Obligatoria           | Descripción                                                                   |
| ------------------------------------------------------------------------------------------------------ | --------------------- | ----------------------------------------------------------------------------- |
| `NODE_ENV`                                                                                             | Sí                    | `production`                                                                  |
| `PORT`                                                                                                 | No                    | Puerto interno (por defecto `3000`)                                           |
| `TRUST_PROXY_HOPS`                                                                                     | Sí detrás de un proxy | `1` en Render, Railway o Nginx: así el límite de envíos por IP usa la IP real |
| `PUBLIC_SITE_URL`                                                                                      | Recomendada           | URL canónica; activa `sitemap.xml`                                            |
| `ALLOWED_ORIGINS`                                                                                      | Recomendada           | Orígenes que pueden enviar la planilla (p. ej. `https://svodeb.org`)          |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`, `SECRETARIA_EMAIL` | Todas o ninguna       | Recepción de afiliaciones                                                     |

| `DATABASE_URL` | Para expedientes y acceso | Conexión del rol `svodeb_app` (sujeto a RLS). Con ella el expediente se **persiste** y el correo solo notifica |
| `DATABASE_MIGRATION_URL` | Solo al migrar | Conexión del rol dueño `svodeb_owner`; solo la usa `pnpm db:migrate` |
| `JWT_SECRET` | Con `DATABASE_URL` | ≥ 32 caracteres (`openssl rand -base64 48`) |
| `JWT_SECRET_PREVIOUS` | Solo en rotación | Secreto anterior: se acepta únicamente para verificar |
| `ACCESS_TTL_SECONDS`, `REFRESH_TTL_SECONDS`, `LOGIN_LINK_TTL_SECONDS` | No | 900 / 2592000 / 900 |

Con `DATABASE_URL` en producción el servidor **se niega a arrancar** si falta `JWT_SECRET`, `PUBLIC_SITE_URL` o SMTP (sin correo nadie podría iniciar sesión).

Sin SMTP, el sitio funciona igual: la planilla le ofrece al postulante un correo ya redactado y la API responde `503`. Nunca se simula un envío exitoso. Si configuras SMTP a medias, el servidor **se niega a arrancar** y lo indica en el log.

## 3. Opción A: Render (recomendada para empezar)

1. En Render: **New → Blueprint** y selecciona el repositorio `SvodebVen_Web`. Render lee `render.yaml`.
2. Completa en el panel las variables marcadas como secretas (`sync: false`).
3. Al terminar el primer despliegue, configura el dominio propio en **Settings → Custom Domains**. Render emite el certificado HTTPS automáticamente.
4. Cada push a `main` despliega solo (`autoDeploy: true`).

## 4. Opción B: cualquier servidor con Docker

```bash
docker build -t svodeb-web .
docker run -d --name svodeb-web --restart unless-stopped \
  --env-file .env -p 127.0.0.1:3000:3000 svodeb-web
```

Pon delante un proxy con HTTPS (Caddy, Nginx o Traefik) y define `TRUST_PROXY_HOPS=1`. La imagen corre como usuario sin privilegios (`node`) e incluye un healthcheck en `/api/health`.

## 4b. Base de datos, migraciones y cuentas de personal

1. Crea la base (Render Postgres) y los roles con `db/provision.sql` (`pnpm db:provision`). Si el plan no permite `CREATE ROLE`, el plan B es un único rol con `FORCE ROW LEVEL SECURITY`.
2. Aplica migraciones **antes** de cada despliegue: `DATABASE_MIGRATION_URL=… pnpm db:migrate`. Es idempotente, usa un bloqueo consultivo y compara checksums: **editar una migración ya aplicada es un error**; crea una nueva.
3. Crea la primera cuenta: `DATABASE_URL=… pnpm admin:create correo@svodeb.org "Nombres" "Apellidos" admin`. Roles: `admin`, `secretaria`, `tesoreria`.
4. Inicia sesión en `/acceso` (recibirás el enlace por correo) y revisa expedientes en `/secretaria`.

**Rotación de `JWT_SECRET`:** (1) pon el secreto actual en `JWT_SECRET_PREVIOUS` y uno nuevo en `JWT_SECRET`; (2) despliega: las sesiones vigentes siguen válidas y las nuevas se firman con el secreto nuevo; (3) pasados 15 min (vida del token de acceso) retira `JWT_SECRET_PREVIOUS`. Si se filtró el secreto, omite el paso (1) para invalidar todo de inmediato.

**Copias de seguridad:** los expedientes contienen datos personales. Activa copias automáticas del proveedor y define el plazo de retención con asesoría legal (pendiente).

### Directorio y Cloudflare

Cloudflare cachea por extensión de archivo: **no cachea el JSON** de `/api/v1/directory` por defecto. Crea una _Cache Rule_: si la ruta empieza por `/api/v1/directory`, "Eligible for cache" y "Respect origin TTL" (el servidor ya envía `s-maxage=60`). No cachees nada bajo `/api/v1/auth`, `/api/v1/members` ni `/api/v1/admin` (son `no-store`). Si el sitio va detrás de Cloudflare, no confíes en `CF-Connecting-IP` sin verificar que la petición viene de Cloudflare, o el límite por IP se podrá evadir. Ajusta `TRUST_PROXY_HOPS` al número real de proxies.

### Render: workspace, base de datos y paso de liberación

- **Facturación:** Render cobra por _workspace_, no por proyecto. Crea un workspace propio de SVODEB con su método de pago para no mezclar costos con otros proyectos. Verifica en Billing el plan del workspace y su cuota de plataforma antes de crear recursos.
- **Región:** `virginia` (la más cercana a Venezuela entre las disponibles). Servicio web y base deben estar en la misma región para usar la red privada.
- **Base de datos:** `ipAllowList` vacía = sin acceso desde Internet; solo el servicio web, por la red privada. Para consultarla desde tu equipo agrega tu IP en _Networking_.
- **Paso de liberación (`dist/release.js`):** corre antes de arrancar y aplica las migraciones. Se ve en los _Logs_ del despliegue (`release: …`). Si falla, el despliegue no arranca.
- **Rol único (limitación honesta):** Render entrega un solo usuario de base de datos. Con `DB_APP_ROLE` y `DB_APP_PASSWORD` el paso de liberación intenta crear un rol separado para la aplicación (sin DDL); si no los defines, usa el mismo usuario: las políticas RLS siguen aplicando (`FORCE ROW LEVEL SECURITY`, usuario sin superusuario ni BYPASSRLS), pero la aplicación conserva permiso de DDL. Para producción conviene el rol separado.
- **Variables obligatorias en producción con base de datos:** `DATABASE_URL` (usa _Add from Database → Internal Database URL_), `JWT_SECRET` (botón _Generate_), `PUBLIC_SITE_URL`, `ALLOWED_ORIGINS` y todas las `SMTP_*`: sin correo nadie podría iniciar sesión, por eso el servidor se niega a arrancar.

## 5. Verificación después de cada despliegue

```bash
pnpm smtp:check                     # credenciales SMTP (no envía correos)
pnpm smoke https://svodeb.org       # 9 verificaciones: salud, cabeceras, 404, SEO, caché, API, sesión, directorio
```

Luego, una prueba manual completa:

1. Envía una afiliación real de prueba desde el sitio.
2. Comprueba que llegó el correo a secretaría (con número de referencia `SVD-AAAA-XXXXXX`).
3. Comprueba que llegó el acuse al postulante (revisa también la carpeta de spam).
4. Revisa las cabeceras en https://securityheaders.com (objetivo: nota A).

## 6. Antes de anunciar el sitio

```bash
pnpm content:audit --strict
```

Este comando falla mientras quede contenido marcado como `PENDIENTE` (RIF, correo, ALODYB, directiva, Estatutos, aviso legal). Es la lista de lo que la directiva debe confirmar.

## 7. Calidad continua (CI)

En cada push, GitHub Actions ejecuta:

- **verify:** verificación de tipos, 29 pruebas, build, auditoría de dependencias, prueba de humo sobre el build y auditoría de contenido.
- **lighthouse:** presupuestos en móvil con 4G lenta simulada (rendimiento ≥ 85, accesibilidad ≥ 95, LCP ≤ 2,5 s, CLS ≤ 0,1). Los informes quedan como artefacto descargable.
