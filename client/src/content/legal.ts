import { ORGANIZACION } from "./site";

/*
 * DATOS LEGALES DEL TITULAR (fuente única para el Aviso legal, la Política de privacidad,
 * la Política de cookies y los Términos). Regla: aquí solo entra lo CONFIRMADO por la directiva.
 * Lo que es `null` se muestra como "Por confirmar" y aparece en `pnpm content:audit`.
 */
export type TitularLegal = Readonly<{
  denominacion: string;
  sigla: string;
  rif: string | null;
  formaJuridica: string | null;
  domicilio: string | null;
  datosRegistro: string | null;
  representanteLegal: string | null;
  email: string;
  dominio: string | null;
  jurisdiccion: string | null;
}>;

export const TITULAR: TitularLegal = Object.freeze({
  denominacion: ORGANIZACION.nombre,
  sigla: ORGANIZACION.sigla,
  rif: ORGANIZACION.rif,
  // PENDIENTE: forma jurídica según el acta constitutiva (p. ej. asociación civil).
  formaJuridica: null,
  // PENDIENTE: domicilio legal completo de la sociedad.
  domicilio: null,
  // PENDIENTE: datos de registro (oficina, fecha, tomo/número) del acta constitutiva.
  datosRegistro: null,
  // PENDIENTE: nombre y cargo del representante legal.
  representanteLegal: null,
  email: ORGANIZACION.email,
  // PENDIENTE: dominio definitivo del sitio.
  dominio: null,
  // PENDIENTE: tribunales competentes (ciudad) según los Estatutos y asesoría legal.
  jurisdiccion: null,
});

/** Estado de revisión de cada documento (visible en la página y en el README). */
export type DocumentoLegal = Readonly<{
  version: string;
  actualizado: string;
  estado: "BORRADOR" | "REVISADO";
}>;

export const AVISO_LEGAL: DocumentoLegal = Object.freeze({
  version: "aviso-legal-borrador-1",
  actualizado: "2026-10-06",
  estado: "BORRADOR",
});
