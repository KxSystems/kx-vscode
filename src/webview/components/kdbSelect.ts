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

import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { baseStyles } from "./baseStyles";
import { inputDefaults } from "../directives";

const PLACEHOLDER = "Select...";

export interface SelectOption {
  value: string;
  label?: string;
  group?: string;
  color?: string;
}

interface Entry {
  value: string;
  text: string;
  group: string;
  color: string;
}

const selectStyles = css`
  :host {
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
  }

  .select {
    position: relative;
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
  }

  /* The face wears the colours of a dropdown over the metrics of an input: a
     theme that colours the two differently would otherwise split a row holding
     both in half. */
  .select input {
    appearance: none;
    padding-right: 1.8em;
    line-height: normal;
    text-overflow: ellipsis;
    color: var(--vscode-dropdown-foreground, var(--vscode-input-foreground));
    background-color: var(
      --vscode-dropdown-background,
      var(--vscode-input-background)
    );
    border-color: var(
      --vscode-dropdown-border,
      var(--vscode-input-border, transparent)
    );
  }

  /* The caret is the wrapper's rather than the field's, drawn as a mask so it
     takes the text colour of whatever theme is on. */
  .select::after {
    content: "";
    position: absolute;
    right: 0.6em;
    top: 50%;
    width: 0.75em;
    height: 0.75em;
    transform: translateY(-50%);
    pointer-events: none;
    background-color: currentColor;
    mask: var(--chevron) center / contain no-repeat;
    -webkit-mask: var(--chevron) center / contain no-repeat;
  }

  /* Fixed rather than absolute: the form this sits in may be a scroll box, or
     a modal that carries a transform, and either would clip a popup laid out
     inside it. Where it goes is measured in place(). */
  .list {
    position: fixed;
    z-index: 10;
    max-height: 15em;
    overflow-y: auto;
    margin: 0;
    padding: 0.15em 0;
    list-style: none;
    color: var(--vscode-dropdown-foreground, var(--vscode-foreground));
    background-color: var(
      --vscode-dropdown-background,
      var(--vscode-editor-background)
    );
    border: 1px solid
      var(--vscode-dropdown-border, var(--vscode-panel-border, transparent));
    border-radius: 2px;
    box-shadow: 0 2px 8px var(--vscode-widget-shadow, transparent);
  }

  /* What holds the field together: nothing of its own where one value is
     picked, so the input keeps carrying the frame, and the frame itself where
     badges and the input share a line. */
  .box {
    display: contents;
  }

  .multi .box {
    display: flex;
    flex-flow: row wrap;
    align-items: center;
    flex: 1 1 auto;
    min-width: 0;
    gap: 0.25em;
    padding: 0.1em 1.8em 0.1em 0.2em;
    border: 1px solid
      var(--vscode-dropdown-border, var(--vscode-input-border, transparent));
    border-radius: 2px;
    background-color: var(
      --vscode-dropdown-background,
      var(--vscode-input-background)
    );
    cursor: text;
  }

  .multi .box:focus-within {
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: -1px;
  }

  .multi .box input {
    flex: 1 1 4em;
    width: auto;
    min-width: 4em;
    padding: 0.1em;
    border: none;
    background: none;
    outline: none;
  }

  /* Smaller and tighter than the text beside it, so a badge never reaches the
     height of the field it sits in: the field is the same height whether it
     holds badges or not. */
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3em;
    max-width: 100%;
    padding: 0 0.2em 0 0.4em;
    border-radius: 3px;
    font-size: 0.92em;
    line-height: 1.4;
    color: var(--vscode-badge-foreground);
    background-color: var(--vscode-badge-background);
  }

  .badge span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badge button {
    flex: 0 0 auto;
    padding: 0 0.2em;
    border: none;
    border-radius: 2px;
    color: inherit;
    background: none;
    line-height: 1;
  }

  .badge button:hover {
    background-color: var(--vscode-toolbar-hoverBackground, transparent);
  }

  .dot {
    flex: 0 0 auto;
    width: 0.6em;
    height: 0.6em;
    border-radius: 50%;
  }

  .option {
    display: flex;
    align-items: center;
    gap: 0.4em;
    padding: 0.2em 0.5em;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
  }

  .option .text {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tick {
    flex: 0 0 0.9em;
    text-align: center;
  }

  .option:hover {
    background-color: var(--vscode-list-hoverBackground, transparent);
  }

  .option.active {
    color: var(
      --vscode-list-activeSelectionForeground,
      var(--vscode-foreground)
    );
    background-color: var(
      --vscode-list-activeSelectionBackground,
      var(--vscode-focusBorder)
    );
  }

  .option.blank {
    color: var(--vscode-descriptionForeground);
  }

  .option.active.blank {
    color: var(
      --vscode-list-activeSelectionForeground,
      var(--vscode-foreground)
    );
  }

  .match {
    background: none;
    color: var(
      --vscode-list-highlightForeground,
      var(--vscode-textLink-foreground)
    );
    font-weight: 600;
  }

  .option.active .match {
    color: inherit;
  }

  .none {
    padding: 0.2em 0.5em;
    color: var(--vscode-descriptionForeground);
  }

  .group {
    padding: 0.3em 0.5em 0.1em;
    color: var(--vscode-descriptionForeground);
    font-weight: 600;
  }
`;

