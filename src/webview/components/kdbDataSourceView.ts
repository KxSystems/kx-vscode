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
import { customElement, property } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { DataSourceFiles, DataSourceTypes } from "../../models/dataSource";
import { MetaObjectPayload } from "../../models/meta";
import { dataSourcesPanelStyles, resetStyles, vscodeStyles } from "./styles";

type Params = {
  isInsights: boolean;
  insightsMeta: MetaObjectPayload;
  dataSourceName: string;
  dataSourceFile: DataSourceFiles;
};

@customElement("kdb-data-source-view")
export class KdbDataSourceView extends LitElement {
  static styles = [resetStyles, vscodeStyles, dataSourcesPanelStyles];

  @property({ type: Object })
  declare params: Params;

  constructor() {
    super();

    this.params = {
      isInsights: false,
      insightsMeta: <MetaObjectPayload>{},
      dataSourceName: "",
      dataSourceFile: <DataSourceFiles>{},
    };
  }

  private vscode = acquireVsCodeApi();
  private dataSourceFormRef: Ref<HTMLFormElement> = createRef();

  private get isMetaLoaded() {
    return this.params.insightsMeta.dap ? true : false;
  }

  private get tabSelected() {
    const selectedType = this.params.dataSourceFile.dataSource.selectedType;
    return selectedType === DataSourceTypes.API
      ? "tab-1"
      : selectedType === DataSourceTypes.QSQL
      ? "tab-2"
      : "tab-3";
  }

  private get data() {
    const form = this.dataSourceFormRef.value;
    const formData = new FormData(form);
    return Object.fromEntries(formData.entries());
  }

  private save(e: Event) {
    e.preventDefault();
    this.vscode.postMessage({
      command: "kdb.dataSource.saveDataSource",
      data: this.data,
    });
  }

  private run(e: Event) {
    e.preventDefault();
    this.vscode.postMessage({
      command: "kdb.dataSource.runDataSource",
      data: this.data,
    });
  }

  private populateScratchpad(e: Event) {
    e.preventDefault();
    this.vscode.postMessage({
      command: "kdb.dataSource.populateScratchpad",
      data: this.data,
    });
  }

  private selectApiTab() {
    this.params.dataSourceFile.dataSource.selectedType = DataSourceTypes.API;
    this.requestUpdate();
  }

  private selectQSqlTab() {
    this.params.dataSourceFile.dataSource.selectedType = DataSourceTypes.QSQL;
    this.requestUpdate();
  }

  private selectSqlTab() {
    this.params.dataSourceFile.dataSource.selectedType = DataSourceTypes.SQL;
    this.requestUpdate();
  }

  private addFilter() {
    const filter = this.params.dataSourceFile.dataSource.api.filter;
    filter.push(`filter ${filter.length + 1}`);
    this.requestUpdate();
  }

  private removeFilter() {
    const filter = this.params.dataSourceFile.dataSource.api.filter;
    if (filter.pop()) {
      this.requestUpdate();
    }
  }

  private addGroupBy() {
    const groupBy = this.params.dataSourceFile.dataSource.api.groupBy;
    groupBy.push(`groupBy ${groupBy.length + 1}`);
    this.requestUpdate();
  }

  private removeGroupBy() {
    const groupBy = this.params.dataSourceFile.dataSource.api.groupBy;
    if (groupBy.pop()) {
      this.requestUpdate();
    }
  }

  private addAgg() {
    const agg = this.params.dataSourceFile.dataSource.api.agg;
    agg.push(`agg ${agg.length + 1}`);
    this.requestUpdate();
  }

  private removeAgg() {
    const agg = this.params.dataSourceFile.dataSource.api.agg;
    if (agg.pop()) {
      this.requestUpdate();
    }
  }

  private addSortCols() {
    const sortCols = this.params.dataSourceFile.dataSource.api.sortCols;
    sortCols.push(`sortCols ${sortCols.length + 1}`);
    this.requestUpdate();
  }

  private removeSortCols() {
    const sortCols = this.params.dataSourceFile.dataSource.api.sortCols;
    if (sortCols.pop()) {
      this.requestUpdate();
    }
  }

  private addSlice() {
    const slice = this.params.dataSourceFile.dataSource.api.slice;
    slice.push(`slice ${slice.length + 1}`);
    this.requestUpdate();
  }

  private removeSlice() {
    const slice = this.params.dataSourceFile.dataSource.api.slice;
    if (slice.pop()) {
      this.requestUpdate();
    }
  }

