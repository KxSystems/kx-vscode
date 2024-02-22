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
  }

  .content-wrapper {
    display: flex;
    align-content: center;
    justify-content: center;
    font-family: var(--vscode-font-family);
  }

  .form-wrapper {
    width: 500px;
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

  h3 {
    color: var(--vscode-foreground);
    font-size: 12px;
    font-weight: 700;
    line-height: 16px;
    letter-spacing: 0.46px;
    word-wrap: break-word;
  }
`;
