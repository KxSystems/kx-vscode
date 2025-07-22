/*
 * Copyright (c) 1998-2025 Kx Systems Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the
 * License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

import js from "@eslint/js";
import headerPlugin from "eslint-plugin-header";
import importPlugin from "eslint-plugin-import";
import licenseHeaderPlugin from "eslint-plugin-license-header";
import unusedImportsPlugin from "eslint-plugin-unused-imports";
import * as tseslint from "typescript-eslint";

const currentYear = new Date().getFullYear();

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
      import: importPlugin,
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
          ` * Copyright (c) 1998-${currentYear} KX Systems Inc.`,
          " *",
          ' * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the',
          " * License. You may obtain a copy of the License at",
          " *",
          " * http://www.apache.org/licenses/LICENSE-2.0",
          " *",
          " * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an",
          ' * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the',
          " * specific language governing permissions and limitations under the License.",
          " */",
        ],
      ],
      "import/order": [
        "error",
        {
          groups: [
            ["builtin", "external"],
            ["internal", "parent", "sibling", "index"],
          ],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
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
