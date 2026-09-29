export type NavItem = Readonly<{ label: string; href: string }>;

/** Anclas de la página principal; con prefijo "/" para funcionar también desde /privacidad. */
export const NAV_ITEMS: readonly NavItem[] = Object.freeze([
  { label: "La sociedad", href: "/#sociedad" },
  { label: "Institución", href: "/#institucion" },
  { label: "Especialistas", href: "/#especialistas" },
  { label: "Eventos", href: "/#eventos" },
  { label: "Contacto", href: "/#contacto" },
]);

export const CTA_AFILIACION: NavItem = Object.freeze({
  label: "Afíliate",
  href: "/#afiliacion",
});
