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

  sl-button::part(base) {
    --sl-color-primary-600: var(--vscode-button-background);
    --sl-color-primary-500: var(--vscode-button-hoverBackground);
  }

  sl-button[variant="neutral"]::part(base) {
    --sl-color-neutral-600: var(--vscode-input-background);
    --sl-color-neutral-500: var(--vscode-inputOption-hoverBackground);
    --sl-color-neutral-0: var(--vscode-input-foreground);
    border-color: var(--sl-input-border-color);
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
