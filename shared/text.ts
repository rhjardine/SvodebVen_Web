/** Minúsculas, sin diacríticos y espacios colapsados: "Mérida" coincide con "merida". */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Caracteres de control (incluye \r\n y NUL): nunca válidos en texto de una sola línea. */
export function hasControlChars(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}
