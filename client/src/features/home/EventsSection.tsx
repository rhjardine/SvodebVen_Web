import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { EVENTOS, ORGANIZACION } from "@/content/site";
import type { EventoSociedad } from "@/content/types";
import { cn } from "@/lib/utils";

const fechaFormatter = new Intl.DateTimeFormat("es-VE", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function EventCard({ evento }: Readonly<{ evento: EventoSociedad }>) {
  const realizado = evento.estado === "REALIZADO";
  return (
    <article
      className="card flex h-full flex-col p-7"
      aria-labelledby={`evento-${evento.id}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold tracking-wide text-royal-600 uppercase">
          {evento.tipo}
        </span>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-bold",
            realizado ? "bg-mist text-ink-soft" : "bg-success-bg text-success"
          )}
        >
          {realizado ? "Realizado" : "Próximo"}
        </span>
      </div>
      <h3 id={`evento-${evento.id}`} className="display mt-6 text-3xl">
        {evento.titulo}
      </h3>
      <p className="mt-3 flex-1 text-base leading-7 text-ink-soft">
        {evento.resumen}
      </p>
      <dl className="mt-6 grid gap-2 text-sm text-ink-soft">
        <div className="flex items-center gap-2">
          <dt>
            <CalendarDays size={16} aria-label="Fecha" />
          </dt>
          <dd>
            {evento.fecha
              ? fechaFormatter.format(new Date(`${evento.fecha}T12:00:00`))
              : "Fecha por confirmar"}
          </dd>
        </div>
        {(evento.sede || evento.modalidad) && (
          <div className="flex items-center gap-2">
            <dt>
              <MapPin size={16} aria-label="Lugar" />
            </dt>
            <dd>
              {[evento.sede, evento.modalidad].filter(Boolean).join(" · ")}
            </dd>
          </div>
        )}
      </dl>
    </article>
  );
}

export function EventsSection() {
  const ordenados = [...EVENTOS].sort((a, b) =>
    a.estado === b.estado ? 0 : a.estado === "PROXIMO" ? -1 : 1
  );
  return (
    <section
      id="eventos"
      aria-labelledby="eventos-title"
      className="border-t border-line bg-white py-24 sm:py-28"
    >
      <div className="container-site">
        <SectionHeading
          id="eventos-title"
          eyebrow="Eventos y educación continua"
          title="Aprender juntos cambia la práctica."
          lead="Jornadas, cursos y encuentros de la Sociedad. Cada actividad se publica con fecha, sede y modalidad confirmadas."
        />
        <ul className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {ordenados.map(evento => (
            <li key={evento.id}>
              <EventCard evento={evento} />
            </li>
          ))}
          <li>
            <div className="on-navy flex h-full flex-col justify-between rounded-(--radius-card) bg-navy-900 p-7 text-white">
              <div>
                <p className="text-sm font-bold tracking-wide text-aqua-300 uppercase">
                  Agenda
                </p>
                <h3 className="display mt-6 text-3xl">Próximas actividades</h3>
                <p className="mt-3 text-base leading-7 text-on-navy">
                  Anunciamos primero cada convocatoria en nuestra cuenta oficial
                  de Instagram.
                </p>
              </div>
              <a
                href={ORGANIZACION.instagram.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary mt-8 self-start"
              >
                Seguir a @{ORGANIZACION.instagram.usuario}{" "}
                <ArrowUpRight size={18} aria-hidden="true" />
                <span className="sr-only">(se abre en una pestaña nueva)</span>
              </a>
            </div>
          </li>
        </ul>
      </div>
    </section>
  );
}
