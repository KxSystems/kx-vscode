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
import { customElement, property } from "lit/decorators.js";

import "@vaadin/date-picker";
import "@vaadin/time-picker";
import "@vaadin/text-field";
import { vaadinStyles } from "../styles";

@customElement("date-time-nano-picker")
export class DateTimeNanoPicker extends LitElement {
  @property({ type: String }) value = "";
  @property({ type: String }) label = "";
  @property({ type: Boolean }) required = false;
  @property({ type: String }) date = new Date().toISOString().slice(0, 10);
  @property({ type: String }) time = "00:00:00";
  @property({ type: String }) nanos = "000000000";

  static styles = [vaadinStyles];

  // firstUpdated() {
  //   console.log("oi");
  //   const datePickerVaadin = this.shadowRoot?.querySelector("vaadin-date-picker");

  //   if (datePickerVaadin) {
  //     console.log("tem date");
  //     datePickerVaadin.addEventListener("opened-changed", (e: any) => {
  //       console.log("abriu");
  //       if (e.detail.value) {
  //         setTimeout(() => {
  //           const overlays = Array.from(
  //             document.body.querySelectorAll("vaadin-date-picker-overlay"),
  //           );
  //           console.log("overlays", overlays);
  //           console.log("datePicker", datePickerVaadin);
  //           if (overlays[0]) {
  //             debugger;
  //             (overlays[0] as any).positionTarget = datePickerVaadin;
  //           }
  //         }, 0);
  //       }
  //     });
  //   }
  // }

  render() {
    return html`
      <div class="row">
        <label>${this.label}</label>
      </div>
      <div class="row">
        <vaadin-date-picker
          label="Date"
          .value=${this.date}
          @value-changed=${(e: { detail: { value: string } }) =>
            (this.date = e.detail.value)}></vaadin-date-picker>
        <vaadin-text-field
          label="Time(hh:mm:ss)"
          maxlength="8"
          pattern="^([01]\\d|2[0-3]):([0-5]\\d):([0-5]\\d)$"
          .value=${this.time}
          placeholder="00:00:00"
          @input=${(e: { target: { value: string } }) => {
            let val = e.target.value.replace(/[^0-9:]/g, "");
            if (/^\d{2}$/.test(val)) val = val + ":";
            if (/^\d{2}:\d{2}$/.test(val)) val = val + ":";
            if (val.length > 8) val = val.slice(0, 8);
            this.time = val;
            e.target.value = this.time;
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
          }}></vaadin-text-field>
        <vaadin-text-field
          label="Nanoseconds"
          maxlength="9"
          pattern="\\d{9}"
          .value=${this.nanos}
          @blur=${(e: { target: { value: string } }) => {
            let val = e.target.value.replace(/\D/g, "");
            if (val.length < 9) val = val.padEnd(9, "0");
            if (val.length > 9) val = val.slice(0, 9);
            this.nanos = val;
            e.target.value = this.nanos;
          }}></vaadin-text-field>
      </div>
    `;
  }
}
