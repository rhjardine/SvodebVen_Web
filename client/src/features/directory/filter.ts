import type { AreaDeInteres, EntidadFederal } from "@shared/membership/catalog";
import type { FichaDirectorio } from "@/content/types";

export type DirectoryFilter = Readonly<{
  texto: string;
  area: AreaDeInteres | "TODAS";
  entidad: EntidadFederal | "TODAS";
}>;

export const EMPTY_FILTER: DirectoryFilter = Object.freeze({
  texto: "",
  area: "TODAS",
  entidad: "TODAS",
});

/** Minúsculas y sin diacríticos: "Mérida" coincide con "merida". */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** Una ficha es publicable solo si su verificación sigue vigente. */
export function isVigente(ficha: FichaDirectorio, hoy: Date): boolean {
  return (
    new Date(`${ficha.verificadoHasta}T23:59:59-04:00`).getTime() >=
    hoy.getTime()
  );
}

export function filterDirectory(
  fichas: readonly FichaDirectorio[],
  filtro: DirectoryFilter,
  hoy: Date
): readonly FichaDirectorio[] {
  const texto = normalizeText(filtro.texto);
  return fichas.filter(ficha => {
    if (!isVigente(ficha, hoy)) return false;
    if (filtro.area !== "TODAS" && !ficha.areas.includes(filtro.area))
      return false;
    if (filtro.entidad !== "TODAS" && ficha.entidad !== filtro.entidad)
      return false;
    if (!texto) return true;
    return [ficha.nombre, ficha.ciudad, ficha.entidad].some(value =>
      normalizeText(value).includes(texto)
    );
  });
}
