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

/* c8 ignore start */

import { LitElement, css, html } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { when } from "lit/directives/when.js";

import { shoelaceStyles } from "./styles";

@customElement("kdb-results-view")
export class KdbResultsView extends LitElement {
  static readonly styles = [
    shoelaceStyles,
    css`
      table,
      thead,
      tbody,
      tr,
      th,
      td,
      p {
        margin: 0;
        padding: 0;
      }
      table {
        border-spacing: 0;
        border-collapse: separate;
        min-width: 100vw;
      }
      thead {
        position: sticky;
        top: 0;
        z-index: 1000;
        background-color: var(--vscode-editor-background);
        tr {
          background-color: var(--vscode-keybindingTable-rowsBackground);
        }
        th:last-child {
          width: 100%;
        }
      }
      tbody {
        tr:nth-child(even) {
          background-color: var(--vscode-keybindingTable-rowsBackground);
        }
      }
      th,
      td {
        text-align: left;
        border-bottom-color: var(--vscode-editorGroup-border);
        border-bottom-style: solid;
        border-bottom-width: 1px;
      }
      th {
        font-weight: 600;
        line-height: 1.25;
        padding: 0.25em 0.5em;
      }
      td {
        padding: 0 0.5em;
      }
      .faint {
        font-weight: 200;
      }
      .container {
        width: 100vw;
        height: 100vh;
        overflow: auto;
      }
      .pager {
        position: fixed;
        right: 1em;
        bottom: 0.75em;
        opacity: 0.5;
        background-color: var(--vscode-editor-background);
      }
      .pager:hover {
        opacity: 1;
      }
    `,
  ];

  @property({ type: Number })
  size = 100;

  @state()
  columnDefs = [];
  @state()
  results = [];
  @state()
  page = 0;
  @state()
  rows = [];
  @state()
  content = "";

  @query(".container")
  container: HTMLElement | undefined;

  private get total() {
    return Math.ceil(this.results.length / this.size);
  }

  readonly vscode = acquireVsCodeApi();

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("message", this.message);
  }

  disconnectedCallback() {
    window.removeEventListener("message", this.message);
    super.disconnectedCallback();
  }

  message = (event: MessageEvent) => {
    switch (event.data.command) {
      case "setGridDatasource":
        this.columnDefs = event.data.columnDefs;
        this.results = event.data.results;
        this.content = "";
        this.page = 0;
        this.renderPage();
        break;
      case "setResultsContent":
        this.content = event.data.results;
        this.columnDefs = [];
        this.results = [];
        this.rows = [];
        this.page = 0;
        break;
      default:
      case "loading":
        break;
    }
  };

  private toTop() {
    if (this.container) this.container.scrollTop = 0;
  }

  private renderPage() {
    this.rows = this.results.slice(
      this.size * this.page,
      this.size * this.page + this.size,
    );
    this.toTop();
  }

  private getHeader(header: string) {
    const parts = header.split("[");
    let type = parts[1];
    if (type) type = type.slice(0, -1);
    return type
      ? html`${parts[0]}<br /><span class="faint">${type}</span>`
      : parts[0];
  }

  protected render() {
    return html`
      <div class="container">
        ${this.content
          ? unsafeHTML(this.content)
          : html`
              <table>
                <thead>
                  <tr>
                    ${this.columnDefs.map(
                      (col: any) =>
                        html`<th nowrap>${this.getHeader(col.headerName)}</th>`,
                    )}
                  </tr>
                </thead>
                <tbody>
                  ${this.rows.map(
                    (row: any) => html`
                      <tr class="rows">
                        ${this.columnDefs.map(
                          (col: any) => html`<td nowrap>${row[col.field]}</td>`,
                        )}
                      </tr>
                    `,
                  )}
                </tbody>
              </table>
              ${when(
                this.total > 1,
                () => html`
                  <sl-button-group class="pager">
                    <sl-button
                      variant="neutral"
                      size="small"
                      @click="${() => {
                        this.page = 0;
                        this.renderPage();
                      }}">
                      <svg
                        slot="prefix"
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        fill="currentColor"
                        class="bi bi-chevron-double-left"
                        viewBox="0 0 16 16">
                        <path
                          fill-rule="evenodd"
                          d="M8.354 1.646a.5.5 0 0 1 0 .708L2.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0" />
                        <path
                          fill-rule="evenodd"
                          d="M12.354 1.646a.5.5 0 0 1 0 .708L6.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0" />
                      </svg>
                    </sl-button>
                    <sl-button
                      variant="neutral"
                      size="small"
                      @click="${() => {
                        if (this.page > 0) {
                          this.page--;
                          this.renderPage();
                        }
                      }}">
                      <svg
                        slot="prefix"
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        fill="currentColor"
                        class="bi bi-chevron-left"
                        viewBox="0 0 16 16">
                        <path
                          fill-rule="evenodd"
                          d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0" />
                      </svg>
                    </sl-button>
                    <sl-button variant="neutral" size="small"
                      >${this.page + 1} / ${this.total}</sl-button
                    >
                    <sl-button
                      variant="neutral"
                      size="small"
                      @click="${() => {
                        if (this.page < this.total - 1) {
                          this.page++;
                          this.renderPage();
                        }
                      }}">
                      <svg
                        slot="prefix"
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        fill="currentColor"
                        class="bi bi-chevron-right"
                        viewBox="0 0 16 16">
                        <path
                          fill-rule="evenodd"
                          d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708" />
                      </svg>
                    </sl-button>
                    <sl-button
                      variant="neutral"
                      size="small"
                      @click="${() => {
                        this.page = this.total - 1;
                        this.renderPage();
                      }}">
                      <svg
                        slot="prefix"
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        fill="currentColor"
                        class="bi bi-chevron-double-right"
                        viewBox="0 0 16 16">
                        <path
                          fill-rule="evenodd"
                          d="M3.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L9.293 8 3.646 2.354a.5.5 0 0 1 0-.708" />
                        <path
                          fill-rule="evenodd"
                          d="M7.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L13.293 8 7.646 2.354a.5.5 0 0 1 0-.708" />
                      </svg>
                    </sl-button>
                  </sl-button-group>
                `,
              )}
            `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "kdb-results-view": KdbResultsView;
  }
}

/* c8 ignore stop */
