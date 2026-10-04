import type { z } from "zod";
import type { Result } from "../result";
import type { ApiError } from "../errors";

/**
 * Contrato de ruta: UNA definición compartida por servidor y cliente.
 * Si un esquema cambia, el handler del servidor y quien llama desde el cliente
 * dejan de compilar (`tsc`) hasta que ambos se actualicen.
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type AuthLevel = "public" | "member" | "staff";
export type SuccessStatus = 200 | 201 | 202;

export type CachePolicy =
  "no-store" | Readonly<{ sMaxAge: number; staleWhileRevalidate: number }>;

export type RouteContract = Readonly<{
  method: HttpMethod;
  /** Ruta completa con parámetros estilo Express: `/api/v1/events/:id`. */
  path: string;
  auth: AuthLevel;
  /** Si es `true`, el servidor exige `Idempotency-Key` (UUID) en cada petición. */
  idempotent: boolean;
  cache: CachePolicy;
  successStatus: SuccessStatus;
  params?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
  /** Debe ser JSON puro (sin transformaciones): lo que el servidor envía es lo que el cliente valida. */
  response: z.ZodType;
}>;

export function defineRoute<const C extends RouteContract>(contract: C): C {
  return contract;
}

type Mode = "input" | "output";
type Pick<S extends z.ZodType, M extends Mode> = M extends "input"
  ? z.input<S>
  : z.output<S>;

type ParamsPart<C, M extends Mode> = C extends {
  readonly params: infer S extends z.ZodType;
}
  ? { readonly params: Pick<S, M> }
  : unknown;
type QueryPart<C, M extends Mode> = C extends {
  readonly query: infer S extends z.ZodType;
}
  ? { readonly query: Pick<S, M> }
  : unknown;
type BodyPart<C, M extends Mode> = C extends {
  readonly body: infer S extends z.ZodType;
}
  ? { readonly body: Pick<S, M> }
  : unknown;

/** Lo que el cliente debe pasar (forma de ENTRADA de los esquemas). */
export type ClientInput<C extends RouteContract> = ParamsPart<C, "input"> &
  QueryPart<C, "input"> &
  BodyPart<C, "input">;

/** Lo que recibe el handler del servidor (forma de SALIDA: ya validada y normalizada). */
export type ServerInput<C extends RouteContract> = ParamsPart<C, "output"> &
  QueryPart<C, "output"> &
  BodyPart<C, "output">;

export type ResponseOf<C extends RouteContract> = z.output<C["response"]>;

export type HandlerResult<C extends RouteContract> = Promise<
  Result<ResponseOf<C>, ApiError>
>;
