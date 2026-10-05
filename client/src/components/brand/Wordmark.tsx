import { ORGANIZACION } from "@/content/site";
import { cn } from "@/lib/utils";
import { LETTERS } from "./brand-paths";
import { Emblem } from "./Emblem";

type WordmarkProps = Readonly<{
  /** `light`: texto claro sobre fondo oscuro; `dark`: texto oscuro sobre fondo claro. */
  tone?: "light" | "dark";
  showFullName?: boolean;
  className?: string;
}>;

/**
 * Logotipo oficial: emblema + inscripción "SVODEB" (vectoriales) y nombre completo como texto real
 * (accesible y traducible). Las proporciones respetan el logo original.
 */
export function Wordmark({
  tone = "light",
  showFullName = true,
  className,
}: WordmarkProps) {
  const light = tone === "light";
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <Emblem
        variant={light ? "on-dark" : "color"}
        className="h-14 w-auto shrink-0"
      />
      <span className="flex flex-col leading-none">
        <svg
          viewBox={LETTERS.viewBox}
          aria-hidden="true"
          focusable="false"
          className="h-[1.7rem] w-auto self-start"
        >
          <path
            fill={light ? "#ffffff" : "#002050"}
            fillRule="evenodd"
            d={LETTERS.path}
          />
        </svg>
        {showFullName && (
          <span
            className={cn(
              "mt-1.5 max-w-[15.5rem] text-[0.7rem] leading-snug font-medium",
              light ? "text-on-navy" : "text-ink-soft"
            )}
          >
            {ORGANIZACION.nombre}
          </span>
        )}
      </span>
    </span>
  );
}
