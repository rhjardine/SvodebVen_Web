import { z } from "zod";

/**
 * Desactiva la compilación JIT de zod (usa `new Function`), incompatible con la CSP
 * estricta sin 'unsafe-eval'. Debe importarse ANTES que cualquier esquema.
 */
z.config({ jitless: true });
