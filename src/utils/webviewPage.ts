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

/**
 * The document a webview's shadow roots sit in. VS Code injects `padding: 0
 * 20px` on the body of every webview, which each of these pages insets itself
 * instead — so the reset cancels it and hands the page the theme's font and
 * colours.
 *
 * Inline rather than a stylesheet of its own: it is a dozen lines that every
 * page needs before it paints, and a linked file is one more round trip and
 * one more thing to ship.
 */
export function webviewReset(nonce: string) {
  return /* html */ `<style nonce="${nonce}">
      html,
      body {
        margin: 0;
        padding: 0;
        line-height: 1.5;
        font-size: var(--vscode-font-size);
      }

      body {
        box-sizing: border-box;
        font-family: var(--vscode-font-family);
        font-weight: var(--vscode-font-weight);
        -webkit-font-smoothing: antialiased;
        -webkit-text-size-adjust: 100%;
        color: var(--vscode-foreground);
        background-color: var(--vscode-editor-background);
      }
    </style>`;
}
