import { describe, expect, it } from "vitest";
import {
  SolicitudAfiliacionSchema,
  toFieldErrors,
} from "../shared/membership/schema";
import { solicitudValida } from "./fixtures";

describe("SolicitudAfiliacionSchema", () => {
  it("normaliza correo, teléfono, año, colegiatura vacía y áreas duplicadas", () => {
    const result = SolicitudAfiliacionSchema.safeParse(solicitudValida);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.email).toBe("maria.perez@correo.com");
    expect(result.data.telefono).toBe("+584141234567");
    expect(result.data.areas).toEqual(["ESTETICA", "BIOMATERIALES"]);
    if (result.data.categoria === "ESTUDIANTE")
      throw new Error("categoría inesperada");
    expect(result.data.anioEgreso).toBe(2015);
    expect(result.data.numeroColegiatura).toBeUndefined();
  });

  it("exige semestre para estudiantes y no año de egreso", () => {
    const result = SolicitudAfiliacionSchema.safeParse({
      ...solicitudValida,
      categoria: "ESTUDIANTE",
      semestre: "",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(toFieldErrors(result.error).semestre).toBeDefined();
  });

  it("rechaza sin consentimiento explícito", () => {
    const result = SolicitudAfiliacionSchema.safeParse({
      ...solicitudValida,
      consentimiento: false,
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(toFieldErrors(result.error).consentimiento).toMatch(/autorizar/);
  });

  it("rechaza caracteres de control (inyección de cabeceras) en campos de una línea", () => {
    const result = SolicitudAfiliacionSchema.safeParse({
      ...solicitudValida,
      nombres: "Ana\r\nBcc: x@y.z",
    });
    expect(result.success).toBe(false);
  });

  it("no permite postular a miembro honorario", () => {
    const result = SolicitudAfiliacionSchema.safeParse({
      ...solicitudValida,
      categoria: "HONORARIO",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza años de egreso futuros y teléfonos inválidos", () => {
    const futuro = SolicitudAfiliacionSchema.safeParse({
      ...solicitudValida,
      anioEgreso: new Date().getFullYear() + 1,
    });
    const telefono = SolicitudAfiliacionSchema.safeParse({
      ...solicitudValida,
      telefono: "123",
    });
    expect(futuro.success).toBe(false);
    expect(telefono.success).toBe(false);
  });

  it("acepta un número internacional", () => {
    const result = SolicitudAfiliacionSchema.safeParse({
      ...solicitudValida,
      telefono: "+57 300 123 4567",
    });
    expect(result.success).toBe(true);
  });
});
