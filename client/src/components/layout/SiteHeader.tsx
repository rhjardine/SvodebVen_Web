import { Menu, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { CTA_AFILIACION, NAV_ITEMS } from "@/content/navigation";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) toggleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };
    const onResize = () => {
      if (window.matchMedia("(min-width: 1024px)").matches) close(false);
    };
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [open, close]);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white text-ink">
      <div className="container-site flex h-[5.25rem] items-center justify-between gap-6">
        <a
          href="/#inicio"
          aria-label="SVODEB, ir al inicio"
          onClick={() => close(false)}
        >
          <Logo priority className="h-[3.6rem] w-auto sm:h-[4rem]" />
        </a>

        <nav
          aria-label="Principal"
          className="hidden items-center gap-1 lg:flex"
        >
          {NAV_ITEMS.map(item => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full px-3.5 py-2 text-[0.95rem] font-semibold text-ink-soft transition-colors hover:bg-mist hover:text-ink"
            >
              {item.label}
            </a>
          ))}
          <a
            href={CTA_AFILIACION.href}
            className="btn btn-primary ml-3 min-h-11 px-5"
          >
            {CTA_AFILIACION.label}
          </a>
        </nav>

        <button
          ref={toggleRef}
          type="button"
          className="flex size-11 items-center justify-center rounded-xl border border-line text-ink lg:hidden"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          onClick={() => setOpen(value => !value)}
        >
          {open ? (
            <X size={22} aria-hidden="true" />
          ) : (
            <Menu size={22} aria-hidden="true" />
          )}
        </button>
      </div>

      <nav
        id={menuId}
        aria-label="Principal (móvil)"
        hidden={!open}
        className="border-t border-line bg-white lg:hidden"
      >
        <ul className="container-site flex flex-col gap-1 py-4">
          {NAV_ITEMS.map(item => (
            <li key={item.href}>
              <a
                href={item.href}
                onClick={() => close(false)}
                className="flex min-h-12 items-center rounded-xl px-3 text-base font-semibold text-ink-soft hover:bg-mist hover:text-ink"
              >
                {item.label}
              </a>
            </li>
          ))}
          <li className="mt-2">
            <a
              href={CTA_AFILIACION.href}
              onClick={() => close(false)}
              className="btn btn-primary w-full"
            >
              {CTA_AFILIACION.label}
            </a>
          </li>
        </ul>
      </nav>
    </header>
  );
}
