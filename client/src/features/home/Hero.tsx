import { ArrowRight, BadgeCheck } from "lucide-react";
import { ToothLineArt } from "@/components/brand/ToothLineArt";
import { DISCIPLINAS, ORGANIZACION } from "@/content/site";

export function Hero() {
  return (
    <section
      id="inicio"
      aria-labelledby="hero-title"
      className="on-navy relative isolate overflow-hidden bg-navy-900 text-white"
    >
      {/* Fondo 100 % CSS/SVG: el LCP es el titular, no una imagen pesada. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(60rem_40rem_at_78%_35%,rgba(46,90,168,0.55),transparent_65%),linear-gradient(180deg,var(--color-navy-950),var(--color-navy-900))]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-[-12rem] -z-10 hidden size-[44rem] -translate-y-1/2 rounded-full border border-aqua-300/10 md:block lg:right-[-6rem]"
      />
      <ToothLineArt className="pointer-events-none absolute top-1/2 right-[-3rem] -z-10 hidden w-[30rem] -translate-y-[46%] opacity-95 md:block lg:right-[4%] lg:w-[34rem]" />

      <div className="container-site py-20 sm:py-24 lg:py-32">
        <div className="max-w-2xl lg:max-w-3xl">
          <p className="animate-rise inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3.5 py-2 text-xs font-bold tracking-[0.14em] text-aqua-300 uppercase">
            <BadgeCheck size={15} aria-hidden="true" /> Sociedad afiliada a{" "}
            {ORGANIZACION.afiliacion.sigla}
          </p>
          <h1
            id="hero-title"
            className="display display-xl animate-rise mt-7 text-[3.3rem] [animation-delay:80ms] sm:text-[4.8rem] lg:text-[6rem]"
          >
            Ciencia que se convierte en{" "}
            <em className="text-aqua-300">confianza.</em>
          </h1>
          <p className="animate-rise mt-7 max-w-xl text-lg leading-8 text-on-navy [animation-delay:160ms] sm:text-xl sm:leading-9">
            La comunidad científica venezolana que impulsa la excelencia en
            operatoria dental, estética y biomateriales.
          </p>
          <div className="animate-rise mt-9 flex flex-col gap-3 [animation-delay:240ms] sm:flex-row">
            <a href="#afiliacion" className="btn btn-primary">
              Afíliate a la sociedad <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a href="#sociedad" className="btn btn-secondary">
              Conoce la SVODEB
            </a>
          </div>
          <ul
            className="mt-14 flex flex-wrap gap-x-7 gap-y-3 text-sm font-semibold text-on-navy"
            aria-label="Áreas de la sociedad"
          >
            {DISCIPLINAS.map(disciplina => (
              <li key={disciplina.id} className="flex items-center gap-2.5">
                <span
                  className="size-1.5 rounded-full bg-aqua-400"
                  aria-hidden="true"
                />
                {disciplina.titulo}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="brand-stripes" aria-hidden="true" />
    </section>
  );
}
