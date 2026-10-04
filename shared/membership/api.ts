/** Constantes del contrato HTTP de afiliación (el contrato completo está en ./contract). */
export const MEMBERSHIP_ENDPOINT = "/api/v1/afiliaciones" as const;

/** Campo trampa: los humanos no lo ven; si llega con valor, es un bot. */
export const HONEYPOT_FIELD = "sitio_web" as const;
