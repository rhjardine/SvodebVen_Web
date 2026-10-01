import { createContext, lazy, type ComponentType } from "react";

/**
 * En el navegador la planilla (y zod) se carga diferida para no bloquear el primer render.
 * En el prerenderizado se inyecta la versión directa vía contexto: así el HTML trae la
 * planilla completa sin límites de Suspense pendientes (que exigirían scripts en línea,
 * prohibidos por la CSP) y la hidratación no cae a renderizado en cliente.
 */
export const LazyMembershipForm = lazy(() =>
  import("./MembershipForm").then(module => ({
    default: module.MembershipForm,
  }))
);

export const MembershipFormComponent =
  createContext<ComponentType>(LazyMembershipForm);
