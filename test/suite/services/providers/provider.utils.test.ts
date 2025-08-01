/*
 * Copyright (c) 1998-2025 KX Systems Inc.
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

import { WebviewPanel } from "vscode";

export function createPanel() {
  const listeners = {
    onDidReceiveMessage: undefined,
    postMessage: undefined,
    onDidChangeViewState: undefined,
    onDidDispose: undefined,
  };
  const panel = <WebviewPanel>{
    webview: {
      onDidReceiveMessage(e) {
        listeners.onDidReceiveMessage = e;
      },
      postMessage(e) {
        listeners.postMessage = e;
      },
    },
    onDidChangeViewState(e) {
      listeners.onDidChangeViewState = e;
    },
    onDidDispose(e) {
      listeners.onDidDispose = e;
    },
  };
  return {
    panel,
    listeners,
  };
}
