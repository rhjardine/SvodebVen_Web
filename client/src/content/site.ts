import type {
  Disciplina,
  EventoSociedad,
  FichaDirectorio,
  Hito,
  JuntaDirectiva,
  Organizacion,
} from "./types";

/*
 * FUENTE ÚNICA DE CONTENIDO (fase previa al CMS).
 * Regla editorial: aquí solo entra información CONFIRMADA por la directiva.
 * Los campos marcados como PENDIENTE deben validarse antes de publicar en producción
 * (ver docs/ROADMAP.md → "Preguntas abiertas").
 */

export const ORGANIZACION: Organizacion = Object.freeze({
  sigla: "SVODEB",
  nombre: "Sociedad Venezolana de Operatoria Dental, Estética y Biomateriales",
  lema: "Ciencia que se convierte en confianza.",
  // PENDIENTE: nombre completo de ALODYB y enlace oficial.
  afiliacion: Object.freeze({ sigla: "ALODYB", url: null }),
  instagram: Object.freeze({
    usuario: "svodeb",
    url: "https://www.instagram.com/svodeb/",
  }),
  // PENDIENTE: confirmar que el buzón existe y es atendido.
  email: "secretaria@svodeb.org",
  // PENDIENTE: confirmar RIF con el documento constitutivo.
  rif: "J-296571635",
});

export const DISCIPLINAS: readonly Disciplina[] = Object.freeze([
  Object.freeze({
    id: "OPERATORIA",
    titulo: "Operatoria dental",
    descripcion:
      "Diagnóstico, preparación y restauración de la estructura dentaria con un enfoque conservador y basado en evidencia.",
  }),
  Object.freeze({
    id: "ESTETICA",
    titulo: "Estética",
    descripcion:
      "Forma, color y armonía al servicio de la función, la salud y las expectativas reales de cada paciente.",
  }),
  Object.freeze({
    id: "BIOMATERIALES",
    titulo: "Biomateriales",
    descripcion:
      "Propiedades, indicaciones y comportamiento clínico de los materiales restauradores y los sistemas adhesivos.",
  }),
]);

/** PENDIENTE: nómina oficial vigente. Vacía = se muestra estado "en actualización". */
export const JUNTA_DIRECTIVA: JuntaDirectiva | null = null;

/** PENDIENTE: hitos históricos verificados (fundación, primeras jornadas, afiliaciones). */
export const HITOS: readonly Hito[] = Object.freeze([]);

/** Solo fichas verificadas por secretaría y con consentimiento expreso del miembro. */
export const DIRECTORIO: readonly FichaDirectorio[] = Object.freeze([]);

export const EVENTOS: readonly EventoSociedad[] = Object.freeze([
  Object.freeze({
    id: "asamblea-2026",
    titulo: "Asamblea SVODEB 2026",
    tipo: "Asamblea",
    estado: "REALIZADO",
    fecha: null, // PENDIENTE: fecha oficial
    sede: null,
    modalidad: null,
    resumen:
      "Encuentro institucional de los miembros de la sociedad. Próximamente publicaremos la memoria y los acuerdos.",
  }),
]);
