import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const container = document.getElementById("root");
if (!container) throw new Error("No se encontró el contenedor #root");

const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

// En producción el HTML viene prerenderizado: se hidrata. En desarrollo se monta desde cero.
if (container.hasChildNodes()) hydrateRoot(container, app);
else createRoot(container).render(app);
