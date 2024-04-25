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
  pattern: /\b(x?feature)\b(.*)/,
});

export const Should = createToken({
  name: "Should",
  pattern: /\b(x?should)\b(.*)/,
});

export const Expect = createToken({
  name: "Expect",
  pattern: /\b(x?expect)\b(.*)/,
});

export const ToMatch = createToken({
  name: "ToMatch",
  pattern: /\b(x?to match)\b(.*)/,
});

export const Behaviour = createToken({
  name: "Behaviour",
  pattern: /\b(x?behaviour)\b(.*)/,
});

export const Baseline = createToken({
  name: "Baseline",
  pattern: /\b(x?baseline)\b(.*)/,
});

export const Bench = createToken({
  name: "Bench",
  pattern: /\b(x?bench)\b(.*)/,
});

export const Property = createToken({
  name: "Property",
  pattern: /\b(x?property)\b(.*)/,
});

export const After = createToken({
  name: "After",
  pattern: /\bx?after\b/,
});

export const AfterEach = createToken({
  name: "AfterEach",
  pattern: /\bx?after each\b/,
});

export const Before = createToken({
  name: "Before",
  pattern: /\bx?before\b/,
});

export const BeforeEach = createToken({
  name: "BeforeEach",
  pattern: /\bx?before each\b/,
});

export const Setup = createToken({
  name: "Setup",
  pattern: /\bx?setup\b/,
});

export const Teardown = createToken({
  name: "Teardown",
  pattern: /\bx?teardown\b/,
});

export const SkipIf = createToken({
  name: "SkipIf",
  pattern: /\bx?skip if\b/,
});

export const TimeLimit = createToken({
  name: "TimeLimit",
  pattern: /\bx?timelimit\b/,
});

export const Tolerance = createToken({
  name: "Tolerance",
  pattern: /\bx?tolerance\b/,
});

export const Replicate = createToken({
  name: "Replicate",
  pattern: /\bx?replicate\b/,
});

export const qukeWithDescription = [
  Feature,
  Should,
  Expect,
  ToMatch,
  Behaviour,
  Baseline,
  Bench,
  Property,
];

export const qukeNoDescription = [
  After,
  AfterEach,
  Before,
  BeforeEach,
  Setup,
  Teardown,
  SkipIf,
  TimeLimit,
  Tolerance,
  Replicate,
];
