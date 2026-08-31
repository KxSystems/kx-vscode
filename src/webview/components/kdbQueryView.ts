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

import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";

import { baseStyles } from "./baseStyles";
import { KdbSelect, SelectOption } from "./kdbSelect";
import { queryStyles } from "./queryStyles";
import { QueryCommand, QueryMessage } from "../../models/messages";
import {
  QueryDraft,
  QueryFile,
  applyDraft,
  createRow,
  isBuiltin,
  parseRows,
  parseValue,
  serializeRows,
  targetLabel,
  toDraft,
} from "../../models/query";
import {
  ParamFieldType,
  ParamSource,
  UDA,
  UDAParam,
  UDA_DISTINGUISHED_PARAMS,
  allowedEmptyRequiredTypes,
  allowedEmptyRequiredTypesStrings,
} from "../../models/uda";
import {
  LOCAL,
  NANOS,
  TEXT,
  joinTimestamp,
  splitTimestamp,
} from "../converters";
import { bind, checked, inputDefaults } from "../directives";

const CHANGE_DELAY = 200;

const ICON_CONNECTION = "\uebaa";
const ICON_RUN = "\ueb2c";
const ICON_POPULATE = "\uebac";
const ICON_REFRESH = "\ueb37";
const ICON_SAVE = "\ueb4b";
const ICON_TRASH = "\uea81";

@customElement("kdb-query-view")
export class KdbQueryView extends LitElement {
  static readonly styles = [baseStyles, queryStyles];

  readonly vscode = acquireVsCodeApi();

  queries: UDA[] = [];
  query: UDA | undefined = undefined;
  tables: { [table: string]: string[] } = {};
  targets: string[] = [];
  private editing = new Map<string, string[][]>();
  private drafts: QueryDraft[] = [];
  isMetaLoaded = false;
  selectedServer = "";

