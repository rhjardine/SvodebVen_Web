import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  all,
  andThen,
  andThenAsync,
  err,
  fromZod,
  map,
  mapError,
  match,
  ok,
  tryAsync,
  trySync,
  type Result,
} from "../shared/result";

describe("Result", () => {
  it("usa el discriminante `success` y es inmutable", () => {
    const good = ok(1);
    const bad = err("x");
    expect(good).toEqual({ success: true, value: 1 });
    expect(bad).toEqual({ success: false, error: "x" });
    expect(Object.isFrozen(good)).toBe(true);
    expect(Object.isFrozen(bad)).toBe(true);
  });

  it("map, mapError y andThen propagan el primer fallo sin ejecutar el resto", () => {
    let calls = 0;
    const boom: Result<number, string> = err("fallo");
    expect(map(boom, () => ++calls)).toEqual(err("fallo"));
    expect(andThen(boom, () => ok(++calls))).toEqual(err("fallo"));
    expect(calls).toBe(0);
    expect(map(ok(2), n => n * 2)).toEqual(ok(4));
    expect(mapError(boom, e => e.toUpperCase())).toEqual(err("FALLO"));
    expect(andThen(ok(2), n => (n > 5 ? ok(n) : err("pequeño")))).toEqual(
      err("pequeño")
    );
  });

  it("andThenAsync encadena pasos asíncronos", async () => {
    const result = await andThenAsync(ok(2), n => Promise.resolve(ok(n + 1)));
    expect(result).toEqual(ok(3));
  });

  it("match elige la rama correcta", () => {
    const handlers = {
      success: (n: number) => `ok ${n}`,
      failure: (e: string) => `err ${e}`,
    };
    expect(match(ok(1), handlers)).toBe("ok 1");
    expect(match(err("e"), handlers)).toBe("err e");
  });

  it("all devuelve todos los valores o el primer fallo", () => {
    expect(all([ok(1), ok(2)])).toEqual(ok([1, 2]));
    expect(all([ok(1), err("a"), err("b")])).toEqual(err("a"));
  });

  it("fromZod convierte safeParse en Result", () => {
    const schema = z.object({ edad: z.coerce.number().int().min(18) });
    expect(fromZod(schema, { edad: "30" })).toEqual(ok({ edad: 30 }));
    const bad = fromZod(schema, { edad: "5" });
    expect(bad.success).toBe(false);
  });

  it("tryAsync y trySync capturan excepciones de librerías en el borde", async () => {
    const asyncFail = await tryAsync(
      () => Promise.reject(new Error("red caída")),
      cause => (cause instanceof Error ? cause.message : "?")
    );
    expect(asyncFail).toEqual(err("red caída"));
    expect(
      await tryAsync(
        () => Promise.resolve(7),
        () => "x"
      )
    ).toEqual(ok(7));
    expect(
      trySync(
        (): unknown => JSON.parse("{roto"),
        () => "json"
      )
    ).toEqual(err("json"));
  });
});
