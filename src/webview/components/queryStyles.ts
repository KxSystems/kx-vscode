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

export const queryStyles = css`
  .container {
    display: flex;
    flex-flow: column nowrap;
  }

  .toolbar {
    display: flex;
    flex-flow: row wrap;
    align-items: center;
    gap: 0.15em;
    position: sticky;
    top: 0;
    z-index: 1;
    background-color: var(--vscode-editor-background);
    border-bottom: 1px solid var(--vscode-panel-border, transparent);
    padding: 0.35em 0.5em;
  }

  .tool {
    display: inline-flex;
    align-items: center;
    gap: 0.35em;
    background: none;
    border: 1px solid transparent;
    border-radius: 5px;
    color: var(--vscode-foreground);
    padding: 0.25em 0.5em;
  }

  .tool:hover {
    background-color: var(--vscode-toolbar-hoverBackground, transparent);
    outline: 1px dotted var(--vscode-toolbar-hoverOutline, transparent);
  }

  .tool:active {
    background-color: var(--vscode-toolbar-activeBackground, transparent);
  }

  /* The face itself is registered by the page — see queryEditorProvider. */
  .codicon {
    flex: 0 0 auto;
    font: normal normal normal 16px/1 codicon;
    text-decoration: none;
    text-rendering: auto;
    text-align: center;
    user-select: none;
    -webkit-font-smoothing: antialiased;
  }

  /* A rule between groups of tools, as the notebook toolbar has. It carries no
     content, so it needs a basis it cannot shrink out of, and the separator
     colour is already translucent — dimming it again left nothing to see. */
  .separator {
    flex: 0 0 1px;
    align-self: stretch;
    margin: 0.25em 0.35em;
    background-color: var(--vscode-menu-separatorBackground, currentColor);
  }

  .form {
    display: flex;
    flex-flow: column nowrap;
    gap: 0.75em;
    max-width: 60em;
    margin: 1em;
  }

  /* A query is read as code, so it is shown in the editor's own face. */
  .code {
    font-family: var(--vscode-editor-font-family);
    line-height: 1.4;
  }

  .nanos {
    flex: 0 0 8em;
    font-family: var(--vscode-editor-font-family);
  }

  .details {
    color: var(--vscode-descriptionForeground);
  }

  .params {
    display: flex;
    flex-flow: column nowrap;
    gap: 0.75em;
    padding-top: 0.5em;
  }

  .param {
    display: flex;
    flex-flow: row nowrap;
    align-items: flex-start;
    gap: 0.5em;
  }

  /* The control and the button that removes it share a row, so the button
     lines up with the control rather than with the label above it. */
  .control {
    align-items: center;
  }

  .multitype {
    display: flex;
    flex-flow: row nowrap;
    align-items: flex-start;
    gap: 0.5em;
  }

  .types {
    flex: 0 0 12em;
  }

  .remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    padding: 0.3em 0.5em;
  }

  .rows .field {
    gap: 0.35em;
  }

  .rows .row {
    align-items: center;
  }

  .row-field {
    flex: 1 1 auto;
    min-width: 0;
  }

  .add-param {
    flex: 0 0 auto;
    align-self: flex-start;
    width: 14em;
  }
`;
