/*
 * Copyright (c) 1998-2025 KX Systems Inc.
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

/* eslint @typescript-eslint/no-explicit-any: 0 */
/* eslint @typescript-eslint/no-empty-function: 0 */

global.window = <any>{
  addEventListener() {},
  removeEventListener() {},
};

const vsCodeApi = <any>{
  getState() {},
  setState() {},
  postMessage() {},
};

global.acquireVsCodeApi = function () {
  return vsCodeApi;
};

export class LitElement {
  connectedCallback() {}
  disconnectedCallback() {}
  requestUpdate() {}
}
export function html(strings: any, ...values: unknown[]) {
  return { strings, values };
}
export function css(strings: any, ...values: unknown[]) {
  return { strings, values };
}
export function customElement() {}
export function state() {}
export function repeat(items: Iterable<any>, keyFn: any, template: any) {
  for (const item of items) {
    keyFn(item);
    if (template) {
      template(item);
    }
  }
}
export function live(param: any) {
  return param;
}
