/*
 * Copyright (c) 1998-2026 KX Systems Inc.
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

export const baseStyles = css`
  :host {
    display: block;
    color: var(--vscode-foreground);
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    --chevron: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 6L8 10.5L12.5 6' fill='none' stroke='black' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    --check: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M14 3.5L6 12L2 8' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  }

  * {
    box-sizing: border-box;
  }

  a {
    color: var(--vscode-textLink-foreground);
  }

  a:hover,
  a:active {
    color: var(--vscode-textLink-activeForeground);
  }

  .field {
    display: flex;
    flex-flow: column nowrap;
    flex: 1 1 auto;
    min-width: 0;
    gap: 0.25em;
  }

  .label {
    display: block;
    font-weight: 600;
  }

  .checkbox,
  .inline {
    display: flex;
    flex-flow: row nowrap;
    align-items: center;
    gap: 0.35em;
    font-weight: normal;
  }

  .help {
    color: var(--vscode-descriptionForeground);
  }

  .row {
    display: flex;
    flex-flow: row nowrap;
    gap: 0.35em;
  }

  .col {
    display: flex;
    flex-flow: column nowrap;
    gap: 0.35em;
  }

  .hidden {
    display: none;
  }

  .mt-1 {
    margin-top: 1em;
  }

  .mb-1 {
    margin-bottom: 1em;
  }

  input,
  textarea {
    color: var(--vscode-input-foreground);
    background-color: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 2px;
    font-family: inherit;
    font-size: inherit;
    padding: 0.25em 0.35em;
    min-width: 0;
    width: 100%;
  }

  /* Drawn rather than native: an unstyled checkbox is painted by the platform
     in the platform's own light, which no accent-color reaches — so it stays
     pale in a dark theme and ignores high contrast. These wear the colours VS
     Code gives its own, with the tick masked so it takes the theme's
     foreground. */
  input[type="checkbox"],
  input[type="radio"] {
    appearance: none;
    -webkit-appearance: none;
    flex: none;
    width: 1.2em;
    height: 1.2em;
    padding: 0;
    display: inline-grid;
    place-content: center;
    cursor: pointer;
    color: var(--vscode-checkbox-foreground, var(--vscode-foreground));
    background-color: var(
      --vscode-checkbox-background,
      var(--vscode-input-background)
    );
    border: 1px solid
      var(--vscode-checkbox-border, var(--vscode-input-border, currentColor));
    border-radius: 3px;
  }

  input[type="radio"] {
    border-radius: 50%;
  }

  input[type="checkbox"]::before,
  input[type="radio"]::before {
    content: "";
    width: 0.8em;
    height: 0.8em;
    background-color: currentColor;
    visibility: hidden;
  }

  input[type="checkbox"]::before {
    mask: var(--check) center / contain no-repeat;
    -webkit-mask: var(--check) center / contain no-repeat;
  }

  input[type="radio"]::before {
    width: 0.55em;
    height: 0.55em;
    border-radius: 50%;
  }

  input[type="checkbox"]:checked::before,
  input[type="radio"]:checked::before {
    visibility: visible;
  }

  input[type="checkbox"]:disabled,
  input[type="radio"]:disabled {
    cursor: default;
    opacity: 0.5;
  }

  input:focus-visible,
  textarea:focus-visible,
  button:focus-visible,
  summary:focus-visible {
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: -1px;
  }

  /* Outside the box rather than inset: a control this small has no room to
     spare a ring of its border to the focus outline. */
  input[type="checkbox"]:focus-visible,
  input[type="radio"]:focus-visible {
    outline: 1px solid var(--vscode-focusBorder);
    outline-offset: 1px;
  }

  input:invalid {
    border-color: var(--vscode-inputValidation-errorBorder);
  }

  textarea {
    resize: vertical;
  }

  button {
    color: var(--vscode-button-secondaryForeground);
    background-color: var(
      --vscode-button-secondaryBackground,
      var(--vscode-button-background)
    );
    border: 1px solid var(--vscode-button-border, transparent);
    border-radius: 2px;
    cursor: pointer;
    font-family: inherit;
    font-size: inherit;
    padding: 0.35em 0.75em;
  }

  button:hover {
    background-color: var(
      --vscode-button-secondaryHoverBackground,
      var(--vscode-button-hoverBackground)
    );
  }

  button:disabled {
    cursor: default;
    opacity: 0.5;
  }

  button.primary {
    color: var(--vscode-button-foreground);
    background-color: var(--vscode-button-background);
  }

  button.primary:hover {
    background-color: var(--vscode-button-hoverBackground);
  }

  /* A disclosure in the shape VS Code gives its own collapsible sections: the
     platform's triangle traded for a chevron that turns where it opens, drawn
     as a mask so it takes the theme's foreground. */
  summary {
    display: flex;
    flex-flow: row nowrap;
    align-items: center;
    gap: 0.35em;
    padding: 0.25em 0;
    cursor: pointer;
    font-weight: 600;
    list-style: none;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  summary::before {
    content: "";
    flex: none;
    width: 0.9em;
    height: 0.9em;
    background-color: currentColor;
    mask: var(--chevron) center / contain no-repeat;
    -webkit-mask: var(--chevron) center / contain no-repeat;
    transform: rotate(-90deg);
  }

  details[open] > summary::before {
    transform: none;
  }

  /* What a disclosure holds. The rhythm is the section's rather than each
     row's: the rows inside come from forms that space themselves out a level
     up, so left to themselves they run into each other. */
  .section {
    display: flex;
    flex-flow: column nowrap;
    gap: 0.75em;
    padding: 0.5em 0;
  }

  .notice {
    border-left: 3px solid var(--vscode-focusBorder);
    background-color: var(--vscode-textBlockQuote-background, transparent);
    margin: 0;
    padding: 0.5em 0.75em;
  }

  .notice.warning {
    border-left-color: var(--vscode-editorWarning-foreground);
  }

  /* A row of tabs, and the panel below it. */
  .tabs {
    display: flex;
    flex-flow: row wrap;
    gap: 0.25em;
    border-bottom: 1px solid var(--vscode-panel-border, transparent);
  }

  .tab {
    background: none;
    border: none;
    border-bottom: 1px solid transparent;
    border-radius: 0;
    color: var(--vscode-foreground);
    margin-bottom: -1px;
    opacity: 0.7;
  }

  .tab:hover {
    background-color: var(--vscode-toolbar-hoverBackground, transparent);
    outline: 1px dotted var(--vscode-toolbar-hoverOutline, transparent);
  }

  .tab[aria-selected="true"] {
    border-bottom-color: var(--vscode-focusBorder);
    opacity: 1;
  }
`;
