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

import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import { repeat } from "lit/directives/repeat.js";

import { dataSourceStyles, kdbStyles, shoelaceStyles } from "./styles";
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
import { DataSourceCommand, DataSourceMessage2 } from "../../models/messages";
import { MetaObjectPayload } from "../../models/meta";
import { ParamFieldType, UDA, UDAParam } from "../../models/uda";
import "./custom-fields/date-time-nano-picker";
import { normalizeAssemblyTarget } from "../../utils/shared";

const MAX_RULES = 32;
const UDA_DISTINGUISED_PARAMS: UDAParam[] = [
  {
    name: "table",
    description: "Table to target.",
    isReq: false,
    type: [-11],
    typeStrings: ["Symbol"],
    isVisible: false,
    fieldType: ParamFieldType.Text,
    isDistinguised: true,
  },
  {
    name: "labels",
    description: "A dictionary describing DAP labels to target,",
    isReq: false,
    type: [99],
    typeStrings: ["Dictionary"],
    isVisible: false,
    fieldType: ParamFieldType.JSON,
    isDistinguised: true,
  },
  {
    name: "scope",
    description: "A dictionary describing what RC and/or DAPs to target.",
    isReq: false,
    type: [99],
    typeStrings: ["Dictionary"],
    fieldType: ParamFieldType.JSON,
    isDistinguised: true,
  },
  {
    name: "startTS",
    description: "Inclusive start time of the request.",
    isReq: false,
    type: [-19],
    typeStrings: ["Time"],
    isVisible: false,
    fieldType: ParamFieldType.Timestamp,
    isDistinguised: true,
  },
  {
    name: "endTS",
    description: "Exclusive end time of the request.",
    isReq: false,
    type: [-19],
    typeStrings: ["Time"],
    isVisible: false,
    fieldType: ParamFieldType.Timestamp,
    isDistinguised: true,
  },
  {
    name: "inputTZ",
    description: "Timezone of startTS and endTS (default: UTC).teste",
    isReq: false,
    type: [-11],
    typeStrings: ["Symbol"],
    isVisible: false,
    fieldType: ParamFieldType.Text,
    isDistinguised: true,
  },
  {
    name: "outputTZ",
    description:
      "Timezone of the final result (.kxi.getData only). No effect on routing.",
    isReq: false,
    type: [-11],
    typeStrings: ["Symbol"],
    isVisible: false,
    fieldType: ParamFieldType.Text,
    isDistinguised: true,
  },
];
const allowedEmptyRequiredTypes = [10, -11];
const allowedEmptyRequiredTypesStrings = ["Symbol", "String"];

@customElement("kdb-data-source-view")
export class KdbDataSourceView extends LitElement {
  static readonly styles = [shoelaceStyles, dataSourceStyles, kdbStyles];

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
      this.qsqlTarget = normalizeAssemblyTarget(
        ds.dataSource.qsql.selectedTarget,
      );
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

  renderExclamationTriangleIcon() {
    return html`<svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -3 24 24"
      fill="currentColor"
      width="15"
      height="15">
      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
    </svg>`;
  }

  renderInfoCircleIcon() {
    return html`
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 -3 24 24"
        fill="currentColor"
        width="15"
        height="15">
        <path
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-6h2v6zm0-8h-2V7h2v4z" />
      </svg>
    `;
  }

