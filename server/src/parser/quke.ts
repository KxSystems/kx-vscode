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
  pattern: /(?<!.)[ \t]*(x?feature)\b(.*)/i,
});

export const Should = createToken({
  name: "Should",
  pattern: /(?<!.)[ \t]*(x?should)\b(.*)/i,
});

export const Expect = createToken({
  name: "Expect",
  pattern: /(?<!.)[ \t]*(x?expect)\b(.*)/i,
});

export const ToMatch = createToken({
  name: "ToMatch",
  pattern: /(?<!.)[ \t]*(x?to match)\b(.*)/i,
});

export const Behaviour = createToken({
  name: "Behaviour",
  pattern: /(?<!.)[ \t]*(x?behaviour)\b(.*)/i,
});

export const Baseline = createToken({
  name: "Baseline",
  pattern: /(?<!.)[ \t]*(x?baseline)\b(.*)/i,
});

export const Bench = createToken({
  name: "Bench",
  pattern: /(?<!.)[ \t]*(x?bench)\b(.*)/i,
});

export const Property = createToken({
  name: "Property",
  pattern: /(?<!.)[ \t]*(x?property)\b(.*)/i,
});

export const After = createToken({
  name: "After",
  pattern: /(?<!.)[ \t]*x?after\b/i,
});

export const AfterEach = createToken({
  name: "AfterEach",
  pattern: /(?<!.)[ \t]*x?after each\b/i,
});

export const Before = createToken({
  name: "Before",
  pattern: /(?<!.)[ \t]*x?before\b/i,
});

export const BeforeEach = createToken({
  name: "BeforeEach",
  pattern: /(?<!.)[ \t]*x?before each\b/i,
});

export const Setup = createToken({
  name: "Setup",
  pattern: /(?<!.)[ \t]*x?setup\b/i,
});

export const Teardown = createToken({
  name: "Teardown",
  pattern: /(?<!.)[ \t]*x?teardown\b/i,
});

export const SkipIf = createToken({
  name: "SkipIf",
  pattern: /(?<!.)[ \t]*x?skip if\b/i,
});

export const TimeLimit = createToken({
  name: "TimeLimit",
  pattern: /(?<!.)[ \t]*x?timelimit\b/i,
});

export const Tolerance = createToken({
  name: "Tolerance",
  pattern: /(?<!.)[ \t]*x?tolerance\b/i,
});

export const Replicate = createToken({
  name: "Replicate",
  pattern: /(?<!.)[ \t]*x?replicate\b/i,
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