@customElement("kdb-select")
export class KdbSelect extends LitElement {
  static readonly styles = [baseStyles, selectStyles];

  static readonly shadowRootOptions = {
    ...LitElement.shadowRootOptions,
    delegatesFocus: true,
  };

  @property({ type: String }) value = "";
  @property({ attribute: false }) values: string[] = [];
  @property({ attribute: false }) options: (string | SelectOption)[] = [];
  @property({ type: String }) empty = "";
  @property({ type: String }) label = "";
  @property({ type: Boolean }) required = false;
  @property({ type: Boolean }) multiple = false;

  @state() open = false;
  @state() filter = "";
  @state() active = 0;

  chosen() {
    if (this.multiple) {
      return this.values;
    }
    return this.value ? [this.value] : [];
  }

  entries(): Entry[] {
    const given = this.options.map((option) =>
      typeof option === "string"
        ? { value: option, text: option, group: "", color: "" }
        : {
            value: option.value,
            text: option.label ?? option.value,
            group: option.group ?? "",
            color: option.color ?? "",
          },
    );

    const unlisted = this.chosen()
      .filter((held) => !given.some((entry) => entry.value === held))
      .map((held) => ({ value: held, text: held, group: "", color: "" }));

    const listed = [...unlisted, ...given];

    return !this.required && !this.multiple
      ? [
          { value: "", text: this.empty || PLACEHOLDER, group: "", color: "" },
          ...listed,
        ]
      : listed;
  }

  textOf(value: string) {
    if (!value) {
      return "";
    }
    return this.entries().find((entry) => entry.value === value)?.text ?? value;
  }

  filtered(): Entry[] {
    const entries = this.entries();
    const query = this.filter.trim().toLowerCase();

    if (!query) {
      return entries;
    }

    const groups = [...new Set(entries.map((entry) => entry.group))];
    const matched = entries
      .filter((entry) => entry.value)
      .map((entry) => ({ entry, at: entry.text.toLowerCase().indexOf(query) }))
      .filter((match) => match.at >= 0);

    matched.sort(
      (one, other) =>
        groups.indexOf(one.entry.group) - groups.indexOf(other.entry.group) ||
        Math.min(one.at, 1) - Math.min(other.at, 1),
    );

    return matched.map((match) => match.entry);
  }

  reveal() {
    this.filter = "";
    this.active = Math.max(
      this.entries().findIndex((entry) => entry.value === this.value),
      0,
    );
    this.open = true;
  }

  dismiss() {
    this.open = false;
    this.filter = "";
  }

  select(option: string) {
    if (this.multiple) {
      this.values = this.values.includes(option)
        ? this.values.filter((held) => held !== option)
        : [...this.values, option];
      this.report();
      return;
    }

    const changed = option !== this.value;
    this.value = option;
    this.dismiss();
    if (changed) {
      this.report();
    }
  }

  private report() {
    this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    this.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  }

  private handleInput = (event: Event) => {
    event.stopPropagation();
    this.filter = (event.target as HTMLInputElement).value;
    this.active = 0;
    this.open = true;
  };

  private handleClick = (event: Event) => {
    const input = this.renderRoot?.querySelector<HTMLInputElement>("input");
    if (input && event.target !== input) {
      input.focus();
    }
    if (!this.open) {
      this.reveal();
    }
  };

  private handleBlur = () => {
    this.dismiss();
  };

