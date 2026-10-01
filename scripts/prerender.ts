/**
 * Prerenderiza cada ruta conocida a HTML estático (SSG) tras `vite build`.
 * Resultado: el contenido llega en la primera respuesta (mejor LCP y SEO);
 * React luego hidrata el mismo árbol en el navegador.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  NOT_FOUND_PAGE,
  PRERENDERED_ROUTES,
  type PrerenderedRoute,
} from "../shared/routes";

const ROOT = path.resolve(import.meta.dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "dist/public");
const SSR_ENTRY = path.join(ROOT, "dist/ssr/entry-server.js");
const ROOT_PLACEHOLDER = '<div id="root"></div>';

type RenderFn = (path: string) => Promise<string>;

class PrerenderError extends Error {
  override readonly name = "PrerenderError";
}

function isRenderFn(value: unknown): value is RenderFn {
  return typeof value === "function";
}

async function loadRender(): Promise<RenderFn> {
  const mod: unknown = await import(pathToFileURL(SSR_ENTRY).href);
  const render =
    typeof mod === "object" && mod !== null && "render" in mod
      ? mod.render
      : undefined;
  if (!isRenderFn(render))
    throw new PrerenderError(`${SSR_ENTRY} no exporta render()`);
  return render;
}

/** Precarga las fuentes del titular (elemento LCP) para evitar el cambio tardío de tipografía. */
function fontPreloads(): string {
  const assets = readdirSync(path.join(PUBLIC_DIR, "assets"));
  return assets
    .filter(file =>
      /^dm-serif-display-latin-400-(normal|italic)-.*\.woff2$/.test(file)
    )
    .map(
      file =>
        `<link rel="preload" href="/assets/${file}" as="font" type="font/woff2" crossorigin />`
    )
    .join("\n    ");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildPage(
  template: string,
  route: PrerenderedRoute,
  html: string,
  preloads: string
): string {
  if (!template.includes(ROOT_PLACEHOLDER)) {
    throw new PrerenderError(
      "La plantilla no contiene el contenedor #root vacío"
    );
  }
  return template
    .replace(
      /<title>[\s\S]*?<\/title>/,
      `<title>${escapeHtml(route.title)}</title>`
    )
    .replace("</head>", `    ${preloads}\n  </head>`)
    .replace(ROOT_PLACEHOLDER, `<div id="root">${html}</div>`);
}

async function main(): Promise<void> {
  const render = await loadRender();
  const template = readFileSync(path.join(PUBLIC_DIR, "index.html"), "utf8");
  const preloads = fontPreloads();

  for (const route of [...PRERENDERED_ROUTES, NOT_FOUND_PAGE]) {
    const html = await render(route.path);
    if (html.length < 200)
      throw new PrerenderError(`HTML vacío para ${route.path}`);
    writeFileSync(
      path.join(PUBLIC_DIR, route.file),
      buildPage(template, route, html, preloads)
    );
    console.log(
      `✔ ${route.path} → dist/public/${route.file} (${(html.length / 1024).toFixed(1)} KB)`
    );
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
