import type { ReactNode } from "react";
import fullLogo from "@/assets/brand/logo-svodeb.jpg";
import headerLogo from "@/assets/brand/logo-svodeb-header.jpg";
import { ORGANIZACION } from "@/content/site";
import { cn } from "@/lib/utils";

type LogoProps = Readonly<{
  /**
   * `compact`: emblema + SVODEB (cabecera).
   * `full`: logo completo con el nombre de la sociedad.
   */
  variant?: "compact" | "full";
  className?: string;
  /** Imagen por encima del pliegue: se carga sin diferir. */
  priority?: boolean;
}>;

/**
 * Logo OFICIAL de SVODEB tal como lo entregó la directiva (JPG con fondo blanco), solo reducido
 * de tamaño. Sobre fondos oscuros se muestra dentro de una placa blanca (ver `LogoPlaque`).
 * PENDIENTE: archivo vectorial/PNG transparente maestro para versiones sin placa.
 */
export function Logo({
  variant = "compact",
  className,
  priority = false,
}: LogoProps) {
  const full = variant === "full";
  return (
    <img
      src={full ? fullLogo : headerLogo}
      width={full ? 900 : 560}
      height={full ? 597 : 350}
      alt={`Logotipo de ${ORGANIZACION.sigla}: ${ORGANIZACION.nombre}`}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={cn("h-auto select-none", className)}
    />
  );
}

/** Placa blanca para mostrar el logo (fondo blanco) sobre superficies oscuras. */
export function LogoPlaque({
  className,
  children,
}: Readonly<{ className?: string; children: ReactNode }>) {
  return (
    <div
      className={cn(
        "rounded-3xl bg-white p-5 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.65)] sm:p-7",
        className
      )}
    >
      {children}
    </div>
  );
}
