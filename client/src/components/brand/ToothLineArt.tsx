import { cn } from "@/lib/utils";

/**
 * Ilustración de línea inspirada en el isotipo (diente trazado con cinta).
 * Es decorativa: NO reemplaza al logotipo oficial. SVG en línea, sin peticiones de red.
 */
export function ToothLineArt({ className }: Readonly<{ className?: string }>) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn("overflow-visible", className)}
    >
      <defs>
        <linearGradient
          id="tooth-stroke"
          x1="6"
          y1="0"
          x2="104"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#8db3ba" />
          <stop offset="0.55" stopColor="#ffffff" />
          <stop offset="1" stopColor="#a9cdd3" />
        </linearGradient>
      </defs>
      <path
        pathLength={1}
        className="animate-draw"
        d="M6 44 C 18 30, 32 27, 42 34 C 48 38, 54 38, 60 31 C 70 17, 94 16, 99 36 C 103 54, 90 68, 86 84 C 83 97, 80 107, 70 113"
        stroke="url(#tooth-stroke)"
        strokeWidth={3.2}
      />
      <path
        pathLength={1}
        className="animate-draw"
        d="M27 36 C 21 52, 30 64, 34 80 C 37 93, 40 103, 47 109"
        stroke="#8db3ba"
        strokeWidth={2.2}
      />
      <path
        pathLength={1}
        className="animate-draw"
        d="M40 54 C 60 43, 88 47, 116 33"
        stroke="#4a76c0"
        strokeWidth={1.4}
      />
    </svg>
  );
}
