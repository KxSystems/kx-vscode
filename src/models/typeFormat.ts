/*
 * Copyright (c) 1998-2026 KX Systems Inc.
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

export const TYPE_NAMES = new Map<number, string>([
  [-1, "Boolean"],
  [-2, "GUID"],
  [-4, "Byte"],
  [-5, "Short"],
  [-6, "Int"],
  [-7, "Long"],
  [-8, "Float"],
  [-9, "Double"],
  [-10, "Char"],
  [-11, "Symbol"],
  [-12, "Timestamp"],
  [-13, "Month"],
  [-14, "Date"],
  [-15, "DateTime"],
  [-16, "Timespan"],
  [-17, "Minute"],
  [-18, "Second"],
  [-19, "Time"],
  [0, "List"],
  [1, "Boolean List"],
  [2, "GUID List"],
  [4, "Byte List"],
  [5, "Short List"],
  [6, "Int List"],
  [7, "Long List"],
  [8, "Float List"],
  [9, "Double List"],
  [10, "String"],
  [11, "Symbol List"],
  [12, "Timestamp List"],
  [13, "Month List"],
  [14, "Date List"],
  [15, "DateTime List"],
  [16, "Timespan List"],
  [17, "Minute List"],
  [18, "Second List"],
  [19, "Time List"],
  [77, "Any Map"],
  [98, "Table"],
  [99, "Dictionary"],
  [100, "Lambda"],
  [101, "Unary"],
]);

export const TYPE_BY_NAME = new Map<string, number>(
  [...TYPE_NAMES].map(([type, name]) => [name, type]),
);

const SPECIAL = "0N|-?0[Ww]";

const special = (pattern: string) => new RegExp(`^(?:${pattern}|${SPECIAL})$`);

type TypeFormat = {
  example: string;
  pattern: RegExp;
  min?: bigint;
  max?: bigint;
};

const FORMATS = new Map<number, TypeFormat>([
  [
    -2,
    {
      example: "00000000-0000-0000-0000-000000000000",
      pattern: special(
        "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
      ),
    },
  ],
  [
    -4,
    {
      example: "42",
      pattern: special("\\d{1,3}|0x[0-9a-fA-F]{2}"),
      min: 0n,
      max: 255n,
    },
  ],
  [
    -5,
    {
      example: "42",
      pattern: special("-?\\d+"),
      min: -32766n,
      max: 32766n,
    },
  ],
  [
    -6,
    {
      example: "42",
      pattern: special("-?\\d+"),
      min: -2147483646n,
      max: 2147483646n,
    },
  ],
  [
    -7,
    {
      example: "42",
      pattern: special("-?\\d+"),
      min: -9223372036854775806n,
      max: 9223372036854775806n,
    },
  ],
  [-8, { example: "3.14", pattern: special("-?\\d*\\.?\\d+") }],
  [-9, { example: "3.14", pattern: special("-?\\d*\\.?\\d+") }],
  [-10, { example: "a", pattern: special(".") }],
  [
    -12,
    {
      example: "2000.01.01D00:00:00.000000000",
      pattern: special(
        "\\d{4}\\.(?:0[1-9]|1[0-2])\\.(?:0[1-9]|[12]\\d|3[01])D(?:[01]\\d|2[0-3])(?::[0-5]\\d(?::[0-5]\\d(?:\\.\\d{1,9})?)?)?" +
          "|\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])T(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d{1,9})?)?Z?",
      ),
    },
  ],
  [
    -13,
    {
      example: "2000.01",
      pattern: special("\\d{4}\\.(?:0[1-9]|1[0-2])"),
    },
  ],
  [
    -14,
    {
      example: "2000.01.01",
      pattern: special("\\d{4}\\.(?:0[1-9]|1[0-2])\\.(?:0[1-9]|[12]\\d|3[01])"),
    },
  ],
  [
    -15,
    {
      example: "2000.01.01T00:00:00.000",
      pattern: special(
        "\\d{4}\\.(?:0[1-9]|1[0-2])\\.(?:0[1-9]|[12]\\d|3[01])T(?:[01]\\d|2[0-3])(?::[0-5]\\d(?::[0-5]\\d(?:\\.\\d{1,3})?)?)?",
      ),
    },
  ],
  [
    -16,
    {
      example: "0D00:00:00.000000000",
      pattern: special(
        "-?\\d+D(?:(?:[01]\\d|2[0-3])(?::[0-5]\\d(?::[0-5]\\d(?:\\.\\d{1,9})?)?)?)?",
      ),
    },
  ],
  [-17, { example: "00:01", pattern: special("-?\\d{1,2}:[0-5]\\d") }],
  [
    -18,
    {
      example: "00:00:01",
      pattern: special("-?\\d{1,2}:[0-5]\\d:[0-5]\\d"),
    },
  ],
  [
    -19,
    {
      example: "00:00:00.001",
      pattern: special(
        "-?\\d{1,2}(?::[0-5]\\d(?::[0-5]\\d(?:\\.\\d{1,3})?)?)?",
      ),
    },
  ],
]);

export function exampleForType(type: number | undefined): string {
  return type === undefined ? "" : (FORMATS.get(type)?.example ?? "");
}

export function typeProblem(
  type: number | undefined,
  value: unknown,
): string | undefined {
  if (type === undefined || typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const format = FORMATS.get(type);
  if (!format) {
    return undefined;
  }

  const expected = `a ${TYPE_NAMES.get(type) ?? type} value, like ${format.example}`;
  if (!format.pattern.test(value.trim())) {
    return expected;
  }

  if (format.min === undefined || format.max === undefined) {
    return undefined;
  }

  const digits = value.trim();
  if (!/^-?\d+$/.test(digits)) {
    return undefined;
  }

  const given = BigInt(digits);
  return given < format.min || given > format.max
    ? `${expected}, between ${format.min} and ${format.max}`
    : undefined;
}
