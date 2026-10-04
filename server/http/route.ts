import type { IRouter, Request, RequestHandler, Response } from "express";
import type {
  CachePolicy,
  HandlerResult,
  RouteContract,
  ServerInput,
} from "../../shared/contracts/define";
import {
  apiError,
  toFieldErrors,
  type ApiError,
  type FieldErrors,
} from "../../shared/errors";
import { isStaff, type Identity } from "../../shared/identity";
import {
  err,
  ok,
  tryAsync,
  describeCause,
  type Result,
} from "../../shared/result";
import type { Logger } from "../membership/submit-application";
import { respondError } from "./respond";

/** Contexto que recibe cada handler (la identidad ya viene verificada). */
export type HandlerContext = Readonly<{
  identity: Identity | null;
  req: Request;
}>;

export type RouteHandler<C extends RouteContract> = (
  input: ServerInput<C>,
  context: HandlerContext
) => HandlerResult<C>;

/** Resuelve la identidad desde la petición (cookie/JWT). `null` = sin sesión. */
export type IdentityResolver = (
  req: Request
) => Promise<Result<Identity | null, ApiError>>;

export type RouteDeps = Readonly<{
  logger: Logger;
  resolveIdentity?: IdentityResolver;
}>;

type Parts = Readonly<Record<string, unknown>>;

function cacheControl(policy: CachePolicy): string {
  return policy === "no-store"
    ? "no-store"
    : `public, s-maxage=${policy.sMaxAge}, stale-while-revalidate=${policy.staleWhileRevalidate}`;
}

/** Valida params, query y body con los esquemas del contrato (safeParse → Result). */
function parseRequest(
  contract: RouteContract,
  req: Request
): Result<Parts, ApiError> {
  const sources = [
    ["params", contract.params, req.params as unknown, "params."],
    ["query", contract.query, req.query as unknown, "query."],
    ["body", contract.body, req.body as unknown, ""],
  ] as const;

  const parts: Record<string, unknown> = {};
  let fields: FieldErrors = {};
  let failed = false;
  for (const [name, schema, source, prefix] of sources) {
    if (!schema) continue;
    const parsed = schema.safeParse(source);
    if (parsed.success) {
      parts[name] = parsed.data;
    } else {
      failed = true;
      fields = { ...fields, ...toFieldErrors(parsed.error, prefix) };
    }
  }
  return failed
    ? err(apiError("VALIDATION_ERROR", "Revisa los campos marcados.", fields))
    : ok(Object.freeze(parts));
}

function authorize(
  contract: RouteContract,
  identity: Identity | null
): ApiError | null {
  if (contract.auth === "public") return null;
  if (!identity) {
    return apiError("UNAUTHENTICATED", "Inicia sesión para continuar.");
  }
  if (contract.auth === "staff" && !isStaff(identity.role)) {
    return apiError("FORBIDDEN", "No tienes permiso para esta acción.");
  }
  return null;
}

async function resolveIdentityFor(
  contract: RouteContract,
  req: Request,
  deps: RouteDeps
): Promise<Result<Identity | null, ApiError>> {
  if (contract.auth === "public") return ok(null);
  if (!deps.resolveIdentity) {
    return err(
      apiError(
        "SERVICE_UNAVAILABLE",
        "La autenticación aún no está habilitada."
      )
    );
  }
  return deps.resolveIdentity(req);
}

/** Cada petición recorre: identidad → tipo de contenido → validación → handler → validación de salida. */
async function serve<C extends RouteContract>(
  contract: C,
  handler: RouteHandler<C>,
  deps: RouteDeps,
  req: Request,
  res: Response
): Promise<void> {
  const identity = await resolveIdentityFor(contract, req, deps);
  if (!identity.success) return respondError(res, identity.error);

  const denied = authorize(contract, identity.value);
  if (denied) return respondError(res, denied);

  if (contract.body && !req.is("application/json")) {
    return respondError(
      res,
      apiError("UNSUPPORTED_MEDIA_TYPE", "Se espera application/json.")
    );
  }

  const parts = parseRequest(contract, req);
  if (!parts.success) return respondError(res, parts.error);

  // Único punto donde datos validados en ejecución se enlazan con su tipo estático:
  // es sólido porque `parseRequest` usó los mismos esquemas que definen `ServerInput<C>`.
  const input = parts.value as unknown as ServerInput<C>;

  const outcome = await tryAsync(
    () => handler(input, { identity: identity.value, req }),
    cause => {
      deps.logger.error("http.handler_exception", {
        route: `${contract.method} ${contract.path}`,
        reason: describeCause(cause),
      });
      return apiError("INTERNAL_ERROR", "Ocurrió un error inesperado.");
    }
  );
  if (!outcome.success) return respondError(res, outcome.error);
  if (!outcome.value.success) return respondError(res, outcome.value.error);

  // Se valida también lo que SALE: una respuesta fuera de contrato es un bug del servidor.
  const payload = contract.response.safeParse(outcome.value.value);
  if (!payload.success) {
    deps.logger.error("http.response_contract_violation", {
      route: `${contract.method} ${contract.path}`,
    });
    return respondError(
      res,
      apiError("INTERNAL_ERROR", "Ocurrió un error inesperado.")
    );
  }

  res.setHeader("Cache-Control", cacheControl(contract.cache));
  res.status(contract.successStatus).json(payload.data);
}

const REGISTER: Readonly<
  Record<
    RouteContract["method"],
    (target: IRouter, path: string, handler: RequestHandler) => void
  >
> = {
  GET: (target, path, handler) => void target.get(path, handler),
  POST: (target, path, handler) => void target.post(path, handler),
  PUT: (target, path, handler) => void target.put(path, handler),
  PATCH: (target, path, handler) => void target.patch(path, handler),
  DELETE: (target, path, handler) => void target.delete(path, handler),
};

/** Registra una ruta a partir de su contrato; el handler devuelve `Result`, nunca lanza. */
export function mountRoute<C extends RouteContract>(
  target: IRouter,
  contract: C,
  handler: RouteHandler<C>,
  deps: RouteDeps
): void {
  REGISTER[contract.method](target, contract.path, (req, res) =>
    serve(contract, handler, deps, req, res)
  );
}