  renderTrashIcon() {
    return html`
      <svg
        width="15"
        height="15"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg">
        <g clip-path="url(#clip0_2116_1576)">
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M4.51657 2.06511C4.51657 1.78618 4.83134 1.37064 5.45829 1.37064H10.5417C11.1718 1.37064 11.4834 1.77971 11.4834 2.06511V3.4449C11.4834 3.50487 11.4911 3.56303 11.5056 3.61847H4.49439C4.50887 3.56303 4.51657 3.50487 4.51657 3.4449V2.06511ZM3.16733 3.61847C3.15285 3.56303 3.14515 3.50487 3.14515 3.4449V2.06511C3.14515 0.827196 4.29324 0 5.45829 0H10.5417C11.7036 0 12.8549 0.815392 12.8549 2.06511V3.4449C12.8549 3.50487 12.8471 3.56303 12.8327 3.61847H15.3143C15.693 3.61847 16 3.9253 16 4.30379C16 4.68228 15.693 4.98911 15.3143 4.98911H14.3726V13.9349C14.3726 15.1728 13.2245 16 12.0594 16H3.93143C2.76953 16 1.61829 15.1846 1.61829 13.9349V4.98911H0.685714C0.307005 4.98911 0 4.68228 0 4.30379C0 3.9253 0.307005 3.61847 0.685714 3.61847H2.31314H3.16733ZM2.98972 4.98911V13.9349C2.98972 14.2203 3.30133 14.6294 3.93143 14.6294H12.0594C12.6864 14.6294 13.0011 14.2138 13.0011 13.9349V4.98911H2.98972ZM6.37257 7.06337C6.75128 7.06337 7.05829 7.3702 7.05829 7.74869V11.8789C7.05829 12.2574 6.75128 12.5642 6.37257 12.5642C5.99386 12.5642 5.68686 12.2574 5.68686 11.8789V7.74869C5.68686 7.3702 5.99386 7.06337 6.37257 7.06337ZM10.3131 7.74869C10.3131 7.3702 10.0061 7.06337 9.62743 7.06337C9.24872 7.06337 8.94171 7.3702 8.94171 7.74869V11.8789C8.94171 12.2574 9.24872 12.5642 9.62743 12.5642C10.0061 12.5642 10.3131 12.2574 10.3131 11.8789V7.74869Z"
            fill="currentColor" />
        </g>
        <defs>
          <clipPath id="clip0_2116_1576">
            <rect width="16" height="16" fill="currentColor" />
          </clipPath>
        </defs>
      </svg>
    `;
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
    const isBaseVersionGreaterOrEqual = (v1: string, v2: string) =>
      v1
        .split(".")
        .map(Number)
        .reduce((acc, num, i) => acc || num - Number(v2.split(".")[i] || 0), 0);

    if (
      isBaseVersionGreaterOrEqual(
        this.selectedServerVersion.toString(),
        "1.11",
      ) >= 0
    ) {
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
        const value = `${dap.assembly} ${dap.instance}`;
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

  getSavedUDAStatus(): string {
    return this.UDAs.some((uda) => uda.name === this.selectedUDA)
      ? "Available UDAs"
      : "Pre-selected UDA is not available for this connection.";
  }

  renderUDA() {
    return html`
      <div class="col width-80-pct">
        <sl-select
          label="User Defined Analytic (UDA)"
          .value="${live(encodeURIComponent(this.selectedUDA))}"
          class="reset-widths-limit width-97-pct"
          search
          @sl-change="${this.handleUDAChange}">
          <sl-option
            .value="${live(encodeURIComponent(this.selectedUDA))}"
            .selected="${live(true)}"
            >${this.selectedUDA || "Select a UDA..."}</sl-option
          >
          ${this.userSelectedUDA
            ? html`<small>${this.userSelectedUDA.description}</small>`
            : ""}
          <small>
            ${this.isMetaLoaded
              ? this.getSavedUDAStatus()
              : "Connect to a server environment to access the available UDAs."}
          </small>
          ${this.renderUDAOptions()}
        </sl-select>
        ${this.renderUDADetails()} ${this.renderUDAParams()}
      </div>
    `;
  }

  handleUDAChange(event: Event) {
    this.selectedUDA = decodeURIComponent(
      (event.target as HTMLSelectElement).value,
    );
    this.userSelectedUDA = this.UDAs.find(
      (uda) => uda.name === this.selectedUDA,
    );
    if (this.userSelectedUDA) {
      UDA_DISTINGUISED_PARAMS.forEach((distinguishedParam) => {
        const exists = this.userSelectedUDA?.params.some(
          (param) => param.name === distinguishedParam.name,
        );
        if (!exists) {
          if (this.userSelectedUDA?.params) {
            this.userSelectedUDA.params.push({ ...distinguishedParam });
          }
        }
      });
    }
    this.requestChange();
  }

  renderUDAOptions() {
    if (!this.isInsights || !this.isMetaLoaded) return [];

    const udaOptions = this.UDAs.map(
      (uda) => html`
        <sl-option value="${uda.name}">${uda.name}</sl-option>
        <small>${uda.description}</small>
      `,
    );

    if (udaOptions.length === 0) {
      udaOptions.push(html`
        <sl-option value="" disabled>No deployed UDAs available</sl-option>
      `);
    }

    return udaOptions;
  }

  renderUDADetails() {
    if (!this.userSelectedUDA) return [];

    const details = [];
    if (this.userSelectedUDA.description) {
      details.push(html`${this.userSelectedUDA.description}<br />`);
    }
    if (this.userSelectedUDA.return) {
      const returnType = Array.isArray(this.userSelectedUDA.return.type)
        ? this.userSelectedUDA.return.type.join(", ")
        : this.userSelectedUDA.return.type;
      details.push(html`
        Return Description: ${this.userSelectedUDA.return.description}<br />
        Return Type: ${returnType}<br />
      `);
    }

    return details.length ? html`<small>${details}</small>` : details;
  }

  renderUDAParams() {
    if (!this.userSelectedUDA) return [];

    const params = [html`<strong>PARAMETERS:</strong>`];
    const visibleParams = this.renderVisibleUDAParams();
    const noParams = this.renderUDANoParams();
    const invalidParams = this.renderUDAInvalidParams();
    const addParamsBtn = this.renderUDAAddParamButton();

    if (invalidParams) {
      params.push(invalidParams);
    } else {
      params.push(
        ...(visibleParams.length ? visibleParams : [noParams]),
        ...[addParamsBtn],
      );
    }

    return params;
  }

  renderUDAAddParamButton() {
    return html`
      <div class="width-98-pct">
        <sl-dropdown
          class="udaDropdown width-30-pct"
          @sl-select="${this.handleUDAAddParamSelect}">
          <sl-button slot="trigger" variant="neutral">
            + Add Parameter
          </sl-button>
          ${this.renderUDAAddParamBtnOptions()}
        </sl-dropdown>
      </div>
    `;
  }

  handleUDAAddParamSelect(event: any) {
    const paramSelected = event.detail.item.value;
    const param = this.userSelectedUDA?.params.find(
      (param) => param.name === paramSelected,
    );
    if (param) {
      param.isVisible = true;
    }
    this.requestChange();
  }

  renderUDAAddParamBtnOptions() {
    return html`
      <sl-menu class="width-100-pct">
        ${this.renderUDAOptionalParamsOpts()}
      </sl-menu>
    `;
  }

  renderUDAOptionalParamsOpts() {
    if (!this.userSelectedUDA) {
      return html`
        <sl-menu-item disabled>No optional parameters available</sl-menu-item>
      `;
    }

    const optParamTxtHtml = html`
      <small class="btn-opt-text"><strong>OPTIONAL PARAMETERS:</strong></small>
    `;
    const distParamTxtHtml = html`
      <small class="btn-opt-text"
        ><strong>DISTINGUISHED PARAMETERS:</strong></small
      >
    `;

    const optionalParams = this.userSelectedUDA.params.filter(
      (param) => !param.isReq && !param.isDistinguised,
    );

    const filteredDistinguisedParam = this.userSelectedUDA.params.filter(
      (param) => !param.isReq && param.isDistinguised,
    );

    const renderParams = (params: any[]) =>
      params.map(
        (param: {
          isVisible: unknown;
          name: unknown;
          description: unknown;
        }) => html`
          <sl-menu-item
            .type=${param.isVisible ? "checkbox" : "normal"}
            .disabled=${!!param.isVisible}
            .value=${param.name as string}>
            ${param.name}<br /><small>${param.description}</small>
          </sl-menu-item>
        `,
      );

    const optionalParamsHtml = [
      optParamTxtHtml,
      ...(optionalParams.length
        ? renderParams(optionalParams)
        : [
            html`<sl-menu-item disabled
              >No optional parameters available</sl-menu-item
            >`,
          ]),
    ];

    if (filteredDistinguisedParam.length > 0) {
      optionalParamsHtml.push(
        html`<hr class="btn-opt-divider" />`,
        distParamTxtHtml,
        ...renderParams(filteredDistinguisedParam),
      );
    }

    return optionalParamsHtml;
  }

  renderDeleteUDAParamButton(param: UDAParam) {
    if (param.isReq) return;

    return html`
      <sl-button
        variant="neutral"
        class="float-left remove-param-btn"
        @click="${() => this.handleUDADeleteParam(param)}">
        ${this.renderTrashIcon()}
      </sl-button>
    `;
  }

  handleUDADeleteParam(param: UDAParam) {
    param.isVisible = false;
    param.value = undefined;
    param.selectedMultiTypeString = undefined;
    this.requestChange();
  }

  retrieveUDAParamInputType(type: string | undefined) {
    const inputTypes: { [key: string]: string } = {
      number: "number",
      boolean: "checkbox",
      timestamp: "datetime-local",
      json: "textarea",
      multitype: "multitype",
      text: "text",
    };
    return inputTypes[type ?? "text"] || "text";
  }

  renderVisibleUDAParams() {
    if (!this.userSelectedUDA) return [];

    return this.userSelectedUDA.params
      .filter((param) => param.isVisible)
      .map((param) =>
        this.renderUDAParam(
          param,
          this.retrieveUDAParamInputType(param.fieldType),
        ),
      );
  }

  renderUDAParam(param: UDAParam, inputType: string) {
    switch (inputType) {
      case "checkbox":
        return this.renderUDACheckbox(param);
      case "textarea":
        return this.renderUDATextarea(param);
      case "multitype":
        return this.renderUDAMultitype(param);
      default:
        return this.renderUDAInput(param, inputType);
    }
  }

  renderUDACheckbox(param: UDAParam) {
    const isChecked = param.value || param.default || false;
    const isReq = param.isReq ? "*" : "";
    const isDistinguised = param.isDistinguised ? "Distinguished | " : "";
    const typeString = param.typeStrings?.[0]
      ? "Type: " + param.typeStrings[0] + " | "
      : "";
    const description =
      param.description !== "" ? "Description: " + param.description : "";
    const helpText = isDistinguised + typeString + description;
    return html`
      <div class="opt-param-field">
        <sl-checkbox
          .helpText="${helpText}"
          @sl-change="${(event: Event) => {
            param.value = (event.target as HTMLInputElement).checked;
            this.requestChange();
          }}"
          .checked="${live(isChecked)}">
          ${param.name + isReq}
        </sl-checkbox>
        ${this.renderDeleteUDAParamButton(param)}
      </div>
    `;
  }

  renderUDATextarea(param: UDAParam) {
    const value = param.value || param.default || "";
    const isReq = param.isReq ? "*" : "";
    const isDistinguised = param.isDistinguised ? "Distinguished | " : "";
    const typeString = param.typeStrings?.[0]
      ? "Type: " + param.typeStrings[0] + " | "
      : "";
    const description =
      param.description !== "" ? "Description: " + param.description : "";
    const helpText = isDistinguised + typeString + description;
    return html`
      <div class="opt-param-field">
        <sl-textarea
          label="${param.name + isReq}"
          .helpText="${helpText}"
          .className="${param.isReq
            ? "width-97-pct"
            : "width-90-pct"} float-left"
          .value="${live(value)}"
          @input="${(event: Event) => {
            param.value = (event.target as HTMLTextAreaElement).value;
            this.requestChange();
          }}">
        </sl-textarea>
        ${this.renderDeleteUDAParamButton(param)}
      </div>
    `;
  }

  renderUDAMultitype(param: UDAParam) {
    const selectedMultiTypeString =
      param.selectedMultiTypeString || param.typeStrings?.[0] || "";
    param.selectedMultiTypeString = selectedMultiTypeString;
    const _value =
      param.selectedMultiTypeString || param.typeStrings?.[0] || "";
    const renderDeleteParam = this.renderDeleteUDAParamButton(param);
    const isMultiTypeAllowed =
      param.selectedMultiTypeString &&
      allowedEmptyRequiredTypesStrings.includes(param.selectedMultiTypeString);
    const _isReq = param.isReq && !isMultiTypeAllowed ? "*" : "";

    return html`
      <div class="opt-param-field">
        <div
          class="${renderDeleteParam
            ? "width-90-pct"
            : "width-97-pct"} row align-top">
          ${this.renderUDAMultiTypeInput(param)}
        </div>
        <div class="${renderDeleteParam ? "width-10-pct" : "display-none"}">
          ${this.renderDeleteUDAParamButton(param)}
        </div>
      </div>
    `;

    //TODO: remove the return above and uncomment this one
    // return html`
    //   <div class="opt-param-field">
    //     <div
    //       class="${renderDeleteParam
    //         ? "width-90-pct"
    //         : "width-97-pct"} row align-top">
    //       <sl-select
    //         class="reset-widths-limit width-30-pct"
    //         label="${param.name + isReq}"
    //         help-text="Select a type"
    //         .value="${live(value)}"
    //         @sl-change="${(event: Event) => {
    //           param.selectedMultiTypeString = (
    //             event.target as HTMLSelectElement
    //           ).value;
    //           this.requestChange();
    //         }}">
    //         ${param.typeStrings?.map(
    //           (option) =>
    //             html`<sl-option value="${option.replace(/\s+/g, "_")}"
    //               >${option}</sl-option
    //             >`,
    //         )}
    //       </sl-select>
    //       ${this.renderUDAMultiTypeInput(param)}
    //     </div>
    //     <div class="${renderDeleteParam ? "width-10-pct" : "display-none"}">
    //       ${this.renderDeleteUDAParamButton(param)}
    //     </div>
    //   </div>
    // `;
  }

  getUDAInputWidth(type: string, haveDeleteBtn = false) {
    switch (type) {
      case "datetime-local":
        return "width-30-pct";
      default:
        if (haveDeleteBtn) return "width-90-pct";
        return "width-97-pct";
    }
  }

  renderUDAInput(param: UDAParam, inputType: string) {
    const validInputTypes = ["text", "number", "datetime-local"];
    const type = validInputTypes.includes(inputType) ? inputType : "text";
    const value = param.value || param.default || "";
    const renderDeleteParam = this.renderDeleteUDAParamButton(param);
    const fieldCanBeEmpty =
      param.name !== "table" &&
      ((Array.isArray(param.type) &&
        param.type.some((type) => allowedEmptyRequiredTypes.includes(type))) ||
        (typeof param.type === "number" &&
          allowedEmptyRequiredTypes.includes(param.type)));
    const isReq = param.isReq && !fieldCanBeEmpty ? "*" : "";
    const isDistinguised = param.isDistinguised ? "Distinguished | " : "";
    const typeString = param.typeStrings?.[0]
      ? "Type: " + param.typeStrings[0] + " | "
      : "";
    const description =
      param.description !== "" ? "Description: " + param.description : "";
    const helpText = isDistinguised + typeString + description;
    const inputFieldWrapperWidth = this.getUDAInputWidth(
      type,
      renderDeleteParam ? true : false,
    );

    return html`
      <div class="opt-param-field">
        <div class="${inputFieldWrapperWidth} row align-top">
          ${type === "datetime-local" || type === "date"
            ? html`
                <date-time-nano-picker
                  class="reset-widths-limit width-100-pct"
                  .label="${param.name}"
                  .required="${isReq === "*"}"
                  .helpText="${helpText}"
                  .value="${live(value)}"
                  @change="${(event: CustomEvent) => {
                    param.value = event.detail.value;
                    this.requestChange();
                  }}">
                </date-time-nano-picker>
              `
            : html`
                <sl-input
                  class="reset-widths-limit width-100-pct"
                  .type="${type as
                    | "number"
                    | "email"
                    | "password"
                    | "search"
                    | "tel"
                    | "text"
                    | "time"
                    | "url"}"
                  label="${param.name + isReq}"
                  .helpText="${helpText}"
                  .value="${live(value)}"
                  @input="${(event: Event) => {
                    param.value = (event.target as HTMLInputElement).value;
                    this.requestChange();
                  }}">
                </sl-input>
              `}
        </div>
        <div class="${renderDeleteParam ? "width-10-pct" : "display-none"}">
          ${this.renderDeleteUDAParamButton(param)}
        </div>
      </div>
    `;
  }

  renderUDAMultiTypeInput(param: UDAParam) {
    const selectedType = param.selectedMultiTypeString;
    const multiFieldType = param.multiFieldTypes?.find(
      (type) => Object.keys(type)[0] === selectedType,
    );
    const fieldType = multiFieldType
      ? Object.values(multiFieldType)[0]
      : "text";
    const inputType = this.retrieveUDAParamInputType(fieldType);
    const isDistinguised = param.isDistinguised ? "Distinguished | " : "";
    const typeString = selectedType ? "Type: " + selectedType + " | " : "";
    const description =
      param.description !== "" ? "Description: " + param.description : "";
    const helpText = isDistinguised + typeString + description;

    switch (inputType) {
      case "checkbox":
        return html`
          <sl-checkbox
            class="fix-multi-checkbox"
            .checked="${live(param.value || false)}"
            .helpText="${helpText}"
            @sl-change="${(event: Event) => {
              param.value = (event.target as HTMLInputElement).checked;
              this.requestChange();
            }}">
            Selected type: ${selectedType}
          </sl-checkbox>
        `;
      case "textarea":
        return html`
          <sl-textarea
            class="reset-widths-limit width-70-pct"
            .label="Selected type: ${selectedType}"
            .value="${live(param.value || "")}"
            .helpText="${helpText}"
            @input="${(event: Event) => {
              param.value = (event.target as HTMLTextAreaElement).value;
              this.requestChange();
            }}">
          </sl-textarea>
        `;
      default:
        return html`
          <sl-input
            class="reset-widths-limit ${this.getUDAInputWidth(inputType)}"
            .label="Selected type: ${selectedType}"
            .type="${(inputType === "multitype" ? "text" : inputType) as
              | "number"
              | "datetime-local"
              | "text"
              | "date"
              | "email"
              | "password"
              | "search"
              | "tel"
              | "time"
              | "url"}"
            .value="${live(param.value || "")}"
            .helpText="${helpText}"
            @input="${(event: Event) => {
              param.value = (event.target as HTMLInputElement).value;
              this.requestChange();
            }}">
          </sl-input>
        `;
    }
  }

  renderUDAInvalidParams() {
    if (this.userSelectedUDA?.incompatibleError !== undefined) {
      return html`
        <sl-alert variant="warning" open>
          ${this.renderExclamationTriangleIcon()}
          <strong>Invalid Parameters</strong><br />
          The UDA you have selected cannot be queried because it has required
          fields with types that are not supported.
        </sl-alert>
      `;
    }
    return "";
  }

  renderUDANoParams() {
    return html`
      <sl-alert variant="primary" open>
        ${this.renderInfoCircleIcon()}
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
