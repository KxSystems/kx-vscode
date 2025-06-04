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

import { css } from "lit";

export const shoelaceStyles = css`
  :host {
    box-sizing: border-box;
  }

  sl-input,
  sl-select {
    --sl-focus-ring-width: 0;
  }

  sl-select::part(listbox) {
    --sl-panel-border-color: var(--vscode-focusBorder);
  }

  sl-option::part(base) {
    --sl-color-primary-600: var(--vscode-button-background);
    --sl-color-neutral-700: var(--vscode-input-foreground);
    --sl-color-neutral-1000: var(--vscode-input-foreground);
    --sl-color-neutral-100: var(--vscode-inputOption-hoverBackground);
  }

  sl-button::part(base),
  sl-radio-button::part(base) {
    --sl-color-primary-600: var(--vscode-button-background);
    --sl-color-primary-500: var(--vscode-button-hoverBackground);
  }

  sl-button[variant="neutral"]::part(base) {
    --sl-color-neutral-600: var(--vscode-input-background);
    --sl-color-neutral-500: var(--vscode-inputOption-hoverBackground);
    --sl-color-neutral-0: var(--vscode-input-foreground);
    border-color: var(--sl-input-border-color);
  }

  sl-menu {
    --sl-panel-border-color: var(--vscode-focusBorder);
  }

  sl-menu-item::part(base) {
    --sl-color-primary-600: var(--vscode-button-background);
    --sl-color-neutral-700: var(--vscode-input-foreground);
    --sl-color-neutral-1000: var(--vscode-input-foreground);
    --sl-color-neutral-100: var(--vscode-inputOption-hoverBackground);
  }

  sl-tab-group::part(tabs) {
    --track-width: 1px;
    --track-color: var(--vscode-inputOption-hoverBackground);
    --indicator-color: var(--vscode-focusBorder);
  }

  sl-tab::part(base) {
    --sl-color-primary-600: var(--vscode-foreground);
  }

  sl-checkbox::part(base) {
    --sl-color-primary-600: var(--vscode-button-background);
    --sl-input-background-color-hover: var(--vscode-button-hoverBackground);
  }

  sl-alert[variant="warning"]::part(base) {
    background-color: #fef4e0;
    color: #d87704;
  }

  sl-alert[variant="primary"]::part(base) {
    background-color: #e0f2fe;
    color: #055a85;
  }

  .remove-param-btn::part(base) {
    padding-top: 3px;
    background: none;
    border: none;
  }

  .nanoseconds-row {
    display: flex;
    gap: 8px;
    align-items: center;
    min-width: 500px;
    & p {
      margin-top: 0;
      margin-bottom: 0;
    }
  }
`;

export const dataSourceStyles = css`
  .container {
    display: flex;
    flex-flow: row nowrap;
    overflow-x: auto;
    gap: var(--sl-spacing-medium);
    padding-left: var(--sl-spacing-medium);
    padding-right: var(--sl-spacing-medium);
  }

  .tabs {
    flex-grow: 1;
  }

  .actions {
    display: flex;
    flex-flow: column nowrap;
    flex-grow: 0;
    gap: var(--sl-spacing-x-small);
    margin-top: calc(
      1rem * var(--sl-line-height-dense) + 3 * var(--sl-spacing-medium)
    );
  }

  .actions sl-button-group > sl-button {
    flex-grow: 1;
  }

  sl-tab::part(base) {
    padding: var(--sl-spacing-medium);
  }

  sl-select::part(listbox) {
    min-width: max-content;
  }

  sl-tab-panel {
    --padding: 0;
    overflow-y: scroll;
    padding-top: var(--sl-spacing-medium);
    padding-bottom: var(--sl-spacing-medium);
    height: calc(
      100vh - 1rem * var(--sl-line-height-dense) - 2 * var(--sl-spacing-medium)
    );
  }

  sl-input,
  sl-select {
    min-width: 13rem;
    max-width: 13rem;
  }

  sl-checkbox {
    padding-bottom: var(--sl-spacing-2x-small);
  }

  .col {
    display: flex;
    flex-direction: column;
    gap: var(--sl-spacing-x-small);
  }

  .row {
    display: flex;
    flex-direction: row;
    gap: var(--sl-spacing-x-small);
    align-items: flex-end;
  }

  .fix-multi-checkbox {
    margin-top: 28px;
  }

  .btn-opt-text {
    margin-left: 1rem;
  }

  .btn-opt-divider {
    border: solid var(--sl-panel-border-width) var(--vscode-focusBorder) !important;
  }

  .remove-param-btn {
    padding-left: 10px;
  }

  .opt-param-field {
    display: flex;
    align-items: center;
  }

  .reset-widths-limit {
    min-width: 0%;
    max-width: 100%;
  }
`;

export const chartStyles = css`
  .frame {
    width: 100vw;
    height: 100vh;
  }

  .plot {
    width: auto;
    max-height: 100%;
  }
`;

