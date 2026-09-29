import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionHeadingProps = Readonly<{
  id: string;
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  className?: string;
}>;

/** Encabezado de sección; `id` enlaza el `<h2>` con `aria-labelledby` de la sección. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  lead,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn("max-w-3xl", className)}>
      <p className="eyebrow">{eyebrow}</p>
      <h2
        id={id}
        className="display mt-5 text-[2.4rem] sm:text-5xl lg:text-[3.6rem]"
      >
        {title}
      </h2>
      {lead && (
        <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-soft">{lead}</p>
      )}
    </div>
  );
}
