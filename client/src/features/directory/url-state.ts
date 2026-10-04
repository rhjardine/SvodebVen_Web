import {
  DirectoryQuerySchema,
  type DirectoryQuery,
} from "@shared/directory/contract";

export const DEFAULT_QUERY: DirectoryQuery = Object.freeze(
  DirectoryQuerySchema.parse({})
);

/**
 * Lee el estado del directorio desde la URL. Todo lo que llega de la URL es no confiable:
 * se valida con el MISMO esquema que la API y, ante cualquier valor inválido, se usa el
 * valor por defecto de ese campo (nunca se rompe la página por un enlace manipulado).
 */
export function parseQuery(search: string): DirectoryQuery {
  const params = new URLSearchParams(search);
  const whole = DirectoryQuerySchema.safeParse(Object.fromEntries(params));
  if (whole.success) return whole.data;

  const raw = Object.fromEntries(params);
  const merged: Record<string, unknown> = {};
  for (const key of ["q", "area", "entidad", "page"] as const) {
    if (raw[key] === undefined) continue;
    const single = DirectoryQuerySchema.safeParse({ [key]: raw[key] });
    if (single.success) merged[key] = raw[key];
  }
  const partial = DirectoryQuerySchema.safeParse(merged);
  return partial.success ? partial.data : DEFAULT_QUERY;
}

/** Serializa solo lo que difiere del valor por defecto (URLs cortas y compartibles). */
export function toSearch(query: DirectoryQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.area) params.set("area", query.area);
  if (query.entidad) params.set("entidad", query.entidad);
  if (query.page > 1) params.set("page", String(query.page));
  const text = params.toString();
  return text ? `?${text}` : "";
}

export const hasFilters = (query: DirectoryQuery): boolean =>
  Boolean(query.q ?? query.area ?? query.entidad);
