// Debe ser el primer import: configura zod antes de construir los esquemas.
import "@/lib/zod-csp";
import { AlertCircle, CheckCircle2, Loader2, Mail, Send } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { ORGANIZACION } from "@/content/site";
import { cn } from "@/lib/utils";
import { HONEYPOT_FIELD } from "@shared/membership/api";
import {
  AREA_LABEL,
  AREAS_DE_INTERES,
  CATEGORIA_LABEL_CORTA,
  CATEGORIAS_POSTULABLES,
  ENTIDADES_FEDERALES,
  type CategoriaPostulable,
} from "@shared/membership/catalog";
import type { FieldErrors } from "@shared/membership/schema";
import { submitMembershipApplication } from "./api-client";
import {
  buildMailtoBody,
  FIELD_ORDER,
  formDataToInput,
  isCategoria,
  validateForm,
  type FieldName,
} from "./form-mapping";

type Status =
  | Readonly<{ kind: "idle" }>
  | Readonly<{ kind: "submitting" }>
  | Readonly<{ kind: "success"; referencia: string; email: string }>
  | Readonly<{ kind: "unavailable"; mailto: string }>
  | Readonly<{ kind: "error"; message: string }>;

const MOTIVACION_MAX = 1000;
const SEMESTRES = Array.from({ length: 12 }, (_, index) => index + 1);

type ControlProps = Readonly<{
  id: string;
  name: FieldName;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
}>;

