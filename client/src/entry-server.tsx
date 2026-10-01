import { renderToString } from "react-dom/server";
import { Router } from "wouter";
import App from "./App";
import { MembershipForm } from "./features/membership/MembershipForm";
import { MembershipFormComponent } from "./features/membership/form-slot";

/**
 * Renderiza una ruta a HTML estático en tiempo de build (ver scripts/prerender.ts).
 * La planilla se inyecta de forma directa (sin lazy): nada queda suspendido.
 */
export async function render(path: string): Promise<string> {
  return renderToString(
    <MembershipFormComponent.Provider value={MembershipForm}>
      <Router ssrPath={path}>
        <App />
      </Router>
    </MembershipFormComponent.Provider>
  );
}
