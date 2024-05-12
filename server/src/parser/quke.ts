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

export const Feature = createToken({
  name: "Feature",
  pattern: /\b(x?feature)\b(.*)/i,
});

export const Should = createToken({
  name: "Should",
  pattern: /\b(x?should)\b(.*)/i,
});

export const Expect = createToken({
  name: "Expect",
  pattern: /\b(x?expect)\b(.*)/i,
});

export const ToMatch = createToken({
  name: "ToMatch",
  pattern: /\b(x?to match)\b(.*)/i,
});

export const Behaviour = createToken({
  name: "Behaviour",
  pattern: /\b(x?behaviour)\b(.*)/i,
});

export const Baseline = createToken({
  name: "Baseline",
  pattern: /\b(x?baseline)\b(.*)/i,
});

export const Bench = createToken({
  name: "Bench",
  pattern: /\b(x?bench)\b(.*)/i,
});

export const Property = createToken({
  name: "Property",
  pattern: /\b(x?property)\b(.*)/i,
});

export const After = createToken({
  name: "After",
  pattern: /\bx?after\b/i,
});

export const AfterEach = createToken({
  name: "AfterEach",
  pattern: /\bx?after each\b/i,
});

export const Before = createToken({
  name: "Before",
  pattern: /\bx?before\b/i,
});

export const BeforeEach = createToken({
  name: "BeforeEach",
  pattern: /\bx?before each\b/i,
});

export const Setup = createToken({
  name: "Setup",
  pattern: /\bx?setup\b/i,
});

export const Teardown = createToken({
  name: "Teardown",
  pattern: /\bx?teardown\b/i,
});

export const SkipIf = createToken({
  name: "SkipIf",
  pattern: /\bx?skip if\b/i,
});

export const TimeLimit = createToken({
  name: "TimeLimit",
  pattern: /\bx?timelimit\b/i,
});

export const Tolerance = createToken({
  name: "Tolerance",
  pattern: /\bx?tolerance\b/i,
});

export const Replicate = createToken({
  name: "Replicate",
  pattern: /\bx?replicate\b/i,
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
  AfterEach,
  After,
  BeforeEach,
  Before,
  Setup,
  Teardown,
  SkipIf,
  TimeLimit,
  Tolerance,
  Replicate,
];
