import { z } from "zod";
import {
  AdminListingSchema,
  DirectoryItemSchema,
  type AdminListing,
  type DirectoryItem,
  type DirectoryQuery,
  type MyListing,
} from "../../shared/directory/contract";
import { AREAS_DE_INTERES } from "../../shared/membership/catalog";
import type { Identity } from "../../shared/identity";
import { err, ok, type Result } from "../../shared/result";
import { normalizeText } from "../../shared/text";
import type { DbError } from "../adapters/postgres/errors";
import type { DbPool } from "../adapters/postgres/pool";
import {
  withIdentity,
  type Actor,
  type IdentityTx,
} from "../adapters/postgres/with-identity";

export type DirectoryError =
  | Readonly<{ kind: "NOT_ELIGIBLE" }>
  | Readonly<{ kind: "NOT_FOUND" }>
  | Readonly<{ kind: "INVALID_DATE"; message: string }>
  | Readonly<{ kind: "STORAGE"; cause: DbError }>;

export type Page<T> = Readonly<{
  items: readonly T[];
  page: number;
  pageSize: number;
  total: number;
}>;

export type MyListingView = Readonly<{
  elegible: boolean;
  ficha: MyListing | null;
}>;

export type MyListingInput = Readonly<{
  nombrePublico: string;
  ciudad: string;
  entidad: string;
  areas: readonly string[];
  publicado: boolean;
}>;

export type DirectoryService = Readonly<{
  search: (
    query: DirectoryQuery
  ) => Promise<Result<Page<DirectoryItem>, DirectoryError>>;
  getMine: (who: Identity) => Promise<Result<MyListingView, DirectoryError>>;
  putMine: (
    who: Identity,
    input: MyListingInput
  ) => Promise<Result<MyListingView, DirectoryError>>;
  removeMine: (who: Identity) => Promise<Result<void, DirectoryError>>;
  adminList: (
    who: Identity,
    query: Readonly<{ pendientes: boolean; page: number; pageSize: number }>
  ) => Promise<Result<Page<AdminListing>, DirectoryError>>;
  verify: (
    who: Identity,
    id: string,
    hasta: string
  ) => Promise<Result<AdminListing, DirectoryError>>;
  unpublish: (
    who: Identity,
    id: string,
    nota: string | undefined
  ) => Promise<Result<AdminListing, DirectoryError>>;
}>;

// Sin identidad: la búsqueda pública corre SIEMPRE como 'anon', aunque haya sesión, de modo que
// la base (RLS) es quien decide qué fichas son visibles al público.
const ANON: Actor = Object.freeze({ role: "anon", memberId: null });
const asActor = (who: Identity): Actor => ({
  role: who.role,
  memberId: who.memberId,
});
const MAX_TOKENS = 5;
const MAX_VERIFICATION_DAYS = 400;

const toStorage = (cause: DbError): DirectoryError => ({
  kind: "STORAGE",
  cause,
});
const DOMAIN_KINDS: ReadonlySet<string> = new Set([
  "NOT_ELIGIBLE",
  "NOT_FOUND",
  "INVALID_DATE",
  "STORAGE",
]);
const isDomain = (error: DirectoryError | DbError): error is DirectoryError =>
  DOMAIN_KINDS.has(error.kind);

function settle<T>(
  result: Result<T, DirectoryError | DbError>
): Result<T, DirectoryError> {
  if (result.success) return result;
  return err(isDomain(result.error) ? result.error : toStorage(result.error));
}

/** Escapa los comodines de LIKE: el texto del usuario nunca actúa como patrón. */
const escapeLike = (value: string): string =>
  value.replace(/[\\%_]/g, match => `\\${match}`);

const AreaEnum = z.enum(AREAS_DE_INTERES);
const PublicRow = z.object({
  id: z.uuid(),
  nombre_publico: z.string(),
  ciudad: z.string(),
  entidad: z.string(),
  areas: z.array(AreaEnum),
  categoria: z.enum(["ACTIVO", "ASOCIADO"]),
  verificado_hasta: z.iso.date(),
});

