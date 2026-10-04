import type { IRouter } from "express";
import {
  getApplicationContract,
  listApplicationsContract,
  transitionApplicationContract,
} from "../../shared/membership/admin-contract";
import { apiError, type ApiError } from "../../shared/errors";
import { exhaustive } from "../../shared/exhaustive";
import { isReviewer } from "../../shared/identity";
import { err, ok } from "../../shared/result";
import { mountRoute, type RouteDeps } from "../http/route";
import type { ApplicationReview, ReviewError } from "./review";

function toApiError(error: ReviewError): ApiError {
  switch (error.kind) {
    case "NOT_FOUND":
      return apiError("NOT_FOUND", "Expediente no encontrado.");
    case "INVALID_TRANSITION":
      return apiError(
        "CONFLICT",
        `La acción ${error.evento} no es válida para un expediente en estado ${error.desde}.`
      );
    case "MEMBER_EXISTS":
      return apiError("CONFLICT", "Ya existe un miembro con ese correo.");
    case "STORAGE":
      return apiError(
        "SERVICE_UNAVAILABLE",
        "No se pudo acceder a los expedientes. Intenta de nuevo."
      );
    default:
      exhaustive(error);
      return apiError("INTERNAL_ERROR", "Ocurrió un error inesperado.");
  }
}

const NOT_REVIEWER = apiError(
  "FORBIDDEN",
  "Solo secretaría y administración pueden revisar expedientes."
);

/** Los datos personales de postulantes los ven solo secretaría y admin (RLS lo exige también en la base). */
export function mountAdminApplicationRoutes(
  target: IRouter,
  review: ApplicationReview,
  route: RouteDeps
): void {
  mountRoute(
    target,
    listApplicationsContract,
    async ({ query }, { identity }) => {
      if (!identity || !isReviewer(identity.role)) return err(NOT_REVIEWER);
      const page = await review.list(identity, query);
      return page.success
        ? ok({
            items: [...page.value.items],
            page: page.value.page,
            pageSize: page.value.pageSize,
            total: page.value.total,
          })
        : err(toApiError(page.error));
    },
    route
  );

  mountRoute(
    target,
    getApplicationContract,
    async ({ params }, { identity }) => {
      if (!identity || !isReviewer(identity.role)) return err(NOT_REVIEWER);
      const detail = await review.detail(identity, params.id);
      return detail.success ? ok(detail.value) : err(toApiError(detail.error));
    },
    route
  );

  mountRoute(
    target,
    transitionApplicationContract,
    async ({ params, body }, { identity }) => {
      if (!identity || !isReviewer(identity.role)) return err(NOT_REVIEWER);
      const done = await review.transition(
        identity,
        params.id,
        body.evento,
        body.nota
      );
      return done.success ? ok(done.value) : err(toApiError(done.error));
    },
    route
  );
}
