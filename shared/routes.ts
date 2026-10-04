/**
 * Rutas que el cliente sabe renderizar. Cada una se prerenderiza en build a su
 * propio HTML; el servidor responde 404 real (con 404.html) para el resto.
 */
export type PrerenderedRoute = Readonly<{
  path: string;
  file: string;
  title: string;
  /** `false`: fuera del sitemap y con `noindex` (páginas de sesión). */
  indexable?: boolean;
}>;

const SITE_NAME = "SVODEB";

export const PRERENDERED_ROUTES: readonly PrerenderedRoute[] = Object.freeze([
  {
    path: "/",
    file: "index.html",
    title: `${SITE_NAME} · Sociedad Venezolana de Operatoria Dental, Estética y Biomateriales`,
  },
  {
    path: "/privacidad",
    file: "privacidad.html",
    title: `Aviso de privacidad · ${SITE_NAME}`,
  },
  {
    path: "/acceso",
    file: "acceso.html",
    title: `Acceso de miembros · ${SITE_NAME}`,
    indexable: false,
  },
  {
    path: "/mi-ficha",
    file: "mi-ficha.html",
    title: `Mi ficha del directorio · ${SITE_NAME}`,
    indexable: false,
  },
  {
    path: "/secretaria",
    file: "secretaria.html",
    title: `Secretaría · ${SITE_NAME}`,
    indexable: false,
  },
]);

export const NOT_FOUND_PAGE: PrerenderedRoute = Object.freeze({
  path: "/404",
  file: "404.html",
  title: `Página no encontrada · ${SITE_NAME}`,
});

export const CLIENT_ROUTES: ReadonlySet<string> = new Set(
  PRERENDERED_ROUTES.map(route => route.path)
);

/** Rutas que van al sitemap (las de sesión quedan fuera). */
export const INDEXABLE_ROUTES: readonly string[] = PRERENDERED_ROUTES.filter(
  route => route.indexable !== false
).map(route => route.path);
