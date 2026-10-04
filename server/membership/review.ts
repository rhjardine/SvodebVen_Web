import { z } from "zod";
import {
  ApplicationEventSchema,
  ApplicationSummarySchema,
  type ApplicationDetail,
  type ApplicationSummary,
} from "../../shared/membership/admin-contract";
import {
  allowedEvents,
  EstadoSchema,
  transition,
  type Estado,
  type Evento,
} from "../../shared/membership/workflow";
import type { Identity } from "../../shared/identity";
import { err, ok, type Result } from "../../shared/result";
import { isUniqueViolation, type DbError } from "../adapters/postgres/errors";
import type { DbPool } from "../adapters/postgres/pool";
import {
  withIdentity,
  type Actor,
  type IdentityTx,
} from "../adapters/postgres/with-identity";

export type ReviewError =
  | Readonly<{ kind: "NOT_FOUND" }>
  | Readonly<{ kind: "INVALID_TRANSITION"; desde: Estado; evento: Evento }>
  | Readonly<{ kind: "MEMBER_EXISTS" }>
  | Readonly<{ kind: "STORAGE"; cause: DbError }>;

export type Page<T> = Readonly<{
  items: readonly T[];
  page: number;
  pageSize: number;
  total: number;
}>;

export type ApplicationReview = Readonly<{
  list: (
    actor: Identity,
    query: Readonly<{ estado?: Estado; page: number; pageSize: number }>
  ) => Promise<Result<Page<ApplicationSummary>, ReviewError>>;
  detail: (
    actor: Identity,
    id: string
  ) => Promise<Result<ApplicationDetail, ReviewError>>;
  transition: (
    actor: Identity,
    id: string,
    evento: Evento,
    nota: string | undefined
  ) => Promise<
    Result<Readonly<{ estado: Estado; miembroId: string | null }>, ReviewError>
  >;
}>;

const asActor = (identity: Identity): Actor => ({
  role: identity.role,
  memberId: identity.memberId,
});

const toStorage = (cause: DbError): ReviewError => ({ kind: "STORAGE", cause });

const REVIEW_KINDS: ReadonlySet<string> = new Set([
  "NOT_FOUND",
  "INVALID_TRANSITION",
  "MEMBER_EXISTS",
  "STORAGE",
]);
const isReviewError = (error: ReviewError | DbError): error is ReviewError =>
  REVIEW_KINDS.has(error.kind);

/** `withIdentity` suma sus fallos de infraestructura (DbError) a los de negocio: se unifican aquí. */
function settle<T>(
  result: Result<T, ReviewError | DbError>
): Result<T, ReviewError> {
  if (result.success) return result;
  return err(
    isReviewError(result.error) ? result.error : toStorage(result.error)
  );
}

const SummaryRow = z.object({
  id: z.uuid(),
  referencia: z.string(),
  estado: EstadoSchema,
  categoria: z.enum(["ACTIVO", "ASOCIADO", "ESTUDIANTE"]),
  nombres: z.string(),
  apellidos: z.string(),
  email: z.string(),
  recibida_en: z.date(),
});

const SUMMARY_COLUMNS = `id, referencia, estado, categoria, email, recibida_en,
  datos->>'nombres' AS nombres, datos->>'apellidos' AS apellidos`;

const toSummary = (row: z.output<typeof SummaryRow>): ApplicationSummary =>
  ApplicationSummarySchema.parse({
    id: row.id,
    referencia: row.referencia,
    estado: row.estado,
    categoria: row.categoria,
    nombres: row.nombres,
    apellidos: row.apellidos,
    email: row.email,
    recibidaEn: row.recibida_en.toISOString(),
  });

async function approve(
  tx: IdentityTx,
  application: z.output<typeof LockedRow>
): Promise<Result<string, ReviewError>> {
  const created = await tx.select(
    z.object({ id: z.uuid() }),
    `INSERT INTO members (email, nombres, apellidos, role, categoria, application_id)
     VALUES ($1, $2, $3, 'member', $4, $5)
     RETURNING id`,
    [
      application.email,
      application.nombres,
      application.apellidos,
      application.categoria,
      application.id,
    ]
  );
  if (!created.success) {
    return err(
      isUniqueViolation(created.error)
        ? { kind: "MEMBER_EXISTS" }
        : toStorage(created.error)
    );
  }
  const id = created.value[0]?.id;
  return id
    ? ok(id)
    : err(toStorage({ kind: "ROW_SHAPE", message: "members sin id" }));
}

const LockedRow = z.object({
  id: z.uuid(),
  estado: EstadoSchema,
  categoria: z.enum(["ACTIVO", "ASOCIADO", "ESTUDIANTE"]),
  email: z.string(),
  nombres: z.string(),
  apellidos: z.string(),
});

