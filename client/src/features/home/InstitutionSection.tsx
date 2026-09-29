import { ArrowRight, BookText, Landmark } from "lucide-react";
import { EmptyState } from "@/components/layout/EmptyState";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { HITOS, JUNTA_DIRECTIVA, ORGANIZACION } from "@/content/site";

const mailtoEstatutos = `mailto:${ORGANIZACION.email}?subject=${encodeURIComponent("Solicitud de copia de los Estatutos")}`;

export function InstitutionSection() {
  return (
    <section
      id="institucion"
      aria-labelledby="institucion-title"
      className="border-y border-line bg-white py-24 sm:py-28"
    >
      <div className="container-site grid gap-14 lg:grid-cols-[1fr_1fr] lg:gap-20">
        <div>
          <SectionHeading
            id="institucion-title"
            eyebrow="Institución"
            title="Un legado que sigue tomando forma."
            lead="La Sociedad reúne a profesionales y estudiantes alrededor de una visión compartida: promover la actualización científica, el intercambio honesto y una práctica clínica centrada en la persona."
          />

          {HITOS.length > 0 && (
            <ol className="mt-10 border-l border-aqua-400 pl-7">
              {HITOS.map(hito => (
                <li
                  key={`${hito.anio}-${hito.titulo}`}
                  className="relative pb-8 last:pb-0"
                >
                  <span
                    aria-hidden="true"
                    className="absolute top-1.5 -left-[2.03rem] size-2.5 rounded-full bg-royal-600 ring-4 ring-aqua-100"
                  />
                  <p className="text-sm font-bold text-royal-600">
                    {hito.anio}
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-ink">
                    {hito.titulo}
                  </h3>
                  <p className="mt-1 text-base leading-7 text-ink-soft">
                    {hito.descripcion}
                  </p>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-10 flex flex-col gap-5 rounded-(--radius-card) bg-mist p-6 sm:flex-row sm:items-start">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-navy-900 text-aqua-300">
              <BookText size={22} aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-lg font-bold text-ink">
                Estatutos de la Sociedad
              </h3>
              <p className="mt-2 text-base leading-7 text-ink-soft">
                Nuestros Estatutos establecen las categorías de membresía, así
                como los derechos y deberes de los miembros. Puedes solicitar
                una copia a la secretaría.
              </p>
              <a href={mailtoEstatutos} className="link-arrow mt-4">
                Solicitar copia <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>

        <div id="directiva" aria-labelledby="directiva-title" role="region">
          <p className="eyebrow">Junta directiva</p>
          <h3
            id="directiva-title"
            className="display mt-5 text-[2rem] sm:text-[2.5rem]"
          >
            Las personas detrás del propósito.
          </h3>
          {JUNTA_DIRECTIVA && JUNTA_DIRECTIVA.miembros.length > 0 ? (
            <>
              <p className="mt-4 text-base text-ink-soft">
                Período {JUNTA_DIRECTIVA.periodo}
              </p>
              <ul className="mt-8 grid gap-3">
                {JUNTA_DIRECTIVA.miembros.map(miembro => (
                  <li
                    key={`${miembro.cargo}-${miembro.nombre}`}
                    className="card flex items-center justify-between gap-4 p-5"
                  >
                    <span className="text-lg font-bold text-ink">
                      {miembro.nombre}
                    </span>
                    <span className="text-sm font-bold tracking-wide text-royal-600 uppercase">
                      {miembro.cargo}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyState
              icon={Landmark}
              title="Nómina oficial en actualización"
              className="mt-8"
            >
              Publicaremos aquí la Junta Directiva vigente, con cargos y período
              de gestión, una vez que sea validada por la Sociedad.
            </EmptyState>
          )}
        </div>
      </div>
    </section>
  );
}
