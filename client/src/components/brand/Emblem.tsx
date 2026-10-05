import { BRAND_COLORS, EMBLEM } from "./brand-paths";

type EmblemProps = Readonly<{
  /**
   * `color`: colores oficiales (fondo claro).
   * `on-dark`: variante para fondos azul marino — la parte marino pasa a blanco y el azul se aclara.
   * PENDIENTE: validar esta variante con la directiva (el manual de marca no se ha entregado).
   */
  variant?: "color" | "on-dark";
  className?: string;
}>;

/** Emblema oficial (diente con cintas) como SVG en línea: sin peticiones de red, nítido a cualquier tamaño. */
export function Emblem({ variant = "color", className }: EmblemProps) {
  const dark = variant === "on-dark";
  return (
    <svg
      viewBox={`0 0 ${EMBLEM.width} ${EMBLEM.height}`}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path fill={BRAND_COLORS.teal} d={EMBLEM.teal} />
      <path fill={dark ? "#ffffff" : BRAND_COLORS.navy} d={EMBLEM.navy} />
      <path fill={dark ? "#9fc0dc" : BRAND_COLORS.blue} d={EMBLEM.blue} />
    </svg>
  );
}
