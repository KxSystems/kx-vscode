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

import { html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { chartStyles, shoelaceStyles } from "./styles";
import { Plot } from "../../models/plot";

@customElement("kdb-chart-view")
export class KdbChartView extends LitElement {
  static styles = [shoelaceStyles, chartStyles];

  readonly vscode = acquireVsCodeApi();

  @state()
  plot: Plot = { charts: [] };

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("message", this.message);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("message", this.message);
  }

  readonly message = (event: MessageEvent) => {
    this.plot = JSON.parse(event.data);
  };

  render() {
    return html`
      <div class="frame">
        ${this.plot.charts.map(
          (chart) => html`<img src="${chart.data}" class="plot" />`,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "kdb-chart-view": KdbChartView;
  }
}
