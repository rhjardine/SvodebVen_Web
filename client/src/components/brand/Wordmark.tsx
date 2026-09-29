import { ORGANIZACION } from "@/content/site";
import { cn } from "@/lib/utils";

type WordmarkProps = Readonly<{
  tone?: "light" | "dark";
  showFullName?: boolean;
  className?: string;
}>;

/**
 * Logotipo tipográfico provisional.
 * PENDIENTE: sustituir por el vector oficial (SVG/AI/PDF) del isotipo + logotipo SVODEB.
 */
export function Wordmark({
  tone = "light",
  showFullName = true,
  className,
}: WordmarkProps) {
  return (
    <span className={cn("flex flex-col leading-none", className)}>
      <span
        className={cn(
          "text-[1.35rem] font-semibold tracking-[0.2em]",
          tone === "light" ? "text-white" : "text-navy-900"
        )}
      >
        {ORGANIZACION.sigla}
      </span>
      {showFullName && (
        <span
          className={cn(
            "mt-1.5 max-w-[15.5rem] text-[0.7rem] leading-snug font-medium",
            tone === "light" ? "text-on-navy" : "text-ink-soft"
          )}
        >
          {ORGANIZACION.nombre}
        </span>
      )}
    </span>
  );
}
