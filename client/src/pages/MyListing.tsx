import { useEffect, useState, type FormEvent } from "react";
import { sessionContract } from "@shared/auth/contract";
import {
  deleteMyListingContract,
  getMyListingContract,
  putMyListingContract,
  type MyListing as Listing,
} from "@shared/directory/contract";
import {
  AREA_LABEL,
  AREAS_DE_INTERES,
  ENTIDADES_FEDERALES,
  type AreaDeInteres,
  type EntidadFederal,
} from "@shared/membership/catalog";
import { PageShell } from "@/components/layout/PageShell";
import { callApi, type ClientError } from "@/lib/api";

type View = "loading" | "anonymous" | "ineligible" | "ready";

const VERIFICACION_TEXT: Readonly<Record<Listing["verificacion"], string>> = {
  SIN_VERIFICAR:
    "Pendiente de verificación por secretaría. Hasta entonces tu ficha no es pública.",
  VIGENTE: "Verificada y vigente.",
  VENCIDA:
    "Tu verificación venció: secretaría debe renovarla para que vuelva a ser pública.",
};

const describe = (error: ClientError): string =>
  error.kind === "API"
    ? error.error.message
    : "No pudimos completar la operación. Revisa tu conexión.";

/** Autogestión de la ficha del directorio: el miembro decide si aparece (consentimiento) y con qué datos. */
export default function MyListing() {
  const [view, setView] = useState<View>("loading");
  const [ficha, setFicha] = useState<Listing | null>(null);
  const [nombre, setNombre] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [entidad, setEntidad] = useState<EntidadFederal>("Distrito Capital");
  const [areas, setAreas] = useState<readonly AreaDeInteres[]>([]);
  const [publicado, setPublicado] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const apply = (next: Listing | null) => {
    setFicha(next);
    if (next) {
      setNombre(next.nombrePublico);
      setCiudad(next.ciudad);
      setEntidad(next.entidad as EntidadFederal);
      setAreas(next.areas);
      setPublicado(next.publicado);
    }
  };

  useEffect(() => {
    document.title = "Mi ficha del directorio · SVODEB";
    void (async () => {
      const session = await callApi(sessionContract, {});
      if (!session.success || !session.value.member)
        return setView("anonymous");
      const mine = await callApi(getMyListingContract, {});
      if (!mine.success) {
        setMessage(describe(mine.error));
        return setView("ready");
      }
      apply(mine.value.ficha);
      setView(mine.value.elegible ? "ready" : "ineligible");
    })();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const result = await callApi(putMyListingContract, {
      body: {
        nombrePublico: nombre,
        ciudad,
        entidad,
        areas: [...areas],
        publicado,
      },
    });
    setBusy(false);
    if (!result.success) {
      return setMessage(
        result.error.kind === "INVALID_INPUT"
          ? "Revisa los campos del formulario."
          : describe(result.error)
      );
    }
    apply(result.value.ficha);
    setMessage("Cambios guardados.");
  }

  async function remove() {
    setBusy(true);
    const result = await callApi(deleteMyListingContract, {});
    setBusy(false);
    if (!result.success) return setMessage(describe(result.error));
    apply(null);
    setNombre("");
    setCiudad("");
    setAreas([]);
    setPublicado(false);
    setMessage("Tu ficha fue eliminada del directorio.");
  }

  return (
    <PageShell>
      <section className="container-site max-w-2xl py-20 sm:py-24">
        <h1 className="display text-4xl">Mi ficha del directorio</h1>
        <div className="mt-8" aria-live="polite">
          {view === "loading" && <p>Cargando…</p>}
          {view === "anonymous" && (
            <p className="text-ink-soft">
              <a
                className="font-semibold text-royal-600 underline"
                href="/acceso"
              >
                Inicia sesión
              </a>{" "}
              para gestionar tu ficha.
            </p>
          )}
          {view === "ineligible" && (
            <p className="text-ink-soft">
              Tu categoría o el estado de tu membresía no permiten figurar en el
              directorio de especialistas.
            </p>
          )}
          {view === "ready" && (
            <form onSubmit={event => void save(event)} className="grid gap-5">
              {message && <p className="field-hint">{message}</p>}
              {ficha && (
                <p className="text-sm text-ink-soft">
                  {VERIFICACION_TEXT[ficha.verificacion]}
                </p>
              )}
              <div>
                <label htmlFor="ml-nombre" className="field-label">
                  Nombre público
                </label>
                <input
                  id="ml-nombre"
                  className="field-input"
                  required
                  minLength={2}
                  maxLength={120}
                  value={nombre}
                  onChange={event => setNombre(event.target.value)}
                />
                <p className="field-hint mt-1">
                  Debe ser tu nombre real. Si cambias nombre, ciudad, estado o
                  áreas, secretaría deberá verificar de nuevo tu ficha.
                </p>
              </div>
              <div>
                <label htmlFor="ml-ciudad" className="field-label">
                  Ciudad
                </label>
                <input
                  id="ml-ciudad"
                  className="field-input"
                  required
                  minLength={2}
                  maxLength={80}
                  value={ciudad}
                  onChange={event => setCiudad(event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="ml-entidad" className="field-label">
                  Estado
                </label>
                <select
                  id="ml-entidad"
                  className="field-input"
                  value={entidad}
                  onChange={event =>
                    setEntidad(event.target.value as EntidadFederal)
                  }
                >
                  {ENTIDADES_FEDERALES.map(value => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
              <fieldset>
                <legend className="field-label">Áreas</legend>
                <div className="mt-2 grid gap-2">
                  {AREAS_DE_INTERES.map(area => (
                    <label key={area} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={areas.includes(area)}
                        onChange={event =>
                          setAreas(prev =>
                            event.target.checked
                              ? [...prev, area]
                              : prev.filter(a => a !== area)
                          )
                        }
                      />
                      {AREA_LABEL[area]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1.5"
                  checked={publicado}
                  onChange={event => setPublicado(event.target.checked)}
                />
                <span>
                  Autorizo que mi nombre, ciudad, estado y áreas aparezcan en el
                  directorio público de SVODEB. No se publican correo ni
                  teléfono. Puedo retirar esta autorización cuando quiera.
                </span>
              </label>
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={busy || areas.length === 0}
                >
                  Guardar
                </button>
                {ficha && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => void remove()}
                  >
                    Eliminar mi ficha
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </section>
    </PageShell>
  );
}
