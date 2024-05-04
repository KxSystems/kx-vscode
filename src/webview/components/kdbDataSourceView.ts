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
import { repeat } from "lit/directives/repeat.js";
import { customElement } from "lit/decorators.js";
import { css } from "lit";
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
import { kdbStyles, vscodeStyles } from "./styles";
import { DataSourceCommand, DataSourceMessage2 } from "../../models/messages";

const MAX_RULES = 32;

@customElement("kdb-data-source-view")
export class KdbDataSourceView extends LitElement {
  static styles = [
    vscodeStyles,
    kdbStyles,
    css`
      vscode-text-area::part(control) {
        width: 48em !important;
      }

      .panel {
        width: 50em;
      }
    `,
  ];

  private isInsights = false;
  private isMetaLoaded = false;
  private insightsMeta = {} as MetaObjectPayload;
  private selectedType = DataSourceTypes.API;
  private selectedApi = "";
  private selectedTable = "";
  private startTS = "";
  private endTS = "";
  private fill = "";
  private filled = false;
  private temporality = "";
  private temporal = false;
  private filters = [createFilter()];
  private labels = [createLabel()];
  private sorts = [createSort()];
  private aggs = [createAgg()];
  private groups = [createGroup()];
  private qsqlTarget = "";
  private qsql = "";
  private sql = "";
  private running = false;
  private servers: string[] = [];
  private selectedServer = "";
  private updating = 0;

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("message", this.message);
  }

  disconnectedCallback() {
    window.removeEventListener("message", this.message);
    super.disconnectedCallback();
  }

  private message = (event: MessageEvent<DataSourceMessage2>) => {
    const msg = event.data;
    switch (msg.command) {
      case DataSourceCommand.Update:
        this.servers = msg.servers;
        this.selectedServer = msg.selectedServer;
        this.isInsights = msg.isInsights;
        this.isMetaLoaded = !!msg.insightsMeta.dap;
        this.insightsMeta = msg.insightsMeta;
        const ds = msg.dataSourceFile;
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
          this.filters = optional.filters;
          this.labels = optional.labels;
          this.sorts = optional.sorts;
          this.aggs = optional.aggs;
          this.groups = optional.groups;
        }
        this.requestUpdate();
        break;
    }
  };

  private get data(): DataSourceFiles {
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

  private save() {
    this.vscode.postMessage({
      command: DataSourceCommand.Save,
      dataSourceFile: this.data,
    } as DataSourceMessage2);
  }

  private run() {
    this.vscode.postMessage({
      command: DataSourceCommand.Run,
      dataSourceFile: this.data,
    } as DataSourceMessage2);
  }

  private populateScratchpad() {
    this.vscode.postMessage({
      command: DataSourceCommand.Populate,
      dataSourceFile: this.data,
    } as DataSourceMessage2);
  }

  private refresh() {
    this.vscode.postMessage({
      command: DataSourceCommand.Refresh,
    } as DataSourceMessage2);
  }

  private requestChange() {
    this.requestUpdate();
    this.vscode.postMessage({
      command: DataSourceCommand.Change,
      dataSourceFile: this.data,
    } as DataSourceMessage2);
  }

  private requestServerChange(event: Event) {
    this.selectedServer = (event.target as HTMLSelectElement).value;
    this.requestUpdate();
    this.vscode.postMessage({
      command: DataSourceCommand.Server,
      selectedServer: this.selectedServer,
    } as DataSourceMessage2);
  }

  private renderApiOptions() {
    if (this.isInsights && this.isMetaLoaded) {
      return this.insightsMeta.api
        .filter(
          (api) => api.api === ".kxi.getData", //|| !api.api.startsWith(".kxi.")
        )
        .map((api) => {
          const value =
            api.api === ".kxi.getData" ? api.api.replace(".kxi.", "") : api.api;
          return html`
            <vscode-option value="${value}">${value}</vscode-option>
          `;
        });
    }
    return [];
  }

  private renderTableOptions() {
    if (this.isInsights && this.isMetaLoaded) {
      return this.insightsMeta.assembly.flatMap((assembly) =>
        assembly.tbls.map(
          (value) => html`
            <vscode-option value="${value}">${value}</vscode-option>
          `,
        ),
      );
    }
    return [];
  }

  private renderColumnOptions() {
    if (this.isInsights && this.isMetaLoaded) {
      const schema = this.insightsMeta.schema;
      if (schema) {
        const found = schema.find((item) => item.table === this.selectedTable);
        if (found) {
          return found.columns.map(
            ({ column }) => html`
              <vscode-option value="${column}">${column}</vscode-option>
            `,
          );
        }
      }
    }
    return [];
  }

  private renderTargetOptions() {
    if (this.isInsights && this.isMetaLoaded) {
      return this.insightsMeta.dap.map((dap) => {
        const value = `${dap.assembly}-qe ${dap.instance}`;
        if (!this.qsqlTarget) {
          this.qsqlTarget = value;
        }
        return html` <vscode-option value="${value}">${value}</vscode-option> `;
      });
    }
    return [];
  }

  private renderFilter(filter: Filter) {
    return html`
      <div class="row align-bottom">
        <vscode-checkbox
          ?checked="${filter.active}"
          @change="${(event: Event) => {
            filter.active = (event.target as HTMLInputElement).checked;
            this.requestChange();
          }}"></vscode-checkbox>
        <div class="dropdown-container">
          <label
            >${this.filters.indexOf(filter) === 0
              ? "Filter By Column"
              : ""}</label
          >
          <vscode-dropdown
            class="dropdown"
            @change="${(event: Event) => {
              filter.column = (event.target as HTMLInputElement).value;
              this.requestChange();
            }}">
            <vscode-option value="${filter.column}" selected
              >${filter.column}</vscode-option
            >
            <vscode-tag>Options</vscode-tag>
            ${this.renderColumnOptions()}
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
            @change="${(event: Event) => {
              filter.operator = (event.target as HTMLInputElement).value;
              this.requestChange();
            }}">
            <vscode-option value=${filter.operator} selected
              >${filter.operator}</vscode-option
            >
            <vscode-tag>Options</vscode-tag>
            ${filterOperators.map(
              (operator) =>
                html`<vscode-option value="${operator}"
                  >${operator}</vscode-option
                >`,
            )}
          </vscode-dropdown>
        </div>
        <vscode-text-field
          class="text-field"
          value="${filter.values}"
          @change="${(event: Event) => {
            filter.values = (event.target as HTMLInputElement).value;
            this.requestChange();
          }}"
          >${this.filters.indexOf(filter) === 0 ? "Set Parameter" : ""}
        </vscode-text-field>
        <div class="row gap-1 align-end">
          <vscode-button
            aria-label="Add Filter"
            appearance="secondary"
            @click="${() => {
              if (this.filters.length < MAX_RULES) {
                const index = this.filters.indexOf(filter);
                this.filters.splice(index + 1, 0, createFilter());
                this.requestChange();
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
                this.filters.splice(index, 1);
                if (this.filters.length === 0) {
                  this.filters.push(createFilter());
                }
                this.requestChange();
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
          @change="${(event: Event) => {
            label.active = (event.target as HTMLInputElement).checked;
            this.requestChange();
          }}"></vscode-checkbox>
        <vscode-text-field
          class="text-field"
          value="${label.key}"
          @change="${(event: Event) => {
            label.key = (event.target as HTMLInputElement).value;
            this.requestChange();
          }}"
          >${this.labels.indexOf(label) === 0
            ? "Filter By Label"
            : ""}</vscode-text-field
        >
        <vscode-text-field
          class="text-field"
          value="${label.value}"
          @change="${(event: Event) => {
            label.value = (event.target as HTMLInputElement).value;
            this.requestChange();
          }}"
          >${this.labels.indexOf(label) === 0 ? "Value" : ""}</vscode-text-field
        >
        <div class="row gap-1 align-end">
          <vscode-button
            aria-label="Add Label"
            appearance="secondary"
            @click="${() => {
              if (this.labels.length < MAX_RULES) {
                const index = this.labels.indexOf(label);
                this.labels.splice(index + 1, 0, createLabel());
                this.requestChange();
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
                this.labels.splice(index, 1);
                if (this.labels.length === 0) {
                  this.labels.push(createLabel());
                }
                this.requestChange();
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
          @change="${(event: Event) => {
            sort.active = (event.target as HTMLInputElement).checked;
            this.requestChange();
          }}"></vscode-checkbox>
        <div class="dropdown-container">
          <label>${this.sorts.indexOf(sort) === 0 ? "Sort By" : ""}</label>
          <vscode-dropdown
            class="dropdown"
            @change="${(event: Event) => {
              sort.column = (event.target as HTMLInputElement).value;
              this.requestChange();
            }}">
            <vscode-option value="${sort.column}" selected
              >${sort.column}</vscode-option
            >
            <vscode-tag>Options</vscode-tag>
            ${this.renderColumnOptions()}
          </vscode-dropdown>
        </div>
        <div class="row gap-1 align-end">
          <vscode-button
            aria-label="Add Sort By"
            appearance="secondary"
            @click="${() => {
              if (this.sorts.length < MAX_RULES) {
                const index = this.sorts.indexOf(sort);
                this.sorts.splice(index + 1, 0, createSort());
                this.requestChange();
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
                this.sorts.splice(index, 1);
                if (this.sorts.length === 0) {
                  this.sorts.push(createSort());
                }
                this.requestChange();
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
          @change="${(event: Event) => {
            agg.active = (event.target as HTMLInputElement).checked;
            this.requestChange();
          }}"></vscode-checkbox>
        <vscode-text-field
          class="text-field"
          value="${agg.key}"
          @change="${(event: Event) => {
            agg.key = (event.target as HTMLInputElement).value;
            this.requestChange();
          }}"
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
            @change="${(event: Event) => {
              agg.operator = (event.target as HTMLInputElement).value;
              this.requestChange();
            }}">
            <vscode-option value="${agg.operator}" selected
              >${agg.operator}</vscode-option
            >
            <vscode-tag>Options</vscode-tag>
            ${aggOperators.map(
              (operator) =>
                html`<vscode-option value="${operator}"
                  >${operator}</vscode-option
                >`,
            )}
          </vscode-dropdown>
        </div>
        <div class="dropdown-container">
          <label>${this.aggs.indexOf(agg) === 0 ? "By Column" : ""}</label>
          <vscode-dropdown
            class="dropdown"
            @change="${(event: Event) => {
              agg.column = (event.target as HTMLInputElement).value;
              this.requestChange();
            }}">
            <vscode-option value="${agg.column}" selected
              >${agg.column}</vscode-option
            >
            <vscode-tag>Options</vscode-tag>
            ${this.renderColumnOptions()}
          </vscode-dropdown>
        </div>
        <div class="row gap-1 align-end">
          <vscode-button
            aria-label="Add Aggregation"
            appearance="secondary"
            @click="${() => {
              if (this.aggs.length < MAX_RULES) {
                const index = this.aggs.indexOf(agg);
                this.aggs.splice(index + 1, 0, createAgg());
                this.requestChange();
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
                this.aggs.splice(index, 1);
                if (this.aggs.length === 0) {
                  this.aggs.push(createAgg());
                }
                this.requestChange();
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
          @change="${(event: Event) => {
            group.active = (event.target as HTMLInputElement).checked;
            this.requestChange();
          }}"></vscode-checkbox>
        <div class="dropdown-container">
          <label
            >${this.groups.indexOf(group) === 0
              ? "Group Aggregation By"
              : ""}</label
          >
          <vscode-dropdown
            class="dropdown"
            @change="${(event: Event) => {
              group.column = (event.target as HTMLInputElement).value;
              this.requestChange();
            }}">
            <vscode-option value="${group.column}" selected
              >${group.column}</vscode-option
            >
            <vscode-tag>Options</vscode-tag>
            ${this.renderColumnOptions()}
          </vscode-dropdown>
        </div>
        <div class="row gap-1 align-end">
          <vscode-button
            aria-label="Add Group By"
            appearance="secondary"
            @click="${() => {
              if (this.groups.length < MAX_RULES) {
                const index = this.groups.indexOf(group);
                this.groups.splice(index + 1, 0, createGroup());
                this.requestChange();
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
                this.groups.splice(index, 1);
                if (this.groups.length === 0) {
                  this.groups.push(createGroup());
                }
                this.requestChange();
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
            <vscode-panels activeid="${this.selectedType}">
              <vscode-panel-tab
                id="${DataSourceTypes.API}"
                @click="${() => {
                  this.selectedType = DataSourceTypes.API;
                  this.requestChange();
                }}"
                >API</vscode-panel-tab
              >
              <vscode-panel-tab
                id="${DataSourceTypes.QSQL}"
                @click="${() => {
                  this.selectedType = DataSourceTypes.QSQL;
                  this.requestChange();
                }}"
                >QSQL</vscode-panel-tab
              >
              <vscode-panel-tab
                id="${DataSourceTypes.SQL}"
                @click="${() => {
                  this.selectedType = DataSourceTypes.SQL;
                  this.requestChange();
                }}"
                >SQL</vscode-panel-tab
              >
              <vscode-panel-view class="panel">
                <div class="col">
                  <div class="row">
                    <div class="dropdown-container">
                      <label for="selectedApi">Select API</label>
                      <vscode-dropdown
                        id="selectedApi"
                        class="dropdown larger"
                        @change="${(event: Event) => {
                          this.selectedApi = (
                            event.target as HTMLInputElement
                          ).value;
                          this.requestChange();
                        }}">
                        <vscode-option value="${this.selectedApi}" selected
                          >${this.selectedApi}</vscode-option
                        >
                        <vscode-tag>Options</vscode-tag>
                        ${this.renderApiOptions()}
                      </vscode-dropdown>
                    </div>

                    <div class="dropdown-container">
                      <label for="selectedTable">Table</label>
                      <vscode-dropdown
                        id="selectedTable"
                        class="dropdown larger"
                        @change="${(event: Event) => {
                          this.selectedTable = (
                            event.target as HTMLSelectElement
                          ).value;
                          this.requestChange();
                        }}">
                        <vscode-option value="${this.selectedTable}" selected
                          >${this.selectedTable}</vscode-option
                        >
                        <vscode-tag>Options</vscode-tag>
                        ${this.renderTableOptions()}
                      </vscode-dropdown>
                    </div>
                  </div>

                  <div class="row">
                    <vscode-text-field
                      type="datetime-local"
                      class="text-field larger"
                      value="${this.startTS}"
                      @change="${(event: Event) => {
                        this.startTS = (
                          event.target as HTMLSelectElement
                        ).value;
                        this.requestChange();
                      }}"
                      >Start Time</vscode-text-field
                    >

                    <vscode-text-field
                      type="datetime-local"
                      class="text-field larger"
                      value="${this.endTS}"
                      @change="${(event: Event) => {
                        this.endTS = (event.target as HTMLSelectElement).value;
                        this.requestChange();
                      }}"
                      >End Time</vscode-text-field
                    >
                  </div>

                  <div class="row align-bottom">
                    <vscode-checkbox
                      ?checked="${this.filled}"
                      @change="${(event: Event) => {
                        this.filled = (
                          event.target as HTMLInputElement
                        ).checked;
                        this.requestChange();
                      }}"></vscode-checkbox>
                    <div class="dropdown-container">
                      <label for="fill">Fill</label>
                      <vscode-dropdown
                        id="fill"
                        class="dropdown"
                        @change="${(event: Event) => {
                          this.fill = (event.target as HTMLSelectElement).value;
                          this.requestChange();
                        }}">
                        <vscode-option value="${this.fill}" selected
                          >${this.fill}</vscode-option
                        >
                        <vscode-tag>Options</vscode-tag>
                        <vscode-option value="zero">zero</vscode-option>
                        <vscode-option value="forward">forward</vscode-option>
                      </vscode-dropdown>
                    </div>
                  </div>

                  <div class="row align-bottom">
                    <vscode-checkbox
                      ?checked="${this.temporal}"
                      @change="${(event: Event) => {
                        this.temporal = (
                          event.target as HTMLInputElement
                        ).checked;
                        this.requestChange();
                      }}"></vscode-checkbox>
                    <div class="dropdown-container">
                      <label for="temporality">Temporality</label>
                      <vscode-dropdown
                        id="temporality"
                        class="dropdown"
                        @change="${(event: Event) => {
                          this.temporality = (
                            event.target as HTMLSelectElement
                          ).value;
                          this.requestChange();
                        }}">
                        <vscode-option value="${this.temporality}" selected
                          >${this.temporality}</vscode-option
                        >
                        <vscode-tag>Options</vscode-tag>
                        <vscode-option value="snapshot">snapshot</vscode-option>
                        <vscode-option value="slice">slice</vscode-option>
                      </vscode-dropdown>
                    </div>
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
              </vscode-panel-view>

              <vscode-panel-view class="panel">
                <div class="col">
                  <div class="row">
                    <div class="dropdown-container">
                      <label for="selectedTarget">Target</label>
                      <vscode-dropdown
                        id="selectedTarget"
                        class="dropdown larger"
                        @change="${(event: Event) => {
                          this.qsqlTarget = (
                            event.target as HTMLSelectElement
                          ).value;
                          this.requestChange();
                        }}">
                        <vscode-option value="${this.qsqlTarget}" selected
                          >${this.qsqlTarget}</vscode-option
                        >
                        <vscode-tag>Options</vscode-tag>
                        ${this.renderTargetOptions()}</vscode-dropdown
                      >
                    </div>
                  </div>
                  <div class="row">
                    <vscode-text-area
                      rows="20"
                      value="${this.qsql}"
                      @change="${(event: Event) => {
                        this.qsql = (event.target as HTMLSelectElement).value;
                        this.requestChange();
                      }}"
                      >Query</vscode-text-area
                    >
                  </div>
                </div>
              </vscode-panel-view>

              <vscode-panel-view class="panel">
                <div class="col">
                  <div class="row">
                    <vscode-text-area
                      rows="20"
                      value="${this.sql}"
                      @change="${(event: Event) => {
                        this.sql = (event.target as HTMLSelectElement).value;
                        this.requestChange();
                      }}"
                      >Query</vscode-text-area
                    >
                  </div>
                </div>
              </vscode-panel-view>
            </vscode-panels>
          </div>
        </div>
        <div class="col">
          <div class="dropdown-container mb-1">
            <label for="selectedTable">Connection</label>
            <vscode-dropdown
              class="dropdown"
              @change="${this.requestServerChange}">
              <vscode-option value="${this.selectedServer}" selected
                >${this.selectedServer}</vscode-option
              >
              <vscode-tag>Options</vscode-tag>
              ${this.servers.map(
                (server) => html`
                  <vscode-option value="${server}">${server}</vscode-option>
                `,
              )}
            </vscode-dropdown>
          </div>
          <div class="row">
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
              ?disabled="${this.running}"
              >Run</vscode-button
            >
          </div>
          <vscode-button
            appearance="secondary"
            @click="${this.populateScratchpad}"
            >Populate Scratchpad</vscode-button
          >
          <vscode-button appearance="secondary" @click="${this.refresh}"
            >Refresh</vscode-button
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
