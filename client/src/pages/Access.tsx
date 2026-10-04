import { useEffect, useState, type FormEvent } from "react";
import {
  requestLoginLinkContract,
  redeemLoginLinkContract,
} from "@shared/auth/contract";
import { PageShell } from "@/components/layout/PageShell";
import { callApi } from "@/lib/api";

type View =
  | Readonly<{ kind: "request" }>
  | Readonly<{ kind: "sent" }>
  | Readonly<{ kind: "redeem"; token: string }>
  | Readonly<{ kind: "done"; nombres: string }>;

const TOKEN_IN_HASH = /^#token=([A-Za-z0-9_-]{43})$/;

/**
 * Acceso por enlace mágico. El token llega en el FRAGMENTO de la URL (no viaja al servidor ni
 * queda en logs), se retira de la barra de direcciones al leerlo y se canjea con un POST
 * desde un botón: abrir el enlace por sí solo (p. ej. un escáner de correo) no lo consume.
 */
export default function Access() {
  const [view, setView] = useState<View>({ kind: "request" });
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Acceso de miembros · SVODEB";
    const match = TOKEN_IN_HASH.exec(window.location.hash);
    if (match?.[1]) {
      window.history.replaceState(null, "", window.location.pathname);
      setView({ kind: "redeem", token: match[1] });
    }
  }, []);

  async function requestLink(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = await callApi(requestLoginLinkContract, { body: { email } });
    setBusy(false);
    if (result.success) return setView({ kind: "sent" });
    setMessage(
      result.error.kind === "INVALID_INPUT"
        ? "Escribe un correo válido."
        : result.error.kind === "API" &&
            result.error.error.code === "RATE_LIMITED"
          ? "Demasiados intentos. Espera unos minutos."
          : "No pudimos procesar la solicitud. Inténtalo de nuevo."
    );
  }

  async function redeem(token: string) {
    setBusy(true);
    setMessage(null);
    const result = await callApi(redeemLoginLinkContract, { body: { token } });
    setBusy(false);
    if (result.success)
      return setView({ kind: "done", nombres: result.value.member.nombres });
    setView({ kind: "request" });
    setMessage("El enlace no es válido o ya caducó. Solicita uno nuevo.");
  }

  return (
    <PageShell>
      <section className="container-site max-w-xl py-20 sm:py-24">
        <h1 className="display text-4xl">Acceso de miembros</h1>
        <div className="mt-8" aria-live="polite">
          {message && <p className="field-error mb-4">{message}</p>}

          {view.kind === "request" && (
            <form
              onSubmit={event => void requestLink(event)}
              className="grid gap-4"
            >
              <p className="text-ink-soft">
                Te enviaremos por correo un enlace de un solo uso. No necesitas
                contraseña.
              </p>
              <label htmlFor="acceso-email" className="field-label">
                Correo electrónico
              </label>
              <input
                id="acceso-email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                className="field-input"
                value={email}
                onChange={event => setEmail(event.target.value)}
              />
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? "Enviando…" : "Enviar enlace de acceso"}
              </button>
            </form>
          )}

          {view.kind === "sent" && (
            <p className="text-lg text-ink-soft">
              Si ese correo pertenece a un miembro, recibirás un enlace en unos
              minutos. Caduca a los 15 minutos y solo funciona una vez.
            </p>
          )}

          {view.kind === "redeem" && (
            <div className="grid gap-4">
              <p className="text-ink-soft">
                Confirma para iniciar sesión en este dispositivo.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void redeem(view.token)}
              >
                {busy ? "Verificando…" : "Entrar a mi cuenta"}
              </button>
            </div>
          )}

          {view.kind === "done" && (
            <p className="text-lg text-ink-soft">
              Bienvenido(a), {view.nombres}. Sesión iniciada.
            </p>
          )}
        </div>
      </section>
    </PageShell>
  );
}
