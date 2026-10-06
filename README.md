# SVODEB · Sitio web

Sitio institucional de la **Sociedad Venezolana de Operatoria Dental, Estética y Biomateriales**.

- **Cliente:** React 19 + Vite + Tailwind CSS 4 (`client/`)
- **Servidor:** Express, que sirve el build y la API: afiliación, acceso de miembros, directorio y revisión de expedientes (`server/`)
- **Datos:** PostgreSQL con RLS (`db/migrations/`); sin base de datos el sitio funciona con SMTP y el directorio queda vacío
- **Contrato compartido:** esquemas Zod y catálogos que usan cliente y servidor (`shared/`)

## Desarrollo

```bash
pnpm install
pnpm dev:api   # API en :3001
pnpm dev       # Front en :3000 (redirige /api a :3001)
```

## Verificación (lo mismo que ejecuta CI)

```bash
pnpm verify    # typecheck + lint + pruebas + build
pnpm db:local  # (opcional) Postgres local para las pruebas de integración
```

## Producción

```bash
pnpm build             # cliente + prerenderizado de cada ruta + servidor
cp .env.example .env   # completar valores reales
pnpm start
```

Guía completa (Render, Docker, verificación): [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md).

## Operación

```bash
pnpm smoke <url>            # prueba de humo contra un despliegue
pnpm smtp:check             # verifica credenciales SMTP (no envía correos)
pnpm content:audit          # contenido institucional pendiente de confirmar
pnpm db:migrate             # aplica migraciones (DATABASE_MIGRATION_URL)
pnpm admin:create           # crea una cuenta de personal (DATABASE_URL)
pnpm lighthouse             # presupuestos de rendimiento y accesibilidad
```

Sin variables `SMTP_*`, la API de afiliación responde `503` y la planilla ofrece enviar la solicitud por correo. Nunca se simula un envío exitoso.

## Documentación legal

Se publica **por iteraciones** y cada documento es un **borrador** hasta que la directiva y su asesoría legal lo aprueben (cada página lo indica). Los datos del titular viven en `client/src/content/legal.ts`; lo no confirmado se muestra como «Por confirmar» y aparece en `pnpm content:audit`.

| Documento              | Ruta           | Estado                                                                                                                   |
| ---------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Aviso legal            | `/aviso-legal` | Borrador publicado (iteración 1)                                                                                         |
| Aviso de privacidad    | `/privacidad`  | Borrador previo; se ampliará en la iteración 2 (datos, finalidades, base de legitimación, plazos, derechos y encargados) |
| Política de cookies    | `/cookies`     | Pendiente (iteración 3). Hoy solo se usan cookies estrictamente necesarias de sesión; no hay analítica ni publicidad     |
| Términos y condiciones | `/terminos`    | Pendiente (iteración 4). Cubrirá la membresía y, al llegar el sprint 6, pagos y reservas                                 |

Estos textos son un punto de partida técnico y **no constituyen asesoría legal**.

## Estructura

```
shared/              Result, errores, contratos de ruta (Zod) y esquemas comunes
server/auth/         Enlace mágico, JWT en cookies, refresh rotatorio
server/membership/   Afiliación (puertos + adaptadores Postgres/SMTP) y revisión de expedientes
server/directory/    Directorio público, autogestión y verificación
server/http/         Rutas por contrato, idempotencia, límite de tasa, cabeceras de seguridad
db/migrations/       Esquema SQL, roles y políticas RLS
client/src/content/  Contenido institucional tipado e inmutable (antes del CMS)
client/src/features/ Secciones por dominio: home, directory, membership, legal
client/src/entry-server.tsx  Render para el prerenderizado (SSG)
scripts/             Prerender, prueba de humo, SMTP y auditoría de contenido
tests/               Vitest: unitarias e integración contra Postgres real (RLS, auth, directorio)
docs/ROADMAP.md      Plan del proyecto, decisiones y preguntas abiertas
docs/DESPLIEGUE.md   Guía de despliegue y verificación
```

Regla editorial: en `client/src/content/site.ts` solo se publica información **confirmada** por la directiva.
