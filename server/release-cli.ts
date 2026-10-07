/**
 * CLI del paso de liberación: `node dist/release-cli.js` (migra la base y termina).
 * Raíz de composición: decide terminar el proceso con el código de salida.
 */
import { runRelease } from "./release";

process.exit(await runRelease(process.env));