  handleKeydown = (event: KeyboardEvent) => {
    const items = this.filtered();

    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
        event.preventDefault();
        if (!this.open) {
          this.reveal();
        } else if (items.length) {
          const step = event.key === "ArrowDown" ? 1 : -1;
          this.active = (this.active + step + items.length) % items.length;
        }
        break;
      case "Home":
      case "End":
        if (this.open && items.length) {
          event.preventDefault();
          this.active = event.key === "Home" ? 0 : items.length - 1;
        }
        break;
      case "Enter":
        if (this.open) {
          event.preventDefault();
          if (this.active < items.length) {
            this.select(items[this.active].value);
          }
        }
        break;
      case "Escape":
        if (this.open) {
          event.preventDefault();
          event.stopPropagation();
          this.dismiss();
        }
        break;
      case "Backspace":
        if (this.multiple && !this.filter && this.values.length) {
          event.preventDefault();
          this.select(this.values[this.values.length - 1]);
        }
        break;
      case "Tab":
        this.dismiss();
        break;
    }
  };

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("scroll", this.reposition, true);
    window.addEventListener("resize", this.reposition);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("scroll", this.reposition, true);
    window.removeEventListener("resize", this.reposition);
  }

  private reposition = () => {
    if (this.open) {
      this.place();
    }
  };

  place() {
    const list = this.renderRoot?.querySelector<HTMLElement>(".list");
    if (!list) {
      return;
    }

    const rect = this.getBoundingClientRect();
    const em = parseFloat(getComputedStyle(this).fontSize) || 13;
    const room = window.innerHeight - rect.bottom;

    list.style.width = `${rect.width}px`;
    list.style.maxHeight = `${Math.max(
      Math.min(Math.max(room, rect.top) - em, 15 * em),
      4 * em,
    )}px`;

    const above = list.offsetHeight > room && rect.top > room;
    const top = above ? rect.top - list.offsetHeight - 2 : rect.bottom + 2;

    list.style.left = `${rect.left}px`;
    list.style.top = `${top}px`;

    const placed = list.getBoundingClientRect();
    list.style.left = `${2 * rect.left - placed.left}px`;
    list.style.top = `${2 * top - placed.top}px`;

    list
      .querySelector(`#option-${this.active}`)
      ?.scrollIntoView({ block: "nearest" });
  }

  updated() {
    const input = this.renderRoot?.querySelector<HTMLInputElement>("input");
    const text = this.open
      ? this.filter
      : this.multiple
        ? ""
        : this.textOf(this.value);
    if (input && input.value !== text) {
      input.value = text;
    }
    this.place();
  }

  renderLabel(text: string) {
    const query = this.filter.trim();
    const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;

    if (at < 0) {
      return html`${text}`;
    }

    return html`${text.slice(0, at)}<span class="match"
        >${text.slice(at, at + query.length)}</span
      >${text.slice(at + query.length)}`;
  }

  renderDot(color: string) {
    return color
      ? html`<span class="dot" style="background-color: ${color}"></span>`
      : html``;
  }

  renderBadges() {
    return this.values.map((held) => {
      const entry = this.entries().find((option) => option.value === held);
      const text = entry?.text ?? held;

      return html`
        <span class="badge" title="${text}">
          ${this.renderDot(entry?.color ?? "")}
          <span>${text}</span>
          <button
            aria-label="Remove ${text}"
            @mousedown="${(event: Event) => event.preventDefault()}"
            @click="${() => this.select(held)}">
            ✕
          </button>
        </span>
      `;
    });
  }

  renderOption(entry: Entry, index: number) {
    const blank = entry.value === "";
    const held = this.chosen().includes(entry.value);

    return html`
      <li
        id="option-${index}"
        class="option ${blank ? "blank" : ""} ${index === this.active
          ? "active"
          : ""}"
        role="option"
        title="${entry.text}"
        aria-selected="${held}"
        @click="${() => this.select(entry.value)}">
        ${this.multiple
          ? html`<span class="tick">${held ? "✓" : ""}</span>`
          : html``}
        ${this.renderDot(entry.color)}
        <span class="text"
          >${blank ? entry.text : this.renderLabel(entry.text)}</span
        >
      </li>
    `;
  }

  renderList() {
    if (!this.open) {
      return html``;
    }

    const items = this.filtered();
    let group = "";

    return html`
      <ul
        id="options"
        class="list"
        role="listbox"
        aria-multiselectable="${this.multiple}"
        @mousedown="${(event: Event) => event.preventDefault()}">
        ${items.length
          ? items.map((entry, index) => {
              const header =
                entry.group && entry.group !== group
                  ? html`<li class="group" role="presentation">
                      ${entry.group}
                    </li>`
                  : html``;
              group = entry.group;
              return html`${header}${this.renderOption(entry, index)}`;
            })
          : html`<li class="none">No matches</li>`}
      </ul>
    `;
  }

  render() {
    const text = this.multiple ? "" : this.textOf(this.value);
    const named = this.empty || PLACEHOLDER;
    const placeholder = this.multiple
      ? this.values.length
        ? ""
        : named
      : this.open
        ? text || named
        : named;

    return html`
      <span class="select ${this.multiple ? "multi" : ""}">
        <span class="box" @click="${this.handleClick}">
          ${this.multiple ? this.renderBadges() : html``}
          <input
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="options"
            aria-expanded="${this.open}"
            aria-activedescendant="${this.open ? `option-${this.active}` : ""}"
            aria-label="${this.label}"
            placeholder="${placeholder}"
            ${inputDefaults()}
            @input="${this.handleInput}"
            @blur="${this.handleBlur}"
            @keydown="${this.handleKeydown}" />
        </span>
        ${this.renderList()}
      </span>
    `;
  }
}
