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

export const kdbStyles = css`
  .col {
    gap: 1em;
  }

  .row {
    gap: 1em;
  }

  .gap-0 {
    gap: 0px;
  }

  .grow {
    flex-grow: 1;
  }

  .dropdown,
  .text-field {
    width: 12em;
  }
`;

export const newConnectionStyles = css`
  /* A section title, and the help text under a field. Both inherit the theme's
     family, size and colour from the shadow root, so each says only what it
     differs from it by — a size of their own would be a size the user's
     --vscode-font-size setting cannot move. The weight is the one a disclosure's
     summary carries, so a titled section and a collapsed one read alike. */
  .option-title {
    font-weight: 600;
    word-wrap: break-word;
  }

  .tabs {
    flex-grow: 1;
  }

  .option-description {
    font-weight: 400;
  }

  .option-help {
    opacity: 0.75;
    margin-top: 4px;
  }

  .content-wrapper {
    display: flex;
    flex-flow: row nowrap;
    overflow-x: auto;
    gap: 1em;
    padding-left: 1em;
    padding-right: 1em;
    align-content: center;
    justify-content: center;
    font-family: var(--vscode-font-family);
  }

  /* Wide as it can be up to the width the form was drawn for. A width of its
     own would not shrink, and the wrapper's overflow-x would turn a narrow
     panel into a horizontal scrollbar rather than a narrower form. */
  .form-wrapper {
    width: 100%;
    max-width: 600px;
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
    box-shadow: 0 2px 10px var(--vscode-widget-shadow, transparent);
  }

  .modal-content h2 {
    color: var(--vscode-editor-foreground);
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

  .labels {
    width: 100%;
    max-width: 350px;
  }
`;
