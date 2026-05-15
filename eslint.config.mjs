import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  { ignores: ["dist", "node_modules"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module"
      }
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-hooks/set-state-in-effect": "off",
      "react-refresh/only-export-components": "off",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }]
    }
  },
  {
    files: ["server/**/*.js", "drizzle.config.mjs"],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  }
];
