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

import { ElementPart, noChange } from "lit";
import { Directive, directive, PartInfo } from "lit/directive.js";

import { Converter, TEXT } from "./converters";

export class Bind extends Directive {
  declare private readonly target: HTMLInputElement;

  #value: unknown = "";
  #converter: Converter<unknown> = TEXT;
  #key: unknown = undefined;
  #dirty = false;
  #focused = false;

  constructor(part: PartInfo) {
    super(part);
    this.target = (part as ElementPart).element as HTMLInputElement;
    this.target.addEventListener("input", this.handleInput);
    this.target.addEventListener("focus", this.handleFocus);
    this.target.addEventListener("blur", this.handleBlur);
  }

  private show() {
    this.target.value =
      this.#focused && !this.target.readOnly
        ? this.#converter.toValue(this.#value)
        : this.#converter.toFormat(this.#value);
  }

  handleInput = () => {
    this.#dirty = true;
  };

  handleFocus = () => {
    this.#focused = true;
    this.show();
  };

  handleBlur = () => {
    this.#focused = false;
    this.#dirty = false;
    this.show();
  };

  render(value: unknown, converter: Converter<unknown> = TEXT, key?: unknown) {
    const rebound = key !== this.#key;
    this.#key = key;
    this.#value = value;
    this.#converter = converter;
    if (rebound) this.#dirty = false;
    if (!this.#dirty) this.show();
    return noChange;
  }
}

export const bind = directive(Bind);

class Checked extends Directive {
  declare private readonly target: HTMLInputElement;

  constructor(part: PartInfo) {
    super(part);
    this.target = (part as ElementPart).element as HTMLInputElement;
  }

  render(value: unknown) {
    this.target.checked = !!value;
    return noChange;
  }
}

export const checked = directive(Checked);

class InputDefaults extends Directive {
  declare private readonly target: HTMLInputElement;

  constructor(part: PartInfo) {
    super(part);
    this.target = (part as ElementPart).element as HTMLInputElement;
  }

  render() {
    this.target.autocomplete = "off";
    this.target.spellcheck = false;
    this.target.setAttribute("autocorrect", "off");
    return noChange;
  }
}

export const inputDefaults = directive(InputDefaults);