function Field({
  name,
  label,
  error,
  hint,
  optional = false,
  className,
  children,
}: Readonly<{
  name: FieldName;
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  className?: string;
  children: (props: ControlProps) => ReactNode;
}>) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cn("grid content-start gap-2", className)}>
      <label htmlFor={id} className="field-label">
        {label}{" "}
        {optional && <span className="font-normal text-slate">(opcional)</span>}
      </label>
      {children({
        id,
        name,
        "aria-invalid": Boolean(error),
        "aria-describedby": describedBy || undefined,
      })}
      {hint && !error && (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

function FieldsetError({
  id,
  error,
}: Readonly<{ id: string; error?: string }>) {
  return error ? (
    <p id={id} className="field-error mt-2">
      {error}
    </p>
  ) : null;
}

export function MembershipForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [categoria, setCategoria] = useState<CategoriaPostulable | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [motivacionLength, setMotivacionLength] = useState(0);
  const [focusToken, setFocusToken] = useState(0);
  const baseId = useId();

  // Tras un intento fallido, lleva el foco al primer campo inválido (en orden visual).
  useEffect(() => {
    if (focusToken === 0) return;
    const first = FIELD_ORDER.find(name => errors[name]);
    if (!first) return;
    formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  }, [focusToken, errors]);

  useEffect(() => {
    if (status.kind === "success" || status.kind === "unavailable")
      resultRef.current?.focus();
  }, [status.kind]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status.kind === "submitting") return;

    const { input, honeypot } = formDataToInput(
      new FormData(event.currentTarget)
    );
    const parsed = validateForm(input);
    if (!parsed.ok) {
      setErrors(parsed.error);
      setFocusToken(token => token + 1);
      return;
    }

    setErrors({});
    setStatus({ kind: "submitting" });
    const outcome = await submitMembershipApplication(parsed.value, honeypot);

    switch (outcome.kind) {
      case "success":
        setStatus({
          kind: "success",
          referencia: outcome.referencia,
          email: parsed.value.email,
        });
        return;
      case "validation":
        setErrors(outcome.fields);
        setStatus({ kind: "idle" });
        setFocusToken(token => token + 1);
        return;
      case "unavailable": {
        const subject = encodeURIComponent(
          `Solicitud de afiliación · ${parsed.value.nombres} ${parsed.value.apellidos}`
        );
        const body = encodeURIComponent(buildMailtoBody(parsed.value));
        setStatus({
          kind: "unavailable",
          mailto: `mailto:${ORGANIZACION.email}?subject=${subject}&body=${body}`,
        });
        return;
      }
      case "rate_limited":
        setStatus({
          kind: "error",
          message:
            "Recibimos varios envíos desde tu conexión. Espera unos minutos e inténtalo de nuevo.",
        });
        return;
      case "failed":
        setStatus({ kind: "error", message: outcome.message });
        return;
      default: {
        const exhaustive: never = outcome;
        throw new Error(`Resultado no manejado: ${JSON.stringify(exhaustive)}`);
      }
    }
  }

  if (status.kind === "success") {
    return (
      <div
        ref={resultRef}
        tabIndex={-1}
        role="status"
        className="rounded-3xl bg-white p-7 text-ink shadow-2xl sm:p-10"
      >
        <CheckCircle2 size={36} className="text-success" aria-hidden="true" />
        <h3 className="display mt-6 text-3xl">Recibimos tu solicitud.</h3>
        <p className="mt-4 text-base leading-7 text-ink-soft">
          Tu número de referencia es{" "}
          <strong className="rounded-md bg-aqua-100 px-2 py-0.5 font-mono text-navy-900">
            {status.referencia}
          </strong>
          . Consérvalo para cualquier consulta.
        </p>
        <p className="mt-3 text-base leading-7 text-ink-soft">
          Te enviaremos una confirmación a{" "}
          <strong className="text-ink">{status.email}</strong>. Si no la ves,
          revisa la carpeta de correo no deseado.
        </p>
      </div>
    );
  }

  if (status.kind === "unavailable") {
    return (
      <div
        ref={resultRef}
        tabIndex={-1}
        role="status"
        className="rounded-3xl bg-white p-7 text-ink shadow-2xl sm:p-10"
      >
        <Mail size={34} className="text-royal-600" aria-hidden="true" />
        <h3 className="display mt-6 text-3xl">
          Envíala por correo, ya está lista.
        </h3>
        <p className="mt-4 text-base leading-7 text-ink-soft">
          La recepción en línea aún no está habilitada. Preparamos un correo
          para la secretaría con los datos que escribiste: solo tienes que
          revisarlo y enviarlo.
        </p>
        <a href={status.mailto} className="btn btn-primary mt-7">
          Abrir mi correo <Send size={17} aria-hidden="true" />
        </a>
      </div>
    );
  }

  const errorCount = Object.keys(errors).length;
  const esEstudiante = categoria === "ESTUDIANTE";
  const submitting = status.kind === "submitting";

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={handleSubmit}
      aria-labelledby={`${baseId}-title`}
      aria-busy={submitting}
      className="relative rounded-3xl bg-white p-6 text-ink shadow-2xl sm:p-9"
    >
      <p className="text-xs font-bold tracking-[0.16em] text-royal-600 uppercase">
        Planilla de postulación
      </p>
      <h3
        id={`${baseId}-title`}
        className="display mt-3 text-3xl sm:text-[2.2rem]"
      >
        Comencemos tu registro.
      </h3>
      <p className="mt-3 text-sm text-slate">
        Todos los campos son obligatorios salvo que se indique lo contrario.
      </p>

      {(errorCount > 0 || status.kind === "error") && (
        <div
          role="alert"
          className="mt-6 flex gap-3 rounded-2xl bg-danger-bg p-4 text-sm text-danger"
        >
          <AlertCircle size={20} className="shrink-0" aria-hidden="true" />
          <p className="font-semibold">
            {status.kind === "error"
              ? status.message
              : errorCount === 1
                ? "Hay 1 campo por revisar."
                : `Hay ${errorCount} campos por revisar.`}
          </p>
        </div>
      )}

      <fieldset
        className="mt-8"
        aria-describedby={
          errors.categoria ? `${baseId}-categoria-error` : undefined
        }
      >
        <legend className="field-label">Categoría de ingreso</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {CATEGORIAS_POSTULABLES.map(value => (
            <label
              key={value}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line px-4 py-3 text-base font-semibold transition has-[:checked]:border-royal-600 has-[:checked]:bg-aqua-100 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-royal-500/25"
            >
              <input
                type="radio"
                name="categoria"
                value={value}
                checked={categoria === value}
                onChange={event =>
                  setCategoria(
                    isCategoria(event.target.value) ? event.target.value : null
                  )
                }
                aria-invalid={Boolean(errors.categoria)}
                className="size-4 accent-royal-600"
              />
              {CATEGORIA_LABEL_CORTA[value]}
            </label>
          ))}
        </div>
        <p className="field-hint mt-2">
          ¿Dudas sobre tu categoría? La secretaría te orientará al revisar tu
          solicitud.
        </p>
        <FieldsetError
          id={`${baseId}-categoria-error`}
          error={errors.categoria}
        />
      </fieldset>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field name="nombres" label="Nombres" error={errors.nombres}>
          {props => (
            <input
              {...props}
              className="field-input"
              autoComplete="given-name"
              maxLength={60}
            />
          )}
        </Field>
        <Field name="apellidos" label="Apellidos" error={errors.apellidos}>
          {props => (
            <input
              {...props}
              className="field-input"
              autoComplete="family-name"
              maxLength={60}
            />
          )}
        </Field>
        <Field name="email" label="Correo electrónico" error={errors.email}>
          {props => (
            <input
              {...props}
              type="email"
              className="field-input"
              autoComplete="email"
              inputMode="email"
              maxLength={254}
            />
          )}
        </Field>
        <Field
          name="telefono"
          label="Teléfono / WhatsApp"
          error={errors.telefono}
          hint="Ej.: 0414 123 4567"
        >
          {props => (
            <input
              {...props}
              type="tel"
              className="field-input"
              autoComplete="tel"
              inputMode="tel"
              maxLength={20}
            />
          )}
        </Field>
        <Field name="entidad" label="Estado" error={errors.entidad}>
          {props => (
            <select {...props} className="field-input" defaultValue="">
              <option value="" disabled>
                Selecciona un estado
              </option>
              {ENTIDADES_FEDERALES.map(entidad => (
                <option key={entidad} value={entidad}>
                  {entidad}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field name="ciudad" label="Ciudad" error={errors.ciudad}>
          {props => (
            <input
              {...props}
              className="field-input"
              autoComplete="address-level2"
              maxLength={80}
            />
          )}
        </Field>
        <Field
          name="universidad"
          label={
            esEstudiante
              ? "Universidad donde estudias"
              : "Universidad de egreso"
          }
          error={errors.universidad}
          className="sm:col-span-2"
        >
          {props => (
            <input
              {...props}
              className="field-input"
              autoComplete="organization"
              maxLength={120}
            />
          )}
        </Field>

        {esEstudiante ? (
          <Field
            name="semestre"
            label="Semestre que cursas"
            error={errors.semestre}
          >
            {props => (
              <select {...props} className="field-input" defaultValue="">
                <option value="" disabled>
                  Selecciona
                </option>
                {SEMESTRES.map(semestre => (
                  <option key={semestre} value={semestre}>
                    {semestre}.º semestre
                  </option>
                ))}
              </select>
            )}
          </Field>
        ) : (
          <>
            <Field
              name="anioEgreso"
              label="Año de egreso"
              error={errors.anioEgreso}
            >
              {props => (
                <input
                  {...props}
                  className="field-input"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="AAAA"
                />
              )}
            </Field>
            <Field
              name="numeroColegiatura"
              label="N.º de colegiatura (COV)"
              optional
              error={errors.numeroColegiatura}
            >
              {props => (
                <input
                  {...props}
                  className="field-input"
                  maxLength={20}
                  autoComplete="off"
                />
              )}
            </Field>
          </>
        )}
      </div>

      <fieldset
        className="mt-6"
        aria-describedby={errors.areas ? `${baseId}-areas-error` : undefined}
      >
        <legend className="field-label">Áreas de interés</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {AREAS_DE_INTERES.map(area => (
            <label
              key={area}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-1 text-base"
            >
              <input
                type="checkbox"
                name="areas"
                value={area}
                aria-invalid={Boolean(errors.areas)}
                className="size-4 accent-royal-600"
              />
              {AREA_LABEL[area]}
            </label>
          ))}
        </div>
        <FieldsetError id={`${baseId}-areas-error`} error={errors.areas} />
      </fieldset>

      <Field
        name="motivacion"
        label="Cuéntanos sobre tu interés"
        optional
        error={errors.motivacion}
        className="mt-6"
      >
        {props => (
          <>
            <textarea
              {...props}
              rows={4}
              maxLength={MOTIVACION_MAX}
              onChange={event => setMotivacionLength(event.target.value.length)}
              className="field-input resize-y py-3"
            />
            <p className="text-right text-xs text-slate" aria-live="polite">
              {motivacionLength}/{MOTIVACION_MAX}
            </p>
          </>
        )}
      </Field>

      {/* Campo trampa anti-bots: oculto para personas y lectores de pantalla. */}
      <div
        aria-hidden="true"
        className="absolute -left-[10000px] size-px overflow-hidden"
      >
        <label>
          No completar este campo
          <input
            type="text"
            name={HONEYPOT_FIELD}
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </label>
      </div>

      <div className="mt-6">
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-ink-soft">
          <input
            type="checkbox"
            name="consentimiento"
            aria-invalid={Boolean(errors.consentimiento)}
            aria-describedby={
              errors.consentimiento ? `${baseId}-consent-error` : undefined
            }
            className="mt-1 size-4 shrink-0 accent-royal-600"
          />
          <span>
            Autorizo a la {ORGANIZACION.sigla} a tratar mis datos personales
            únicamente para gestionar mi solicitud de afiliación, según el{" "}
            <a
              href="/privacidad"
              target="_blank"
              rel="noopener"
              className="font-semibold text-royal-600 underline underline-offset-2"
            >
              Aviso de privacidad
            </a>
            .
          </span>
        </label>
        <FieldsetError
          id={`${baseId}-consent-error`}
          error={errors.consentimiento}
        />
      </div>

      <div className="mt-8 flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate">
          La secretaría revisará cada solicitud.
        </p>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />{" "}
              Enviando…
            </>
          ) : (
            <>
              Enviar solicitud <Send size={17} aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
