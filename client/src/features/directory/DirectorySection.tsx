import {
  ArrowRight,
  BadgeCheck,
  MapPin,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import {
  listDirectoryContract,
  type DirectoryItem,
  type DirectoryQuery,
} from "@shared/directory/contract";
import {
  AREA_LABEL,
  AREAS_DE_INTERES,
  ENTIDADES_FEDERALES,
} from "@shared/membership/catalog";
import { EmptyState } from "@/components/layout/EmptyState";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { ORGANIZACION } from "@/content/site";
import { callApi } from "@/lib/api";
import { useDebounced } from "@/lib/use-debounced";
import { DEFAULT_QUERY, hasFilters, parseQuery, toSearch } from "./url-state";

const DEBOUNCE_MS = 300;

const verificadoFormatter = new Intl.DateTimeFormat("es-VE", {
  month: "long",
  year: "numeric",
});
const mailtoFicha = `mailto:${ORGANIZACION.email}?subject=${encodeURIComponent("Validación de ficha en el directorio")}`;

type Result =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "error" }>
  | Readonly<{
      kind: "ok";
      items: readonly DirectoryItem[];
      total: number;
      totalPages: number;
    }>;

const isArea = (value: string): value is (typeof AREAS_DE_INTERES)[number] =>
  (AREAS_DE_INTERES as readonly string[]).includes(value);
const isEntidad = (
  value: string
): value is (typeof ENTIDADES_FEDERALES)[number] =>
  (ENTIDADES_FEDERALES as readonly string[]).includes(value);

