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

export const resetStyles = css`
  html {
    box-sizing: border-box;
    font-size: 13px;
  }

  *,
  *:before,
  *:after {
    box-sizing: inherit;
  }

  body,
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  p,
  ol,
  ul {
    margin: 0;
    padding: 0;
    font-weight: normal;
  }

  img {
    max-width: 100%;
    height: auto;
  }
`;

export const vscodeStyles = css`
  :root {
    --container-padding: 20px;
    --input-padding-vertical: 6px;
    --input-padding-horizontal: 4px;
    --input-margin-vertical: 4px;
    --input-margin-horizontal: 0;
  }

  body {
    padding: 0 var(--container-padding);
    color: var(--vscode-foreground);
    font-size: var(--vscode-font-size);
    font-weight: var(--vscode-font-weight);
    font-family: var(--vscode-font-family);
    background-color: var(--vscode-editor-background);
  }

  ol,
  ul {
    padding-left: var(--container-padding);
  }

  body > *,
  form > * {
    margin-block-start: var(--input-margin-vertical);
    margin-block-end: var(--input-margin-vertical);
  }

  *:focus {
    outline-color: var(--vscode-focusBorder) !important;
  }

  a {
    color: var(--vscode-textLink-foreground);
  }

  a:hover,
  a:active {
    color: var(--vscode-textLink-activeForeground);
  }

  code {
    font-size: var(--vscode-editor-font-size);
    font-family: var(--vscode-editor-font-family);
  }

  button {
    border: none;
    padding: var(--input-padding-vertical) var(--input-padding-horizontal);
    width: 100%;
    text-align: center;
    outline: 1px solid transparent;
    outline-offset: 2px !important;
    color: var(--vscode-button-foreground);
    background: var(--vscode-button-background);
  }

  button:hover {
    cursor: pointer;
    background: var(--vscode-button-hoverBackground);
  }

  button:focus {
    outline-color: var(--vscode-focusBorder);
  }

  button.secondary {
    color: var(--vscode-button-secondaryForeground);
    background: var(--vscode-button-secondaryBackground);
  }

  button.secondary:hover {
    background: var(--vscode-button-secondaryHoverBackground);
  }

  input:not([type="checkbox"]),
  textarea {
    display: block;
    width: 100%;
    border: none;
    font-family: var(--vscode-font-family);
    padding: var(--input-padding-vertical) var(--input-padding-horizontal);
    color: var(--vscode-input-foreground);
    outline-color: var(--vscode-input-border);
    background-color: var(--vscode-input-background);
  }

  input::placeholder,
  textarea::placeholder {
    color: var(--vscode-input-placeholderForeground);
  }
`;

export const dataSourcesPanelStyles = css`
  .datasource-view-container {
    width: 100%;
    height: 100%;
  }

  .header-wrapper {
    display: block;
    width: 100%;
    float: left;
  }

  .btn-types-group {
    display: block;
    float: left;
  }

  .btn-api,
  .btn-qsql,
  .btn-sql {
    width: 100px;
    margin: 0 5px;
  }

  .btn-api {
    margin-right: 5px;
    margin-left: 0px;
  }

  .btn-actions-group {
    display: block;
    float: right;
  }

  .content-wrapper {
    display: block;
    width: 100%;
    float: left;
    margin-top: 25px;
  }

  .form-wrapper {
    display: block;
    width: calc(100vw - 240px);
    float: left;
    overflow: scroll;
  }
  .actions-wrapper {
    display: grid;
    width: 150px;
    min-width: 120px;
    margin-top: 130px;
  }

  .btn-action {
    width: 100%;
    margin: 0 10px 10px 10px;
  }

  .btn-save,
  .btn-run,
  .btn-scratchpad {
    width: 120px;
  }

  .api-editor,
  .qsql-editor,
  .sql-editor {
    width: 100%;
    height: 100%;
    border: 1px solid #ccc;
    border-radius: 5px;
    padding: 5px;
    font-family: monospace;
  }
  .editor-panel {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    align-content: center;
    justify-content: space-between;
    align-items: center;
  }

  .field-row {
    width: 100%;
    float: left;
    margin-bottom: 10px;
  }

  .dropdown-container {
    width: 100%;
    align-items: center;
    align-content: center;
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
  }
  .dropdown {
    width: 100%;
    min-width: 530px;
  }

  .text-input {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    align-content: space-between;
    align-items: center;
    width: 100%;
  }

  .text-input > .root {
    width: 100%;
  }

  .text-area {
    width: 100%;
  }

  .params-wrapper {
    display: flex;
    flex-wrap: wrap;
    align-content: space-between;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }

  label {
    min-width: 65px;
    margin-bottom: 5px;
  }

  .name-row {
    display: grid;
  }
`;
