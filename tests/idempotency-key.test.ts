import { describe, expect, it } from "vitest";
import { createAttemptKey } from "../client/src/lib/idempotency";
import { apiError } from "../shared/errors";

const sequence = () => {
  let n = 0;
  return () => `key-${++n}`;
};

describe("createAttemptKey", () => {
  it("reutiliza la clave tras un fallo de red o de servidor (el reintento es el mismo intento)", () => {
    const attempt = createAttemptKey(sequence());
    const first = attempt.current();
    attempt.settle({ kind: "NETWORK" });
    attempt.settle({ kind: "TIMEOUT" });
    attempt.settle({
      kind: "API",
      status: 503,
      error: apiError("SERVICE_UNAVAILABLE", "x"),
    });
    expect(attempt.current()).toBe(first);
  });

  it("renueva la clave tras un éxito o un rechazo definitivo 4xx", () => {
    const attempt = createAttemptKey(sequence());
    const first = attempt.current();
    attempt.settle("success");
    const second = attempt.current();
    expect(second).not.toBe(first);
    attempt.settle({
      kind: "API",
      status: 422,
      error: apiError("VALIDATION_ERROR", "x"),
    });
    expect(attempt.current()).not.toBe(second);
  });
});
