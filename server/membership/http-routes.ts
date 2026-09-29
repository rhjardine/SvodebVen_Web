import { Router, type Request, type Response } from "express";
import {
  HONEYPOT_FIELD,
  type ApiErrorBody,
  type SubmitApplicationSuccess,
} from "../../shared/membership/api";
import {
  randomReference,
  type Logger,
  type SubmitApplication,
  type SubmitApplicationError,
} from "./submit-application";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sendError(res: Response, error: SubmitApplicationError): void {
  switch (error.kind) {
    case "VALIDATION": {
      const body: ApiErrorBody = {
        error: {
          code: "VALIDATION_ERROR",
          message: "Revisa los campos marcados.",
          fields: error.fields,
        },
      };
      res.status(422).json(body);
      return;
    }
    case "INTAKE_UNAVAILABLE": {
      const body: ApiErrorBody = {
        error: {
          code: "INTAKE_UNAVAILABLE",
          message: "La recepción en línea aún no está habilitada.",
        },
      };
      res.status(503).json(body);
      return;
    }
    case "DELIVERY_FAILED": {
      const body: ApiErrorBody = {
        error: {
          code: "DELIVERY_FAILED",
          message:
            "No pudimos registrar tu solicitud. Intenta de nuevo en unos minutos.",
        },
      };
      res.status(502).json(body);
      return;
    }
    default: {
      const exhaustive: never = error;
      throw new Error(`Error no manejado: ${JSON.stringify(exhaustive)}`);
    }
  }
}

export function membershipRouter(
  submitApplication: SubmitApplication,
  logger: Logger
): Router {
  const router = Router();

  router.post("/", async (req: Request, res: Response) => {
    try {
      await handleSubmit(req, res);
    } catch (cause) {
      logger.error("membership.unexpected_error", {
        reason: cause instanceof Error ? cause.message : "unknown",
      });
      if (!res.headersSent) {
        const body: ApiErrorBody = {
          error: {
            code: "INTERNAL_ERROR",
            message: "Ocurrió un error inesperado.",
          },
        };
        res.status(500).json(body);
      }
    }
  });

  async function handleSubmit(req: Request, res: Response): Promise<void> {
    if (!req.is("application/json")) {
      const body: ApiErrorBody = {
        error: {
          code: "UNSUPPORTED_MEDIA_TYPE",
          message: "Se espera application/json.",
        },
      };
      res.status(415).json(body);
      return;
    }

    const payload: unknown = req.body;

    // Honeypot: respuesta indistinguible de un éxito para no dar señales al bot.
    if (
      isRecord(payload) &&
      typeof payload[HONEYPOT_FIELD] === "string" &&
      payload[HONEYPOT_FIELD] !== ""
    ) {
      const now = new Date();
      logger.info("membership.honeypot_triggered");
      const decoy: SubmitApplicationSuccess = {
        referencia: randomReference.next(now),
        recibidaEn: now.toISOString(),
      };
      res.status(201).json(decoy);
      return;
    }

    const result = await submitApplication(payload);
    if (!result.ok) {
      sendError(res, result.error);
      return;
    }

    const body: SubmitApplicationSuccess = {
      referencia: result.value.referencia,
      recibidaEn: result.value.recibidaEn.toISOString(),
    };
    res.status(201).json(body);
  }

  return router;
}