const AdminRow = z.object({
  id: z.uuid(),
  nombre_publico: z.string(),
  email: z.string(),
  ciudad: z.string(),
  entidad: z.string(),
  areas: z.array(AreaEnum),
  categoria: z.enum(["ACTIVO", "ASOCIADO"]),
  publicado: z.boolean(),
  consentimiento_en: z.date().nullable(),
  verificado_hasta: z.iso.date().nullable(),
});
const ADMIN_COLUMNS = `p.id, p.nombre_publico, m.email, p.ciudad, p.entidad, p.areas, p.categoria,
  p.publicado, p.consentimiento_en, p.verificado_hasta::text AS verificado_hasta`;
const toAdmin = (row: z.output<typeof AdminRow>): AdminListing =>
  AdminListingSchema.parse({
    id: row.id,
    nombre: row.nombre_publico,
    email: row.email,
    ciudad: row.ciudad,
    entidad: row.entidad,
    areas: row.areas,
    categoria: row.categoria,
    publicado: row.publicado,
    consentimientoEn: row.consentimiento_en?.toISOString() ?? null,
    verificadoHasta: row.verificado_hasta,
  });

const MineRow = z.object({
  nombre_publico: z.string(),
  ciudad: z.string(),
  entidad: z.string(),
  areas: z.array(AreaEnum),
  publicado: z.boolean(),
  verificacion: z.enum(["SIN_VERIFICAR", "VIGENTE", "VENCIDA"]),
  verificado_hasta: z.iso.date().nullable(),
});
const TODAY_CARACAS = "(now() AT TIME ZONE 'America/Caracas')::date";

async function loadMine(
  tx: IdentityTx,
  memberId: string
): Promise<Result<MyListingView, DirectoryError>> {
  const member = await tx.select(
    z.object({ estado: z.string(), categoria: z.string().nullable() }),
    "SELECT estado, categoria FROM members WHERE id = $1",
    [memberId]
  );
  if (!member.success) return err(toStorage(member.error));
  const m = member.value[0];
  const elegible =
    m?.estado === "ACTIVO" &&
    (m.categoria === "ACTIVO" || m.categoria === "ASOCIADO");

  const rows = await tx.select(
    MineRow,
    `SELECT nombre_publico, ciudad, entidad, areas, publicado, verificado_hasta::text AS verificado_hasta,
       CASE WHEN verificado_hasta IS NULL THEN 'SIN_VERIFICAR'
            WHEN verificado_hasta >= ${TODAY_CARACAS} THEN 'VIGENTE' ELSE 'VENCIDA' END AS verificacion
     FROM directory_profiles WHERE member_id = $1`,
    [memberId]
  );
  if (!rows.success) return err(toStorage(rows.error));
  const row = rows.value[0];
  return ok({
    elegible,
    ficha: row
      ? {
          nombrePublico: row.nombre_publico,
          ciudad: row.ciudad,
          entidad: row.entidad,
          areas: row.areas,
          publicado: row.publicado,
          verificacion: row.verificacion,
          verificadoHasta: row.verificado_hasta,
        }
      : null,
  });
}

async function audit(
  tx: IdentityTx,
  who: Identity,
  accion: string,
  entidadId: string,
  detalle: Readonly<Record<string, string | boolean | null>>
): Promise<Result<void, DirectoryError>> {
  const written = await tx.query(
    `INSERT INTO audit_log (actor_id, actor_role, accion, entidad, entidad_id, detalle)
     VALUES ($1, $2, $3, 'directory_profiles', $4, $5::jsonb)`,
    [who.memberId, who.role, accion, entidadId, JSON.stringify(detalle)]
  );
  return written.success ? ok(undefined) : err(toStorage(written.error));
}

async function loadAdminRow(
  tx: IdentityTx,
  id: string
): Promise<Result<AdminListing, DirectoryError>> {
  const rows = await tx.select(
    AdminRow,
    `SELECT ${ADMIN_COLUMNS} FROM directory_profiles p JOIN members m ON m.id = p.member_id WHERE p.id = $1`,
    [id]
  );
  if (!rows.success) return err(toStorage(rows.error));
  const row = rows.value[0];
  return row ? ok(toAdmin(row)) : err({ kind: "NOT_FOUND" });
}