export function DirectorySection() {
  const [query, setQuery] = useState<DirectoryQuery>(DEFAULT_QUERY);
  const [texto, setTexto] = useState("");
  const [result, setResult] = useState<Result>({ kind: "loading" });
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const firstUrlWrite = useRef(true);
  const searchId = useId();
  const areaId = useId();
  const entidadId = useId();
  const debouncedTexto = useDebounced(texto, DEBOUNCE_MS);

  // 1) Tras hidratar, el estado inicial sale de la URL (el HTML prerenderizado usa el valor por defecto).
  useEffect(() => {
    const initial = parseQuery(window.location.search);
    setQuery(initial);
    setTexto(initial.q ?? "");
    setReady(true);
  }, []);

  // 2) El texto debounced pasa a la consulta y reinicia la página.
  useEffect(() => {
    if (!ready) return;
    const next = debouncedTexto.trim();
    setQuery(prev =>
      (prev.q ?? "") === next
        ? prev
        : { ...prev, q: next === "" ? undefined : next, page: 1 }
    );
  }, [debouncedTexto, ready]);

  // 3) La consulta se refleja en la URL (compartible) y se pide a la API; las respuestas viejas se descartan.
  useEffect(() => {
    if (!ready) return;
    const search = toSearch(query);
    if (search !== window.location.search) {
      const url = `${window.location.pathname}${search}${window.location.hash}`;
      if (firstUrlWrite.current) window.history.replaceState(null, "", url);
      else window.history.pushState(null, "", url);
    }
    firstUrlWrite.current = false;

    const controller = new AbortController();
    setResult({ kind: "loading" });
    void callApi(
      listDirectoryContract,
      { query },
      { signal: controller.signal }
    ).then(outcome => {
      if (controller.signal.aborted) return;
      if (outcome.success) {
        setResult({
          kind: "ok",
          items: outcome.value.items,
          total: outcome.value.total,
          totalPages: outcome.value.totalPages,
        });
        return;
      }
      // Sin base de datos configurada la ruta no existe (404/503): se muestra el estado
      // honesto "en proceso de verificación", no un error técnico.
      const notEnabled =
        outcome.error.kind === "API" &&
        (outcome.error.status === 404 || outcome.error.status === 503);
      setResult(
        notEnabled
          ? { kind: "ok", items: [], total: 0, totalPages: 1 }
          : { kind: "error" }
      );
    });
    return () => controller.abort();
  }, [query, ready, retry]);

  // Botón Atrás/Adelante: se vuelve a leer la URL.
  useEffect(() => {
    const onPop = () => {
      const next = parseQuery(window.location.search);
      firstUrlWrite.current = true;
      setQuery(next);
      setTexto(next.q ?? "");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const empty =
    result.kind === "ok" && result.total === 0 && !hasFilters(query);

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
            con cada período de membresía. Por privacidad, el directorio no
            publica correos ni teléfonos.
          </p>
        </div>

        {empty || result.kind === "error" ? (
          <EmptyState
            icon={BadgeCheck}
            title={
              result.kind === "error"
                ? "No pudimos cargar el directorio"
                : "Directorio en proceso de verificación"
            }
            action={
              result.kind === "error" ? (
                <button
                  type="button"
                  className="link-arrow"
                  onClick={() => setRetry(value => value + 1)}
                >
                  Reintentar <ArrowRight size={16} aria-hidden="true" />
                </button>
              ) : (
                <a href={mailtoFicha} className="link-arrow">
                  ¿Eres miembro? Solicita la validación de tu ficha{" "}
                  <ArrowRight size={16} aria-hidden="true" />
                </a>
              )
            }
          >
            {result.kind === "error"
              ? "Revisa tu conexión e inténtalo de nuevo en unos minutos."
              : "Estamos validando la nómina con cada miembro. Solo publicaremos fichas confirmadas, para que pacientes y colegas encuentren información confiable."}
          </EmptyState>
        ) : (
          <div className="card p-5 sm:p-7">
            <div
              role="search"
              className="grid gap-3 sm:grid-cols-[1fr_auto_auto]"
            >
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
                  value={texto}
                  maxLength={60}
                  onChange={event => setTexto(event.target.value)}
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
                value={query.area ?? "TODAS"}
                onChange={event => {
                  const value = event.target.value;
                  setQuery(prev => ({
                    ...prev,
                    area: isArea(value) ? value : undefined,
                    page: 1,
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
                value={query.entidad ?? "TODAS"}
                onChange={event => {
                  const value = event.target.value;
                  setQuery(prev => ({
                    ...prev,
                    entidad: isEntidad(value) ? value : undefined,
                    page: 1,
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
              {result.kind === "loading"
                ? "Buscando…"
                : result.total === 1
                  ? "1 especialista"
                  : `${result.total} especialistas`}
            </p>

            {result.kind === "ok" && (
              <>
                <ul className="mt-3 divide-y divide-line">
                  {result.items.map(ficha => (
                    <li
                      key={ficha.id}
                      className="flex flex-col gap-2 py-5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-lg font-bold text-ink">
                          {ficha.nombre}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft">
                          <MapPin size={15} aria-hidden="true" /> {ficha.ciudad}
                          , {ficha.entidad} ·{" "}
                          {ficha.areas.map(area => AREA_LABEL[area]).join(", ")}
                        </p>
                      </div>
                      <p className="inline-flex items-center gap-1.5 self-start rounded-full bg-success-bg px-3 py-1.5 text-xs font-bold text-success sm:self-center">
                        <BadgeCheck size={14} aria-hidden="true" />
                        {ficha.categoria === "ACTIVO" ? "Activo" : "Asociado"} ·
                        vigente hasta{" "}
                        {verificadoFormatter.format(
                          new Date(`${ficha.verificadoHasta}T12:00:00`)
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
                {result.total === 0 && (
                  <p className="mt-6 text-ink-soft">
                    No encontramos especialistas con esos criterios.
                  </p>
                )}
                {result.totalPages > 1 && (
                  <nav
                    aria-label="Paginación del directorio"
                    className="mt-6 flex items-center gap-4 text-sm"
                  >
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={query.page <= 1}
                      onClick={() =>
                        setQuery(prev => ({ ...prev, page: prev.page - 1 }))
                      }
                    >
                      Anterior
                    </button>
                    <span>
                      Página {query.page} de {result.totalPages}
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={query.page >= result.totalPages}
                      onClick={() =>
                        setQuery(prev => ({ ...prev, page: prev.page + 1 }))
                      }
                    >
                      Siguiente
                    </button>
                  </nav>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
