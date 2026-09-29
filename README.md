# SVODEB · Sitio web

Sitio institucional de la **Sociedad Venezolana de Operatoria Dental, Estética y Biomateriales**.

- **Cliente:** React 19 + Vite + Tailwind CSS 4 (`client/`)
- **Servidor:** Express, que sirve el build y la API de afiliación (`server/`)
- **Contrato compartido:** esquemas Zod y catálogos que usan cliente y servidor (`shared/`)

## Desarrollo

```bash
pnpm install
pnpm dev:api   # API en :3001
pnpm dev       # Front en :3000 (redirige /api a :3001)
```

## Verificación (lo mismo que ejecuta CI)

```bash
pnpm verify    # typecheck + pruebas + build
```

## Producción

```bash
pnpm build
cp .env.example .env   # completar valores reales
pnpm start
```

Sin variables `SMTP_*`, la API de afiliación responde `503` y la planilla ofrece enviar la solicitud por correo. Nunca se simula un envío exitoso.

## Estructura

```
shared/membership/   Catálogos, esquema de la solicitud y contrato HTTP
server/membership/   Caso de uso (puertos) + adaptador SMTP + rutas HTTP
server/http/         Cabeceras de seguridad, límite de tasa, control de origen
client/src/content/  Contenido institucional tipado e inmutable (antes del CMS)
client/src/features/ Secciones por dominio: home, directory, membership
tests/               Vitest: esquema, API, configuración, directorio, planilla
docs/ROADMAP.md      Plan del proyecto, decisiones y preguntas abiertas
```

Regla editorial: en `client/src/content/site.ts` solo se publica información **confirmada** por la directiva.
