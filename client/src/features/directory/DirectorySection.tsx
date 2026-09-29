import {
  ArrowRight,
  BadgeCheck,
  MapPin,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useDeferredValue, useId, useMemo, useState } from "react";
import { EmptyState } from "@/components/layout/EmptyState";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { DIRECTORIO, ORGANIZACION } from "@/content/site";
import {
  AREA_LABEL,
  AREAS_DE_INTERES,
  ENTIDADES_FEDERALES,
  type AreaDeInteres,
  type EntidadFederal,
} from "@shared/membership/catalog";
import {
  EMPTY_FILTER,
  filterDirectory,
  isVigente,
  type DirectoryFilter,
} from "./filter";

const verificadoFormatter = new Intl.DateTimeFormat("es-VE", {
  month: "long",
  year: "numeric",
});
const mailtoFicha = `mailto:${ORGANIZACION.email}?subject=${encodeURIComponent("Validación de ficha en el directorio")}`;

function isArea(value: string): value is AreaDeInteres {
  return (AREAS_DE_INTERES as readonly string[]).includes(value);
}
function isEntidad(value: string): value is EntidadFederal {
  return (ENTIDADES_FEDERALES as readonly string[]).includes(value);
}

export function DirectorySection() {
  const hoy = useMemo(() => new Date(), []);
  const publicables = useMemo(
    () => DIRECTORIO.filter(ficha => isVigente(ficha, hoy)),
    [hoy]
  );

  return (
    <section
      id="especialistas"
      aria-labelledby="especialistas-title"
      className="py-24 sm:py-28"
    >
      <div className="container-site grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <SectionHeading
            id="especialistas-title"
            eyebrow="Directorio"
            title="Especialistas verificados."
            lead="Cada ficha corresponde a un miembro con membresía vigente y autorización expresa para aparecer en el directorio."
          />
          <p className="mt-8 flex items-start gap-3 text-base leading-7 text-ink-soft">
            <ShieldCheck
              size={22}
              className="mt-0.5 shrink-0 text-royal-600"
              aria-hidden="true"
            />
            La verificación la realiza la secretaría de la Sociedad y se renueva
            con cada período de membresía.
          </p>
        </div>

        {publicables.length === 0 ? (
          <EmptyState
            icon={BadgeCheck}
            title="Directorio en proceso de verificación"
            action={
              <a href={mailtoFicha} className="link-arrow">
                ¿Eres miembro? Solicita la validación de tu ficha{" "}
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            }
          >
            Estamos validando la nómina con cada miembro. Solo publicaremos
            fichas confirmadas, para que pacientes y colegas encuentren
            información confiable.
          </EmptyState>
        ) : (
          <DirectoryBrowser hoy={hoy} />
        )}
      </div>
    </section>
  );
}

function DirectoryBrowser({ hoy }: Readonly<{ hoy: Date }>) {
  const [filtro, setFiltro] = useState<DirectoryFilter>(EMPTY_FILTER);
  const texto = useDeferredValue(filtro.texto);
  const resultados = useMemo(
    () => filterDirectory(DIRECTORIO, { ...filtro, texto }, hoy),
    [filtro, texto, hoy]
  );
  const searchId = useId();
  const areaId = useId();
  const entidadId = useId();

  return (
    <div className="card p-5 sm:p-7">
      <div role="search" className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <label htmlFor={searchId} className="sr-only">
            Buscar por nombre o ciudad
          </label>
          <Search
            size={18}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate"
            aria-hidden="true"
          />
          <input
            id={searchId}
            type="search"
            value={filtro.texto}
            onChange={event =>
              setFiltro(prev => ({ ...prev, texto: event.target.value }))
            }
            placeholder="Nombre o ciudad"
            className="field-input pl-11"
            autoComplete="off"
          />
        </div>
        <label htmlFor={areaId} className="sr-only">
          Área
        </label>
        <select
          id={areaId}
          value={filtro.area}
          onChange={event => {
            const value = event.target.value;
            setFiltro(prev => ({
              ...prev,
              area: isArea(value) ? value : "TODAS",
            }));
          }}
          className="field-input sm:w-48"
        >
          <option value="TODAS">Todas las áreas</option>
          {AREAS_DE_INTERES.map(area => (
            <option key={area} value={area}>
              {AREA_LABEL[area]}
            </option>
          ))}
        </select>
        <label htmlFor={entidadId} className="sr-only">
          Estado
        </label>
        <select
          id={entidadId}
          value={filtro.entidad}
          onChange={event => {
            const value = event.target.value;
            setFiltro(prev => ({
              ...prev,
              entidad: isEntidad(value) ? value : "TODAS",
            }));
          }}
          className="field-input sm:w-48"
        >
          <option value="TODAS">Todo el país</option>
          {ENTIDADES_FEDERALES.map(entidad => (
            <option key={entidad} value={entidad}>
              {entidad}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-5 text-sm text-slate" aria-live="polite">
        {resultados.length === 1
          ? "1 especialista"
          : `${resultados.length} especialistas`}
      </p>

      <ul className="mt-3 divide-y divide-line">
        {resultados.map(ficha => (
          <li
            key={ficha.id}
            className="flex flex-col gap-2 py-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-lg font-bold text-ink">{ficha.nombre}</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft">
                <MapPin size={15} aria-hidden="true" /> {ficha.ciudad},{" "}
                {ficha.entidad} ·{" "}
                {ficha.areas.map(area => AREA_LABEL[area]).join(", ")}
              </p>
            </div>
            <p className="inline-flex items-center gap-1.5 self-start rounded-full bg-success-bg px-3 py-1.5 text-xs font-bold text-success sm:self-center">
              <BadgeCheck size={14} aria-hidden="true" />
              {ficha.categoria} · vigente hasta{" "}
              {verificadoFormatter.format(
                new Date(`${ficha.verificadoHasta}T12:00:00`)
              )}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
