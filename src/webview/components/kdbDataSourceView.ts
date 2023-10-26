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

import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
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
import { DataSourceMessage } from "../../models/messages";
import { MetaObjectPayload } from "../../models/meta";
import { kdbStyles, vscodeStyles } from "./styles";

const MAX_RULES = 32;

@customElement("kdb-data-source-view")
export class KdbDataSourceView extends LitElement {
  static styles = [vscodeStyles, kdbStyles];

  @state() declare isInsights: boolean;
  @state() declare isMetaLoaded: boolean;
  @state() declare insightsMeta: MetaObjectPayload;
  @state() declare originalName: string;
  @state() declare name: string;
  @state() declare selectedType: DataSourceTypes;
  @state() declare selectedApi: string;
  @state() declare selectedTable: string;
  @state() declare startTS: string;
  @state() declare endTS: string;
  @state() declare fill: string;
  @state() declare filled: boolean;
  @state() declare temporality: string;
  @state() declare temporal: boolean;
  @state() declare sliceStartTS: string;
  @state() declare sliceEndTS: string;
  @state() declare filters: Filter[];
  @state() declare labels: Label[];
  @state() declare sorts: Sort[];
  @state() declare aggs: Agg[];
  @state() declare groups: Group[];
  @state() declare qsqlTarget: string;
  @state() declare qsql: string;
  @state() declare sql: string;

  constructor() {
    super();
    this.isInsights = false;
    this.isMetaLoaded = false;
    this.insightsMeta = {} as MetaObjectPayload;
    this.originalName = "";
    this.name = "";
    this.selectedType = DataSourceTypes.API;
    this.selectedApi = "";
    this.selectedTable = "";
    this.startTS = "";
    this.endTS = "";
    this.fill = "";
    this.filled = false;
    this.temporality = "";
    this.temporal = false;
    this.sliceStartTS = "";
    this.sliceEndTS = "";
    this.filters = [createFilter()];
    this.labels = [createLabel()];
    this.sorts = [createSort()];
    this.aggs = [createAgg()];
    this.groups = [createGroup()];
    this.qsqlTarget = "";
    this.qsql = "";
    this.sql = "";
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("message", this.message);
  }

  disconnectedCallback() {
    window.removeEventListener("message", this.message);
    super.disconnectedCallback();
  }

  private message = (event: MessageEvent<DataSourceMessage>) => {
    const params = event.data;
    const ds = params.dataSourceFile;
    this.isInsights = params.isInsights;
    this.isMetaLoaded = !!params.insightsMeta.dap;
    this.insightsMeta = params.insightsMeta;
    this.originalName = params.dataSourceName;
    this.name = params.dataSourceName;
    this.selectedType = ds.dataSource.selectedType;
    this.selectedApi = ds.dataSource.api.selectedApi;
    this.selectedTable = ds.dataSource.api.table;
    this.startTS = ds.dataSource.api.startTS;
    this.endTS = ds.dataSource.api.endTS;
    this.fill = ds.dataSource.api.fill;
    this.temporality = ds.dataSource.api.temporality;
    this.qsqlTarget = ds.dataSource.qsql.selectedTarget;
    this.qsql = ds.dataSource.qsql.query;
    this.sql = ds.dataSource.sql.query;
    const optional = ds.dataSource.api.optional;
    if (optional) {
      this.filled = optional.filled;
      this.temporal = optional.temporal;
      this.sliceStartTS = optional.startTS;
      this.sliceEndTS = optional.endTS;
      this.filters = optional.filters;
      this.labels = optional.labels;
      this.sorts = optional.sorts;
      this.aggs = optional.aggs;
      this.groups = optional.groups;
    }
  };

