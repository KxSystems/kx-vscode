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
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { DataSourceFiles, DataSourceTypes } from "../../models/dataSource";
import { MetaObjectPayload } from "../../models/meta";
import { kdbStyles, vscodeStyles } from "./styles";

type Params = {
  isInsights: boolean;
  insightsMeta: MetaObjectPayload;
  dataSourceName: string;
  dataSourceFile: DataSourceFiles;
};

@customElement("kdb-data-source-view")
export class KdbDataSourceView extends LitElement {
  static styles = [vscodeStyles, kdbStyles];

  private vscode = acquireVsCodeApi();
  private dataSourceFormRef: Ref<HTMLFormElement> = createRef();

  @state() declare isInsights: boolean;
  @state() declare isMetaLoaded: boolean;
  @state() declare insightsMeta: MetaObjectPayload;
  @state() declare originalName: string;
  @state() declare dataSourceName: string;
  @state() declare selectedType: DataSourceTypes;
  @state() declare selectedApi: string;
  @state() declare selectedTable: string;
  @state() declare startTS: string;
  @state() declare endTS: string;
  @state() declare fill: string;
  @state() declare temporality: string;
  @state() declare qsqlTarget: string;
  @state() declare qsql: string;
  @state() declare sql: string;

  constructor() {
    super();

    this.isInsights = false;
    this.isMetaLoaded = false;
    this.insightsMeta = <MetaObjectPayload>{};
    this.originalName = "";
    this.dataSourceName = "";
    this.selectedType = DataSourceTypes.API;
    this.selectedApi = "";
    this.selectedTable = "";
    this.startTS = "";
    this.endTS = "";
    this.fill = "";
    this.temporality = "";
    this.qsqlTarget = "";
    this.qsql = "";
    this.sql = "";

    window.addEventListener("message", (event) => {
      const params = event.data as Params;
      this.isInsights = params.isInsights;
      this.isMetaLoaded = params.insightsMeta.dap ? true : false;
      this.insightsMeta = params.insightsMeta;
      this.originalName = params.dataSourceName;
      this.dataSourceName = params.dataSourceName;
      this.selectedType = params.dataSourceFile.dataSource.selectedType;
      this.selectedApi = params.dataSourceFile.dataSource.api.selectedApi;
      this.selectedTable = params.dataSourceFile.dataSource.api.table;
      this.startTS = params.dataSourceFile.dataSource.api.startTS;
      this.endTS = params.dataSourceFile.dataSource.api.endTS;
      this.fill = params.dataSourceFile.dataSource.api.fill;
      this.temporality = params.dataSourceFile.dataSource.api.temporality;
      this.qsqlTarget = params.dataSourceFile.dataSource.qsql.selectedTarget;
      this.qsql = params.dataSourceFile.dataSource.qsql.query;
      this.sql = params.dataSourceFile.dataSource.sql.query;
    });
  }

  private get selectedTab() {
    return this.selectedType === DataSourceTypes.API
      ? "tab-1"
      : this.selectedType === DataSourceTypes.QSQL
      ? "tab-2"
      : "tab-3";
  }

