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

export interface Converter<M> {
  toModel(value: string): M;
  toValue(value: M): string;
  toFormat(value: M): string;
}

class Text implements Converter<unknown> {
  toModel(value: string): unknown {
    return value;
  }

  toValue(value: unknown): string {
    return value === undefined || value === null ? "" : String(value);
  }

  toFormat(value: unknown): string {
    return this.toValue(value);
  }
}

export const TEXT = new Text();

const TIMESTAMP =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)?(?:\.(\d{1,9}))?$/;

export function splitTimestamp(value: unknown) {
  const match = TEXT.toValue(value).match(TIMESTAMP);
  return {
    local: match?.[1] ?? "",
    nanos: (match?.[2] ?? "").padEnd(9, "0").slice(0, 9),
  };
}

export function joinTimestamp(local: string, nanos: string) {
  if (!local) {
    return "";
  }
  const seconds = local.length === 16 ? `${local}:00` : local;
  return `${seconds}.${nanos.replace(/\D/g, "").padEnd(9, "0").slice(0, 9)}`;
}

class Local implements Converter<unknown> {
  toModel(value: string): unknown {
    return value;
  }

  toValue(value: unknown): string {
    return splitTimestamp(value).local;
  }

  toFormat(value: unknown): string {
    return this.toValue(value);
  }
}

export const LOCAL = new Local();

class Nanos implements Converter<unknown> {
  toModel(value: string): unknown {
    return value;
  }

  toValue(value: unknown): string {
    return splitTimestamp(value).nanos;
  }

  toFormat(value: unknown): string {
    return this.toValue(value);
  }
}

export const NANOS = new Nanos();
