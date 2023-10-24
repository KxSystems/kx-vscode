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
  .container {
    display: flex;
    flex-direction: row;
    gap: 1em;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 1em;
  }

  .list-item {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 1em;
    justify-content: flex-start;
    align-items: flex-end;
  }

  .button-group {
    display: flex;
    flex-direction: row;
    gap: 4px;
    justify-content: flex-start;
    align-items: flex-end;
  }

  .align-end {
    justify-content: flex-end;
  }

  .grow {
    flex-grow: 1;
  }

  .dropdown {
    min-width: 13em;
  }

  .dropdown.larger {
    min-width: 15.5em;
  }

  .text-field {
    min-width: 13em;
  }

  .text-field.larger {
    min-width: 15.5em;
  }

  .actions {
    margin-top: 4px;
    padding-top: 1em;
  }
`;
