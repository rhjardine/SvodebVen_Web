import { useEffect, type ReactNode } from "react";
import { PageShell } from "@/components/layout/PageShell";
import type { DocumentoLegal } from "@/content/legal";
import { ORGANIZACION } from "@/content/site";

const dateFormatter = new Intl.DateTimeFormat("es-VE", { dateStyle: "long" });

type LegalPageProps = Readonly<{
  title: string;
  documento: DocumentoLegal;
  /** Una frase que resume para qué sirve el documento (lenguaje claro). */
  summary: string;
  children: ReactNode;
}>;

/** Plantilla común de los documentos legales: aviso de borrador, fecha, versión y estilo de lectura. */
export function LegalPage({
  title,
  documento,
  summary,
  children,
}: LegalPageProps) {
  useEffect(() => {
    document.title = `${title} · ${ORGANIZACION.sigla}`;
  }, [title]);

  return (
    <PageShell>
      <article className="container-site max-w-3xl py-20 sm:py-24">
        {documento.estado === "BORRADOR" && (
          <p className="eyebrow">Documento en revisión legal</p>
        )}
        <h1 className="display mt-5 text-5xl">{title}</h1>
        <p className="mt-6 text-lg leading-8 text-ink-soft">{summary}</p>
        <p className="mt-4 text-sm text-slate">
          Última actualización:{" "}
          {dateFormatter.format(new Date(`${documento.actualizado}T12:00:00`))}{" "}
          · Versión {documento.version}
        </p>
        {documento.estado === "BORRADOR" && (
          <p
            role="note"
            className="mt-6 rounded-2xl border border-line bg-aqua-100 p-4 text-sm leading-6 text-ink"
          >
            Este texto es un borrador preparado para la directiva y su asesoría
            legal. Los datos marcados como «Por confirmar» se completarán con la
            documentación oficial de la sociedad antes de su aprobación
            definitiva.
          </p>
        )}
        <div className="mt-10 grid gap-8 text-lg leading-8 text-ink-soft [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-ink [&_li]:mt-2 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
          {children}
        </div>
      </article>
    </PageShell>
  );
}

export function LegalSection({
  title,
  children,
}: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <section>
      <h2>{title}</h2>
      <div className="mt-3 grid gap-3">{children}</div>
    </section>
  );
}

/** Dato del titular: si aún no está confirmado se dice abiertamente, nunca se inventa. */
export function Dato({
  etiqueta,
  valor,
}: Readonly<{ etiqueta: string; valor: string | null }>) {
  return (
    <li>
      <strong className="text-ink">{etiqueta}:</strong>{" "}
      {valor ?? <em>Por confirmar</em>}
    </li>
  );
}
