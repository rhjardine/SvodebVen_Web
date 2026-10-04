import { z } from "zod";
import { defineRoute } from "../contracts/define";
import { EstadoSchema, EventoSchema } from "./workflow";

export const ADMIN_APPLICATIONS = "/api/v1/admin/applications" as const;
export const MAX_PAGE_SIZE = 50;

const CategoriaSchema = z.enum(["ACTIVO", "ASOCIADO", "ESTUDIANTE"]);

export const ApplicationSummarySchema = z.object({
  id: z.uuid(),
  referencia: z.string(),
  estado: EstadoSchema,
  categoria: CategoriaSchema,
  nombres: z.string(),
  apellidos: z.string(),
  email: z.string(),
  recibidaEn: z.iso.datetime(),
});
export type ApplicationSummary = z.output<typeof ApplicationSummarySchema>;

export const ApplicationEventSchema = z.object({
  desde: EstadoSchema.nullable(),
  hacia: EstadoSchema,
  nota: z.string().nullable(),
  ocurridoEn: z.iso.datetime(),
});

export const ApplicationDetailSchema = ApplicationSummarySchema.extend({
  /** Datos tal como los envió la persona (se muestran como texto, nunca como HTML). */
  datos: z.record(z.string(), z.unknown()),
  eventos: z.array(ApplicationEventSchema),
  accionesPermitidas: z.array(EventoSchema),
  miembroId: z.uuid().nullable(),
});
export type ApplicationDetail = z.output<typeof ApplicationDetailSchema>;

export const listApplicationsContract = defineRoute({
  method: "GET",
  path: ADMIN_APPLICATIONS,
  auth: "staff",
  idempotent: false,
  cache: "no-store",
  successStatus: 200,
  query: z.object({
    estado: EstadoSchema.optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
  }),
  response: z.object({
    items: z.array(ApplicationSummarySchema),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  }),
});

export const getApplicationContract = defineRoute({
  method: "GET",
  path: `${ADMIN_APPLICATIONS}/:id`,
  auth: "staff",
  idempotent: false,
  cache: "no-store",
  successStatus: 200,
  params: z.object({ id: z.uuid() }),
  response: ApplicationDetailSchema,
});

export const transitionApplicationContract = defineRoute({
  method: "POST",
  path: `${ADMIN_APPLICATIONS}/:id/transition`,
  auth: "staff",
  idempotent: false,
  cache: "no-store",
  successStatus: 200,
  params: z.object({ id: z.uuid() }),
  body: z.object({
    evento: EventoSchema,
    nota: z.string().trim().max(500).optional(),
  }),
  response: z.object({
    estado: EstadoSchema,
    miembroId: z.uuid().nullable(),
  }),
});
