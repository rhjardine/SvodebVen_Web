// Reglas que hacen cumplir los estándares del proyecto (ver docs/ARQUITECTURA o ROADMAP):
//  • sin `any` en ninguna parte;
//  • sin `throw` en la lógica de negocio (shared/ y server/): los errores son valores `Result`;
//  • `switch` exhaustivos y promesas siempre atendidas.
import js from "@eslint/js";
import tseslint from "typescript-eslint";

const NO_THROW_MESSAGE =
  "No lances excepciones en la lógica de negocio: devuelve `err(...)` de shared/result. " +
  "Las excepciones de librerías se capturan UNA vez en el borde con `tryAsync`/`trySync`.";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".lighthouseci/**",
      "eslint.config.js",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Los manejadores async de Express devuelven promesas: es el patrón esperado.
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { arguments: false, attributes: false } },
      ],
    },
  },
  {
    // Lógica de negocio: prohibido lanzar excepciones.
    files: ["shared/**/*.ts", "server/**/*.ts"],
    ignores: ["server/index.ts", "server/start.ts", "server/release-cli.ts"], // raíz de composición: decide terminar el proceso
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "ThrowStatement", message: NO_THROW_MESSAGE },
      ],
    },
  }
);