  private get data() {
    const form = this.dataSourceFormRef.value;
    const formData = new FormData(form);
    return Object.fromEntries(formData.entries());
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

  private selectApiTab() {
    this.selectedType = DataSourceTypes.API;
  }

  private selectQSqlTab() {
    this.selectedType = DataSourceTypes.QSQL;
  }

  private selectSqlTab() {
    this.selectedType = DataSourceTypes.SQL;
  }

  private tableChanged(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.selectedTable = select.value;
  }

  private temporalityChanged(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.temporality = select.value;
  }

  private addFilter() {
    return false;
  }

  private removeFilter() {
    return false;
  }

  private addLabel() {
    return false;
  }

  private removeLabel() {
    return false;
  }

  private addSortBy() {
    return false;
  }

  private removeSortBy() {
    return false;
  }

  private addAgg() {
    return false;
  }

  private removeAgg() {
    return false;
  }

  private addGroupBy() {
    return false;
  }

  private removeGroupBy() {
    return false;
  }

  private renderApiOptions(selected: string) {
    if (this.isInsights && this.isMetaLoaded) {
      return html`
        ${this.insightsMeta.api
          .filter(
            (api) => api.api === ".kxi.getData" || !api.api.startsWith(".kxi.")
          )
          .map((api) => {
            const generatedValue =
              api.api === ".kxi.getData"
                ? api.api.replace(".kxi.", "")
                : api.api;

            return generatedValue === selected
              ? html`<vscode-option value="${generatedValue}" selected
                  >${generatedValue}</vscode-option
                >`
              : html`<vscode-option value="${generatedValue}"
                  >${generatedValue}</vscode-option
                >`;
          })}
      `;
    }
    return [];
  }

  private renderTableOptions(selected: string) {
    if (this.isInsights && this.isMetaLoaded) {
      const auxOptions = this.insightsMeta.assembly.flatMap((assembly) => {
        return assembly.tbls.map((tbl) => {
          const generatedValue = tbl;
          if (!this.selectedTable) {
            this.selectedTable = generatedValue;
          }
          if (generatedValue === selected) {
            return html`<vscode-option value="${generatedValue}" selected
              >${generatedValue}</vscode-option
            >`;
          }
          return html`<vscode-option value="${generatedValue}"
            >${generatedValue}</vscode-option
          >`;
        });
      });
      return auxOptions;
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
            (column) => html` <vscode-option>${column.column}</vscode-option> `
          );
        }
      }
    }
    return [];
  }

  private renderTargetOptions(selected: string) {
    if (this.isInsights && this.isMetaLoaded) {
      return this.insightsMeta.dap.map((dap) => {
        const generatedValue = `${dap.assembly}-qe ${dap.instance}`;
        const option =
          generatedValue === selected
            ? html`
                <vscode-option value="${generatedValue}" selected
                  >${generatedValue}</vscode-option
                >
              `
            : html`
                <vscode-option value="${generatedValue}"
                  >${generatedValue}</vscode-option
                >
              `;
        return option;
      });
    }
    return [];
  }

  private renderFilter() {
    return html`
      <div class="list-item">
        <vscode-checkbox></vscode-checkbox>
        <div class="dropdown-container">
          <label>Filter By Column</label>
          <vscode-dropdown class="dropdown">
            ${this.renderColumnOptions()}
          </vscode-dropdown>
        </div>
        <div class="dropdown-container">
          <label>Apply Function</label>
          <vscode-dropdown class="dropdown">
            <vscode-option>in</vscode-option>
            <vscode-option>within</vscode-option>
            <vscode-option>&lt;</vscode-option>
            <vscode-option>&gt;</vscode-option>
            <vscode-option>&lt;=</vscode-option>
            <vscode-option>&gt;=</vscode-option>
            <vscode-option>=</vscode-option>
            <vscode-option>&lt;&gt;</vscode-option>
            <vscode-option>like</vscode-option>
          </vscode-dropdown>
        </div>
        <vscode-text-field class="text-field">Set Parameter</vscode-text-field>
        <div class="button-group align-end">
          <vscode-button
            aria-label="Add Filter"
            appearance="secondary"
            @click="${this.addFilter}"
            >+</vscode-button
          >
          <vscode-button
            aria-label="Remove Filter"
            appearance="secondary"
            @click="${this.removeFilter}"
            >-</vscode-button
          >
        </div>
      </div>
    `;
  }

  private renderLabel() {
    return html`
      <div class="list-item">
        <vscode-checkbox></vscode-checkbox>
        <vscode-text-field class="text-field"
          >Filter By Label</vscode-text-field
        >
        <vscode-text-field class="text-field">Value</vscode-text-field>
        <div class="button-group align-end">
          <vscode-button
            aria-label="Add Label"
            appearance="secondary"
            @click="${this.addLabel}"
            >+</vscode-button
          >
          <vscode-button
            aria-label="Remove Label"
            appearance="secondary"
            @click="${this.removeLabel}"
            >-</vscode-button
          >
        </div>
      </div>
    `;
  }

  private renderSort() {
    return html`
      <div class="list-item">
        <vscode-checkbox></vscode-checkbox>
        <div class="dropdown-container">
          <label>Sort By</label>
          <vscode-dropdown class="dropdown">
            ${this.renderColumnOptions()}
          </vscode-dropdown>
        </div>
        <div class="button-group align-end">
          <vscode-button
            aria-label="Add Sort By"
            appearance="secondary"
            @click="${this.addSortBy}"
            >+</vscode-button
          >
          <vscode-button
            aria-label="Remove Sort By"
            appearance="secondary"
            @click="${this.removeSortBy}"
            >-</vscode-button
          >
        </div>
      </div>
    `;
  }

  private renderAgg() {
    return html`
      <div class="list-item">
        <vscode-checkbox></vscode-checkbox>
        <vscode-text-field class="text-field"
          >Define Output Aggregate</vscode-text-field
        >
        <div class="dropdown-container">
          <label>Choose Aggregation</label>
          <vscode-dropdown class="dropdown">
            <vscode-option>count</vscode-option>
            <vscode-option>first</vscode-option>
            <vscode-option>last</vscode-option>
            <vscode-option>sum</vscode-option>
            <vscode-option>prd</vscode-option>
            <vscode-option>min</vscode-option>
            <vscode-option>max</vscode-option>
            <vscode-option>all</vscode-option>
            <vscode-option>any</vscode-option>
            <vscode-option>var</vscode-option>
            <vscode-option>avg</vscode-option>
            <vscode-option>dev</vscode-option>
            <vscode-option>distinct</vscode-option>
            <vscode-option>svar</vscode-option>
            <vscode-option>sdev</vscode-option>
          </vscode-dropdown>
        </div>
        <div class="dropdown-container">
          <label>By Column</label>
          <vscode-dropdown class="dropdown">
            ${this.renderColumnOptions()}
          </vscode-dropdown>
        </div>
        <div class="button-group align-end">
          <vscode-button
            aria-label="Add Aggregation"
            appearance="secondary"
            @click="${this.addAgg}"
            >+</vscode-button
          >
          <vscode-button
            aria-label="Remove Aggregation"
            appearance="secondary"
            @click="${this.removeAgg}"
            >-</vscode-button
          >
        </div>
      </div>
    `;
  }

  private renderGroupBy() {
    return html`
      <div class="list-item">
        <vscode-checkbox></vscode-checkbox>
        <div class="dropdown-container">
          <label>Group Aggregation By</label>
          <vscode-dropdown class="dropdown">
            ${this.renderColumnOptions()}
          </vscode-dropdown>
        </div>
        <div class="button-group align-end">
          <vscode-button
            aria-label="Add Group By"
            appearance="secondary"
            @click="${this.addGroupBy}"
            >+</vscode-button
          >
          <vscode-button
            aria-label="Remove Group By"
            appearance="secondary"
            @click="${this.removeGroupBy}"
            >-</vscode-button
          >
        </div>
      </div>
    `;
  }

  render() {
    return html`
      <form ${ref(this.dataSourceFormRef)}>
        <input type="hidden" name="originalName" value="${this.originalName}" />
        <input type="hidden" name="selectedType" value="${this.selectedType}" />

        <div class="container">
          <div class="list">
            <div class="list-item">
              <vscode-text-field
                name="name"
                placeholder="Data Source Name"
                value="${this.dataSourceName}"
                class="grow"
                >Data Source Name</vscode-text-field
              >
            </div>

            <div class="list-item">
              <vscode-panels activeid="${this.selectedTab}">
                <vscode-panel-tab id="tab-1" @click="${this.selectApiTab}"
                  >API</vscode-panel-tab
                >
                <vscode-panel-tab id="tab-2" @click="${this.selectQSqlTab}"
                  >QSQL</vscode-panel-tab
                >
                <vscode-panel-tab id="tab-3" @click="${this.selectSqlTab}"
                  >SQL</vscode-panel-tab
                >
                <vscode-panel-view>
                  <div class="list">
                    <div class="list-item">
                      <div class="dropdown-container">
                        <label for="selectedApi">Select API</label>
                        <vscode-dropdown
                          id="selectedApi"
                          name="selectedApi"
                          class="dropdown larger">
                          ${this.renderApiOptions(this.selectedApi)}
                        </vscode-dropdown>
                      </div>
                    </div>

                    <div class="list-item">
                      <div class="dropdown-container">
                        <label for="selectedTable">Table</label>
                        <vscode-dropdown
                          id="selectedTable"
                          name="selectedTable"
                          class="dropdown larger"
                          @change="${this.tableChanged}">
                          ${this.renderTableOptions(this.selectedTable)}
                        </vscode-dropdown>
                      </div>
                    </div>

                    <div class="list-item">
                      <vscode-text-field
                        type="datetime-local"
                        name="startTS"
                        placeholder="startTS"
                        class="text-field larger"
                        value="${this.startTS}"
                        >Start Time</vscode-text-field
                      >
                    </div>

                    <div class="list-item">
                      <vscode-text-field
                        type="datetime-local"
                        name="endTS"
                        placeholder="endTS"
                        class="text-field larger"
                        value="${this.endTS}"
                        >End Time</vscode-text-field
                      >
                    </div>

                    <div class="list-item">
                      <vscode-checkbox></vscode-checkbox>
                      <div class="dropdown-container">
                        <label for="fill">Fill</label>
                        <vscode-dropdown id="fill" name="fill" class="dropdown">
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

                    <div class="list-item">
                      <vscode-checkbox></vscode-checkbox>
                      <div class="dropdown-container">
                        <label for="temporality">Temporality</label>
                        <vscode-dropdown
                          id="temporality"
                          name="temporality"
                          class="dropdown"
                          @change="${this.temporalityChanged}">
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
                        ?hidden="${this.temporality !== "slice"}"
                        >Start Time</vscode-text-field
                      >
                      <vscode-text-field
                        type="time"
                        class="text-field"
                        ?hidden="${this.temporality !== "slice"}"
                        >End Time</vscode-text-field
                      >
                    </div>

                    <div class="list">
                      ${this.renderFilter()} ${this.renderFilter()}
                      ${this.renderFilter()} ${this.renderFilter()}
                    </div>

                    <div class="list">
                      ${this.renderLabel()} ${this.renderLabel()}
                      ${this.renderLabel()} ${this.renderLabel()}
                    </div>

                    <div class="list">
                      ${this.renderSort()} ${this.renderSort()}
                      ${this.renderSort()} ${this.renderSort()}
                    </div>

                    <div class="list">
                      ${this.renderAgg()} ${this.renderAgg()}
                      ${this.renderAgg()} ${this.renderAgg()}
                    </div>

                    <div class="list">
                      ${this.renderGroupBy()} ${this.renderGroupBy()}
                      ${this.renderGroupBy()} ${this.renderGroupBy()}
                    </div>
                  </div>
                </vscode-panel-view>

                <vscode-panel-view>
                  <div class="list">
                    <div class="list-item">
                      <div class="dropdown-container">
                        <label for="selectedTarget">Target</label>
                        <vscode-dropdown
                          id="selectedTarget"
                          class="dropdown larger">
                          ${this.renderTargetOptions(
                            this.qsqlTarget
                          )}</vscode-dropdown
                        >
                      </div>
                    </div>
                    <div class="list-item">
                      <vscode-text-area
                        name="qsql"
                        cols="60"
                        rows="20"
                        value="${this.qsql}"
                        >Query</vscode-text-area
                      >
                    </div>
                  </div>
                </vscode-panel-view>

                <vscode-panel-view>
                  <div class="list">
                    <div class="list-item">
                      <vscode-text-area
                        name="sql"
                        cols="60"
                        rows="20"
                        value="${this.sql}"
                        >Query</vscode-text-area
                      >
                    </div>
                  </div>
                </vscode-panel-view>
              </vscode-panels>
            </div>
          </div>
          <div class="list actions">
            <div class="list-item">
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
      </form>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "kdb-data-source-view": KdbDataSourceView;
  }
}
