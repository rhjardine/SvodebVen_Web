# Guía de despliegue · Sitio SVODEB

Esta guía explica cómo publicar el sitio en producción y cómo comprobar que funciona.

## 1. Requisitos previos (los decide la directiva)

| Recurso | Para qué | Ejemplo |
|---|---|---|
| Dominio | Dirección pública del sitio | `svodeb.org` |
| Cuenta de correo SMTP | Recibir afiliaciones y enviar el acuse | Google Workspace, Gmail con contraseña de aplicación, Zoho, Brevo |
| Correo de secretaría | Destino de las solicitudes | `secretaria@svodeb.org` |
| Hosting con Docker | Ejecutar el contenedor | Render (incluido `render.yaml`), Railway, Fly.io o un VPS |

## 2. Variables de entorno

Parte de `.env.example`. **Nunca** subas el `.env` real al repositorio.

| Variable | Obligatoria | Descripción |
|---|---|---|
| `NODE_ENV` | Sí | `production` |
| `PORT` | No | Puerto interno (por defecto `3000`) |
| `TRUST_PROXY_HOPS` | Sí detrás de un proxy | `1` en Render, Railway o Nginx: así el límite de envíos por IP usa la IP real |
| `PUBLIC_SITE_URL` | Recomendada | URL canónica; activa `sitemap.xml` |
| `ALLOWED_ORIGINS` | Recomendada | Orígenes que pueden enviar la planilla (p. ej. `https://svodeb.org`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`, `SECRETARIA_EMAIL` | Todas o ninguna | Recepción de afiliaciones |

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

## 5. Verificación después de cada despliegue

```bash
pnpm smtp:check                     # credenciales SMTP (no envía correos)
pnpm smoke https://svodeb.org       # 7 verificaciones: salud, cabeceras, 404, SEO, caché, API
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
