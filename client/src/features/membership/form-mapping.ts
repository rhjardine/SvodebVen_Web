import { HONEYPOT_FIELD } from "@shared/membership/api";
import {
  CATEGORIA_LABEL,
  AREA_LABEL,
  type CategoriaPostulable,
} from "@shared/membership/catalog";
import {
  SolicitudAfiliacionSchema,
  toFieldErrors,
  type FieldErrors,
  type SolicitudAfiliacion,
} from "@shared/membership/schema";
import { err, ok, type Result } from "@shared/result";

/** Orden visual de los campos: el foco va al primer campo con error. */
export const FIELD_ORDER = [
  "categoria",
  "nombres",
  "apellidos",
  "email",
  "telefono",
  "entidad",
  "ciudad",
  "universidad",
  "anioEgreso",
  "numeroColegiatura",
  "semestre",
  "areas",
  "motivacion",
  "consentimiento",
] as const;
export type FieldName = (typeof FIELD_ORDER)[number];

const text = (data: FormData, key: string): string => {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
};

/** Convierte el formulario en la forma de entrada del esquema compartido (sin validar). */
export function formDataToInput(
  data: FormData
): Readonly<{ input: Record<string, unknown>; honeypot: string }> {
  const categoria = text(data, "categoria");
  const input: Record<string, unknown> = {
    categoria,
    nombres: text(data, "nombres"),
    apellidos: text(data, "apellidos"),
    email: text(data, "email"),
    telefono: text(data, "telefono"),
    entidad: text(data, "entidad"),
    ciudad: text(data, "ciudad"),
    universidad: text(data, "universidad"),
    areas: data
      .getAll("areas")
      .filter((value): value is string => typeof value === "string"),
    motivacion: text(data, "motivacion"),
    consentimiento: data.get("consentimiento") === "on",
  };
  if (categoria === "ESTUDIANTE") {
    input.semestre = text(data, "semestre");
  } else {
    input.anioEgreso = text(data, "anioEgreso");
    input.numeroColegiatura = text(data, "numeroColegiatura");
  }
  return Object.freeze({
    input: Object.freeze(input),
    honeypot: text(data, HONEYPOT_FIELD),
  });
}

export function isCategoria(value: string): value is CategoriaPostulable {
  return value === "ACTIVO" || value === "ASOCIADO" || value === "ESTUDIANTE";
}

/**
 * Valida la planilla. Si falta la categoría, igualmente reporta el resto de campos
 * (la unión discriminada, por sí sola, solo informaría la categoría).
 */
export function validateForm(
  input: Readonly<Record<string, unknown>>
): Result<SolicitudAfiliacion, FieldErrors> {
  const parsed = SolicitudAfiliacionSchema.safeParse(input);
  if (parsed.success) return ok(parsed.data);
  if (typeof input.categoria === "string" && isCategoria(input.categoria)) {
    return err(toFieldErrors(parsed.error));
  }
  const rest = SolicitudAfiliacionSchema.safeParse({
    ...input,
    categoria: "ACTIVO",
  });
  return err(
    Object.freeze({
      categoria: "Selecciona una categoría de ingreso.",
      ...(rest.success ? {} : toFieldErrors(rest.error)),
    })
  );
}

/** Texto para el correo alternativo cuando la recepción en línea no está habilitada. */
export function buildMailtoBody(solicitud: SolicitudAfiliacion): string {
  const lines = [
    "Hola, deseo afiliarme a la SVODEB. Estos son mis datos:",
    "",
    `Categoría: ${CATEGORIA_LABEL[solicitud.categoria]}`,
    `Nombre: ${solicitud.nombres} ${solicitud.apellidos}`,
    `Correo: ${solicitud.email}`,
    `Teléfono: ${solicitud.telefono}`,
    `Ubicación: ${solicitud.ciudad}, ${solicitud.entidad}`,
    `Universidad: ${solicitud.universidad}`,
    solicitud.categoria === "ESTUDIANTE"
      ? `Semestre: ${solicitud.semestre}`
      : `Año de egreso: ${solicitud.anioEgreso}`,
    `Áreas de interés: ${solicitud.areas.map(area => AREA_LABEL[area]).join(", ")}`,
  ];
  if (solicitud.motivacion) lines.push("", solicitud.motivacion);
  return lines.join("\n");
}
