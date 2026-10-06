import { AtSign, Mail } from "lucide-react";
import { Logo, LogoPlaque } from "@/components/brand/Logo";
import { NAV_ITEMS } from "@/content/navigation";
import { ORGANIZACION } from "@/content/site";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer
      id="contacto"
      className="on-navy bg-navy-950 text-white"
      aria-labelledby="footer-title"
    >
      <div className="brand-stripes" aria-hidden="true" />
      <div className="container-site grid gap-12 py-16 md:grid-cols-[1.4fr_0.8fr_1fr]">
        <div>
          <h2 id="footer-title" className="sr-only">
            Contacto e información institucional
          </h2>
          <LogoPlaque className="w-fit max-w-full">
            <Logo variant="full" className="w-60 max-w-full sm:w-64" />
          </LogoPlaque>
          <p className="mt-6 max-w-sm text-base leading-7 text-on-navy">
            Operatoria dental, estética y biomateriales con rigor científico y
            vocación de servicio.
          </p>
          <p className="mt-4 text-sm font-semibold text-on-navy-muted">
            Sociedad afiliada a {ORGANIZACION.afiliacion.sigla}
          </p>
        </div>

        <nav aria-label="Pie de página">
          <p className="text-xs font-bold tracking-[0.16em] text-aqua-300 uppercase">
            Navegación
          </p>
          <ul className="mt-5 grid gap-3">
            {NAV_ITEMS.filter(item => item.href !== "/#contacto").map(item => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="text-base text-on-navy hover:text-white hover:underline"
                >
                  {item.label}
                </a>
              </li>
            ))}
            <li>
              <a
                href="/#afiliacion"
                className="text-base text-on-navy hover:text-white hover:underline"
              >
                Afiliación
              </a>
            </li>
          </ul>
        </nav>

        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-aqua-300 uppercase">
            Canales oficiales
          </p>
          <ul className="mt-5 grid gap-3">
            <li>
              <a
                href={ORGANIZACION.instagram.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 text-base text-on-navy hover:text-white hover:underline"
              >
                <AtSign size={18} aria-hidden="true" /> Instagram: @
                {ORGANIZACION.instagram.usuario}
                <span className="sr-only">(se abre en una pestaña nueva)</span>
              </a>
            </li>
            <li>
              <a
                href={`mailto:${ORGANIZACION.email}`}
                className="inline-flex items-center gap-2.5 text-base text-on-navy hover:text-white hover:underline"
              >
                <Mail size={18} aria-hidden="true" /> {ORGANIZACION.email}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-site flex flex-col gap-3 py-6 text-sm text-on-navy-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {ORGANIZACION.sigla}
            {ORGANIZACION.rif && <> · RIF {ORGANIZACION.rif}</>}
          </p>
          <a href="/privacidad" className="hover:text-white hover:underline">
            Aviso de privacidad
          </a>
        </div>
      </div>
    </footer>
  );
}
