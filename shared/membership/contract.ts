import { z } from "zod";
import { defineRoute } from "../contracts/define";
import { MEMBERSHIP_ENDPOINT } from "./api";
import { SolicitudAfiliacionSchema } from "./schema";

export const SubmitApplicationResponseSchema = z.object({
  referencia: z.string().min(1),
  recibidaEn: z.iso.datetime(),
});
export type SubmitApplicationResponse = z.output<
  typeof SubmitApplicationResponseSchema
>;

/** POST /api/v1/afiliaciones — solicitud pública de afiliación. */
export const submitApplicationContract = defineRoute({
  method: "POST",
  path: MEMBERSHIP_ENDPOINT,
  auth: "public",
  idempotent: false,
  cache: "no-store",
  successStatus: 201,
  body: SolicitudAfiliacionSchema,
  response: SubmitApplicationResponseSchema,
});