  private pending = 0;

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("message", this.message);
  }

  disconnectedCallback() {
    window.removeEventListener("message", this.message);
    super.disconnectedCallback();
  }

  message = (event: MessageEvent<QueryMessage>) => {
    const msg = event.data;
    if (msg.command === QueryCommand.Update) {
      this.queries = msg.queries;
      this.tables = msg.tables || {};
      this.targets = msg.targets || [];
      this.isMetaLoaded = msg.isMetaLoaded;
      this.selectedServer = msg.selectedServer;
      // The stored query gets the same treatment as one picked from the
      // dropdown. A .kxquery is user-editable JSON, and a converted datasource
      // carries whatever its .kdb.json held, so `params` may be absent
      // altogether or list none of the distinguished ones.
      const stored = msg.file.query;
      this.query =
        !stored || isBuiltin(stored)
          ? stored
          : this.withDistinguishedParams(stored);
      this.drafts = msg.file.drafts || [];
      this.editing.clear();
      this.requestUpdate();
    }
  };

  get file(): QueryFile {
    const file: QueryFile = { version: 1, query: this.query };
    if (this.drafts.length > 0) {
      file.drafts = this.drafts;
    }
    return file;
  }

  postMessage(msg: Partial<QueryMessage>) {
    /* c8 ignore start */
    this.vscode.postMessage(msg);
    /* c8 ignore stop */
  }

  requestChange() {
    this.requestUpdate();
    window.clearTimeout(this.pending);
    this.pending = window.setTimeout(() => this.flushChange(), CHANGE_DELAY);
  }

  flushChange() {
    window.clearTimeout(this.pending);
    this.pending = 0;
    this.postMessage({ command: QueryCommand.Change, file: this.file });
  }

  save() {
    this.flushChange();
    this.postMessage({ command: QueryCommand.Save, file: this.file });
  }

  refresh() {
    this.postMessage({
      command: QueryCommand.Refresh,
      selectedServer: this.selectedServer,
    });
  }

  run() {
    this.flushChange();
    this.postMessage({
      command: QueryCommand.Run,
      selectedServer: this.selectedServer,
      file: this.file,
    });
  }

  populateScratchpad() {
    this.flushChange();
    this.postMessage({
      command: QueryCommand.Populate,
      selectedServer: this.selectedServer,
      file: this.file,
    });
  }

  pickConnection() {
    this.postMessage({ command: QueryCommand.Connection });
  }

  handleQueryChange(event: Event) {
    const name = (event.target as HTMLInputElement).value.trim();
    if (!name) {
      if (this.query) {
        this.stashDraft();
        this.query = undefined;
        this.editing.clear();
        this.requestChange();
      }
      return;
    }
    const selected = this.queries.find((query) => query.name === name);
    if (!selected || selected.name === this.query?.name) {
      return;
    }
    this.stashDraft();
    const query = structuredClone(selected);
    this.query = isBuiltin(query) ? query : this.withDistinguishedParams(query);
    const draft = this.takeDraft(name);
    if (draft) {
      applyDraft(this.query, draft);
    }
    this.editing.clear();
    this.requestChange();
  }

  /** The API being left keeps what was entered for it. */
  private stashDraft() {
    const draft = toDraft(this.query);
    const others = this.drafts.filter((item) => item.name !== this.query?.name);
    this.drafts = draft ? [...others, draft] : others;
  }

  /** The arriving API's values, which from now on live in `query`. */
  private takeDraft(name: string) {
    const draft = this.drafts.find((item) => item.name === name);
    if (draft) {
      this.drafts = this.drafts.filter((item) => item !== draft);
    }
    return draft;
  }

  withDistinguishedParams(uda: UDA) {
    if (!uda.params) {
      uda.params = [];
    }
    for (const distinguished of UDA_DISTINGUISHED_PARAMS) {
      if (!uda.params.some((param) => param.name === distinguished.name)) {
        uda.params.push({ ...distinguished });
      }
    }
    return uda;
  }

  handleAddParam(event: Event) {
    const select = event.target as KdbSelect;
    const param = this.query?.params.find((item) => item.name === select.value);
    select.value = "";
    if (!param) {
      return;
    }
    if (param.rows) {
      const rows = param.isVisible ? this.rowsOf(param) : [];
      rows.push(createRow(param));
      param.isVisible = true;
      this.setRows(param, rows);
      return;
    }
    param.isVisible = true;
    this.requestChange();
  }

  handleDeleteParam(param: UDAParam) {
    param.isVisible = false;
    param.value = undefined;
    param.selectedMultiTypeString = undefined;
    this.requestChange();
  }

  setParam(param: UDAParam, value: unknown) {
    param.value = value;
    this.requestChange();
  }

  setTimestamp(param: UDAParam, local: string, nanos: string) {
    param.value = joinTimestamp(local, nanos);
    this.requestChange();
  }

  isRequired(param: UDAParam) {
    if (!param.isReq) {
      return false;
    }
    if (param.fieldType === ParamFieldType.MultiType) {
      return !allowedEmptyRequiredTypesStrings.includes(
        param.selectedMultiTypeString || "",
      );
    }
    if (param.name === "table") {
      return true;
    }
    const types = Array.isArray(param.type) ? param.type : [param.type];
    return !types.some((type) => allowedEmptyRequiredTypes.includes(type));
  }

  paramHelp(param: UDAParam, type = param.typeStrings?.[0]) {
    const parts = [];
    if (param.isDistinguised) {
      parts.push("Distinguished");
    }
    if (type) {
      parts.push(`Type: ${type}`);
    }
    if (param.description) {
      parts.push(param.description);
    }
    return parts.join(" | ");
  }

  paramLabel(param: UDAParam) {
    return param.name + (this.isRequired(param) ? " *" : "");
  }

  placeholder(name: string, source?: ParamSource) {
    if (source === "columns" && this.suggestions(source).length === 0) {
      return "Select a table first...";
    }
    return `Select ${/^[aeiou]/i.test(name) ? "an" : "a"} ${name}...`;
  }

  visibleParams() {
    return this.query?.params.filter((param) => param.isVisible) || [];
  }

  hiddenParams(distinguished: boolean) {
    return (
      this.query?.params.filter(
        (param) =>
          !param.isReq &&
          (!param.isVisible || !!param.rows) &&
          !!param.isDistinguised === distinguished,
      ) || []
    );
  }

  renderIcon(glyph: string) {
    return html`<span class="codicon" aria-hidden="true">${glyph}</span>`;
  }

  renderQueryPicker() {
    const known = this.queries.some((query) => query.name === this.query?.name);
    const status =
      this.query && !known
        ? "This API is not available on the selected connection."
        : this.isMetaLoaded
          ? `${this.queries.length} API${this.queries.length === 1 ? "" : "s"} available on this connection.`
          : "Connect to a server environment to access its UDAs. getData, qSQL and SQL are always available.";

    return html`
      <label class="field">
        <span class="label">API</span>
        ${this.renderSelect(
          this.query?.name || "",
          this.queries.map((query) => query.name),
          this.handleQueryChange,
          this.placeholder("API"),
          "API",
        )}
        <small class="help">${status}</small>
      </label>
    `;
  }

  renderSelect(
    value: string,
    options: (string | SelectOption)[],
    handler: (event: Event) => void,
    empty = "",
    label = "",
  ) {
    return html`
      <kdb-select
        value="${value}"
        empty="${empty}"
        label="${label}"
        .options="${options}"
        @input="${handler}"></kdb-select>
    `;
  }

  suggestions(source: ParamSource): (string | SelectOption)[] {
    if (source === "targets") {
      return this.targets.map((target) => ({
        value: target,
        label: targetLabel(target),
      }));
    }

    if (source === "tables") {
      return Object.keys(this.tables).sort();
    }

    // Only the table chosen has columns to offer, and until one is chosen
    // there are none. The parameter holding it is the one drawing on the table
    // list rather than the one called `table`, so a UDA naming it `tablename`
    // narrows its columns the same way getData does.
    const table = this.query?.params.find(
      (param) => param.source === "tables" && !!param.value,
    )?.value;
    const named = table ? this.tables[String(table)] : undefined;

    return named ? [...named].sort() : [];
  }

  renderQueryDetails() {
    if (!this.query) {
      return html``;
    }
    const returns = this.query.return;
    const type = Array.isArray(returns?.type)
      ? returns?.type.join(", ")
      : returns?.type;

    return html`
      <div class="details">
        ${this.query.description
          ? html`<div>${this.query.description}</div>`
          : html``}
        ${returns?.description
          ? html`<div>Return description: ${returns.description}</div>`
          : html``}
        ${type ? html`<div>Return type: ${type}</div>` : html``}
      </div>
    `;
  }

  renderParams() {
    if (!this.query) {
      return html``;
    }
    if (this.query.incompatibleError !== undefined) {
      return html`
        <p class="notice warning">
          <strong>Invalid parameters</strong><br />
          The UDA you have selected cannot be queried because it has required
          fields with types that are not supported.
        </p>
      `;
    }

    const visible = this.visibleParams();

    return html`
      <div class="params">
        <strong class="label">PARAMETERS</strong>
        ${visible.length
          ? repeat(
              visible,
              (param) => param.name,
              (param) => this.renderParam(param),
            )
          : html`
              <p class="notice">
                <strong>No parameters</strong><br />
                There are no required parameters in this UDA.
              </p>
            `}
        ${this.renderAddParam()}
      </div>
    `;
  }

  renderAddParam() {
    const optional = this.hiddenParams(false);
    const distinguished = this.hiddenParams(true);

    if (!optional.length && !distinguished.length) {
      return html``;
    }

    const grouped = (params: UDAParam[], group: string) =>
      params.map((param) => ({ value: param.name, group }));

    return html`
      <kdb-select
        class="add-param"
        value=""
        empty="+ Add parameter"
        label="Add parameter"
        required
        .options="${[
          ...grouped(optional, "Optional parameters"),
          ...grouped(distinguished, "Distinguished parameters"),
        ]}"
        @input="${this.handleAddParam}"></kdb-select>
    `;
  }

  renderParam(param: UDAParam) {
    if (param.rows) {
      return this.renderRows(param);
    }
    if (param.multiple) {
      return this.renderChoices(param);
    }
    if (param.choices || param.source) {
      return this.renderChoice(param);
    }
    switch (param.fieldType) {
      case ParamFieldType.Boolean:
        return this.renderCheckbox(param);
      case ParamFieldType.JSON:
        return this.renderTextarea(param);
      case ParamFieldType.Code:
        return this.renderTextarea(
          param,
          this.paramHelp(param),
          param.name === "query" ? 10 : 4,
          true,
        );
      case ParamFieldType.Timestamp:
        return this.renderTimestamp(param);
      case ParamFieldType.MultiType:
        return this.renderMultitype(param);
      case ParamFieldType.Number:
        return this.renderInput(param, "number");
      default:
        return this.renderInput(param, "text");
    }
  }

  rowsOf(param: UDAParam) {
    let rows = this.editing.get(param.name);
    if (!rows) {
      rows = parseRows(param);
      if (rows.length === 0) {
        rows.push(createRow(param));
      }
      this.editing.set(param.name, rows);
    }
    return rows;
  }

  setRows(param: UDAParam, rows: string[][]) {
    this.editing.set(param.name, rows);
    param.value = serializeRows(param, rows);
    this.requestChange();
  }

  removeRow(param: UDAParam, index: number) {
    const rows = this.rowsOf(param).filter((_, at) => at !== index);
    if (rows.length === 0) {
      this.editing.delete(param.name);
      this.handleDeleteParam(param);
      return;
    }
    this.setRows(param, rows);
  }

  renderRows(param: UDAParam) {
    const fields = param.rows || [];
    const rows = this.rowsOf(param);

    return html`
      <div class="param rows">
        <div class="field">
          <span class="label">${this.paramLabel(param)}</span>
          ${repeat(
            rows,
            (_, index) => `${param.name}-${index}`,
            (row, index) => html`
              <span class="row control">
                ${fields.map((field, column) =>
                  field.choices || field.source
                    ? this.renderSelect(
                        row[column] || "",
                        field.choices ||
                          this.suggestions(field.source as ParamSource),
                        (event: Event) => {
                          row[column] = (event.target as KdbSelect).value;
                          this.setRows(param, rows);
                        },
                        this.placeholder(field.name, field.source),
                        field.name,
                      )
                    : html`
                        <input
                          type="text"
                          class="row-field"
                          placeholder="${field.name}"
                          ${inputDefaults()}
                          ${bind(
                            row[column] || "",
                            TEXT,
                            `${param.name}-${index}-${column}`,
                          )}
                          @input="${(event: Event) => {
                            row[column] = (
                              event.target as HTMLInputElement
                            ).value;
                            this.setRows(param, rows);
                          }}" />
                      `,
                )}
                <button
                  class="remove"
                  title="Remove this ${param.name}"
                  @click="${() => this.removeRow(param, index)}">
                  ${this.renderIcon(ICON_TRASH)}
                </button>
              </span>
            `,
          )}
          <small class="help">${this.paramHelp(param)}</small>
        </div>
      </div>
    `;
  }

  /**
   * A parameter holding several of the choices at once. The value is stored as
   * the JSON list the request wants, so what the badges show and what goes over
   * the wire are the same thing.
   */
  renderChoices(param: UDAParam) {
    const options =
      param.choices || (param.source ? this.suggestions(param.source) : []);
    const held = parseValue(param.value);
    const values = Array.isArray(held) ? held.map(String) : [];

    return html`
      <div class="param">
        <div class="field">
          <span class="label">${this.paramLabel(param)}</span>
          <span class="row control">
            <kdb-select
              multiple
              label="${this.paramLabel(param)}"
              empty="${this.placeholder(param.name, param.source)}"
              .values="${values}"
              .options="${options}"
              @input="${(event: Event) => {
                const chosen = (event.target as KdbSelect).values;
                this.setParam(
                  param,
                  chosen.length === 0 ? undefined : JSON.stringify(chosen),
                );
              }}"></kdb-select>
            ${this.renderRemove(param)}
          </span>
          <small class="help">${this.paramHelp(param)}</small>
        </div>
      </div>
    `;
  }

  /*
   * A choice parameter sits in a div rather than a label, the way renderRows
   * does. A label forwards its click to its first labelable descendant, and
   * kdb-select is a custom element that does not qualify — so the click carried
   * on to the remove button beside it and deleted the parameter the moment its
   * dropdown was opened. The visible name stays in .label and the control keeps
   * its own aria-label, so nothing is lost by not being a label.
   */
  renderChoice(param: UDAParam) {
    const value = String(param.value ?? param.default ?? "");
    const options =
      param.choices || (param.source ? this.suggestions(param.source) : []);

    return html`
      <div class="param">
        <div class="field">
          <span class="label">${this.paramLabel(param)}</span>
          <span class="row control">
            ${this.renderSelect(
              value,
              options,
              (event: Event) =>
                this.setParam(param, (event.target as KdbSelect).value),
              this.placeholder(param.name, param.source),
              this.paramLabel(param),
            )}
            ${this.renderRemove(param)}
          </span>
          <small class="help">${this.paramHelp(param)}</small>
        </div>
      </div>
    `;
  }

  renderRemove(param: UDAParam) {
    if (param.isReq) {
      return html``;
    }
    return html`
      <button
        class="remove"
        title="Remove ${param.name}"
        @click="${() => this.handleDeleteParam(param)}">
        ${this.renderIcon(ICON_TRASH)}
      </button>
    `;
  }

  renderInput(param: UDAParam, type: string, help = this.paramHelp(param)) {
    return html`
      <div class="param">
        <label class="field">
          <span class="label">${this.paramLabel(param)}</span>
          <span class="row control">
            <input
              type="${type}"
              ${inputDefaults()}
              ${bind(param.value ?? param.default ?? "", TEXT, param.name)}
              @input="${(event: Event) =>
                this.setParam(
                  param,
                  TEXT.toModel((event.target as HTMLInputElement).value),
                )}" />
            ${this.renderRemove(param)}
          </span>
          <small class="help">${help}</small>
        </label>
      </div>
    `;
  }

  renderTextarea(
    param: UDAParam,
    help = this.paramHelp(param),
    rows = 3,
    code = false,
  ) {
    return html`
      <div class="param">
        <label class="field">
          <span class="label">${this.paramLabel(param)}</span>
          <span class="row control">
            <textarea
              class="${code ? "code" : ""}"
              rows="${rows}"
              ${inputDefaults()}
              ${bind(param.value ?? param.default ?? "", TEXT, param.name)}
              @input="${(event: Event) =>
                this.setParam(
                  param,
                  TEXT.toModel((event.target as HTMLTextAreaElement).value),
                )}"></textarea>
            ${this.renderRemove(param)}
          </span>
          <small class="help">${help}</small>
        </label>
      </div>
    `;
  }

  renderCheckbox(param: UDAParam, help = this.paramHelp(param)) {
    return html`
      <div class="param">
        <label class="field">
          <span class="row control">
            <span class="label checkbox">
              <input
                type="checkbox"
                ${checked(param.value ?? param.default)}
                @input="${(event: Event) =>
                  this.setParam(
                    param,
                    (event.target as HTMLInputElement).checked,
                  )}" />
              ${this.paramLabel(param)}
            </span>
            ${this.renderRemove(param)}
          </span>
          <small class="help">${help}</small>
        </label>
      </div>
    `;
  }

  renderTimestamp(param: UDAParam, help = this.paramHelp(param)) {
    return html`
      <div class="param">
        <label class="field">
          <span class="label">${this.paramLabel(param)}</span>
          <span class="row control">
            <input
              type="datetime-local"
              step="1"
              ${inputDefaults()}
              ${bind(param.value ?? param.default ?? "", LOCAL, param.name)}
              @input="${(event: Event) =>
                this.setTimestamp(
                  param,
                  (event.target as HTMLInputElement).value,
                  splitTimestamp(param.value).nanos,
                )}" />
            <input
              type="text"
              class="nanos"
              maxlength="9"
              title="Nanoseconds"
              ${inputDefaults()}
              ${bind(param.value ?? param.default ?? "", NANOS, param.name)}
              @input="${(event: Event) =>
                this.setTimestamp(
                  param,
                  splitTimestamp(param.value).local,
                  (event.target as HTMLInputElement).value,
                )}" />
            ${this.renderRemove(param)}
          </span>
          <small class="help">${help}</small>
        </label>
      </div>
    `;
  }

  renderMultitype(param: UDAParam) {
    if (!param.selectedMultiTypeString) {
      param.selectedMultiTypeString = param.typeStrings?.[0] || "";
    }
    const selected = param.selectedMultiTypeString;
    const fieldType = param.multiFieldTypes?.find(
      (type) => Object.keys(type)[0] === selected,
    );
    const help = this.paramHelp(param, selected);

    return html`
      <div class="multitype">
        <label class="field types">
          <span class="label">${this.paramLabel(param)} type</span>
          <kdb-select
            value="${selected}"
            label="${`${this.paramLabel(param)} type`}"
            required
            .options="${param.typeStrings || []}"
            @input="${(event: Event) => {
              param.selectedMultiTypeString = (event.target as KdbSelect).value;
              param.value = undefined;
              this.requestChange();
            }}"></kdb-select>
          ${selected && selected !== param.typeStrings?.[0]
            ? html`
                <small class="help warn">
                  Run Query reads this as ${param.typeStrings?.[0]}${": "}the
                  service gateway casts to the first type a UDA registers.
                  Populate Scratchpad reads it as ${selected}.
                </small>
              `
            : html``}
        </label>
        ${this.renderParamOfType(
          param,
          help,
          fieldType ? Object.values(fieldType)[0] : ParamFieldType.Text,
        )}
      </div>
    `;
  }

  renderParamOfType(param: UDAParam, help: string, fieldType: ParamFieldType) {
    switch (fieldType) {
      case ParamFieldType.Boolean:
        return this.renderCheckbox(param, help);
      case ParamFieldType.JSON:
        return this.renderTextarea(param, help);
      case ParamFieldType.Timestamp:
        return this.renderTimestamp(param, help);
      case ParamFieldType.Number:
        return this.renderInput(param, "number", help);
      default:
        return this.renderInput(param, "text", help);
    }
  }

  renderToolbar() {
    return html`
      <button class="tool" @click="${this.pickConnection}">
        ${this.renderIcon(ICON_CONNECTION)} Connection
      </button>
      <span class="separator"></span>
      <button class="tool" @click="${this.run}">
        ${this.renderIcon(ICON_RUN)} Run
      </button>
      <button class="tool" @click="${this.populateScratchpad}">
        ${this.renderIcon(ICON_POPULATE)} Populate Scratchpad
      </button>
      <span class="separator"></span>
      <button class="tool" @click="${this.refresh}">
        ${this.renderIcon(ICON_REFRESH)} Refresh
      </button>
      <button class="tool" @click="${this.save}">
        ${this.renderIcon(ICON_SAVE)} Save
      </button>
    `;
  }

  render() {
    return html`
      <div class="container">
        <div class="toolbar">${this.renderToolbar()}</div>
        <div class="form">
          ${this.renderQueryPicker()} ${this.renderQueryDetails()}
          ${this.renderParams()}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "kdb-query-view": KdbQueryView;
  }
}
