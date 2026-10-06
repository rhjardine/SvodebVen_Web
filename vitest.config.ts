import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Permite renderizar componentes React (SSR) en las pruebas sin el plugin de Vite.
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Las pruebas con base de datos comparten una BD: se ejecutan una a una.
    fileParallelism: false,
  },
});
