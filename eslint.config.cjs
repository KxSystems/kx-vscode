const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const headerPlugin = require("eslint-plugin-header");
const licenseHeaderPlugin = require("eslint-plugin-license-header");
const unusedImportsPlugin = require("eslint-plugin-unused-imports");

const currentYear = new Date().getFullYear();

module.exports = [
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
        [
          "/*",
          ` * Copyright (c) 1998-${currentYear} Kx Systems Inc.`,
          " *",
          ' * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the',
          " * License. You may obtain a copy of the License at",
          " *",
          " * http://www.apache.org/licenses/LICENSE-2.0",
          " *",
          " * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an",
          ' * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the',
          " * specific language governing permissions and limitations under the License.",
          "*/",
        ],
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
