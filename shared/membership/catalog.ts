/**
 * Catálogos cerrados del dominio de Membresía.
 * Se exportan como tuplas `as const` para derivar tipos literales y
 * alimentar `z.enum`, evitando cadenas libres en la frontera.
 */

/** 23 estados + Distrito Capital, más la opción para postulantes del exterior. */
export const ENTIDADES_FEDERALES = [
  "Amazonas",
  "Anzoátegui",
  "Apure",
  "Aragua",
  "Barinas",
  "Bolívar",
  "Carabobo",
  "Cojedes",
  "Delta Amacuro",
  "Distrito Capital",
  "Falcón",
  "Guárico",
  "La Guaira",
  "Lara",
  "Mérida",
  "Miranda",
  "Monagas",
  "Nueva Esparta",
  "Portuguesa",
  "Sucre",
  "Táchira",
  "Trujillo",
  "Yaracuy",
  "Zulia",
  "Fuera de Venezuela",
] as const;
export type EntidadFederal = (typeof ENTIDADES_FEDERALES)[number];

/**
 * Categorías a las que se puede POSTULAR.
 * "Miembro honorario" se confiere por la sociedad; no es postulable.
 * PENDIENTE: validar nombres y requisitos contra los Estatutos vigentes.
 */
export const CATEGORIAS_POSTULABLES = [
  "ACTIVO",
  "ASOCIADO",
  "ESTUDIANTE",
] as const;
export type CategoriaPostulable = (typeof CATEGORIAS_POSTULABLES)[number];

export const CATEGORIA_LABEL: Readonly<Record<CategoriaPostulable, string>> =
  Object.freeze({
    ACTIVO: "Miembro activo",
    ASOCIADO: "Miembro asociado",
    ESTUDIANTE: "Estudiante",
  });

/** Etiqueta corta para controles compactos (tarjetas de selección). */
export const CATEGORIA_LABEL_CORTA: Readonly<
  Record<CategoriaPostulable, string>
> = Object.freeze({
  ACTIVO: "Activo",
  ASOCIADO: "Asociado",
  ESTUDIANTE: "Estudiante",
});

export const AREAS_DE_INTERES = [
  "OPERATORIA",
  "ESTETICA",
  "BIOMATERIALES",
  "DOCENCIA_INVESTIGACION",
] as const;
export type AreaDeInteres = (typeof AREAS_DE_INTERES)[number];

export const AREA_LABEL: Readonly<Record<AreaDeInteres, string>> =
  Object.freeze({
    OPERATORIA: "Operatoria dental",
    ESTETICA: "Odontología estética",
    BIOMATERIALES: "Biomateriales",
    DOCENCIA_INVESTIGACION: "Docencia e investigación",
  });
