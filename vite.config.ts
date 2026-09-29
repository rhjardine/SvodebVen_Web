import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

const API_DEV_TARGET = process.env.API_DEV_TARGET ?? "http://localhost:3001";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    sourcemap: false,
    // Sin data: URIs: permite una CSP estricta (font-src/img-src 'self').
    assetsInlineLimit: 0,
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      "/api": { target: API_DEV_TARGET, changeOrigin: false },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
