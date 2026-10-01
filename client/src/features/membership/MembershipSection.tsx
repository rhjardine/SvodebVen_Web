import { Suspense, useContext } from "react";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { MembershipFormComponent } from "./form-slot";

function FormSkeleton() {
  return (
    <div
      className="min-h-[52rem] animate-pulse rounded-3xl bg-white/95 p-9"
      aria-busy="true"
      aria-label="Cargando planilla"
    >
      <div className="h-3 w-40 rounded bg-aqua-100" />
      <div className="mt-4 h-8 w-72 rounded bg-aqua-100" />
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-12 rounded-xl bg-mist" />
        ))}
      </div>
    </div>
  );
}

const PASOS = Object.freeze([
  {
    titulo: "Envías tu solicitud",
    texto: "Completas la planilla con tus datos, formación y áreas de interés.",
  },
  {
    titulo: "Secretaría revisa tu expediente",
    texto:
      "Validamos la información y te contactamos si hace falta algún documento.",
  },
  {
    titulo: "Activas tu membresía",
    texto: "Recibes la confirmación y te sumas a la comunidad SVODEB.",
  },
] as const);

export function MembershipSection() {
  const MembershipForm = useContext(MembershipFormComponent);
  return (
    <section
      id="afiliacion"
      aria-labelledby="afiliacion-title"
      className="on-navy bg-navy-900 py-24 text-white sm:py-28"
    >
      <div className="container-site grid gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <div className="lg:sticky lg:top-28">
          <SectionHeading
            id="afiliacion-title"
            eyebrow="Afiliación"
            title={
              <>
                Tu siguiente capítulo{" "}
                <em className="text-aqua-300">empieza aquí.</em>
              </>
            }
          />
          <p className="mt-6 max-w-xl text-lg leading-8 text-on-navy">
            Odontólogos y estudiantes de odontología pueden postularse para
            formar parte de la Sociedad.
          </p>
          <ol className="mt-10 grid gap-6">
            {PASOS.map((paso, index) => (
              <li key={paso.titulo} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-aqua-400/60 text-sm font-bold text-aqua-300"
                >
                  {index + 1}
                </span>
                <div>
                  <p className="text-base font-bold text-white">
                    {paso.titulo}
                  </p>
                  <p className="mt-1 text-base leading-7 text-on-navy">
                    {paso.texto}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <Suspense fallback={<FormSkeleton />}>
          <MembershipForm />
        </Suspense>
      </div>
    </section>
  );
}
