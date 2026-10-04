import type { IRouter } from "express";
import { apiError, type ApiError } from "../../shared/errors";
import { submitApplicationContract } from "../../shared/membership/contract";
import { err, ok } from "../../shared/result";
import { exhaustive } from "../../shared/exhaustive";
import { mountRoute, type RouteDeps } from "../http/route";
import type {
  SubmitApplication,
  SubmitApplicationError,
} from "./submit-application";

function toApiError(error: SubmitApplicationError): ApiError {
  switch (error.kind) {
    case "INTAKE_UNAVAILABLE":
      return apiError(
        "INTAKE_UNAVAILABLE",
        "La recepción en línea aún no está habilitada."
      );
    case "IDEMPOTENCY_KEY_REUSED":
      return apiError(
        "IDEMPOTENCY_KEY_REUSED",
        "Esta clave de envío ya se usó con otra solicitud. Recarga la página e inténtalo de nuevo."
      );
    case "DELIVERY_FAILED":
      return apiError(
        "DELIVERY_FAILED",
        "No pudimos registrar tu solicitud. Intenta de nuevo en unos minutos."
      );
    default:
      exhaustive(error);
      return apiError("INTERNAL_ERROR", "Ocurrió un error inesperado.");
  }
}

export type MembershipRoutesDeps = Readonly<{
  submitApplication: SubmitApplication;
  route: RouteDeps;
}>;

/** POST /api/v1/afiliaciones — el cuerpo ya llega validado por el contrato. */
export function mountMembershipRoutes(
  target: IRouter,
  deps: MembershipRoutesDeps
): void {
  mountRoute(
    target,
    submitApplicationContract,
    async ({ body }, { idempotency }) => {
      const result = await deps.submitApplication(body, { idempotency });
      if (!result.success) return err(toApiError(result.error));
      return ok({
        referencia: result.value.referencia,
        recibidaEn: result.value.recibidaEn.toISOString(),
      });
    },
    deps.route
  );
}
