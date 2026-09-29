import { describe, expect, it } from "vitest";
import {
  formDataToInput,
  validateForm,
} from "../client/src/features/membership/form-mapping";
import { HONEYPOT_FIELD } from "../shared/membership/api";

function formData(entries: ReadonlyArray<readonly [string, string]>): FormData {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

describe("planilla de afiliación (cliente)", () => {
  it("reporta todos los campos pendientes aunque falte la categoría", () => {
    const { input } = formDataToInput(formData([["nombres", "Ana"]]));
    const result = validateForm(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.categoria).toBeDefined();
    expect(result.error.email).toBeDefined();
    expect(result.error.nombres).toBeUndefined();
  });

  it("mapea checkboxes, consentimiento, campos condicionales y honeypot", () => {
    const { input, honeypot } = formDataToInput(
      formData([
        ["categoria", "ESTUDIANTE"],
        ["semestre", "7"],
        ["anioEgreso", "2010"],
        ["areas", "OPERATORIA"],
        ["areas", "ESTETICA"],
        ["consentimiento", "on"],
        [HONEYPOT_FIELD, "bot"],
      ])
    );
    expect(input.semestre).toBe("7");
    expect(input).not.toHaveProperty("anioEgreso");
    expect(input.areas).toEqual(["OPERATORIA", "ESTETICA"]);
    expect(input.consentimiento).toBe(true);
    expect(honeypot).toBe("bot");
  });
});
