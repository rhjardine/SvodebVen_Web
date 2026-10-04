import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUERY,
  hasFilters,
  parseQuery,
  toSearch,
} from "../client/src/features/directory/url-state";

describe("estado del directorio en la URL", () => {
  it("sin parámetros usa los valores por defecto", () => {
    expect(parseQuery("")).toEqual(DEFAULT_QUERY);
    expect(hasFilters(DEFAULT_QUERY)).toBe(false);
  });

  it("lee filtros válidos y los serializa de vuelta (ida y vuelta)", () => {
    const query = parseQuery("?q=ana&area=ESTETICA&entidad=M%C3%A9rida&page=3");
    expect(query).toMatchObject({
      q: "ana",
      area: "ESTETICA",
      entidad: "Mérida",
      page: 3,
    });
    expect(parseQuery(toSearch(query))).toEqual(query);
    expect(toSearch(DEFAULT_QUERY)).toBe("");
  });

  it("ignora valores manipulados campo por campo sin romper los válidos", () => {
    const query = parseQuery("?area=HACK&entidad=Mordor&page=-5&q=ana");
    expect(query.q).toBe("ana");
    expect(query.area).toBeUndefined();
    expect(query.entidad).toBeUndefined();
    expect(query.page).toBe(1);
  });

  it("rechaza páginas fuera de rango, texto excesivo o con caracteres de control", () => {
    expect(parseQuery("?page=999").page).toBe(1);
    expect(parseQuery(`?q=${"a".repeat(200)}`).q).toBeUndefined();
    expect(parseQuery("?q=a%0Ab").q).toBeUndefined();
  });

  it("no hay inyección posible: el texto solo es un valor de búsqueda", () => {
    const query = parseQuery("?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E");
    expect(toSearch(query)).toContain("q=");
    expect(query.q).toBe("<script>alert(1)</script>");
  });
});
