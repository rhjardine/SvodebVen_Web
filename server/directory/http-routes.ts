import type { IRouter } from "express";
import {
  deleteMyListingContract,
  getMyListingContract,
  listAdminDirectoryContract,
  listDirectoryContract,
  putMyListingContract,
  unpublishListingContract,
  verifyListingContract,
} from "../../shared/directory/contract";
import { apiError, type ApiError } from "../../shared/errors";
import { exhaustive } from "../../shared/exhaustive";
import { isReviewer } from "../../shared/identity";
import { err, ok } from "../../shared/result";
import { mountRoute, type RouteDeps } from "../http/route";
import type { DirectoryError, DirectoryService } from "./service";

function toApiError(error: DirectoryError): ApiError {
  switch (error.kind) {
    case "NOT_ELIGIBLE":
      return apiError(
        "FORBIDDEN",
        "Tu categoría o el estado de tu membresía no permiten figurar en el directorio."
      );
    case "NOT_FOUND":
      return apiError("NOT_FOUND", "Ficha no encontrada.");
    case "INVALID_DATE":
      return apiError("VALIDATION_ERROR", "Revisa los campos marcados.", {
        verificadoHasta: error.message,
      });
    case "STORAGE":
      return apiError(
        "SERVICE_UNAVAILABLE",
        "El directorio no está disponible. Intenta de nuevo en unos minutos."
      );
    default:
      exhaustive(error);
      return apiError("INTERNAL_ERROR", "Ocurrió un error inesperado.");
  }
}

const NOT_REVIEWER = apiError(
  "FORBIDDEN",
  "Solo secretaría y administración pueden gestionar el directorio."
);

export function mountDirectoryRoutes(
  target: IRouter,
  service: DirectoryService,
  route: RouteDeps
): void {
  // Público: solo datos de la ficha, sin identidad ni contacto.
  mountRoute(
    target,
    listDirectoryContract,
    async ({ query }) => {
      const page = await service.search(query);
      if (!page.success) return err(toApiError(page.error));
      return ok({
        items: [...page.value.items],
        page: page.value.page,
        pageSize: page.value.pageSize,
        total: page.value.total,
        totalPages: Math.max(
          1,
          Math.ceil(page.value.total / page.value.pageSize)
        ),
      });
    },
    route
  );

  // Autogestión: la identidad sale del JWT verificado, nunca del cuerpo.
  mountRoute(
    target,
    getMyListingContract,
    async (_input, { identity }) => {
      if (!identity) return err(apiError("UNAUTHENTICATED", "Inicia sesión."));
      const mine = await service.getMine(identity);
      return mine.success ? ok(mine.value) : err(toApiError(mine.error));
    },
    route
  );
  mountRoute(
    target,
    putMyListingContract,
    async ({ body }, { identity }) => {
      if (!identity) return err(apiError("UNAUTHENTICATED", "Inicia sesión."));
      const saved = await service.putMine(identity, body);
      return saved.success ? ok(saved.value) : err(toApiError(saved.error));
    },
    route
  );
  mountRoute(
    target,
    deleteMyListingContract,
    async (_input, { identity }) => {
      if (!identity) return err(apiError("UNAUTHENTICATED", "Inicia sesión."));
      const removed = await service.removeMine(identity);
      return removed.success
        ? ok({ ok: true as const })
        : err(toApiError(removed.error));
    },
    route
  );

  // Verificación: solo secretaría y admin (también lo exige RLS).
  mountRoute(
    target,
    listAdminDirectoryContract,
    async ({ query }, { identity }) => {
      if (!identity || !isReviewer(identity.role)) return err(NOT_REVIEWER);
      const page = await service.adminList(identity, query);
      return page.success
        ? ok({ ...page.value, items: [...page.value.items] })
        : err(toApiError(page.error));
    },
    route
  );
  mountRoute(
    target,
    verifyListingContract,
    async ({ params, body }, { identity }) => {
      if (!identity || !isReviewer(identity.role)) return err(NOT_REVIEWER);
      const done = await service.verify(
        identity,
        params.id,
        body.verificadoHasta
      );
      return done.success ? ok(done.value) : err(toApiError(done.error));
    },
    route
  );
  mountRoute(
    target,
    unpublishListingContract,
    async ({ params, body }, { identity }) => {
      if (!identity || !isReviewer(identity.role)) return err(NOT_REVIEWER);
      const done = await service.unpublish(identity, params.id, body.nota);
      return done.success ? ok(done.value) : err(toApiError(done.error));
    },
    route
  );
}

/**
 * Sin base de datos el directorio simplemente está vacío: respuesta 200 veraz (no hay fichas
 * verificadas) en lugar de un 404 que ensucia la consola del navegador.
 */
export function mountDirectoryUnavailable(
  target: IRouter,
  route: RouteDeps
): void {
  mountRoute(
    target,
    listDirectoryContract,
    ({ query }) =>
      Promise.resolve(
        ok({
          items: [],
          page: query.page,
          pageSize: query.pageSize,
          total: 0,
          totalPages: 1,
        })
      ),
    route
  );
}
