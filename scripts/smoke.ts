/**
 * Prueba de humo contra un despliegue real (o local).
 * Uso: pnpm smoke https://svodeb.org
 *
 * No envía solicitudes válidas de afiliación (no genera correos ni expedientes):
 * verifica salud, cabeceras, rutas, SEO y que la API rechace entradas inválidas.
 */
import { MEMBERSHIP_ENDPOINT } from "../shared/membership/api";

type CheckResult = Readonly<{ nombre: string; ok: boolean; detalle: string }>;
type Check = Readonly<{ nombre: string; run: (base: URL) => Promise<string> }>;

class CheckFailure extends Error {
  override readonly name = "CheckFailure";
}

function expect(condition: boolean, message: string): void {
  if (!condition) throw new CheckFailure(message);
}

const REQUIRED_HEADERS = [
  "content-security-policy",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
] as const;

const checks: readonly Check[] = [
  {
    nombre: "Salud de la API",
    run: async base => {
      const res = await fetch(new URL("/api/health", base));
      expect(res.status === 200, `estado ${res.status}`);
      return "200 OK";
    },
  },
  {
    nombre: "Sesión: sin cookie no hay identidad y la respuesta no se cachea",
    run: async base => {
      const res = await fetch(new URL("/api/v1/auth/session", base));
      expect(res.status === 200, `estado ${res.status}`);
      const body: unknown = await res.json();
      expect(
        typeof body === "object" &&
          body !== null &&
          "member" in body &&
          body.member === null,
        "se esperaba { member: null }"
      );
      expect(
        res.headers.get("cache-control") === "no-store",
        "la sesión debe ser no-store"
      );
      return "200 · member null · no-store";
    },
  },
  {
    nombre: "Directorio: respuesta acotada, cacheable y sin datos de contacto",
    run: async base => {
      const res = await fetch(new URL("/api/v1/directory?pageSize=5", base));
      // Sin base de datos configurada la ruta no existe: es un estado válido (404).
      if (res.status === 404)
        return "404 (sin base de datos: directorio no habilitado)";
      expect(res.status === 200, `estado ${res.status}`);
      expect(
        (res.headers.get("cache-control") ?? "").includes("s-maxage"),
        "falta Cache-Control con s-maxage"
      );
      const text = await res.text();
      expect(
        !/@|telefono|memberId/i.test(text),
        "la respuesta expone datos de contacto"
      );
      return "200 · cacheable · sin contacto";
    },
  },
  {
    nombre: "Página principal y cabeceras de seguridad",
    run: async base => {
      const res = await fetch(base);
      expect(res.status === 200, `estado ${res.status}`);
      const faltantes = REQUIRED_HEADERS.filter(h => !res.headers.has(h));
      expect(
        faltantes.length === 0,
        `faltan cabeceras: ${faltantes.join(", ")}`
      );
      if (base.protocol === "https:") {
        expect(
          res.headers.has("strict-transport-security"),
          "falta HSTS en HTTPS"
        );
      }
      expect(!res.headers.has("x-powered-by"), "expone X-Powered-By");
      const html = await res.text();
      expect(html.includes('lang="es-VE"'), "falta lang=es-VE");
      return "200 OK, cabeceras completas";
    },
  },
  {
    nombre: "Ruta desconocida devuelve 404 real",
    run: async base => {
      const res = await fetch(new URL("/ruta-inexistente-smoke", base));
      expect(res.status === 404, `estado ${res.status}`);
      return "404";
    },
  },
  {
    nombre: "Aviso de privacidad",
    run: async base => {
      const res = await fetch(new URL("/privacidad", base));
      expect(res.status === 200, `estado ${res.status}`);
      return "200 OK";
    },
  },
  {
    nombre: "robots.txt",
    run: async base => {
      const res = await fetch(new URL("/robots.txt", base));
      expect(res.status === 200, `estado ${res.status}`);
      const body = await res.text();
      return body.includes("Sitemap:")
        ? "con sitemap"
        : "sin sitemap (falta PUBLIC_SITE_URL)";
    },
  },
  {
    nombre: "Recursos estáticos con caché inmutable",
    run: async base => {
      const html = await (await fetch(base)).text();
      const asset = /\/assets\/[^"']+\.js/.exec(html)?.[0];
      expect(asset !== undefined, "no se encontró el bundle JS");
      const res = await fetch(new URL(asset ?? "", base));
      expect(res.status === 200, `estado ${res.status}`);
      expect(
        (res.headers.get("cache-control") ?? "").includes("immutable"),
        "sin caché inmutable"
      );
      return asset ?? "";
    },
  },
  {
    nombre: "API de afiliación rechaza datos inválidos",
    run: async base => {
      const res = await fetch(new URL(MEMBERSHIP_ENDPOINT, base), {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: base.origin },
        body: JSON.stringify({ categoria: "ACTIVO" }),
      });
      expect(res.status === 422, `estado ${res.status} (se esperaba 422)`);
      return "422 con errores por campo";
    },
  },
];

async function main(): Promise<void> {
  const target = process.argv[2] ?? process.env.SMOKE_URL;
  if (!target) {
    console.error(
      "Uso: pnpm smoke <url>   (ej.: pnpm smoke https://svodeb.org)"
    );
    process.exit(2);
  }
  const base = new URL(target);
  const results: CheckResult[] = [];

  for (const check of checks) {
    try {
      results.push({
        nombre: check.nombre,
        ok: true,
        detalle: await check.run(base),
      });
    } catch (error) {
      const detalle = error instanceof Error ? error.message : String(error);
      results.push({ nombre: check.nombre, ok: false, detalle });
    }
  }

  for (const r of results)
    console.log(`${r.ok ? "✔" : "✘"} ${r.nombre} — ${r.detalle}`);
  const fallidas = results.filter(r => !r.ok).length;
  console.log(
    fallidas === 0
      ? `\nTodo correcto (${results.length} verificaciones).`
      : `\n${fallidas} verificación(es) fallida(s).`
  );
  process.exit(fallidas === 0 ? 0 : 1);
}

void main();
