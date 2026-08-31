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

/* eslint @typescript-eslint/no-explicit-any: 0 */

import * as assert from "node:assert";
import * as vscode from "vscode";

/**
 * Webview content runs in an iframe the extension host cannot reach into: the
 * only channel is postMessage. So a test opens its own panel, loads the same
 * bundle the real panels load, and drives the component from a script running
 * inside the page, which reports what it found back over that channel. The
 * component, its shadow DOM and the controls it is built from are all real;
 * only the panel hosting them belongs to the test.
 */

// Runs in the page. Grabs the one real handle to the extension host, leaves a
// recorder in its place for the component to pick up, and answers eval
// requests.
const DRIVER = /* javascript */ `
  const host = acquireVsCodeApi();

  window.__posted = [];
  window.acquireVsCodeApi = () => ({
    postMessage: (message) => window.__posted.push(message),
    getState: () => undefined,
    setState: () => undefined,
  });

  window.__find = (path) =>
    path
      .split(">>>")
      .reduce(
        (node, selector) =>
          node && (node.shadowRoot || node).querySelector(selector.trim()),
        document,
      );

  // Types into a field the way the user does: real focus, then an insertion
  // the browser itself performs, so the input event it raises is trusted and
  // carries the same payload a keystroke would. Setting .value and dispatching
  // an event by hand would be untrusted, and would skip selection handling.
  window.__type = (path, text) => {
    const input = typeof path === "string" ? window.__find(path) : path;
    input.focus();
    input.select();
    document.execCommand("insertText", false, text);
  };

  // Waits for the page to catch up, the way test/e2e/utils/index.ts waits for the
  // extension host: a message from the panel is rendered a frame or two later.
  window.__until = async (condition, what) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (condition()) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error("timed out waiting for " + what);
  };

  window.__field = (path, text, tag) => {
    const scope = window.__find(path);
    const field = [
      ...(scope.shadowRoot || scope).querySelectorAll("label.field"),
    ].find(
      (candidate) =>
        candidate.querySelector(".label")?.textContent.trim() === text,
    );
    return field ? field.querySelector(tag || "input") : undefined;
  };

  window.__open = async (path, text) => {
    const scope = window.__find(path);
    const section = [
      ...(scope.shadowRoot || scope).querySelectorAll("details"),
    ].find(
      (candidate) =>
        candidate.querySelector("summary")?.textContent.trim() === text,
    );
    if (!section) {
      throw new Error("no section " + text + " in " + path);
    }
    if (!section.open) {
      section.querySelector("summary").click();
    }
    await scope.updateComplete;
  };

  window.__opened = async (path) => {
    const select = window.__find(path);
    if (!select.open) {
      select.shadowRoot.querySelector(".box").click();
      await select.updateComplete;
    }
    return [...select.shadowRoot.querySelectorAll(".option .text")].map(
      (option) => option.textContent.trim(),
    );
  };

  window.__choose = async (path, text) => {
    const texts = await window.__opened(path);
    const select = window.__find(path);
    const option = [...select.shadowRoot.querySelectorAll(".option")].find(
      (candidate) =>
        candidate.querySelector(".text").textContent.trim() === text,
    );
    if (!option) {
      throw new Error("no option " + text + " in " + path + ", only " + texts);
    }
    option.click();
    await select.updateComplete;
  };

  window.addEventListener("message", async (event) => {
    const request = event.data;
    if (!request || request.__id === undefined) {
      return;
    }
    try {
      const value = await (0, eval)("(" + request.source + ")")(
        ...request.args,
      );
      host.postMessage({ __id: request.__id, value });
    } catch (error) {
      host.postMessage({
        __id: request.__id,
        error: String((error && error.stack) || error),
      });
    }
  });

  host.postMessage({ __ready: true });
`;

declare global {
  // Everything the component under test sent to the extension host.
  const __posted: any[];
  function __find(path: string): any;
  // Replaces what a field holds, as typing it would.
  function __type(path: string, text: string): void;
  function __field(path: string, text: string, tag?: string): any;
  function __open(path: string, text: string): Promise<void>;
  function __opened(path: string): Promise<string[]>;
  function __choose(path: string, text: string): Promise<void>;
  // Waits for the page to render what a message asked for.
  function __until(condition: () => any, what: string): Promise<void>;
}

export type Webview = {
  /**
   * Runs `fn` inside the page and resolves with what it returns, which has to
   * survive being posted as a message. The function is sent as source, so it
   * can only use its arguments and the page's own globals — nothing it closes
   * over in the test comes with it.
   */
  eval<T>(fn: (...args: any[]) => T | Promise<T>, ...args: any[]): Promise<T>;
  // Posts a message the way the real panel does, into window.onmessage.
  send(message: any): Promise<void>;
  dispose(): void;
};

/**
 * Mounts a component and returns a handle on the page it is in. Attributes are
 * the ones the panel hosting it in the product sets, such as the page size the
 * results view is given: without them the test drives a differently configured
 * component than ships. The bundle is the one the real page loads: the query
 * editor is built apart from the rest, so its component only exists in
 * out/query.js.
 */
export async function webview(
  tag: string,
  attributes: Record<string, string> = {},
  bundle = "webview.js",
): Promise<Webview> {
  const extension = vscode.extensions.getExtension("KX.kdb");
  assert.ok(extension, "the kdb extension is not installed in this window");

  const panel = vscode.window.createWebviewPanel(
    "kdb.e2eWebview",
    `end to end ${tag}`,
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [extension.extensionUri],
    },
  );

  const resource = (name: string) =>
    panel.webview.asWebviewUri(
      vscode.Uri.joinPath(extension.extensionUri, "out", name),
    );

  const pending = new Map<
    number,
    { resolve: (value: any) => void; reject: (error: Error) => void }
  >();
  let ready: () => void;
  const loaded = new Promise<void>((resolve) => (ready = resolve));
  let nextId = 0;

  panel.webview.onDidReceiveMessage((message) => {
    if (message.__ready) {
      ready();
      return;
    }
    const request = pending.get(message.__id);
    if (request) {
      pending.delete(message.__id);
      if (message.error) {
        request.reject(new Error(message.error));
      } else {
        request.resolve(message.value);
      }
    }
  });

  panel.webview.html = /* html */ `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <script>${DRIVER}</script>
      <script type="module" src="${resource(bundle)}"></script>
    </head>
    <body></body>
    </html>`;

  await loaded;

  const view: Webview = {
    eval(fn, ...args) {
      const __id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(__id, { resolve, reject });
        panel.webview.postMessage({ __id, source: fn.toString(), args });
      });
    },
    async send(message) {
      await panel.webview.postMessage(message);
    },
    dispose() {
      panel.dispose();
    },
  };

  // The bundle is a module, so it only defines the components after the
  // document has been parsed; nothing can be queried until then.
  await view.eval(
    (name, given: Record<string, string>) =>
      customElements.whenDefined(name).then(() => {
        const element: any = document.createElement(name);
        for (const attribute of Object.keys(given)) {
          element.setAttribute(attribute, given[attribute]);
        }
        document.body.appendChild(element);
        return element.updateComplete;
      }),
    tag,
    attributes,
  );

  return view;
}
