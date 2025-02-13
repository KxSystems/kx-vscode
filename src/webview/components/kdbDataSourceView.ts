/*
 * Copyright (c) 1998-2025 Kx Systems Inc.
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
import { repeat } from "lit/directives/repeat.js";
import { live } from "lit/directives/live.js";
import { customElement } from "lit/decorators.js";
import {
  Agg,
  DataSourceFiles,
  DataSourceTypes,
  Filter,
  Group,
  Label,
  Sort,
  aggOperators,
  createAgg,
  createFilter,
  createGroup,
  createLabel,
  createSort,
  filterOperators,
} from "../../models/dataSource";
import { MetaObjectPayload } from "../../models/meta";
import { DataSourceCommand, DataSourceMessage2 } from "../../models/messages";
import { dataSourceStyles, shoelaceStyles } from "./styles";
import { UDA } from "../../models/uda";

const MAX_RULES = 32;

@customElement("kdb-data-source-view")
export class KdbDataSourceView extends LitElement {
  static styles = [shoelaceStyles, dataSourceStyles];

  readonly vscode = acquireVsCodeApi();
  declare private debounce;

  isInsights = false;
  isMetaLoaded = false;
  insightsMeta = <MetaObjectPayload>{};
  UDAs = <UDA[]>[];
  selectedType = DataSourceTypes.API;
  selectedApi = "";
  selectedTable = "";
  startTS = "";
  rowLimitCount = "100000";
  isRowLimitLast = true;
  rowLimit = false;
  selectedServerVersion = 0;
  endTS = "";
  fill = "";
  filled = false;
  temporality = "";
  temporal = false;
  filters = [createFilter()];
  labels = [createLabel()];
  sorts = [createSort()];
  aggs = [createAgg()];
  groups = [createGroup()];
  qsqlTarget = "";
  qsql = "";
  sql = "";
  savedUDA: UDA | undefined = undefined;
  userSelectedUDA: UDA | undefined = undefined;
  selectedUDA: string = "";
  running = false;
  servers: string[] = [];
  selectedServer = "";
  updating = 0;

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("message", this.message);
  }

  disconnectedCallback() {
    window.removeEventListener("message", this.message);
    super.disconnectedCallback();
  }

  message = (event: MessageEvent<DataSourceMessage2>) => {
    const msg = event.data;
    if (msg.command === DataSourceCommand.Update) {
      this.servers = msg.servers;
      this.selectedServer = msg.selectedServer;
      this.selectedServerVersion = msg.selectedServerVersion
        ? msg.selectedServerVersion
        : 0;
      this.isInsights = msg.isInsights;
      this.isMetaLoaded = !!msg.insightsMeta.dap;
      this.insightsMeta = msg.insightsMeta;
      this.UDAs = msg.UDAs;
      const ds = msg.dataSourceFile;
      this.selectedType = ds.dataSource.selectedType;
      this.selectedApi = ds.dataSource.api.selectedApi;
      this.selectedTable = ds.dataSource.api.table;
      this.startTS = ds.dataSource.api.startTS;
      this.endTS = ds.dataSource.api.endTS;
      this.fill = ds.dataSource.api.fill;
      this.rowLimitCount = ds.dataSource.api.rowCountLimit
        ? ds.dataSource.api.rowCountLimit
        : "100000";
      this.isRowLimitLast = ds.dataSource.api.isRowLimitLast !== false;
      this.temporality = ds.dataSource.api.temporality;
      const optional = ds.dataSource.api.optional;
      if (optional) {
        this.filled = optional.filled;
        this.temporal = optional.temporal;
        this.filters = optional.filters;
        this.labels = optional.labels;
        this.sorts = optional.sorts;
        this.aggs = optional.aggs;
        this.groups = optional.groups;
        this.rowLimit = optional.rowLimit ? optional.rowLimit : false;
      }
      this.qsqlTarget = ds.dataSource.qsql.selectedTarget;
      this.qsql = ds.dataSource.qsql.query;
      this.sql = ds.dataSource.sql.query;
      // for the UDAs, it will optional for this moment
      this.savedUDA = ds.dataSource.uda;
      this.userSelectedUDA = this.savedUDA;
      this.selectedUDA = this.savedUDA ? this.savedUDA.name : "";
      this.requestUpdate();
    }
  };

  get data(): DataSourceFiles {
    return {
      name: "",
      originalName: "",
      dataSource: {
        selectedType: this.selectedType,
        api: {
          selectedApi: this.selectedApi,
          table: this.selectedTable,
          startTS: this.startTS,
          endTS: this.endTS,
          fill: this.fill,
          rowCountLimit: this.rowLimitCount,
          isRowLimitLast: this.isRowLimitLast,
          temporality: this.temporality,
          filter: [],
          groupBy: [],
          agg: [],
          sortCols: [],
          slice: [],
          labels: [],
          optional: {
            filled: this.filled,
            temporal: this.temporal,
            filters: this.filters,
            labels: this.labels,
            sorts: this.sorts,
            aggs: this.aggs,
            groups: this.groups,
            rowLimit: this.rowLimit,
          },
        },
        qsql: {
          query: this.qsql,
          selectedTarget: this.qsqlTarget,
        },
        sql: {
          query: this.sql,
        },
        uda: this.userSelectedUDA,
      },
    };
  }

  /* istanbul ignore next */
  postMessage(msg: Partial<DataSourceMessage2>) {
    this.vscode.postMessage(msg);
  }

  save() {
    this.postMessage({
      command: DataSourceCommand.Save,
      dataSourceFile: this.data,
    });
  }

  refresh() {
    this.postMessage({
      command: DataSourceCommand.Refresh,
      selectedServer: this.selectedServer,
    });
  }

  run() {
    this.postMessage({
      command: DataSourceCommand.Run,
      selectedServer: this.selectedServer,
      dataSourceFile: this.data,
    });
  }

  populateScratchpad() {
    this.postMessage({
      command: DataSourceCommand.Populate,
      selectedServer: this.selectedServer,
      dataSourceFile: this.data,
    });
  }

  requestChange() {
    this.requestUpdate();
    this.postMessage({
      command: DataSourceCommand.Change,
      dataSourceFile: this.data,
    });
  }

  requestServerChange(event: Event) {
    this.selectedServer = (event.target as HTMLSelectElement).value;
    this.requestUpdate();
    this.postMessage({
      command: DataSourceCommand.Server,
      selectedServer: this.selectedServer,
    });
  }

  renderRowCountOptions() {
    const compareVersions = (v1: string, v2: string) =>
      v1
        .split(".")
        .map(Number)
        .reduce((acc, num, i) => acc || num - Number(v2.split(".")[i] || 0), 0);

    if (compareVersions(this.selectedServerVersion.toString(), "1.11") >= 0) {
      return html`
        <div class="row align-bottom">
          <sl-checkbox
            .checked="${this.rowLimit}"
            @sl-change="${(event: Event) => {
              this.rowLimit = (event.target as HTMLInputElement).checked;
              this.requestChange();
            }}"></sl-checkbox>

          <sl-input
            type="number"
            label="Row Limit"
            .value="${live(this.rowLimitCount)}"
            @input="${(event: Event) => {
              this.rowLimitCount = (event.target as HTMLInputElement).value;
              this.requestChange();
            }}"></sl-input>

          <sl-radio-group
            .value="${live(this.isRowLimitLast ? "last" : "first")}"
            @sl-change="${(event: Event) => {
              const value = (event.target as HTMLInputElement).value;
              this.isRowLimitLast = value === "last";
              this.requestChange();
            }}">
            <sl-radio-button value="first">First</sl-radio-button>
            <sl-radio-button value="last">Last</sl-radio-button>
          </sl-radio-group>
        </div>
      `;
    } else {
      this.rowLimit = false;
      this.rowLimitCount = "100000";
      this.isRowLimitLast = true;
    }
  }

  renderApiOptions() {
    if (this.isInsights && this.isMetaLoaded) {
      return this.insightsMeta.api
        .filter(
          (api) =>
            (api.api === ".kxi.getData" || !api.api.startsWith(".kxi.")) &&
            api.custom === false,
        )
        .map((api) => {
          const value =
            api.api === ".kxi.getData" ? api.api.replace(".kxi.", "") : api.api;
          return html`
            <sl-option value="${value}" ?disabled="${value !== "getData"}"
              >${value}</sl-option
            >
          `;
        });
    }
    return [];
  }

  renderTableOptions() {
    if (this.isInsights && this.isMetaLoaded) {
      return this.insightsMeta.assembly.flatMap((assembly) =>
        assembly.tbls.map(
          (value) => html` <sl-option value="${value}">${value}</sl-option> `,
        ),
      );
    }
    return [];
  }

  renderColumnOptions() {
    if (this.isInsights && this.isMetaLoaded) {
      const schema = this.insightsMeta.schema;
      if (schema) {
        const found = schema.find((item) => item.table === this.selectedTable);
        if (found) {
          return found.columns.map(
            ({ column }) => html`
              <sl-option value="${column}">${column}</sl-option>
            `,
          );
        }
      }
    }
    return [];
  }

  renderTargetOptions() {
    if (this.isInsights && this.isMetaLoaded) {
      return this.insightsMeta.dap.map((dap) => {
        const value = `${dap.assembly}-qe ${dap.instance}`;
        if (!this.qsqlTarget) {
          this.qsqlTarget = value;
        }
        return html`<sl-option value="${encodeURIComponent(value)}"
          >${value}</sl-option
        >`;
      });
    }
    return [];
  }

  renderFilter(filter: Filter) {
    return html`
      <div class="row align-bottom">
        <sl-checkbox
          .checked="${filter.active}"
          @sl-change="${(event: Event) => {
            filter.active = (event.target as HTMLInputElement).checked;
            this.requestChange();
          }}"></sl-checkbox>
        <sl-select
          .value="${live(filter.column)}"
          label="${this.filters.indexOf(filter) === 0
            ? "Filter By Column"
            : ""}"
          @sl-change="${(event: Event) => {
            filter.column = (event.target as HTMLInputElement).value;
            this.requestChange();
          }}">
          <sl-option .value="${live(filter.column)}" .selected="${live(true)}"
            >${filter.column || "(none)"}</sl-option
          >
          <small
            >${this.isMetaLoaded ? "Meta Columns" : "Meta Not Loaded"}</small
          >
          ${this.renderColumnOptions()}
        </sl-select>
        <sl-select
          .value=${live(filter.operator)}
          label="${this.filters.indexOf(filter) === 0 ? "Apply Function" : ""}"
          @sl-change="${(event: Event) => {
            filter.operator = (event.target as HTMLInputElement).value;
            this.requestChange();
          }}">
          <sl-option .value=${live(filter.operator)} .selected="${live(true)}"
            >${filter.operator || "(none)"}</sl-option
          >
          <small>Operators</small>
          ${filterOperators.map(
            (operator) =>
              html`<sl-option value="${operator}">${operator}</sl-option>`,
          )}
        </sl-select>
        <sl-input
          label="${this.filters.indexOf(filter) === 0 ? "Set Parameter" : ""}"
          .value="${live(filter.values)}"
          @input="${(event: Event) => {
            filter.values = (event.target as HTMLInputElement).value;
            this.requestChange();
          }}"></sl-input>
        <sl-button-group>
          <sl-button
            variant="neutral"
            aria-label="Add Filter"
            appearance="secondary"
            @click="${() => {
              if (this.filters.length < MAX_RULES) {
                const index = this.filters.indexOf(filter);
                this.filters.splice(index + 1, 0, createFilter());
                this.requestChange();
              }
            }}"
            >+</sl-button
          >
          <sl-button
            variant="neutral"
            aria-label="Remove Filter"
            @click="${() => {
              if (this.filters.length > 0) {
                const index = this.filters.indexOf(filter);
                this.filters.splice(index, 1);
                if (this.filters.length === 0) {
                  this.filters.push(createFilter());
                }
                this.requestChange();
              }
            }}"
            >-</sl-button
          >
        </sl-button-group>
      </div>
    `;
  }

  renderLabel(label: Label) {
    return html`
      <div class="row align-bottom">
        <sl-checkbox
          .checked="${label.active}"
          @sl-change="${(event: Event) => {
            label.active = (event.target as HTMLInputElement).checked;
            this.requestChange();
          }}"></sl-checkbox>
        <sl-input
          label="${this.labels.indexOf(label) === 0 ? "Filter By Label" : ""}"
          .value="${live(label.key)}"
          @input="${(event: Event) => {
            label.key = (event.target as HTMLInputElement).value;
            this.requestChange();
          }}"></sl-input>
        <sl-input
          label="${this.labels.indexOf(label) === 0 ? "Value" : ""}"
          .value="${live(label.value)}"
          @input="${(event: Event) => {
            label.value = (event.target as HTMLInputElement).value;
            this.requestChange();
          }}"></sl-input>
        <sl-button-group>
          <sl-button
            variant="neutral"
            aria-label="Add Label"
            @click="${() => {
              if (this.labels.length < MAX_RULES) {
                const index = this.labels.indexOf(label);
                this.labels.splice(index + 1, 0, createLabel());
                this.requestChange();
              }
            }}"
            >+</sl-button
          >
          <sl-button
            variant="neutral"
            aria-label="Remove Label"
            @click="${() => {
              if (this.labels.length > 0) {
                const index = this.labels.indexOf(label);
                this.labels.splice(index, 1);
                if (this.labels.length === 0) {
                  this.labels.push(createLabel());
                }
                this.requestChange();
              }
            }}"
            >-</sl-button
          >
        </sl-button-group>
      </div>
    `;
  }

  renderSort(sort: Sort) {
    return html`
      <div class="row align-bottom">
        <sl-checkbox
          .checked="${sort.active}"
          @sl-change="${(event: Event) => {
            sort.active = (event.target as HTMLInputElement).checked;
            this.requestChange();
          }}"></sl-checkbox>
        <sl-select
          .value="${live(sort.column)}"
          label="${this.sorts.indexOf(sort) === 0 ? "Sort By" : ""}"
          @sl-change="${(event: Event) => {
            sort.column = (event.target as HTMLInputElement).value;
            this.requestChange();
          }}">
          <sl-option .value="${live(sort.column)}" .selected="${live(true)}"
            >${sort.column || "(none)"}</sl-option
          >
          <small
            >${this.isMetaLoaded ? "Meta Columns" : "Meta Not Loaded"}</small
          >
          ${this.renderColumnOptions()}
        </sl-select>
        <sl-button-group>
          <sl-button
            variant="neutral"
            aria-label="Add Sort By"
            @click="${() => {
              if (this.sorts.length < MAX_RULES) {
                const index = this.sorts.indexOf(sort);
                this.sorts.splice(index + 1, 0, createSort());
                this.requestChange();
              }
            }}"
            >+</sl-button
          >
          <sl-button
            variant="neutral"
            aria-label="Remove Sort By"
            @click="${() => {
              if (this.sorts.length > 0) {
                const index = this.sorts.indexOf(sort);
                this.sorts.splice(index, 1);
                if (this.sorts.length === 0) {
                  this.sorts.push(createSort());
                }
                this.requestChange();
              }
            }}"
            >-</sl-button
          >
        </sl-button-group>
      </div>
    `;
  }

  renderAgg(agg: Agg) {
    return html`
      <div class="row align-bottom">
        <sl-checkbox
          .checked="${agg.active}"
          @sl-change="${(event: Event) => {
            agg.active = (event.target as HTMLInputElement).checked;
            this.requestChange();
          }}"></sl-checkbox>
        <sl-input
          label="${this.aggs.indexOf(agg) === 0
            ? "Define Output Aggregate"
            : ""}"
          .value="${live(agg.key)}"
          @input="${(event: Event) => {
            agg.key = (event.target as HTMLInputElement).value;
            this.requestChange();
          }}"></sl-input>
        <sl-select
          .value="${live(agg.operator)}"
          label="${this.aggs.indexOf(agg) === 0 ? "Choose Aggregation" : ""}"
          @sl-change="${(event: Event) => {
            agg.operator = (event.target as HTMLInputElement).value;
            this.requestChange();
          }}">
          <sl-option .value="${live(agg.operator)}" .selected="${live(true)}"
            >${agg.operator || "(none)"}</sl-option
          >
          <small>Operators</small>
          ${aggOperators.map(
            (operator) =>
              html`<sl-option value="${operator}">${operator}</sl-option>`,
          )}
        </sl-select>
        <sl-select
          .value="${live(agg.column)}"
          label="${this.aggs.indexOf(agg) === 0 ? "By Column" : ""}"
          @sl-change="${(event: Event) => {
            agg.column = (event.target as HTMLInputElement).value;
            this.requestChange();
          }}">
          <sl-option .value="${live(agg.column)}" .selected="${live(true)}"
            >${agg.column || "(none)"}</sl-option
          >
          <small
            >${this.isMetaLoaded ? "Meta Columns" : "Meta Not Loaded"}</small
          >
          ${this.renderColumnOptions()}
        </sl-select>
        <sl-button-group>
          <sl-button
            variant="neutral"
            aria-label="Add Aggregation"
            @click="${() => {
              if (this.aggs.length < MAX_RULES) {
                const index = this.aggs.indexOf(agg);
                this.aggs.splice(index + 1, 0, createAgg());
                this.requestChange();
              }
            }}"
            >+</sl-button
          >
          <sl-button
            variant="neutral"
            aria-label="Remove Aggregation"
            @click="${() => {
              if (this.aggs.length > 0) {
                const index = this.aggs.indexOf(agg);
                this.aggs.splice(index, 1);
                if (this.aggs.length === 0) {
                  this.aggs.push(createAgg());
                }
                this.requestChange();
              }
            }}"
            >-</sl-button
          >
        </sl-button-group>
      </div>
    `;
  }

  renderGroup(group: Group) {
    return html`
      <div class="row align-bottom">
        <sl-checkbox
          .checked="${group.active}"
          @sl-change="${(event: Event) => {
            group.active = (event.target as HTMLInputElement).checked;
            this.requestChange();
          }}"></sl-checkbox>
        <sl-select
          .value="${live(group.column)}"
          label="${this.groups.indexOf(group) === 0
            ? "Group Aggregation By"
            : ""}"
          @sl-change="${(event: Event) => {
            group.column = (event.target as HTMLInputElement).value;
            this.requestChange();
          }}">
          <sl-option .value="${live(group.column)}" .selected="${live(true)}"
            >${group.column || "(none)"}</sl-option
          >
          <small
            >${this.isMetaLoaded ? "Meta Columns" : "Meta Not Loaded"}</small
          >
          ${this.renderColumnOptions()}
        </sl-select>
        <sl-button-group>
          <sl-button
            variant="neutral"
            aria-label="Add Group By"
            @click="${() => {
              if (this.groups.length < MAX_RULES) {
                const index = this.groups.indexOf(group);
                this.groups.splice(index + 1, 0, createGroup());
                this.requestChange();
              }
            }}"
            >+</sl-button
          >
          <sl-button
            variant="neutral"
            aria-label="Remove Group By"
            @click="${() => {
              if (this.groups.length > 0) {
                const index = this.groups.indexOf(group);
                this.groups.splice(index, 1);
                if (this.groups.length === 0) {
                  this.groups.push(createGroup());
                }
                this.requestChange();
              }
            }}"
            >-</sl-button
          >
        </sl-button-group>
      </div>
    `;
  }

  renderAPI() {
    return html`
      <div class="col">
        <div class="row">
          <sl-select
            label="Select API"
            .value="${live(this.selectedApi)}"
            @sl-change="${(event: Event) => {
              this.selectedApi = (event.target as HTMLInputElement).value;
              this.requestChange();
            }}">
            <sl-option
              .value="${live(this.selectedApi)}"
              .selected="${live(true)}"
              >${this.selectedApi || "(none)"}</sl-option
            >
            <small
              >${this.isMetaLoaded ? "Meta APIs" : "Meta Not Loaded"}</small
            >
            ${this.renderApiOptions()}
          </sl-select>

          <sl-select
            label="Table"
            .value="${live(this.selectedTable)}"
            @sl-change="${(event: Event) => {
              this.selectedTable = (event.target as HTMLSelectElement).value;
              this.requestChange();
            }}">
            <sl-option
              .value="${live(this.selectedTable)}"
              .selected="${live(true)}"
              >${this.selectedTable || "(none)"}</sl-option
            >
            <small
              >${this.isMetaLoaded ? "Meta Tables" : "Meta Not Loaded"}</small
            >
            ${this.renderTableOptions()}
          </sl-select>
        </div>

        <div class="row">
          <sl-input
            label="Start Time"
            type="datetime-local"
            .value="${live(this.startTS)}"
            @input="${(event: Event) => {
              this.startTS = (event.target as HTMLSelectElement).value;
              this.requestChange();
            }}">
          </sl-input>

          <sl-input
            label="End Time"
            type="datetime-local"
            class="text-field larger"
            .value="${live(this.endTS)}"
            @input="${(event: Event) => {
              this.endTS = (event.target as HTMLSelectElement).value;
              this.requestChange();
            }}"></sl-input>
        </div>
        ${this.renderRowCountOptions()}
        <div class="row align-bottom">
          <sl-checkbox
            .checked="${this.filled}"
            @sl-change="${(event: Event) => {
              this.filled = (event.target as HTMLInputElement).checked;
              this.requestChange();
            }}"></sl-checkbox>
          <sl-select
            label="Fill"
            @sl-change="${(event: Event) => {
              this.fill = (event.target as HTMLSelectElement).value;
              this.requestChange();
            }}">
            <sl-option .value="${live(this.fill)}" .selected="${live(true)}"
              >${this.fill || "(none)"}</sl-option
            >
            <small>Options</small>
            <sl-option value="zero">zero</sl-option>
            <sl-option value="forward">forward</sl-option>
          </sl-select>
        </div>

        <div class="row align-bottom">
          <sl-checkbox
            .checked="${this.temporal}"
            @sl-change="${(event: Event) => {
              this.temporal = (event.target as HTMLInputElement).checked;
              this.requestChange();
            }}"></sl-checkbox>

          <sl-select
            label="Temporality"
            .value="${live(this.temporality)}"
            @sl-change="${(event: Event) => {
              this.temporality = (event.target as HTMLSelectElement).value;
              this.requestChange();
            }}">
            <sl-option
              .value="${live(this.temporality)}"
              .selected="${live(true)}"
              >${this.temporality || "(none)"}</sl-option
            >
            <small>Options</small>
            <sl-option value="snapshot">snapshot</sl-option>
            <sl-option value="slice">slice</sl-option>
          </sl-select>
        </div>

        <div class="col">
          ${repeat(
            this.filters,
            (filter) => filter,
            (filter) => this.renderFilter(filter),
          )}
        </div>
        <div class="col">
          ${repeat(
            this.labels,
            (label) => label,
            (label) => this.renderLabel(label),
          )}
        </div>
        <div class="col">
          ${repeat(
            this.sorts,
            (sort) => sort,
            (sort) => this.renderSort(sort),
          )}
        </div>
        <div class="col">
          ${repeat(
            this.aggs,
            (agg) => agg,
            (agg) => this.renderAgg(agg),
          )}
        </div>
        <div class="col">
          ${repeat(
            this.groups,
            (group) => group,
            (group) => this.renderGroup(group),
          )}
        </div>
      </div>
    `;
  }

  renderQSQL() {
    return html`
      <div class="col">
        <sl-select
          label="Target"
          .value="${live(encodeURIComponent(this.qsqlTarget))}"
          @sl-change="${(event: Event) => {
            this.qsqlTarget = decodeURIComponent(
              (event.target as HTMLSelectElement).value,
            );
            this.requestChange();
          }}">
          <sl-option
            .value="${live(encodeURIComponent(this.qsqlTarget))}"
            .selected="${live(true)}"
            >${this.qsqlTarget || "(none)"}</sl-option
          >
          <small
            >${this.isMetaLoaded ? "Meta Targets" : "Meta Not Loaded"}</small
          >
          ${this.renderTargetOptions()}
        </sl-select>
        <sl-textarea
          label="Query"
          rows="16"
          .value="${live(this.qsql)}"
          @input="${(event: Event) => {
            this.qsql = (event.target as HTMLSelectElement).value;
            this.requestChange();
          }}"></sl-textarea>
      </div>
    `;
  }

  renderSQL() {
    return html`
      <sl-textarea
        label="Query"
        rows="16"
        .value="${live(this.sql)}"
        @input="${(event: Event) => {
          this.sql = (event.target as HTMLSelectElement).value;
          this.requestChange();
        }}">
      </sl-textarea>
    `;
  }

  renderUDA() {
    return html`
      <div class="col">
        <sl-select
          label="User Defined Analytic (UDA)"
          .value="${live(encodeURIComponent(this.selectedUDA))}"
          style="max-width: 100%"
          search
          @sl-change="${(event: Event) => {
            this.selectedUDA = decodeURIComponent(
              (event.target as HTMLSelectElement).value,
            );
            this.userSelectedUDA = this.UDAs.find(
              (uda) => uda.name === this.selectedUDA,
            );
            this.requestChange();
          }}">
          <sl-option
            .value="${live(encodeURIComponent(this.selectedUDA))}"
            .selected="${live(true)}"
            >${this.selectedUDA || "Select a UDA..."}</sl-option
          >
          ${this.userSelectedUDA
            ? html`<small>${this.userSelectedUDA.description}</small>`
            : ""}
          <small>${this.isMetaLoaded ? "Meta UDAs" : "Meta Not Loaded"}</small>
          ${this.renderUDAOptions()}
        </sl-select>
        ${this.renderUDADetails()} ${this.renderUDAParams()}
      </div>
    `;
  }

  renderUDAOptions() {
    if (this.isInsights && this.isMetaLoaded) {
      const udaOptions = this.UDAs.map((uda) => {
        return html`
          <sl-option value="${uda.name}">${uda.name}</sl-option>
          <small>${uda.description}</small>
        `;
      });
      if (udaOptions.length === 0) {
        udaOptions.push(
          html`<sl-option value="" disabled
            >No deployed UDAs available</sl-option
          >`,
        );
      }
      return udaOptions;
    }
    return [];
  }

  renderUDADetails() {
    const UDADetails = [];
    if (this.userSelectedUDA) {
      if (this.userSelectedUDA.description) {
        UDADetails.push(html`${this.userSelectedUDA.description}<br />`);
      }
      if (this.userSelectedUDA.return) {
        UDADetails.push(
          html`Return Description: ${this.userSelectedUDA.return.description}<br />Return
            Type: ${this.userSelectedUDA.return.type}<br /> `,
        );
      }
    }
    if (UDADetails.length !== 0) {
      return html`<small>${UDADetails}</small>`;
    }
    return UDADetails;
  }

  renderUDAParams() {
    const UDAParams = [];
    if (this.userSelectedUDA) {
      UDAParams.push(html`<strong>PARAMETERS:</strong>`);
      const UDAReqParams = this.renderReqUDAParams();
      const UDANoParams = this.renderUDANoParams();
      const UDAInvalidParams = this.renderUDAInvalidParams();
      if (UDAInvalidParams !== "") {
        UDAParams.push(UDAInvalidParams);
      } else {
        if (UDAReqParams.length > 0) {
          UDAParams.push(UDAReqParams);
        } else {
          UDAParams.push(UDANoParams);
        }
      }
    }

    return UDAParams;
  }

  renderReqUDAParams() {
    const UDAParamsList = [];
    if (this.userSelectedUDA) {
      const UDAReqParams = this.userSelectedUDA.params.filter(
        (param) => param.isReq === true,
      );
      if (UDAReqParams.length > 0) {
        for (const param of UDAReqParams) {
          UDAParamsList.push(html`
            <sl-input
              label="${param.name}"
              .helpText="${param.description}"
              .value="${live(
                param.value ? param.value : param.default ? param.default : "",
              )}"
              @input="${(event: Event) => {
                param.value = (event.target as HTMLInputElement).value;
                this.requestChange();
              }}"></sl-input>
          `);
        }
      }
    }
    return UDAParamsList;
  }

  renderUDAInvalidParams() {
    if (this.userSelectedUDA) {
      if (this.userSelectedUDA.incompatibleError !== undefined) {
        return html`
          <sl-alert variant="warning" open>
            <sl-icon slot="icon" name="exclamation-triangle"></sl-icon>
            <strong>Invalid Parameters</strong><br />
            The UDA you have selected cannot be queried because it has required
            fields with types that are not supported.
          </sl-alert>
        `;
      }
    }
    return "";
  }

  renderUDANoParams() {
    return html`
      <sl-alert variant="primary" open>
        <sl-icon slot="icon" name="info-circle"></sl-icon>
        <strong>No Parameters</strong><br />
        There are no required parameters in this UDA.
      </sl-alert>
    `;
  }

  renderTabGroup() {
    return html`
      <sl-tab-group>
        <sl-tab
          slot="nav"
          panel="${DataSourceTypes.API}"
          ?active="${live(this.selectedType === DataSourceTypes.API)}"
          @click="${() => {
            this.selectedType = DataSourceTypes.API;
            this.requestChange();
          }}"
          >API</sl-tab
        >
        <sl-tab
          slot="nav"
          panel="${DataSourceTypes.QSQL}"
          ?active="${live(this.selectedType === DataSourceTypes.QSQL)}"
          @click="${() => {
            this.selectedType = DataSourceTypes.QSQL;
            this.requestChange();
          }}"
          >QSQL</sl-tab
        >
        <sl-tab
          slot="nav"
          panel="${DataSourceTypes.SQL}"
          ?active="${live(this.selectedType === DataSourceTypes.SQL)}"
          @click="${() => {
            this.selectedType = DataSourceTypes.SQL;
            this.requestChange();
          }}"
          >SQL</sl-tab
        >
        <sl-tab
          slot="nav"
          panel="${DataSourceTypes.UDA}"
          ?active="${live(this.selectedType === DataSourceTypes.UDA)}"
          @click="${() => {
            this.selectedType = DataSourceTypes.UDA;
            this.requestChange();
          }}"
          >UDA</sl-tab
        >
        <sl-tab-panel
          name="${DataSourceTypes.API}"
          ?active="${live(this.selectedType === DataSourceTypes.API)}"
          >${this.renderAPI()}</sl-tab-panel
        >
        <sl-tab-panel
          name="${DataSourceTypes.QSQL}"
          ?active="${live(this.selectedType === DataSourceTypes.QSQL)}"
          >${this.renderQSQL()}</sl-tab-panel
        >
        <sl-tab-panel
          name="${DataSourceTypes.SQL}"
          ?active="${live(this.selectedType === DataSourceTypes.SQL)}"
          >${this.renderSQL()}</sl-tab-panel
        >
        <sl-tab-panel
          name="${DataSourceTypes.UDA}"
          ?active="${live(this.selectedType === DataSourceTypes.UDA)}"
          >${this.renderUDA()}</sl-tab-panel
        >
      </sl-tab-group>
    `;
  }

  renderActions() {
    const selectedServerExists = this.servers.includes(this.selectedServer);
    if (!selectedServerExists) {
      this.selectedServer = "";
    }
    return html`
      <sl-select
        label="Connection"
        .value="${live(this.selectedServer)}"
        @sl-change="${this.requestServerChange}"
        ?disabled="${this.running}">
        ${!selectedServerExists
          ? html`<sl-option .value="${live("")}" .selected="${live(true)}"
              >(none)</sl-option
            >`
          : html`<sl-option
              .value="${live(this.selectedServer)}"
              .selected="${live(true)}"
              >${this.selectedServer}</sl-option
            >`}
        <small>Connections</small>
        ${this.servers.map(
          (server) => html`
            <sl-option value="${server}">${server}</sl-option>
          `,
        )}
      </sl-select>
      <sl-button-group>
        <sl-button variant="primary" class="grow" @click="${this.save}"
          >Save</sl-button
        >
        <sl-button
          variant="neutral"
          @click="${this.refresh}"
          ?disabled="${this.running}"
          >Refresh</sl-button
        >
      </sl-button-group>
      <sl-button
        variant="neutral"
        @click="${this.run}"
        ?disabled="${this.running}"
        >Run</sl-button
      >
      <sl-button
        variant="neutral"
        @click="${this.populateScratchpad}"
        ?disabled="${this.running}"
        >Populate Scratchpad</sl-button
      >
    `;
  }

  render() {
    return html`
      <div class="container">
        <div class="tabs">${this.renderTabGroup()}</div>
        <div class="actions">${this.renderActions()}</div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "kdb-data-source-view": KdbDataSourceView;
  }
}