  private get data(): DataSourceFiles {
    return {
      name: this.name,
      originalName: this.originalName,
      dataSource: {
        selectedType: this.selectedType,
        api: {
          selectedApi: this.selectedApi,
          table: this.selectedTable,
          startTS: this.startTS,
          endTS: this.endTS,
          fill: this.fill,
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
            startTS: this.sliceStartTS,
            endTS: this.sliceEndTS,
            filters: this.filters,
            labels: this.labels,
            sorts: this.sorts,
            aggs: this.aggs,
            groups: this.groups,
          },
        },
        qsql: {
          query: this.qsql,
          selectedTarget: this.qsqlTarget,
        },
        sql: {
          query: this.sql,
        },
      },
    };
  }

  private readonly vscode = acquireVsCodeApi();

  private get selectedTab() {
    switch (this.selectedType) {
      case DataSourceTypes.API:
        return "tab-1";
      case DataSourceTypes.QSQL:
        return "tab-2";
      case DataSourceTypes.SQL:
        return "tab-3";
      default:
        return "tab-1";
    }
  }

  private save() {
    this.vscode.postMessage({
      command: "kdb.dataSource.saveDataSource",
      data: this.data,
    });
  }

  private run() {
    this.vscode.postMessage({
      command: "kdb.dataSource.runDataSource",
      data: this.data,
    });
  }

  private populateScratchpad() {
    this.vscode.postMessage({
      command: "kdb.dataSource.populateScratchpad",
      data: this.data,
    });
  }

  private renderApiOptions(selected: string) {
    if (this.isInsights && this.isMetaLoaded) {
      return html`
        ${this.insightsMeta.api
          .filter(
            (api) => api.api === ".kxi.getData" || !api.api.startsWith(".kxi.")
          )
          .map((api) => {
            const value =
              api.api === ".kxi.getData"
                ? api.api.replace(".kxi.", "")
                : api.api;

            return html`
              <vscode-option value="${value}" ?selected="${value === selected}"
                >${value}</vscode-option
              >
            `;
          })}
      `;
    }
    return [];
  }

  private renderTableOptions(selected: string) {
    if (this.isInsights && this.isMetaLoaded) {
      return this.insightsMeta.assembly.flatMap((assembly) => {
        return assembly.tbls.map((value) => {
          if (!this.selectedTable) {
            this.selectedTable = value;
          }
          return html`
            <vscode-option value="${value}" ?selected="${value === selected}"
              >${value}</vscode-option
            >
          `;
        });
      });
    }
    return [];
  }

  private renderColumnOptions(selected: string) {
    if (this.isInsights && this.isMetaLoaded) {
      const schema = this.insightsMeta.schema;
      if (schema) {
        const found = schema.find((item) => item.table === this.selectedTable);
        if (found) {
          return found.columns.map(
            ({ column }) =>
              html`
                <vscode-option
                  value="${column}"
                  ?selected="${column === selected}"
                  >${column}</vscode-option
                >
              `
          );
        }
      }
    }
    return [];
  }

  private renderTargetOptions(selected: string) {
    if (this.isInsights && this.isMetaLoaded) {
      return this.insightsMeta.dap.map((dap) => {
        const value = `${dap.assembly}-qe ${dap.instance}`;
        return html`
          <vscode-option value="${value}" ?selected="${value === selected}"
            >${value}</vscode-option
          >
        `;
      });
    }
    return [];
  }

  private renderFilter(filter: Filter) {
    return html`
      <div class="row align-bottom">
        <vscode-checkbox
          ?checked="${filter.active}"
          @change="${(event: Event) =>
            (filter.active = (
              event.target as HTMLInputElement
            ).checked)}"></vscode-checkbox>
        <div class="dropdown-container">
          <label
            >${this.filters.indexOf(filter) === 0
              ? "Filter By Column"
              : ""}</label
          >
          <vscode-dropdown
            class="dropdown"
            @change="${(event: Event) =>
              (filter.column = (event.target as HTMLInputElement).value)}"
            >${this.renderColumnOptions(filter.column)}
          </vscode-dropdown>
        </div>
        <div class="dropdown-container">
          <label
            >${this.filters.indexOf(filter) === 0
              ? "Apply Function"
              : ""}</label
          >
          <vscode-dropdown
            class="dropdown"
            @change="${(event: Event) =>
              (filter.operator = (event.target as HTMLInputElement).value)}">
            ${filterOperators.map(
              (operator) =>
                html` <vscode-option
                  value="${operator}"
                  ?selected="${operator === filter.operator}"
                  >${operator}</vscode-option
                >`
            )}
          </vscode-dropdown>
        </div>
        <vscode-text-field
          class="text-field"
          value="${filter.values}"
          @input="${(event: Event) =>
            (filter.values = (event.target as HTMLInputElement).value)}"
          >${this.filters.indexOf(filter) === 0 ? "Set Parameter" : ""}
        </vscode-text-field>
        <div class="row gap-1 align-end">
          <vscode-button
            aria-label="Add Filter"
            appearance="secondary"
            @click="${() => {
              if (this.filters.length < MAX_RULES) {
                const index = this.filters.indexOf(filter);
                const value = this.filters;
                this.filters = [];
                this.requestUpdate();
                queueMicrotask(() => {
                  value.splice(index + 1, 0, createFilter());
                  this.filters = value;
                  this.requestUpdate();
                });
              }
            }}"
            >+</vscode-button
          >
          <vscode-button
            aria-label="Remove Filter"
            appearance="secondary"
            @click="${() => {
              if (this.filters.length > 0) {
                const index = this.filters.indexOf(filter);
                const value = this.filters;
                this.filters = [];
                this.requestUpdate();
                queueMicrotask(() => {
                  value.splice(index, 1);
                  if (value.length === 0) {
                    value.push(createFilter());
                  }
                  this.filters = value;
                  this.requestUpdate();
                });
              }
            }}"
            >-</vscode-button
          >
        </div>
      </div>
    `;
  }

  private renderLabel(label: Label) {
    return html`
      <div class="row align-bottom">
        <vscode-checkbox
          ?checked="${label.active}"
          @change="${(event: Event) =>
            (label.active = (
              event.target as HTMLInputElement
            ).checked)}"></vscode-checkbox>
        <vscode-text-field
          class="text-field"
          value="${label.key}"
          @input="${(event: Event) =>
            (label.key = (event.target as HTMLInputElement).value)}"
          >${this.labels.indexOf(label) === 0
            ? "Filter By Label"
            : ""}</vscode-text-field
        >
        <vscode-text-field
          class="text-field"
          value="${label.value}"
          @input="${(event: Event) =>
            (label.value = (event.target as HTMLInputElement).value)}"
          >${this.labels.indexOf(label) === 0 ? "Value" : ""}</vscode-text-field
        >
        <div class="row gap-1 align-end">
          <vscode-button
            aria-label="Add Label"
            appearance="secondary"
            @click="${() => {
              if (this.labels.length < MAX_RULES) {
                const index = this.labels.indexOf(label);
                const value = this.labels;
                this.labels = [];
                this.requestUpdate();
                queueMicrotask(() => {
                  value.splice(index + 1, 0, createLabel());
                  this.labels = value;
                  this.requestUpdate();
                });
              }
            }}"
            >+</vscode-button
          >
          <vscode-button
            aria-label="Remove Label"
            appearance="secondary"
            @click="${() => {
              if (this.labels.length > 0) {
                const index = this.labels.indexOf(label);
                const value = this.labels;
                this.labels = [];
                this.requestUpdate();
                queueMicrotask(() => {
                  value.splice(index, 1);
                  if (value.length === 0) {
                    value.push(createLabel());
                  }
                  this.labels = value;
                  this.requestUpdate();
                });
              }
            }}"
            >-</vscode-button
          >
        </div>
      </div>
    `;
  }

  private renderSort(sort: Sort) {
    return html`
      <div class="row align-bottom">
        <vscode-checkbox
          ?checked="${sort.active}"
          @change="${(event: Event) =>
            (sort.active = (
              event.target as HTMLInputElement
            ).checked)}"></vscode-checkbox>
        <div class="dropdown-container">
          <label>${this.sorts.indexOf(sort) === 0 ? "Sort By" : ""}</label>
          <vscode-dropdown
            class="dropdown"
            @change="${(event: Event) =>
              (sort.column = (event.target as HTMLInputElement).value)}">
            ${this.renderColumnOptions(sort.column)}
          </vscode-dropdown>
        </div>
        <div class="row gap-1 align-end">
          <vscode-button
            aria-label="Add Sort By"
            appearance="secondary"
            @click="${() => {
              if (this.sorts.length < MAX_RULES) {
                const index = this.sorts.indexOf(sort);
                const value = this.sorts;
                this.sorts = [];
                this.requestUpdate();
                queueMicrotask(() => {
                  value.splice(index + 1, 0, createSort());
                  this.sorts = value;
                  this.requestUpdate();
                });
              }
            }}"
            >+</vscode-button
          >
          <vscode-button
            aria-label="Remove Sort By"
            appearance="secondary"
            @click="${() => {
              if (this.sorts.length > 0) {
                const index = this.sorts.indexOf(sort);
                const value = this.sorts;
                this.sorts = [];
                this.requestUpdate();
                queueMicrotask(() => {
                  value.splice(index, 1);
                  if (value.length === 0) {
                    value.push(createSort());
                  }
                  this.sorts = value;
                  this.requestUpdate();
                });
              }
            }}"
            >-</vscode-button
          >
        </div>
      </div>
    `;
  }

  private renderAgg(agg: Agg) {
    return html`
      <div class="row align-bottom">
        <vscode-checkbox
          ?checked="${agg.active}"
          @change="${(event: Event) =>
            (agg.active = (
              event.target as HTMLInputElement
            ).checked)}"></vscode-checkbox>
        <vscode-text-field
          class="text-field"
          value="${agg.key}"
          @input="${(event: Event) =>
            (agg.key = (event.target as HTMLInputElement).value)}"
          >${this.aggs.indexOf(agg) === 0
            ? "Define Output Aggregate"
            : ""}</vscode-text-field
        >
        <div class="dropdown-container">
          <label
            >${this.aggs.indexOf(agg) === 0 ? "Choose Aggregation" : ""}</label
          >
          <vscode-dropdown
            class="dropdown"
            @change="${(event: Event) =>
              (agg.operator = (event.target as HTMLInputElement).value)}">
            ${aggOperators.map(
              (operator) =>
                html`<vscode-option
                  value="${operator}"
                  ?selected="${operator === agg.operator}"
                  >${operator}</vscode-option
                >`
            )}
          </vscode-dropdown>
        </div>
        <div class="dropdown-container">
          <label>${this.aggs.indexOf(agg) === 0 ? "By Column" : ""}</label>
          <vscode-dropdown
            class="dropdown"
            @change="${(event: Event) =>
              (agg.column = (event.target as HTMLInputElement).value)}">
            ${this.renderColumnOptions(agg.column)}
          </vscode-dropdown>
        </div>
        <div class="row gap-1 align-end">
          <vscode-button
            aria-label="Add Aggregation"
            appearance="secondary"
            @click="${() => {
              if (this.aggs.length < MAX_RULES) {
                const index = this.aggs.indexOf(agg);
                const value = this.aggs;
                this.aggs = [];
                this.requestUpdate();
                queueMicrotask(() => {
                  value.splice(index + 1, 0, createAgg());
                  this.aggs = value;
                  this.requestUpdate();
                });
              }
            }}"
            >+</vscode-button
          >
          <vscode-button
            aria-label="Remove Aggregation"
            appearance="secondary"
            @click="${() => {
              if (this.aggs.length > 0) {
                const index = this.aggs.indexOf(agg);
                const value = this.aggs;
                this.aggs = [];
                this.requestUpdate();
                queueMicrotask(() => {
                  value.splice(index, 1);
                  if (value.length === 0) {
                    value.push(createAgg());
                  }
                  this.aggs = value;
                  this.requestUpdate();
                });
              }
            }}"
            >-</vscode-button
          >
        </div>
      </div>
    `;
  }

  private renderGroup(group: Group) {
    return html`
      <div class="row align-bottom">
        <vscode-checkbox
          ?checked="${group.active}"
          @change="${(event: Event) =>
            (group.active = (
              event.target as HTMLInputElement
            ).checked)}"></vscode-checkbox>
        <div class="dropdown-container">
          <label
            >${this.groups.indexOf(group) === 0
              ? "Group Aggregation By"
              : ""}</label
          >
          <vscode-dropdown
            class="dropdown"
            @change="${(event: Event) =>
              (group.column = (event.target as HTMLInputElement).value)}">
            ${this.renderColumnOptions(group.column)}
          </vscode-dropdown>
        </div>
        <div class="row gap-1 align-end">
          <vscode-button
            aria-label="Add Group By"
            appearance="secondary"
            @click="${() => {
              if (this.groups.length < MAX_RULES) {
                const index = this.groups.indexOf(group);
                const value = this.groups;
                this.groups = [];
                this.requestUpdate();
                queueMicrotask(() => {
                  value.splice(index + 1, 0, createGroup());
                  this.groups = value;
                  this.requestUpdate();
                });
              }
            }}"
            >+</vscode-button
          >
          <vscode-button
            aria-label="Remove Group By"
            appearance="secondary"
            @click="${() => {
              if (this.groups.length > 0) {
                const index = this.groups.indexOf(group);
                const value = this.groups;
                this.groups = [];
                this.requestUpdate();
                queueMicrotask(() => {
                  value.splice(index, 1);
                  if (value.length === 0) {
                    value.push(createGroup());
                  }
                  this.groups = value;
                  this.requestUpdate();
                });
              }
            }}"
            >-</vscode-button
          >
        </div>
      </div>
    `;
  }

  render() {
    return html`
      <div class="row mt-1 mb-1">
        <div class="col">
          <div class="row">
            <vscode-text-field
              class="grow"
              placeholder="Data Source Name"
              value="${this.name}"
              @input="${(event: Event) =>
                (this.name = (event.target as HTMLInputElement).value)}"
              >Data Source Name</vscode-text-field
            >
          </div>

          <div class="row">
            <vscode-panels activeid="${this.selectedTab}">
              <vscode-panel-tab
                id="tab-1"
                @click="${() => (this.selectedType = DataSourceTypes.API)}"
                >API</vscode-panel-tab
              >
              <vscode-panel-tab
                id="tab-2"
                @click="${() => (this.selectedType = DataSourceTypes.QSQL)}"
                >QSQL</vscode-panel-tab
              >
              <vscode-panel-tab
                id="tab-3"
                @click="${() => (this.selectedType = DataSourceTypes.SQL)}"
                >SQL</vscode-panel-tab
              >
              <vscode-panel-view>
                <div class="col">
                  <div class="row">
                    <div class="dropdown-container">
                      <label for="selectedApi">Select API</label>
                      <vscode-dropdown
                        id="selectedApi"
                        class="dropdown larger"
                        @change="${(event: Event) =>
                          (this.selectedApi = (
                            event.target as HTMLInputElement
                          ).value)}">
                        ${this.renderApiOptions(this.selectedApi)}
                      </vscode-dropdown>
                    </div>
                  </div>

                  <div class="row">
                    <div class="dropdown-container">
                      <label for="selectedTable">Table</label>
                      <vscode-dropdown
                        id="selectedTable"
                        class="dropdown larger"
                        @change="${(event: Event) =>
                          (this.selectedTable = (
                            event.target as HTMLSelectElement
                          ).value)}">
                        ${this.renderTableOptions(this.selectedTable)}
                      </vscode-dropdown>
                    </div>
                  </div>

                  <div class="row">
                    <vscode-text-field
                      type="datetime-local"
                      class="text-field larger"
                      value="${this.startTS}"
                      @input="${(event: Event) =>
                        (this.startTS = (
                          event.target as HTMLSelectElement
                        ).value)}"
                      >Start Time</vscode-text-field
                    >
                  </div>

                  <div class="row">
                    <vscode-text-field
                      type="datetime-local"
                      class="text-field larger"
                      value="${this.endTS}"
                      @input="${(event: Event) =>
                        (this.endTS = (
                          event.target as HTMLSelectElement
                        ).value)}"
                      >End Time</vscode-text-field
                    >
                  </div>

                  <div class="row align-bottom">
                    <vscode-checkbox
                      ?checked="${this.filled}"
                      @change="${(event: Event) =>
                        (this.filled = (
                          event.target as HTMLInputElement
                        ).checked)}"></vscode-checkbox>
                    <div class="dropdown-container">
                      <label for="fill">Fill</label>
                      <vscode-dropdown
                        id="fill"
                        class="dropdown"
                        @change="${(event: Event) =>
                          (this.fill = (
                            event.target as HTMLSelectElement
                          ).value)}">
                        <vscode-option
                          value="zero"
                          ?selected="${this.fill === "zero"}"
                          >zero</vscode-option
                        >
                        <vscode-option
                          value="forward"
                          ?selected="${this.fill === "forward"}"
                          >forward</vscode-option
                        >
                      </vscode-dropdown>
                    </div>
                  </div>

                  <div class="row align-bottom">
                    <vscode-checkbox
                      ?checked="${this.temporal}"
                      @change="${(event: Event) =>
                        (this.temporal = (
                          event.target as HTMLInputElement
                        ).checked)}"></vscode-checkbox>
                    <div class="dropdown-container">
                      <label for="temporality">Temporality</label>
                      <vscode-dropdown
                        id="temporality"
                        class="dropdown"
                        @change="${(event: Event) =>
                          (this.temporality = (
                            event.target as HTMLSelectElement
                          ).value)}">
                        <vscode-option
                          value="snapshot"
                          ?selected="${this.temporality === "snapshot"}"
                          >snapshot</vscode-option
                        >
                        <vscode-option
                          value="slice"
                          ?selected="${this.temporality === "slice"}"
                          >slice</vscode-option
                        >
                      </vscode-dropdown>
                    </div>
                    <vscode-text-field
                      type="time"
                      class="text-field"
                      value="${this.sliceStartTS}"
                      @input="${(event: Event) =>
                        (this.sliceStartTS = (
                          event.target as HTMLSelectElement
                        ).value)}"
                      ?hidden="${this.temporality !== "slice"}"
                      >Start Time</vscode-text-field
                    >
                    <vscode-text-field
                      type="time"
                      class="text-field"
                      value="${this.sliceEndTS}"
                      @input="${(event: Event) =>
                        (this.sliceEndTS = (
                          event.target as HTMLSelectElement
                        ).value)}"
                      ?hidden="${this.temporality !== "slice"}"
                      >End Time</vscode-text-field
                    >
                  </div>

                  <div class="col">
                    ${this.filters.map((filter) => this.renderFilter(filter))}
                  </div>
                  <div class="col">
                    ${this.labels.map((label) => this.renderLabel(label))}
                  </div>
                  <div class="col">
                    ${this.sorts.map((sort) => this.renderSort(sort))}
                  </div>
                  <div class="col">
                    ${this.aggs.map((agg) => this.renderAgg(agg))}
                  </div>
                  <div class="col">
                    ${this.groups.map((group) => this.renderGroup(group))}
                  </div>
                </div>
              </vscode-panel-view>

              <vscode-panel-view>
                <div class="col">
                  <div class="row">
                    <div class="dropdown-container">
                      <label for="selectedTarget">Target</label>
                      <vscode-dropdown
                        id="selectedTarget"
                        class="dropdown larger"
                        @change="${(event: Event) =>
                          (this.qsqlTarget = (
                            event.target as HTMLSelectElement
                          ).value)}">
                        ${this.renderTargetOptions(
                          this.qsqlTarget
                        )}</vscode-dropdown
                      >
                    </div>
                  </div>
                  <div class="row">
                    <vscode-text-area
                      cols="64"
                      rows="16"
                      value="${this.qsql}"
                      @input="${(event: Event) =>
                        (this.qsql = (
                          event.target as HTMLSelectElement
                        ).value)}"
                      >Query</vscode-text-area
                    >
                  </div>
                </div>
              </vscode-panel-view>

              <vscode-panel-view>
                <div class="col">
                  <div class="row">
                    <vscode-text-area
                      cols="64"
                      rows="16"
                      value="${this.sql}"
                      @input="${(event: Event) =>
                        (this.sql = (event.target as HTMLSelectElement).value)}"
                      >Query</vscode-text-area
                    >
                  </div>
                </div>
              </vscode-panel-view>
            </vscode-panels>
          </div>
        </div>
        <div class="col">
          <div class="row mt-6">
            <vscode-button
              appearance="primary"
              class="grow"
              @click="${this.save}"
              >Save</vscode-button
            >
            <vscode-button
              appearance="secondary"
              class="grow"
              @click="${this.run}"
              >Run</vscode-button
            >
          </div>
          <vscode-button
            appearance="secondary"
            @click="${this.populateScratchpad}"
            >Populate Scratchpad</vscode-button
          >
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "kdb-data-source-view": KdbDataSourceView;
  }
}
