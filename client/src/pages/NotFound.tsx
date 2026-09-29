import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ORGANIZACION } from "@/content/site";

export default function NotFound() {
  useEffect(() => {
    document.title = `Página no encontrada · ${ORGANIZACION.sigla}`;
  }, []);

  return (
    <PageShell>
      <section className="container-site flex min-h-[60vh] flex-col items-start justify-center py-24">
        <p className="eyebrow">Error 404</p>
        <h1 className="display mt-5 text-5xl sm:text-6xl">
          No encontramos esta página.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-ink-soft">
          Es posible que el enlace haya cambiado o que la dirección tenga un
          error.
        </p>
        <a href="/" className="btn btn-primary mt-9">
          <ArrowLeft size={18} aria-hidden="true" /> Volver al inicio
        </a>
      </section>
    </PageShell>
  );
}
