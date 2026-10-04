/**
 * Guarda de exhaustividad SIN excepción: si se agrega una variante a una unión y
 * este `switch` no la maneja, `tsc` falla aquí (el argumento ya no es `never`).
 * En ejecución es inalcanzable; el llamador debe responder con un error genérico.
 */
export function exhaustive(_value: never): void {
  // Verificación solo en compilación.
}
