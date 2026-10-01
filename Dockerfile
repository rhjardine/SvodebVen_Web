# syntax=docker/dockerfile:1.7
# Imagen de producción del sitio SVODEB: build reproducible y ejecución sin privilegios.

ARG NODE_VERSION=22-alpine

# ─── Etapa 1: dependencias y build ──────────────────────────────────────────
FROM node:${NODE_VERSION} AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ─── Etapa 2: solo dependencias de producción ───────────────────────────────
FROM node:${NODE_VERSION} AS prod-deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# ─── Etapa 3: ejecución ─────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./

# Usuario sin privilegios provisto por la imagen oficial de Node.
USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
