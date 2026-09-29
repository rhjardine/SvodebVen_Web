import { FlaskConical, Layers, Sparkles, type LucideIcon } from "lucide-react";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { DISCIPLINAS } from "@/content/site";
import type { AreaDeInteres } from "@shared/membership/catalog";

const ICONS: Readonly<Partial<Record<AreaDeInteres, LucideIcon>>> =
  Object.freeze({
    OPERATORIA: Layers,
    ESTETICA: Sparkles,
    BIOMATERIALES: FlaskConical,
  });

export function SocietySection() {
  return (
    <section
      id="sociedad"
      aria-labelledby="sociedad-title"
      className="py-24 sm:py-28"
    >
      <div className="container-site">
        <SectionHeading
          id="sociedad-title"
          eyebrow="La sociedad"
          title="Una práctica más precisa. Una comunidad más cercana."
          lead="La SVODEB conecta a quienes entienden la odontología como una disciplina de precisión, criterio y servicio: una sociedad científica con identidad venezolana y vocación regional."
        />
        <ul className="mt-14 grid gap-5 md:grid-cols-3">
          {DISCIPLINAS.map((disciplina, index) => {
            const Icon = ICONS[disciplina.id] ?? Layers;
            return (
              <li
                key={disciplina.id}
                className="card relative overflow-hidden p-7"
              >
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-7 h-1 w-12 rounded-b-full bg-gradient-to-r from-aqua-400 to-royal-600"
                />
                <div className="flex items-center justify-between">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-aqua-100 text-royal-700">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <span
                    className="text-sm font-bold text-slate"
                    aria-hidden="true"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-8 text-2xl font-bold tracking-tight text-ink">
                  {disciplina.titulo}
                </h3>
                <p className="mt-3 text-base leading-7 text-ink-soft">
                  {disciplina.descripcion}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
