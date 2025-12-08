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
import { customElement, property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { shoelaceStyles } from "./styles";

@customElement("kdb-results-view")
export class KdbResultsView extends LitElement {
  static readonly styles = [
    shoelaceStyles,
    css`
      html,
      body {
        margin: 0;
        padding: 0;
      }
      table {
        margin: 0;
        padding: 0;
        thead {
          position: sticky;
          top: 0;
          z-index: 1000;
          background-color: var(--vscode-editor-background);
        }
      }
    `,
  ];

  @property()
  dark = "";
  @state()
  columnDefs = [];
  @state()
  results = [];
  @state()
  content = "";

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
        break;
      case "setResultsContent":
        this.content = event.data.results;
        this.columnDefs = [];
        this.results = [];
        break;
      default:
      case "loading":
        break;
    }
  };

  protected render() {
    return html`
      ${this.content
        ? unsafeHTML(this.content)
        : html`
            <table>
              <thead>
                <tr>
                  ${this.columnDefs.map(
                    (col: any) => html`<th nowrap>${col.headerName}</th>`,
                  )}
                </tr>
              </thead>
              <tbody>
                ${this.results.map(
                  (row: any) => html`
                    <tr>
                      ${this.columnDefs.map(
                        (col: any) => html`<td nowrap>${row[col.field]}</td>`,
                      )}
                    </tr>
                  `,
                )}
                <tr></tr>
              </tbody>
            </table>
          `}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "kdb-results-view": KdbResultsView;
  }
}

/* c8 ignore stop */
