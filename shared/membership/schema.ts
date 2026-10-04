import { z } from "zod";
import { AREAS_DE_INTERES, ENTIDADES_FEDERALES } from "./catalog";

/**
 * Contrato de la solicitud de afiliación.
 * Se ejecuta en el cliente (experiencia de usuario) y SIEMPRE de nuevo en el
 * servidor (frontera de confianza). Nunca confiar solo en la validación del cliente.
 */

/** Caracteres de control (incluye inyección de cabeceras con \r\n); opcionalmente tolera tab y saltos de línea. */
function hasControlChars(value: string, allowWhitespace: boolean): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code === 0x7f) return true;
    if (code <= 0x1f) {
      const isWhitespace = code === 0x09 || code === 0x0a || code === 0x0d;
      if (!(allowWhitespace && isWhitespace)) return true;
    }
  }
  return false;
}

type TextLabels = Readonly<{ campo: string; requerido: string }>;

const singleLine = (min: number, max: number, labels: TextLabels) =>
  z
    .string({ error: labels.requerido })
    .trim()
    .min(1, { error: labels.requerido })
    .min(min, { error: `${labels.campo}: mínimo ${min} caracteres.` })
    .max(max, { error: `${labels.campo}: máximo ${max} caracteres.` })
    .refine(value => !hasControlChars(value, false), {
      error: `${labels.campo}: contiene caracteres no permitidos.`,
    });

/** Normaliza separadores comunes y exige formato internacional o local venezolano. */
const telefono = z
  .string({ error: "Escribe tu teléfono." })
  .trim()
  .min(1, { error: "Escribe tu teléfono." })
  .transform(value => value.replace(/[\s().-]/g, ""))
  .transform(value =>
    /^0\d{10}$/.test(value) ? `+58${value.slice(1)}` : value
  )
  .transform(value => (/^58\d{10}$/.test(value) ? `+${value}` : value))
  .refine(value => /^\+[1-9]\d{9,14}$/.test(value), {
    error:
      "Usa un número válido, por ejemplo 0414 123 4567 o +58 414 123 4567.",
  });

/** Campo numérico de formulario: "" o ausente cuenta como "no respondido". */
const emptyToUndefined = (value: unknown): unknown =>
  value === "" || value === null ? undefined : value;

const anioEgreso = z.preprocess(
  emptyToUndefined,
  z.coerce
    .number({ error: "Indica el año de egreso." })
    .int({ error: "El año debe ser un número entero." })
    .min(1950, { error: "Revisa el año de egreso." })
    .refine(year => year <= new Date().getFullYear(), {
      error: "El año de egreso no puede ser futuro.",
    })
);

const numeroColegiatura = z
  .string()
  .trim()
  .max(20, { error: "Máximo 20 caracteres." })
  .regex(/^[A-Za-z0-9-]*$/, { error: "Solo letras, números y guiones." })
  .optional()
  .transform(value => (value ? value : undefined));

const base = z.object({
  nombres: singleLine(2, 60, {
    campo: "Nombres",
    requerido: "Escribe tu nombre.",
  }),
  apellidos: singleLine(2, 60, {
    campo: "Apellidos",
    requerido: "Escribe tu apellido.",
  }),
  email: z
    .string({ error: "Escribe tu correo." })
    .trim()
    .min(1, { error: "Escribe tu correo." })
    .toLowerCase()
    .pipe(z.email({ error: "Escribe un correo válido." }).max(254)),
  telefono,
  entidad: z.enum(ENTIDADES_FEDERALES, { error: "Selecciona un estado." }),
  ciudad: singleLine(2, 80, {
    campo: "Ciudad",
    requerido: "Escribe tu ciudad.",
  }),
  areas: z
    .array(z.enum(AREAS_DE_INTERES), { error: "Selecciona al menos un área." })
    .min(1, { error: "Selecciona al menos un área." })
    .max(AREAS_DE_INTERES.length)
    .transform(areas => Array.from(new Set(areas))),
  motivacion: z
    .string()
    .trim()
    .max(1000, { error: "Máximo 1000 caracteres." })
    .refine(value => !hasControlChars(value, true), {
      error: "El texto contiene caracteres no permitidos.",
    })
    .optional()
    .transform(value => (value ? value : undefined)),
  consentimiento: z.literal(true, {
    error: "Debes autorizar el tratamiento de tus datos para continuar.",
  }),
});

const profesional = {
  universidad: singleLine(2, 120, {
    campo: "Universidad",
    requerido: "Indica tu universidad.",
  }),
  anioEgreso,
  numeroColegiatura,
};

export const SolicitudAfiliacionSchema = z.discriminatedUnion(
  "categoria",
  [
    base.extend({ categoria: z.literal("ACTIVO"), ...profesional }),
    base.extend({ categoria: z.literal("ASOCIADO"), ...profesional }),
    base.extend({
      categoria: z.literal("ESTUDIANTE"),
      universidad: singleLine(2, 120, {
        campo: "Universidad",
        requerido: "Indica tu universidad.",
      }),
      semestre: z.preprocess(
        emptyToUndefined,
        z.coerce
          .number({ error: "Indica el semestre que cursas." })
          .int()
          .min(1, { error: "Semestre entre 1 y 12." })
          .max(12, { error: "Semestre entre 1 y 12." })
      ),
    }),
  ],
  { error: "Selecciona una categoría de ingreso." }
);

export type SolicitudAfiliacionInput = z.input<
  typeof SolicitudAfiliacionSchema
>;
export type SolicitudAfiliacion = Readonly<
  z.output<typeof SolicitudAfiliacionSchema>
>;

/** Mapa campo → primer mensaje de error, apto para pintar errores en línea. */
export type FieldErrors = Readonly<Partial<Record<string, string>>>;

export function toFieldErrors(error: z.ZodError): FieldErrors {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : "_form";
    if (!(key in errors)) errors[key] = issue.message;
  }
  return Object.freeze(errors);
}
