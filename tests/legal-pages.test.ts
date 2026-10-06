import { describe, expect, it } from "vitest";
import { render } from "../client/src/entry-server";
import { TITULAR } from "../client/src/content/legal";
import { INDEXABLE_ROUTES, PRERENDERED_ROUTES } from "../shared/routes";

describe("Aviso legal", () => {
  const html = render("/aviso-legal");

  it("se prerenderiza, está en el sitemap y se enlaza desde el pie", () => {
    expect(PRERENDERED_ROUTES.some(r => r.path === "/aviso-legal")).toBe(true);
    expect(INDEXABLE_ROUTES).toContain("/aviso-legal");
    expect(html).toContain('href="/aviso-legal"');
  });

  it("incluye las secciones esenciales", () => {
    for (const heading of [
      "1. Titular del sitio",
      "3. Condiciones de uso",
      "4. Carácter informativo: no es atención clínica",
      "5. Propiedad intelectual",
      "7. Responsabilidad",
      "10. Ley aplicable y jurisdicción",
    ]) {
      expect(html).toContain(heading);
    }
  });

  it("muestra los datos confirmados y declara «Por confirmar» lo pendiente (sin inventar ni mostrar null)", () => {
    expect(html).toContain(TITULAR.denominacion);
    expect(html).toContain(TITULAR.email);
    if (TITULAR.rif) expect(html).toContain(TITULAR.rif);
    const pendientes = Object.values(TITULAR).filter(v => v === null).length;
    expect(html.split("Por confirmar").length - 1).toBeGreaterThanOrEqual(
      Math.min(pendientes, 1)
    );
    expect(html).not.toMatch(/>null<|undefined|PENDIENTE/);
  });

  it("avisa que es un borrador en revisión legal", () => {
    expect(html).toContain("Documento en revisión legal");
  });
});
