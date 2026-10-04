import { z } from "zod";
import { defineRoute } from "../contracts/define";
import { AREAS_DE_INTERES, ENTIDADES_FEDERALES } from "../membership/catalog";
import { hasControlChars } from "../text";

export const DIRECTORY_ENDPOINT = "/api/v1/directory" as const;
export const MY_DIRECTORY_ENDPOINT = "/api/v1/members/me/directory" as const;
export const ADMIN_DIRECTORY = "/api/v1/admin/directory" as const;

/** Tope duro: página × tamaño ≤ 1000 fichas alcanzables por consulta (antiraspado). */
export const DIRECTORY_MAX_PAGE = 50;
export const DIRECTORY_MAX_PAGE_SIZE = 20;
export const DIRECTORY_DEFAULT_PAGE_SIZE = 12;
export const DIRECTORY_MAX_QUERY = 60;

const AreaSchema = z.enum(AREAS_DE_INTERES);
const EntidadSchema = z.enum(ENTIDADES_FEDERALES);
const CategoriaDirectorioSchema = z.enum(["ACTIVO", "ASOCIADO"]);
const DateSchema = z.iso.date();

/** Texto de búsqueda: sin caracteres de control; vacío equivale a "sin filtro". */
const SearchText = z
  .string()
  .trim()
  .max(DIRECTORY_MAX_QUERY)
  .refine(value => !hasControlChars(value), "Texto no permitido.")
  .transform(value => (value === "" ? undefined : value))
  .optional();

/** Misma definición para la URL del navegador y para la API: una sola fuente de verdad. */
export const DirectoryQuerySchema = z.object({
  q: SearchText,
  area: AreaSchema.optional(),
  entidad: EntidadSchema.optional(),
  page: z.coerce.number().int().min(1).max(DIRECTORY_MAX_PAGE).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(DIRECTORY_MAX_PAGE_SIZE)
    .default(DIRECTORY_DEFAULT_PAGE_SIZE),
});
export type DirectoryQuery = z.output<typeof DirectoryQuerySchema>;

/** Ficha pública: sin correo, teléfono ni identificador del miembro. */
export const DirectoryItemSchema = z.object({
  id: z.uuid(),
  nombre: z.string(),
  ciudad: z.string(),
  entidad: z.string(),
  areas: z.array(AreaSchema),
  categoria: CategoriaDirectorioSchema,
  verificadoHasta: DateSchema,
});
export type DirectoryItem = z.output<typeof DirectoryItemSchema>;

export const listDirectoryContract = defineRoute({
  method: "GET",
  path: DIRECTORY_ENDPOINT,
  auth: "public",
  idempotent: false,
  // Cacheable en el borde (Cloudflare necesita además una Cache Rule explícita para JSON).
  cache: { sMaxAge: 60, staleWhileRevalidate: 300 },
  successStatus: 200,
  query: DirectoryQuerySchema,
  response: z.object({
    items: z.array(DirectoryItemSchema),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});

// ─── Autogestión del miembro ────────────────────────────────────────────────
const textField = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine(value => !hasControlChars(value), "Texto no permitido.");

export const MyListingInputSchema = z.object({
  nombrePublico: textField(2, 120),
  ciudad: textField(2, 80),
  entidad: EntidadSchema,
  areas: z
    .array(AreaSchema)
    .min(1, "Selecciona al menos un área.")
    .max(AREAS_DE_INTERES.length)
    .transform(areas => [...new Set(areas)].sort()),
  publicado: z.boolean(),
});

export const VERIFICACION = ["SIN_VERIFICAR", "VIGENTE", "VENCIDA"] as const;

export const MyListingSchema = z.object({
  nombrePublico: z.string(),
  ciudad: z.string(),
  entidad: z.string(),
  areas: z.array(AreaSchema),
  publicado: z.boolean(),
  verificacion: z.enum(VERIFICACION),
  verificadoHasta: DateSchema.nullable(),
});
export type MyListing = z.output<typeof MyListingSchema>;

const MyListingResponse = z.object({
  /** `false` si la categoría o el estado del miembro no permiten figurar en el directorio. */
  elegible: z.boolean(),
  ficha: MyListingSchema.nullable(),
});

export const getMyListingContract = defineRoute({
  method: "GET",
  path: MY_DIRECTORY_ENDPOINT,
  auth: "member",
  idempotent: false,
  cache: "no-store",
  successStatus: 200,
  response: MyListingResponse,
});

export const putMyListingContract = defineRoute({
  method: "PUT",
  path: MY_DIRECTORY_ENDPOINT,
  auth: "member",
  idempotent: false,
  cache: "no-store",
  successStatus: 200,
  body: MyListingInputSchema,
  response: MyListingResponse,
});

export const deleteMyListingContract = defineRoute({
  method: "DELETE",
  path: MY_DIRECTORY_ENDPOINT,
  auth: "member",
  idempotent: false,
  cache: "no-store",
  successStatus: 200,
  response: z.object({ ok: z.literal(true) }),
});

// ─── Verificación por secretaría ────────────────────────────────────────────
export const AdminListingSchema = z.object({
  id: z.uuid(),
  nombre: z.string(),
  email: z.string(),
  ciudad: z.string(),
  entidad: z.string(),
  areas: z.array(AreaSchema),
  categoria: CategoriaDirectorioSchema,
  publicado: z.boolean(),
  consentimientoEn: z.iso.datetime().nullable(),
  verificadoHasta: DateSchema.nullable(),
});
export type AdminListing = z.output<typeof AdminListingSchema>;

export const listAdminDirectoryContract = defineRoute({
  method: "GET",
  path: ADMIN_DIRECTORY,
  auth: "staff",
  idempotent: false,
  cache: "no-store",
  successStatus: 200,
  query: z.object({
    pendientes: z
      .enum(["true", "false"])
      .default("false")
      .transform(value => value === "true"),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  }),
  response: z.object({
    items: z.array(AdminListingSchema),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  }),
});

export const verifyListingContract = defineRoute({
  method: "POST",
  path: `${ADMIN_DIRECTORY}/:id/verify`,
  auth: "staff",
  idempotent: false,
  cache: "no-store",
  successStatus: 200,
  params: z.object({ id: z.uuid() }),
  body: z.object({ verificadoHasta: DateSchema }),
  response: AdminListingSchema,
});

export const unpublishListingContract = defineRoute({
  method: "POST",
  path: `${ADMIN_DIRECTORY}/:id/unpublish`,
  auth: "staff",
  idempotent: false,
  cache: "no-store",
  successStatus: 200,
  params: z.object({ id: z.uuid() }),
  body: z.object({ nota: z.string().trim().max(500).optional() }),
  response: AdminListingSchema,
});
