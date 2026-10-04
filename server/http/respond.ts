import type { Response } from "express";
import {
  API_ERROR_STATUS,
  apiErrorBody,
  type ApiError,
} from "../../shared/errors";

/** Única vía para responder errores: estado HTTP según la taxonomía y nunca cacheable. */
export function respondError(res: Response, error: ApiError): void {
  res.setHeader("Cache-Control", "no-store");
  res.status(API_ERROR_STATUS[error.code]).json(apiErrorBody(error));
}
