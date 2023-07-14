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

export class Debounce {
  private debounceEvent: {
    timeout?: NodeJS.Timeout;
    resolve?: (value: string | null) => void;
  } = {};

  private readonly timeout: number;

  constructor(options: { timeout: number } = { timeout: 300 }) {
    this.timeout = options.timeout;
  }

  public debounced(
    timeOverFunction: () => Promise<string | null>
  ): Promise<string | null> {
    if (this.debounceEvent.timeout) {
      this.debounceEvent.resolve!(null);
      clearTimeout(this.debounceEvent.timeout);
    }

    return new Promise<string | null>((resolve, reject) => {
      this.debounceEvent.resolve = resolve;

      this.debounceEvent.timeout = setTimeout(async () => {
        try {
          resolve(await timeOverFunction());
        } catch (e) {
          reject(e);
        } finally {
          this.debounceEvent.timeout = undefined;
          this.debounceEvent.resolve = undefined;
        }
      }, this.timeout);
    });
  }
}