export function createDirectoryService(pool: DbPool): DirectoryService {
  return {
    async search(query) {
      const tokens = normalizeText(query.q ?? "")
        .split(" ")
        .filter(token => token.length > 0)
        .slice(0, MAX_TOKENS);
      const result = await withIdentity(
        pool,
        ANON,
        async (tx): Promise<Result<Page<DirectoryItem>, DirectoryError>> => {
          const params: unknown[] = [];
          const where: string[] = [];
          for (const token of tokens) {
            params.push(`%${escapeLike(token)}%`);
            where.push(`busqueda LIKE $${params.length} ESCAPE '\\'`);
          }
          if (query.area) {
            params.push(query.area);
            where.push(`$${params.length}::text = ANY(areas)`);
          }
          if (query.entidad) {
            params.push(query.entidad);
            where.push(`entidad = $${params.length}`);
          }
          const filter = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

          const total = await tx.select(
            z.object({ n: z.number() }),
            `SELECT count(*)::int AS n FROM directory_profiles ${filter}`,
            params
          );
          if (!total.success) return err(toStorage(total.error));
          const rows = await tx.select(
            PublicRow,
            `SELECT id, nombre_publico, ciudad, entidad, areas, categoria, verificado_hasta::text AS verificado_hasta
           FROM directory_profiles ${filter}
           ORDER BY busqueda, id
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, query.pageSize, (query.page - 1) * query.pageSize]
          );
          if (!rows.success) return err(toStorage(rows.error));
          return ok({
            items: rows.value.map(row =>
              DirectoryItemSchema.parse({
                id: row.id,
                nombre: row.nombre_publico,
                ciudad: row.ciudad,
                entidad: row.entidad,
                areas: row.areas,
                categoria: row.categoria,
                verificadoHasta: row.verificado_hasta,
              })
            ),
            page: query.page,
            pageSize: query.pageSize,
            total: total.value[0]?.n ?? 0,
          });
        }
      );
      return settle(result);
    },

    async getMine(who) {
      return settle(
        await withIdentity(pool, asActor(who), tx => loadMine(tx, who.memberId))
      );
    },

    async putMine(who, input) {
      const result = await withIdentity(
        pool,
        asActor(who),
        async (tx): Promise<Result<MyListingView, DirectoryError>> => {
          const current = await loadMine(tx, who.memberId);
          if (!current.success) return current;
          if (!current.value.elegible) return err({ kind: "NOT_ELIGIBLE" });

          const category = await tx.select(
            z.object({ categoria: z.enum(["ACTIVO", "ASOCIADO"]) }),
            "SELECT categoria FROM members WHERE id = $1",
            [who.memberId]
          );
          if (!category.success) return err(toStorage(category.error));
          const categoria = category.value[0]?.categoria;
          if (!categoria) return err({ kind: "NOT_ELIGIBLE" });

          const saved = await tx.query(
            `INSERT INTO directory_profiles
             (member_id, nombre_publico, ciudad, entidad, areas, categoria, busqueda, publicado, consentimiento_en)
           VALUES ($1, $2, $3, $4, $5::text[], $6, $7, $8::boolean, CASE WHEN $8::boolean THEN now() END)
           ON CONFLICT (member_id) DO UPDATE SET
             nombre_publico = EXCLUDED.nombre_publico,
             ciudad = EXCLUDED.ciudad,
             entidad = EXCLUDED.entidad,
             areas = EXCLUDED.areas,
             busqueda = EXCLUDED.busqueda,
             publicado = EXCLUDED.publicado,
             consentimiento_en = CASE WHEN EXCLUDED.publicado
               THEN COALESCE(directory_profiles.consentimiento_en, now()) END`,
            [
              who.memberId,
              input.nombrePublico,
              input.ciudad,
              input.entidad,
              [...input.areas],
              categoria,
              normalizeText(
                `${input.nombrePublico} ${input.ciudad} ${input.entidad}`
              ),
              input.publicado,
            ]
          );
          if (!saved.success) return err(toStorage(saved.error));
          const logged = await audit(
            tx,
            who,
            "directory.self_update",
            who.memberId,
            { publicado: input.publicado }
          );
          if (!logged.success) return logged;
          return loadMine(tx, who.memberId);
        }
      );
      return settle(result);
    },

    async removeMine(who) {
      const result = await withIdentity(
        pool,
        asActor(who),
        async (tx): Promise<Result<void, DirectoryError>> => {
          const deleted = await tx.query(
            "DELETE FROM directory_profiles WHERE member_id = $1",
            [who.memberId]
          );
          if (!deleted.success) return err(toStorage(deleted.error));
          return audit(tx, who, "directory.self_remove", who.memberId, {});
        }
      );
      return settle(result);
    },

    async adminList(who, query) {
      const result = await withIdentity(
        pool,
        asActor(who),
        async (tx): Promise<Result<Page<AdminListing>, DirectoryError>> => {
          const filter = `WHERE (NOT $1::boolean OR p.verificado_hasta IS NULL OR p.verificado_hasta < ${TODAY_CARACAS})`;
          const total = await tx.select(
            z.object({ n: z.number() }),
            `SELECT count(*)::int AS n FROM directory_profiles p ${filter}`,
            [query.pendientes]
          );
          if (!total.success) return err(toStorage(total.error));
          const rows = await tx.select(
            AdminRow,
            `SELECT ${ADMIN_COLUMNS} FROM directory_profiles p JOIN members m ON m.id = p.member_id
           ${filter} ORDER BY p.created_at DESC, p.id LIMIT $2 OFFSET $3`,
            [
              query.pendientes,
              query.pageSize,
              (query.page - 1) * query.pageSize,
            ]
          );
          if (!rows.success) return err(toStorage(rows.error));
          return ok({
            items: rows.value.map(toAdmin),
            page: query.page,
            pageSize: query.pageSize,
            total: total.value[0]?.n ?? 0,
          });
        }
      );
      return settle(result);
    },

    async verify(who, id, hasta) {
      const result = await withIdentity(
        pool,
        asActor(who),
        async (tx): Promise<Result<AdminListing, DirectoryError>> => {
          const locked = await tx.select(
            z.object({
              member_estado: z.string(),
              member_categoria: z.string().nullable(),
              today: z.iso.date(),
              limit: z.iso.date(),
            }),
            `SELECT m.estado AS member_estado, m.categoria AS member_categoria,
                  ${TODAY_CARACAS}::text AS today, (${TODAY_CARACAS} + ${MAX_VERIFICATION_DAYS})::text AS limit
           FROM directory_profiles p JOIN members m ON m.id = p.member_id
           WHERE p.id = $1 FOR UPDATE OF p`,
            [id]
          );
          if (!locked.success) return err(toStorage(locked.error));
          const row = locked.value[0];
          if (!row) return err({ kind: "NOT_FOUND" });
          if (
            row.member_estado !== "ACTIVO" ||
            (row.member_categoria !== "ACTIVO" &&
              row.member_categoria !== "ASOCIADO")
          ) {
            return err({ kind: "NOT_ELIGIBLE" });
          }
          // Fechas ISO (AAAA-MM-DD): la comparación de texto equivale a la cronológica.
          if (hasta < row.today || hasta > row.limit) {
            return err({
              kind: "INVALID_DATE",
              message: `La vigencia debe estar entre ${row.today} y ${row.limit}.`,
            });
          }
          const updated = await tx.query(
            `UPDATE directory_profiles p
           SET verificado_hasta = $2::date, verificado_por = $3,
               categoria = (SELECT categoria FROM members WHERE id = p.member_id)
           WHERE p.id = $1`,
            [id, hasta, who.memberId]
          );
          if (!updated.success) return err(toStorage(updated.error));
          const logged = await audit(tx, who, "directory.verify", id, {
            verificadoHasta: hasta,
          });
          if (!logged.success) return logged;
          return loadAdminRow(tx, id);
        }
      );
      return settle(result);
    },

    async unpublish(who, id, nota) {
      const result = await withIdentity(
        pool,
        asActor(who),
        async (tx): Promise<Result<AdminListing, DirectoryError>> => {
          const updated = await tx.query(
            `UPDATE directory_profiles
           SET publicado = false, consentimiento_en = NULL, verificado_hasta = NULL, verificado_por = NULL
           WHERE id = $1 RETURNING 1 AS hit`,
            [id]
          );
          if (!updated.success) return err(toStorage(updated.error));
          if (updated.value.length === 0) return err({ kind: "NOT_FOUND" });
          const logged = await audit(tx, who, "directory.unpublish", id, {
            nota: nota ?? null,
          });
          if (!logged.success) return logged;
          return loadAdminRow(tx, id);
        }
      );
      return settle(result);
    },
  };
}
