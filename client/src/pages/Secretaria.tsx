import { useCallback, useEffect, useState } from "react";
import { sessionContract } from "@shared/auth/contract";
import {
  getApplicationContract,
  listApplicationsContract,
  transitionApplicationContract,
  type ApplicationDetail,
  type ApplicationSummary,
} from "@shared/membership/admin-contract";
import { ESTADOS, type Estado, type Evento } from "@shared/membership/workflow";
import { PageShell } from "@/components/layout/PageShell";
import { callApi, type ClientError } from "@/lib/api";

const ESTADO_LABEL: Readonly<Record<Estado, string>> = {
  RECIBIDA: "Recibida",
  EN_REVISION: "En revisión",
  REQUIERE_INFORMACION: "Requiere información",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
};

const EVENTO_LABEL: Readonly<Record<Evento, string>> = {
  INICIAR_REVISION: "Iniciar revisión",
  SOLICITAR_INFORMACION: "Solicitar información",
  REANUDAR_REVISION: "Reanudar revisión",
  APROBAR: "Aprobar y crear miembro",
  RECHAZAR: "Rechazar",
};

type Access = "loading" | "denied" | "granted";

const PAGE_SIZE = 20;

const asText = (value: unknown): string =>
  Array.isArray(value)
    ? value.map(item => asText(item)).join(", ")
    : typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ? String(value)
      : "";

function describe(error: ClientError): string {
  if (error.kind === "API") return error.error.message;
  return "No pudimos completar la operación. Revisa tu conexión.";
}

/** Bandeja mínima de secretaría. La autorización real la imponen el servidor y la base (RLS). */
export default function Secretaria() {
  const [access, setAccess] = useState<Access>("loading");
  const [estado, setEstado] = useState<Estado | "">("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<readonly ApplicationSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [nota, setNota] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Secretaría · SVODEB";
    void (async () => {
      const session = await callApi(sessionContract, {});
      const role = session.success ? session.value.member?.role : undefined;
      setAccess(
        role === "secretaria" || role === "admin" ? "granted" : "denied"
      );
    })();
  }, []);

  const load = useCallback(async () => {
    const result = await callApi(listApplicationsContract, {
      query: { ...(estado ? { estado } : {}), page, pageSize: PAGE_SIZE },
    });
    if (result.success) {
      setItems(result.value.items);
      setTotal(result.value.total);
      setMessage(null);
    } else {
      setMessage(describe(result.error));
    }
  }, [estado, page]);

  useEffect(() => {
    if (access === "granted") void load();
  }, [access, load]);

  async function open(id: string) {
    const result = await callApi(getApplicationContract, { params: { id } });
    if (result.success) {
      setDetail(result.value);
      setNota("");
      setMessage(null);
    } else setMessage(describe(result.error));
  }

  async function act(evento: Evento) {
    if (!detail) return;
    setBusy(true);
    const result = await callApi(transitionApplicationContract, {
      params: { id: detail.id },
      body: { evento, ...(nota.trim() ? { nota: nota.trim() } : {}) },
    });
    setBusy(false);
    if (!result.success) return setMessage(describe(result.error));
    await Promise.all([open(detail.id), load()]);
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PageShell>
      <section className="container-site py-16 sm:py-20">
        <h1 className="display text-4xl">Expedientes de afiliación</h1>

        {access === "loading" && <p className="mt-6">Cargando…</p>}
        {access === "denied" && (
          <p className="mt-6 text-ink-soft">
            Esta sección es solo para secretaría.{" "}
            <a
              className="font-semibold text-royal-600 underline"
              href="/acceso"
            >
              Inicia sesión
            </a>
            .
          </p>
        )}

        {access === "granted" && (
          <div
            className="mt-8 grid gap-8 lg:grid-cols-[1fr_1fr]"
            aria-live="polite"
          >
            {message && <p className="field-error lg:col-span-2">{message}</p>}
            <div>
              <label htmlFor="filtro-estado" className="field-label">
                Estado
              </label>
              <select
                id="filtro-estado"
                className="field-input mt-2 max-w-xs"
                value={estado}
                onChange={event => {
                  setEstado(event.target.value as Estado | "");
                  setPage(1);
                }}
              >
                <option value="">Todos</option>
                {ESTADOS.map(value => (
                  <option key={value} value={value}>
                    {ESTADO_LABEL[value]}
                  </option>
                ))}
              </select>
              <ul className="mt-4 divide-y divide-ink/10 border-y border-ink/10">
                {items.map(item => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="w-full py-3 text-left hover:bg-ink/5"
                      onClick={() => void open(item.id)}
                    >
                      <span className="font-semibold">
                        {item.nombres} {item.apellidos}
                      </span>
                      <span className="block text-sm text-ink-soft">
                        {item.referencia} · {ESTADO_LABEL[item.estado]} ·{" "}
                        {new Date(item.recibidaEn).toLocaleDateString("es-VE")}
                      </span>
                    </button>
                  </li>
                ))}
                {items.length === 0 && (
                  <li className="py-6 text-ink-soft">Sin expedientes.</li>
                )}
              </ul>
              <div className="mt-4 flex items-center gap-4 text-sm">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Anterior
                </button>
                <span>
                  Página {page} de {pages}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={page >= pages}
                  onClick={() => setPage(page + 1)}
                >
                  Siguiente
                </button>
              </div>
            </div>

            {detail && (
              <article>
                <h2 className="text-2xl font-bold">
                  {detail.nombres} {detail.apellidos}
                </h2>
                <p className="text-ink-soft">
                  {detail.referencia} · {ESTADO_LABEL[detail.estado]}
                </p>
                <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  {Object.entries(detail.datos).map(([key, value]) => (
                    <div key={key} className="contents">
                      <dt className="font-semibold">{key}</dt>
                      <dd className="break-words">{asText(value)}</dd>
                    </div>
                  ))}
                </dl>
                <h3 className="mt-6 font-bold">Bitácora</h3>
                <ol className="mt-2 text-sm text-ink-soft">
                  {detail.eventos.map(event => (
                    <li key={`${event.ocurridoEn}-${event.hacia}`}>
                      {new Date(event.ocurridoEn).toLocaleString("es-VE")} →{" "}
                      {ESTADO_LABEL[event.hacia]}
                      {event.nota ? ` · ${event.nota}` : ""}
                    </li>
                  ))}
                </ol>
                {detail.accionesPermitidas.length > 0 && (
                  <div className="mt-6 grid gap-3">
                    <label htmlFor="nota" className="field-label">
                      Nota (opcional)
                    </label>
                    <textarea
                      id="nota"
                      className="field-input"
                      maxLength={500}
                      rows={3}
                      value={nota}
                      onChange={event => setNota(event.target.value)}
                    />
                    <div className="flex flex-wrap gap-3">
                      {detail.accionesPermitidas.map(evento => (
                        <button
                          key={evento}
                          type="button"
                          className={
                            evento === "RECHAZAR"
                              ? "btn btn-secondary"
                              : "btn btn-primary"
                          }
                          disabled={busy}
                          onClick={() => void act(evento)}
                        >
                          {EVENTO_LABEL[evento]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            )}
          </div>
        )}
      </section>
    </PageShell>
  );
}
