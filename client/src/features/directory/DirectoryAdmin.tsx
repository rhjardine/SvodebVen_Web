import { useCallback, useEffect, useState } from "react";
import {
  listAdminDirectoryContract,
  unpublishListingContract,
  verifyListingContract,
  type AdminListing,
} from "@shared/directory/contract";
import { AREA_LABEL } from "@shared/membership/catalog";
import { callApi, type ClientError } from "@/lib/api";

const describe = (error: ClientError): string =>
  error.kind === "API"
    ? error.error.message
    : "No pudimos completar la operación. Revisa tu conexión.";

/** Fecha de hoy + 365 días (AAAA-MM-DD) como sugerencia de vigencia; el servidor la valida igualmente. */
const suggestedExpiry = (): string =>
  new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);

/** Verificación de fichas del directorio por secretaría/admin. La autorización real está en el servidor y RLS. */
export function DirectoryAdmin() {
  const [pendientes, setPendientes] = useState(true);
  const [items, setItems] = useState<readonly AdminListing[]>([]);
  const [dates, setDates] = useState<Readonly<Record<string, string>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const result = await callApi(listAdminDirectoryContract, {
      query: {
        pendientes: pendientes ? "true" : "false",
        page: 1,
        pageSize: 50,
      },
    });
    if (result.success) {
      setItems(result.value.items);
      setMessage(null);
    } else setMessage(describe(result.error));
  }, [pendientes]);

  useEffect(() => {
    void load();
  }, [load]);

  async function verify(item: AdminListing) {
    setBusy(true);
    const result = await callApi(verifyListingContract, {
      params: { id: item.id },
      body: { verificadoHasta: dates[item.id] ?? suggestedExpiry() },
    });
    setBusy(false);
    if (!result.success) return setMessage(describe(result.error));
    await load();
  }

  async function unpublish(item: AdminListing) {
    setBusy(true);
    const result = await callApi(unpublishListingContract, {
      params: { id: item.id },
      body: {},
    });
    setBusy(false);
    if (!result.success) return setMessage(describe(result.error));
    await load();
  }

  return (
    <section className="mt-16" aria-labelledby="dir-admin-title">
      <h2 id="dir-admin-title" className="display text-3xl">
        Directorio de especialistas
      </h2>
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={pendientes}
          onChange={event => setPendientes(event.target.checked)}
        />
        Solo pendientes de verificar o vencidas
      </label>
      {message && <p className="field-error mt-4">{message}</p>}
      <ul className="mt-4 divide-y divide-ink/10 border-y border-ink/10">
        {items.map(item => (
          <li key={item.id} className="grid gap-2 py-4">
            <p className="font-semibold">
              {item.nombre} · {item.categoria}
            </p>
            <p className="text-sm text-ink-soft">
              {item.email} · {item.ciudad}, {item.entidad} ·{" "}
              {item.areas.map(area => AREA_LABEL[area]).join(", ")}
            </p>
            <p className="text-sm">
              {item.publicado ? "Publicada" : "No publicada"} ·{" "}
              {item.verificadoHasta
                ? `verificada hasta ${item.verificadoHasta}`
                : "sin verificar"}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="sr-only" htmlFor={`vig-${item.id}`}>
                Vigencia
              </label>
              <input
                id={`vig-${item.id}`}
                type="date"
                className="field-input max-w-44"
                value={dates[item.id] ?? suggestedExpiry()}
                onChange={event =>
                  setDates(prev => ({ ...prev, [item.id]: event.target.value }))
                }
              />
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void verify(item)}
              >
                Verificar
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => void unpublish(item)}
              >
                Despublicar
              </button>
            </div>
          </li>
        ))}
        {items.length === 0 && (
          <li className="py-6 text-ink-soft">Sin fichas.</li>
        )}
      </ul>
    </section>
  );
}
