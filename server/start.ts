/**
 * Punto de entrada de producción: `node dist/start.js`.
 * 1) Paso de liberación (migraciones). Si falla, el proceso termina con error y el despliegue NO arranca.
 * 2) Solo entonces inicia el servidor HTTP.
 * Es un único comando, sin shell ni comillas: funciona igual como CMD del Dockerfile que en el campo
 * «Docker Command» de Render (que conserva las comillas como texto y rompe `sh -c "a && b"`).
 * Raíz de composición: decide terminar el proceso.
 */
import { runRelease } from "./release";

const code = await runRelease(process.env);
if (code !== 0) process.exit(code);
await import("./index");
