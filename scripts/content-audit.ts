/**
 * Lista la información institucional aún no confirmada (marcadores PENDIENTE).
 * Uso: pnpm content:audit            → informe (siempre termina con éxito)
 *      pnpm content:audit --strict   → falla si queda algo pendiente (antes de publicar)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOTS = ["client/src/content", "client/src/pages", "shared"] as const;
const MARKER = /PENDIENTE:\s*(.*)/;

type Pendiente = Readonly<{ archivo: string; linea: number; nota: string }>;

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx)$/.test(entry)) yield full;
  }
}

function collect(): readonly Pendiente[] {
  const found: Pendiente[] = [];
  for (const root of ROOTS) {
    for (const file of walk(root)) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          const match = MARKER.exec(line);
          if (match) {
            const nota = (match[1] ?? "").replace(/\*\/\s*$/, "").trim();
            found.push({
              archivo: file,
              linea: index + 1,
              nota: nota || "(sin detalle)",
            });
          }
        });
    }
  }
  return found;
}

const strict = process.argv.includes("--strict");
const pendientes = collect();

if (pendientes.length === 0) {
  console.log("✔ Sin contenido pendiente de confirmar.");
  process.exit(0);
}

console.log(
  `Contenido pendiente de confirmar por la directiva (${pendientes.length}):\n`
);
for (const p of pendientes)
  console.log(`  • ${p.archivo}:${p.linea} — ${p.nota}`);
console.log("\nVer docs/ROADMAP.md → «Preguntas abiertas».");
process.exit(strict ? 1 : 0);
