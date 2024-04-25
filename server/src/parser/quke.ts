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

import { createToken } from "chevrotain";

export const Quke = createToken({
  name: "Quke",
  pattern: /(?<!.)\s*x?feature\b/,
  push_mode: "quke_mode",
});

export const Feature = createToken({
  name: "Feature",
  pattern: /\bx?feature\b/,
});

export const Before = createToken({
  name: "Before",
  pattern: /\bx?before\b/,
});

export const After = createToken({
  name: "After",
  pattern: /\bx?after\b/,
});

export const Should = createToken({
  name: "Should",
  pattern: /\bx?should\b/,
});

export const Expect = createToken({
  name: "Expect",
  pattern: /\bx?expect\b/,
});

export const ToMatch = createToken({
  name: "ToMatch",
  pattern: /\bx?to match\b/,
});

export const Description = createToken({
  name: "Description",
  pattern: /(?<=\bx?(?:feature|should|expect|to match)\b)[^\r\n]*/,
});
