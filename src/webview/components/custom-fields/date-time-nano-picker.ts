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
import { customElement } from "lit/decorators.js";

import { shoelaceStyles } from "../styles";

@customElement("date-time-nano-picker")
export class DateTimeNanoPicker extends LitElement {
  value = "";
  label = "";
  helpText = "";
  required = false;
  date = new Date().toISOString().slice(0, 10);
  time = "00:00:00";
  nanos = "000000000";

  static styles = [shoelaceStyles];

  static get properties() {
    return {
      value: { type: String },
      label: { type: String },
      helpText: { type: String },
      required: { type: Boolean },
      date: { type: String },
      time: { type: String },
      nanos: { type: String },
    };
  }

  /* istanbul ignore next */
  connectedCallback() {
    super.connectedCallback();
    if (this.value) {
      this.parseQDateTime(this.value);
    }
    this.parseValuesToQDateTime();
  }

  parseQDateTime(qdt: string) {
    const match = qdt.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?$/,
    );
    if (match) {
      const [, yyyy, mm, dd, h, m, s, n = ""] = match;
      this.date = `${yyyy}-${mm}-${dd}`;
      this.time = `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${s.padStart(2, "0")}`;
      this.nanos = n.padEnd(9, "0");
    }
  }

  parseValuesToQDateTime() {
    const [yyyy, mm, dd] = this.date.split("-");
    const [h, m, s] = this.time.split(":");
    const n = this.nanos.padEnd(9, "0").slice(0, 9);
    this.value = `${yyyy}-${mm}-${dd}T${h}:${m}:${s}.${n}`;
    this.requestUpdate();
    this.dispatchValueChanged();
  }

  dispatchValueChanged() {
    this.dispatchEvent(
      new CustomEvent("change", {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /* istanbul ignore next */
  render() {
    return html`
      <div class="nanoseconds-row">
        <label>${this.label + (this.required ? " *" : "")}</label>
      </div>
      <div class="nanoseconds-row">
        <sl-input
          label="Date"
          type="date"
          .value="${this.date}"
          @input=${(e: { target: { value: string } }) => {
            this.date = e.target.value;
            this.parseValuesToQDateTime();
          }}>
        </sl-input>
        <sl-input
          type="text"
          .value="${this.time}"
          label="Time(hh:mm:ss)"
          maxlength="8"
          pattern="^([01]\\d|2[0-3]):([0-5]\\d):([0-5]\\d)$"
          @input=${(e: { target: { value: string } }) => {
            let val = e.target.value.replace(/[^0-9:]/g, "");
            if (/^\d{2}$/.test(val)) val = val + ":";
            if (/^\d{2}:\d{2}$/.test(val)) val = val + ":";
            if (val.length > 8) val = val.slice(0, 8);
            this.time = val;
            e.target.value = this.time;
            this.parseValuesToQDateTime();
          }}
          @blur=${(e: { target: { value: string } }) => {
            let val = e.target.value.replace(/[^0-9]/g, "");
            val = val.padEnd(6, "0").slice(0, 6);
            const hh = val.slice(0, 2);
            const mm = val.slice(2, 4);
            const ss = val.slice(4, 6);
            const formatted = `${hh}:${mm}:${ss}`;
            this.time = formatted;
            e.target.value = formatted;
          }}>
        </sl-input>
        <sl-input
          label="Nanoseconds"
          maxlength="9"
          pattern="\\d{9}"
          .value=${this.nanos}
          @input=${(e: { target: { value: string } }) => {
            this.nanos = e.target.value;
            this.parseValuesToQDateTime();
          }}
          @blur=${(e: { target: { value: string } }) => {
            let val = e.target.value.replace(/\D/g, "");
            if (val.length < 9) val = val.padEnd(9, "0");
            if (val.length > 9) val = val.slice(0, 9);
            this.nanos = val;
            e.target.value = this.nanos;
          }}></sl-input>
        <sl-input
          class="nanoseconds-timestamp-display"
          label="Timestamp value"
          readonly
          disabled
          .value=${this.value}></sl-input>
      </div>
      <div class="nanoseconds-row">
        <p>${this.helpText}</p>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "date-time-nano-picker": DateTimeNanoPicker;
  }
}
