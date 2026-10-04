import type { AreaDeInteres } from "@shared/membership/catalog";

/**
 * Modelo de contenido institucional. Todo es `Readonly`: el contenido se edita
 * en la fuente (hoy este módulo, mañana el CMS), nunca se muta en tiempo de ejecución.
 */

export type Organizacion = Readonly<{
  sigla: string;
  nombre: string;
  lema: string;
  afiliacion: Readonly<{ sigla: string; url: string | null }>;
  instagram: Readonly<{ usuario: string; url: string }>;
  email: string;
  rif: string | null;
}>;

export type Disciplina = Readonly<{
  id: AreaDeInteres;
  titulo: string;
  descripcion: string;
}>;

export type MiembroDirectiva = Readonly<{
  nombre: string;
  cargo: string;
}>;

export type JuntaDirectiva = Readonly<{
  periodo: string;
  miembros: readonly MiembroDirectiva[];
}>;

export type Hito = Readonly<{
  anio: number;
  titulo: string;
  descripcion: string;
}>;

export type EstadoEvento = "PROXIMO" | "REALIZADO";

export type EventoSociedad = Readonly<{
  id: string;
  titulo: string;
  tipo: "Asamblea" | "Jornada" | "Curso" | "Congreso";
  estado: EstadoEvento;
  /** Fecha ISO; `null` mientras no esté confirmada oficialmente. */
  fecha: string | null;
  sede: string | null;
  modalidad: "Presencial" | "En línea" | "Híbrida" | null;
  resumen: string;
}>;
