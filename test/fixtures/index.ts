/*
 * Copyright (c) 1998-2023 Kx Systems Inc.
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

/* eslint @typescript-eslint/ban-ts-comment: 0 */

import Module from "module";
import path from "path";

// @ts-ignore
const resolve = Module._resolveFilename;

// @ts-ignore
Module._resolveFilename = function (specifier: string, parent: string) {
  switch (specifier) {
    case "lit":
    case "lit/decorators.js":
    case "lit/directives/repeat.js":
      specifier = path.resolve(__dirname, "webview.js");
      break;
  }
  return resolve(specifier, parent);
};