export const vscodeStyles = css`
  .dropdown-container {
    box-sizing: border-box;
    display: flex;
    flex-flow: column nowrap;
    align-items: flex-start;
    justify-content: flex-start;
  }

  .dropdown-container label {
    display: block;
    color: var(--vscode-foreground);
    cursor: pointer;
    font-size: var(--vscode-font-size);
    line-height: normal;
    margin-bottom: 2px;
  }

  vscode-dropdown::part(listbox) {
    width: unset !important;
    min-width: 12em;
  }
`;

export const kdbStyles = css`
  .w-full {
    min-width: 50em;
  }

  .col {
    display: flex;
    flex-direction: column;
    gap: 1em;
  }

  .row {
    display: flex;
    flex-direction: row;
    gap: 1em;
  }

  .align-start {
    justify-content: flex-start;
  }

  .align-end {
    justify-content: flex-end;
  }

  .align-top {
    align-items: flex-start;
  }

  .align-bottom {
    align-items: flex-end;
  }

  .gap-1 {
    gap: 4px;
  }

  .gap-0 {
    gap: 0px;
  }

  .grow {
    flex-grow: 1;
  }

  .mt-1 {
    margin-top: 1em;
  }

  .mb-1 {
    margin-bottom: 1em;
  }

  .mt-6 {
    margin-top: 6em;
  }

  .width-200-px {
    width: 200px;
  }

  .width-10-pct {
    width: 10%;
  }

  .width-20-pct {
    width: 20%;
  }

  .width-30-pct {
    width: 30%;
  }

  .width-40-pct {
    width: 40%;
  }

  .width-50-pct {
    width: 50%;
  }

  .width-60-pct {
    width: 60%;
  }

  .width-70-pct {
    width: 70%;
  }

  .width-80-pct {
    width: 80%;
  }

  .width-90-pct {
    width: 90%;
  }

  .width-97-pct {
    width: 97%;
  }

  .width-98-pct {
    width: 98%;
  }

  .width-100-pct {
    width: 100%;
  }

  .padding-left-10-px {
    padding-left: 10px;
  }

  .display-none {
    display: none;
  }

  .float-left {
    float: left;
  }

  .dropdown,
  .text-field {
    width: 12em;
  }

  .dropdown.larger,
  .text-field.larger {
    width: 14.5em;
  }
`;

export const newConnectionStyles = css`
  .option-title {
    color: var(--vscode-foreground);
    font-size: 12px;
    font-weight: 700;
    line-height: 16px;
    letter-spacing: 0.46px;
    word-wrap: break-word;
  }

  .tabs {
    flex-grow: 1;
  }

  .option-description {
    color: var(--vscode-foreground);
    font-size: 12px;
    font-weight: 400;
    line-height: 16px;
  }

  .option-help {
    opacity: 0.75;
    margin-top: 4px;
  }

  .content-wrapper {
    display: flex;
    flex-flow: row nowrap;
    overflow-x: auto;
    gap: var(--sl-spacing-medium);
    padding-left: var(--sl-spacing-medium);
    padding-right: var(--sl-spacing-medium);
    align-content: center;
    justify-content: center;
    font-family: var(--vscode-font-family);
  }

  .form-wrapper {
    width: 600px;
  }

  .text-field.x-larger {
    width: 36.5em;
  }

  .header-text-wrapper {
    color: var(--vscode-foreground);
    width: 100%;
    border: solid 1px transparent;
    box-sizing: border-box;
    padding: 10px calc((var(4) + 2) * 1px);
  }

  h2 {
    font-weight: 400;
    margin-top: 0;
    margin-bottom: 5px;
    font-size: 1.5em;
    line-height: normal;
    color: var(--vscode-foreground);
    letter-spacing: 0.46px;
    word-wrap: break-word;
  }

  .dropdown.larger,
  .text-field.larger {
    width: 20em;
  }

  .modal {
    position: fixed;
    top: 50%;
    transform: translate(-50%, -50%);
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    padding: 1rem;
    z-index: 1001;
    border: 1px solid var(--vscode-editorWidget-border);
    box-shadow: 0 2px 10px var(--vscode-widget-shadow);
  }

  .modal-content h2 {
    color: var(--vscode-editor-foreground);
  }
  vscode-text-field,
  vscode-dropdown,
  vscode-button {
    --vscode-input-background: var(--vscode-editor-background);
    --vscode-input-foreground: var(--vscode-editor-foreground);
    --vscode-input-border: var(--vscode-editorWidget-border);
  }

  .overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
  }

  .lbl-dropdown-container {
    width: 350px;
  }

  .lbl-dropdown-container-field-wrapper {
    margin-bottom: 0.5em;
    width: 100%;
    display: flex;
    flex-wrap: nowrap;
    justify-content: space-between;
  }
`;
