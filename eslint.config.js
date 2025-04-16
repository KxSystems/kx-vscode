import js from "@eslint/js";
import tseslint from "typescript-eslint";
import headerPlugin from "eslint-plugin-header";
import licenseHeaderPlugin from "eslint-plugin-license-header";
import unusedImportsPlugin from "eslint-plugin-unused-imports";
import path from "path";

export default [
  {
    ignores: ["**/*.d.ts", "**/*.js", "src/ipc/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2018,
        sourceType: "module",
      },
    },
    plugins: {
      header: headerPlugin,
      "license-header": licenseHeaderPlugin,
      "unused-imports": unusedImportsPlugin,
    },
    rules: {
      "@typescript-eslint/no-use-before-define": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "license-header/header": [
        "error",
        path.resolve("./resources/license-header.js"),
      ],
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
    },
  },
];
