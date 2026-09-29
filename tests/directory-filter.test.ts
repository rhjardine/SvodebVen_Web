import { describe, expect, it } from "vitest";
import type { FichaDirectorio } from "../client/src/content/types";
import {
  EMPTY_FILTER,
  filterDirectory,
} from "../client/src/features/directory/filter";

const hoy = new Date("2026-09-29T12:00:00-04:00");

const fichas: readonly FichaDirectorio[] = [
  {
    id: "a",
    nombre: "Ana Núñez",
    categoria: "Activo",
    areas: ["ESTETICA"],
    ciudad: "Mérida",
    entidad: "Mérida",
    verificadoHasta: "2027-01-31",
  },
  {
    id: "b",
    nombre: "Luis Pérez",
    categoria: "Asociado",
    areas: ["BIOMATERIALES"],
    ciudad: "Maracaibo",
    entidad: "Zulia",
    verificadoHasta: "2027-01-31",
  },
  {
    id: "c",
    nombre: "Vencida Gómez",
    categoria: "Activo",
    areas: ["ESTETICA"],
    ciudad: "Caracas",
    entidad: "Distrito Capital",
    verificadoHasta: "2026-01-31",
  },
];

describe("filterDirectory", () => {
  it("oculta fichas con verificación vencida", () => {
    expect(filterDirectory(fichas, EMPTY_FILTER, hoy).map(f => f.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("busca sin distinguir tildes ni mayúsculas", () => {
    expect(
      filterDirectory(fichas, { ...EMPTY_FILTER, texto: "MERIDA" }, hoy).map(
        f => f.id
      )
    ).toEqual(["a"]);
    expect(
      filterDirectory(fichas, { ...EMPTY_FILTER, texto: "nunez" }, hoy).map(
        f => f.id
      )
    ).toEqual(["a"]);
  });

  it("filtra por área y por entidad", () => {
    expect(
      filterDirectory(
        fichas,
        { ...EMPTY_FILTER, area: "BIOMATERIALES" },
        hoy
      ).map(f => f.id)
    ).toEqual(["b"]);
    expect(
      filterDirectory(
        fichas,
        { ...EMPTY_FILTER, entidad: "Zulia", area: "ESTETICA" },
        hoy
      )
    ).toEqual([]);
  });
});
