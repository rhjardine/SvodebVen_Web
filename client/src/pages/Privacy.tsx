import { useEffect } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ORGANIZACION } from "@/content/site";

/**
 * BORRADOR en lenguaje claro. Debe ser revisado por la directiva y asesoría legal
 * antes de la publicación en producción (ver docs/ROADMAP.md).
 * PENDIENTE: revisión legal del Aviso de privacidad.
 */
export default function Privacy() {
  useEffect(() => {
    document.title = `Aviso de privacidad · ${ORGANIZACION.sigla}`;
  }, []);

  return (
    <PageShell>
      <article className="container-site max-w-3xl py-20 sm:py-24">
        <p className="eyebrow">Documento en revisión</p>
        <h1 className="display mt-5 text-5xl">Aviso de privacidad</h1>
        <div className="mt-10 grid gap-8 text-lg leading-8 text-ink-soft [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-ink">
          <section>
            <h2>Quién trata tus datos</h2>
            <p className="mt-3">
              La {ORGANIZACION.nombre} ({ORGANIZACION.sigla}) es responsable de
              los datos que envías a través de este sitio. Puedes escribirnos a{" "}
              <a
                className="font-semibold text-royal-600 underline"
                href={`mailto:${ORGANIZACION.email}`}
              >
                {ORGANIZACION.email}
              </a>
              .
            </p>
          </section>
          <section>
            <h2>Qué datos recogemos y para qué</h2>
            <p className="mt-3">
              En la planilla de afiliación pedimos tus datos de identificación y
              contacto, tu formación académica y tus áreas de interés. Los
              usamos únicamente para evaluar tu solicitud, comunicarnos contigo
              y, si eres admitido, gestionar tu membresía.
            </p>
          </section>
          <section>
            <h2>Con quién los compartimos</h2>
            <p className="mt-3">
              No vendemos ni cedemos tus datos. Solo acceden a ellos las
              personas de la Sociedad encargadas de tramitar las afiliaciones y
              los proveedores técnicos imprescindibles para operar el sitio y el
              correo.
            </p>
          </section>
          <section>
            <h2>Directorio público</h2>
            <p className="mt-3">
              Tu ficha solo aparecerá en el directorio de especialistas si eres
              miembro con membresía vigente y lo autorizas de forma expresa.
              Puedes pedir que se modifique o se retire en cualquier momento.
            </p>
          </section>
          <section>
            <h2>Tus derechos</h2>
            <p className="mt-3">
              Puedes solicitar acceso, corrección o eliminación de tus datos
              escribiendo al correo indicado. La Constitución de la República
              Bolivariana de Venezuela reconoce el derecho de toda persona a
              acceder a la información que sobre sí misma conste en registros, y
              a solicitar su actualización o rectificación (artículo 28).
            </p>
          </section>
        </div>
      </article>
    </PageShell>
  );
}