  private addLabels() {
    const labels = this.params.dataSourceFile.dataSource.api.labels;
    labels.push(`labels ${labels.length + 1}`);
    this.requestUpdate();
  }

  private removeLabels() {
    const labels = this.params.dataSourceFile.dataSource.api.labels;
    if (labels.pop()) {
      this.requestUpdate();
    }
  }

  private generateTarget(targetApi: string) {
    if (this.params.isInsights && this.isMetaLoaded) {
      const auxOptions = this.params.insightsMeta.dap.map((dap) => {
        const generatedValue = `${dap.assembly}-qe ${dap.instance}`;
        const option =
          generatedValue === targetApi
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
      return [
        html`
          <vscode-dropdown
            id="selectedTarget"
            name="selectedTarget"
            value="${targetApi}"
            class="dropdown">
            ${auxOptions}
          </vscode-dropdown>
        `,
      ];
    }
    return [
      html`
        <vscode-dropdown
          id="selectedTarget"
          name="selectedTarget"
          class="dropdown">
          <vscode-option>Not connected to Insights</vscode-option>
        </vscode-dropdown>
      `,
    ];
  }

  private generateTables(targetTable: string) {
    if (this.params.isInsights && this.isMetaLoaded) {
      const auxOptions = this.params.insightsMeta.assembly.flatMap(
        (assembly) => {
          return assembly.tbls.map((tbl) => {
            const generatedValue = tbl;
            const option =
              generatedValue === targetTable
                ? html`<vscode-option value="${generatedValue}" selected
                    >${generatedValue}</vscode-option
                  >`
                : html`<vscode-option value="${generatedValue}"
                    >${generatedValue}</vscode-option
                  >`;
            return option;
          });
        }
      );
      return [
        html`
          <vscode-dropdown
            id="selectedTable"
            name="selectedTable"
            value="${targetTable}"
            class="dropdown">
            ${auxOptions}
          </vscode-dropdown>
        `,
      ];
    }
    return [
      html`
        <vscode-dropdown
          id="selectedTable"
          name="selectedTable"
          class="dropdown">
          <vscode-option>Not connected to Insights</vscode-option>
        </vscode-dropdown>
      `,
    ];
  }

  private generateApiTarget(target: string) {
    return this.params.isInsights && this.isMetaLoaded
      ? html`
          <vscode-dropdown
            id="selectedApi"
            name="selectedApi"
            value="${target}"
            class="dropdown">
            ${this.params.insightsMeta.api
              .filter(
                (api) =>
                  api.api === ".kxi.getData" || !api.api.startsWith(".kxi.")
              )
              .map((api) => {
                const generatedValue =
                  api.api === ".kxi.getData"
                    ? api.api.replace(".kxi.", "")
                    : api.api;

                return generatedValue === target
                  ? html`<vscode-option value="${generatedValue}" selected
                      >${generatedValue}</vscode-option
                    >`
                  : html`<vscode-option value="${generatedValue}"
                      >${generatedValue}</vscode-option
                    >`;
              })}
          </vscode-dropdown>
        `
      : html`
          <vscode-dropdown id="selectedApi" name="selectedApi" class="dropdown">
            <vscode-option>Not connected to Insights</vscode-option>
          </vscode-dropdown>
        `;
  }

  private generateAPIListParams(
    listParamType: string,
    actualParamArray: string[]
  ) {
    if (actualParamArray.length > 0) {
      return actualParamArray.map((param, i) => {
        return html`
          <div class="field-row ${listParamType}-row">
            <vscode-text-field
              size="100"
              id="${listParamType}-${i + 1}"
              name="${listParamType}-${i + 1}"
              placeholder="${listParamType} ${i + 1}"
              value="${param}"
              class="text-input ${listParamType}-input"></vscode-text-field>
          </div>
        `;
      });
    } else {
      return [
        html`
          <div class="field-row ${listParamType}-row">
            <vscode-text-field
              size="100"
              id="${listParamType}-1"
              name="${listParamType}-1"
              placeholder="${listParamType} 1"
              class="text-input ${listParamType}-input"></vscode-text-field>
          </div>
        `,
      ];
    }
  }

  render() {
    return html`
      <form id="dataSourceForm" ${ref(this.dataSourceFormRef)}>
        <div class="datasource-view-container">
          <div class="content-wrapper">
            <div class="field-row name-row">
              <label for="name">DataSource Name</label>
              <vscode-text-field
                size="100"
                id="name"
                name="name"
                placeholder="DataSource Name"
                value="${this.params.dataSourceFile.name}"
                class="text-input name-input"></vscode-text-field>
              <input
                type="hidden"
                name="originalName"
                value="${this.params.dataSourceName}" />
            </div>
            <div class="form-wrapper">
              <vscode-panels activeid="${this.tabSelected}">
                <vscode-panel-tab
                  id="tab-1"
                  class="type-tab"
                  @click="${this.selectApiTab}"
                  >API</vscode-panel-tab
                >
                <vscode-panel-tab
                  id="tab-2"
                  class="type-tab"
                  @click="${this.selectQSqlTab}"
                  >QSQL</vscode-panel-tab
                >
                <vscode-panel-tab
                  id="tab-3"
                  class="type-tab"
                  @click="${this.selectSqlTab}"
                  >SQL</vscode-panel-tab
                >
                <input
                  type="hidden"
                  name="selectedType"
                  value="${this.params.dataSourceFile.dataSource
                    .selectedType}" />
                <vscode-panel-view id="view-1">
                  <div class="editor-panel">
                    <div class="field-row">
                      <div class="dropdown-container">
                        <label for="selectedApi">Select API</label>
                        ${this.generateApiTarget(
                          this.params.dataSourceFile.dataSource.api.selectedApi
                        )}
                      </div>
                    </div>
                    <div class="field-row">
                      <div class="dropdown-container">
                        <label for="selectedTable">Table</label>
                        ${this.generateTables(
                          this.params.dataSourceFile.dataSource.api.table
                        )}
                      </div>
                    </div>
                    <div class="field-row">
                      <vscode-text-field
                        type="datetime-local"
                        size="100"
                        id="startTS"
                        name="startTS"
                        placeholder="startTS"
                        value="${this.params.dataSourceFile.dataSource.api
                          .startTS}"
                        >startTS</vscode-text-field
                      >
                    </div>
                    <div class="field-row">
                      <vscode-text-field
                        type="datetime-local"
                        size="100"
                        id="endTS"
                        name="endTS"
                        placeholder="endTS"
                        value="${this.params.dataSourceFile.dataSource.api
                          .endTS}"
                        >endTS</vscode-text-field
                      >
                    </div>
                    <div class="field-row">
                      <vscode-text-field
                        size="100"
                        id="fill"
                        name="fill"
                        placeholder="fill"
                        value="${this.params.dataSourceFile.dataSource.api
                          .fill}"
                        >fill</vscode-text-field
                      >
                    </div>
                    <div class="field-row">
                      <vscode-text-field
                        size="100"
                        id="temporality"
                        name="temporality"
                        placeholder="temporality"
                        value="${this.params.dataSourceFile.dataSource.api
                          .temporality}"
                        >temporality</vscode-text-field
                      >
                    </div>
                    <div class="params-wrapper" id="filter-wrapper">
                      <label>filter</label>
                      ${this.generateAPIListParams(
                        "filter",
                        this.params.dataSourceFile.dataSource.api.filter
                      )}
                    </div>
                    <div class="field-row">
                      <vscode-button
                        id="addFilter"
                        appearance="secondary"
                        class="btn-add-param"
                        @click="${this.addFilter}"
                        >ADD FILTER</vscode-button
                      >
                      <vscode-button
                        id="removeFilter"
                        appearance="secondary"
                        class="btn-remove-param"
                        @click="${this.removeFilter}"
                        >REMOVE FILTER</vscode-button
                      >
                    </div>
                    <div class="params-wrapper" id="groupBy-wrapper">
                      <label>groupBy</label>
                      ${this.generateAPIListParams(
                        "groupBy",
                        this.params.dataSourceFile.dataSource.api.groupBy
                      )}
                    </div>
                    <div class="field-row">
                      <vscode-button
                        id="addGroupBy"
                        appearance="secondary"
                        class="btn-add-param"
                        @click="${this.addGroupBy}"
                        >ADD GROUP BY</vscode-button
                      >
                      <vscode-button
                        id="removeGroupBy"
                        appearance="secondary"
                        class="btn-remove-param"
                        @click="${this.removeGroupBy}"
                        >REMOVE GROUP BY</vscode-button
                      >
                    </div>
                    <div class="params-wrapper" id="agg-wrapper">
                      <label>agg</label>
                      ${this.generateAPIListParams(
                        "agg",
                        this.params.dataSourceFile.dataSource.api.agg
                      )}
                    </div>
                    <div class="field-row">
                      <vscode-button
                        id="addAgg"
                        appearance="secondary"
                        class="btn-add-param"
                        @click="${this.addAgg}"
                        >ADD AGG</vscode-button
                      >
                      <vscode-button
                        id="removeAgg"
                        appearance="secondary"
                        class="btn-remove-param"
                        @click="${this.removeAgg}"
                        >REMOVE AGG</vscode-button
                      >
                    </div>
                    <div class="params-wrapper" id="sortCols-wrapper">
                      <label>sortCols</label>
                      ${this.generateAPIListParams(
                        "sortCols",
                        this.params.dataSourceFile.dataSource.api.sortCols
                      )}
                    </div>
                    <div class="field-row">
                      <vscode-button
                        id="addSortCols"
                        appearance="secondary"
                        class="btn-add-param"
                        @click="${this.addSortCols}"
                        >ADD SORT COLS</vscode-button
                      >
                      <vscode-button
                        id="removeSortCols"
                        appearance="secondary"
                        class="btn-remove-param"
                        @click="${this.removeSortCols}"
                        >REMOVE SORT COLS</vscode-button
                      >
                    </div>
                    <div class="params-wrapper" id="slice-wrapper">
                      <label>slice</label>
                      ${this.generateAPIListParams(
                        "slice",
                        this.params.dataSourceFile.dataSource.api.slice
                      )}
                    </div>
                    <div class="field-row">
                      <vscode-button
                        id="addSlice"
                        appearance="secondary"
                        class="btn-add-param"
                        @click="${this.addSlice}"
                        >ADD SLICE</vscode-button
                      >
                      <vscode-button
                        id="removeSlice"
                        appearance="secondary"
                        class="btn-remove-param"
                        @click="${this.removeSlice}"
                        >REMOVE SLICE</vscode-button
                      >
                    </div>
                    <div class="params-wrapper" id="labels-wrapper">
                      <label>labels</label>
                      ${this.generateAPIListParams(
                        "labels",
                        this.params.dataSourceFile.dataSource.api.labels
                      )}
                    </div>
                    <div class="field-row">
                      <vscode-button
                        id="addLabels"
                        appearance="secondary"
                        class="btn-add-param"
                        @click="${this.addLabels}"
                        >ADD LABEL</vscode-button
                      >
                      <vscode-button
                        id="removeLabels"
                        appearance="secondary"
                        class="btn-remove-param"
                        @click="${this.removeLabels}"
                        >REMOVE LABEL</vscode-button
                      >
                    </div>
                  </div>
                </vscode-panel-view>
                <vscode-panel-view id="view-2">
                  <div class="editor-panel">
                    <div class="field-row">
                      <div class="dropdown-container">
                        <label for="selectedTarget">Target</label>
                        ${this.generateTarget(
                          this.params.dataSourceFile.dataSource.qsql
                            .selectedTarget
                        )}
                      </div>
                    </div>
                    <div class="field-row">
                      <vscode-text-area
                        class="text-area"
                        id="qsql"
                        name="qsql"
                        value="${this.params.dataSourceFile.dataSource.api
                          .endTS}"
                        rows="20"
                        >Query</vscode-text-area
                      >
                    </div>
                  </div>
                </vscode-panel-view>
                <vscode-panel-view id="view-3">
                  <div class="editor-panel">
                    <div class="field-row">
                      <vscode-text-area
                        class="text-area"
                        id="sql"
                        value="${this.params.dataSourceFile.dataSource.sql
                          .query}"
                        name="sql"
                        rows="20"
                        >Query</vscode-text-area
                      >
                    </div>
                  </div>
                </vscode-panel-view>
              </vscode-panels>
            </div>
            <div class="actions-wrapper">
              <div class="btn-actions-group">
                <div class="btn-action">
                  <vscode-button
                    id="save"
                    appearance="primary"
                    class="btn-save"
                    @click="${this.save}"
                    >SAVE</vscode-button
                  >
                </div>
                <div class="btn-action">
                  <vscode-button
                    id="run"
                    appearance="secondary"
                    class="btn-run"
                    @click="${this.run}"
                    >RUN</vscode-button
                  >
                </div>
                <div class="btn-action">
                  <vscode-button
                    id="populateScratchpad"
                    appearance="secondary"
                    class="btn-scratchpad"
                    @click="${this.populateScratchpad}"
                    >POPULATE SCRATCHPAD</vscode-button
                  >
                </div>
              </div>
            </div>
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
