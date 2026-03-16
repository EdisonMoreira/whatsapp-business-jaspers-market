
import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  // 1. Configuração Recomendada do JavaScript
  { 
    files: ["**/*.{js,mjs,cjs}"], 
    plugins: { js }, 
    rules: js.configs.recommended.rules, // Pega as regras padrão
    languageOptions: { 
      globals: {
        ...globals.browser, // Carrega globais do navegador (window, document, etc.)
        ...globals.node     // Carrega globais do Node (process, console)
      }
    } 
  },

  // 2. Suas personalizações específicas para o Facebook SDK
  {
    languageOptions: {
      globals: {
        FB: "readonly", // Agora o ESLint não vai mais dizer que 'FB' não existe
      }
    },
    rules: {
      "no-unused-vars": "warn", // Transforma erro de variável não usada em apenas um aviso
      "no-console": "off"       // Permite usar console.log sem avisos (útil em dev)
    }
  }
]);