export function createApplicationReview(pool: DbPool): ApplicationReview {
  return {
    async list(identity, query) {
      const result = await withIdentity(
        pool,
        asActor(identity),
        async (tx): Promise<Result<Page<ApplicationSummary>, ReviewError>> => {
          const filter = query.estado ? "WHERE estado = $1" : "";
          const filterParams = query.estado ? [query.estado] : [];
          const total = await tx.select(
            z.object({ n: z.number() }),
            `SELECT count(*)::int AS n FROM applications ${filter}`,
            filterParams
          );
          if (!total.success) return err(toStorage(total.error));
          const limit = filterParams.length + 1;
          const rows = await tx.select(
            SummaryRow,
            `SELECT ${SUMMARY_COLUMNS} FROM applications ${filter}
             ORDER BY recibida_en DESC, id LIMIT $${limit} OFFSET $${limit + 1}`,
            [...filterParams, query.pageSize, (query.page - 1) * query.pageSize]
          );
          if (!rows.success) return err(toStorage(rows.error));
          return ok({
            items: rows.value.map(toSummary),
            page: query.page,
            pageSize: query.pageSize,
            total: total.value[0]?.n ?? 0,
          });
        }
      );
      return settle(result);
    },

    async detail(identity, id) {
      const result = await withIdentity(
        pool,
        asActor(identity),
        async (tx): Promise<Result<ApplicationDetail, ReviewError>> => {
          const rows = await tx.select(
            SummaryRow.extend({
              datos: z.record(z.string(), z.unknown()),
              miembro_id: z.uuid().nullable(),
            }),
            `SELECT ${SUMMARY_COLUMNS}, datos,
               (SELECT m.id FROM members m WHERE m.application_id = applications.id) AS miembro_id
             FROM applications WHERE id = $1`,
            [id]
          );
          if (!rows.success) return err(toStorage(rows.error));
          const row = rows.value[0];
          if (!row) return err({ kind: "NOT_FOUND" });

          const events = await tx.select(
            z.object({
              desde: EstadoSchema.nullable(),
              hacia: EstadoSchema,
              nota: z.string().nullable(),
              ocurrido_en: z.date(),
            }),
            `SELECT desde, hacia, nota, ocurrido_en FROM application_events
             WHERE application_id = $1 ORDER BY id`,
            [id]
          );
          if (!events.success) return err(toStorage(events.error));

          return ok({
            ...toSummary(row),
            datos: row.datos,
            eventos: events.value.map(event =>
              ApplicationEventSchema.parse({
                desde: event.desde,
                hacia: event.hacia,
                nota: event.nota,
                ocurridoEn: event.ocurrido_en.toISOString(),
              })
            ),
            accionesPermitidas: [...allowedEvents(row.estado)],
            miembroId: row.miembro_id,
          });
        }
      );
      return settle(result);
    },

    async transition(identity, id, evento, nota) {
      const result = await withIdentity(
        pool,
        asActor(identity),
        async (
          tx
        ): Promise<
          Result<
            Readonly<{ estado: Estado; miembroId: string | null }>,
            ReviewError
          >
        > => {
          // FOR UPDATE: dos revisiones simultáneas del mismo expediente se serializan.
          const locked = await tx.select(
            LockedRow,
            `SELECT id, estado, categoria, email,
                    datos->>'nombres' AS nombres, datos->>'apellidos' AS apellidos
             FROM applications WHERE id = $1 FOR UPDATE`,
            [id]
          );
          if (!locked.success) return err(toStorage(locked.error));
          const application = locked.value[0];
          if (!application) return err({ kind: "NOT_FOUND" });

          const next = transition(application.estado, evento);
          if (!next.success) return err(next.error);

          const updated = await tx.query(
            "UPDATE applications SET estado = $2, actualizada_en = now() WHERE id = $1",
            [id, next.value]
          );
          if (!updated.success) return err(toStorage(updated.error));
          const logged = await tx.query(
            `INSERT INTO application_events (application_id, desde, hacia, actor_id, nota)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              id,
              application.estado,
              next.value,
              identity.memberId,
              nota ?? null,
            ]
          );
          if (!logged.success) return err(toStorage(logged.error));

          let miembroId: string | null = null;
          if (evento === "APROBAR") {
            const member = await approve(tx, application);
            if (!member.success) return member;
            miembroId = member.value;
          }

          const audited = await tx.query(
            `INSERT INTO audit_log (actor_id, actor_role, accion, entidad, entidad_id, detalle)
             VALUES ($1, $2, 'application.transition', 'applications', $3, $4::jsonb)`,
            [
              identity.memberId,
              identity.role,
              id,
              JSON.stringify({ desde: application.estado, hacia: next.value }),
            ]
          );
          if (!audited.success) return err(toStorage(audited.error));

          return ok({ estado: next.value, miembroId });
        }
      );
      return settle(result);
    },
  };
}
