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

import "../../../fixtures";
import * as assert from "assert";
import * as sinon from "sinon";

import { KdbWelcomeView } from "../../../../src/webview/components/kdbWelcomeView";

describe("kdbWelcomeView", () => {
  let view: KdbWelcomeView;
  beforeEach(() => {
    view = new KdbWelcomeView();
  });
  afterEach(() => {
    sinon.restore();
  });
  it("should exists", () => {
    assert.ok(view);
  });

  it("should keep the startup choice and tell the extension host", () => {
    const post = sinon.stub(view.vscode, "postMessage");
    const handler = handlers(view["render"]())[1];
    handler({ target: { checked: false } });
    assert.strictEqual(view.checked, "false");
    assert.strictEqual(post.calledOnceWith(<any>false), true);
  });

  it("should offer to install KDB-X off Windows", () => {
    const post = sinon.stub(view.vscode, "postMessage");
    const template = view["render"]();
    assert.ok(text(template).includes("Install &amp; Continue"));
    handlers(template)[0]();
    assert.strictEqual(post.calledOnceWith(<any>"install"), true);
  });

  it("should point Windows at WSL or a kdb+ install instead", () => {
    const post = sinon.stub(view.vscode, "postMessage");
    view.windows = "true";
    const template = view["render"]();
    assert.ok(!text(template).includes("Install &amp; Continue"));
    assert.ok(text(template).includes("Windows Subsystem for Linux (WSL)"));
    assert.ok(text(template).includes("Set QHOME"));
    handlers(template)[0]();
    assert.strictEqual(post.calledOnceWith(<any>"qhome"), true);
  });

  it("should link to the REPL and the KDB-X install when q is found", () => {
    const post = sinon.stub(view.vscode, "postMessage");
    view.q = "/home/me/.kx/bin/q";
    const template = view["render"]();
    assert.ok(!text(template).includes("Install &amp; Continue"));
    assert.ok(text(template).includes("/home/me/.kx/bin/q"));
    assert.ok(text(template).includes("Start REPL"));
    assert.ok(text(template).includes("Install KDB-X"));
    const preventDefault = sinon.stub();
    handlers(template)[0]({ preventDefault });
    handlers(template)[1]({ preventDefault });
    sinon.assert.calledTwice(preventDefault);
    assert.deepStrictEqual(post.args, [["repl"], ["install"]]);
  });

  it("should link only to the REPL on Windows when q is found", () => {
    const post = sinon.stub(view.vscode, "postMessage");
    view.windows = "true";
    view.q = "C:\\q\\w64\\q.exe";
    const template = view["render"]();
    assert.ok(text(template).includes("Windows Subsystem for Linux (WSL)"));
    assert.ok(text(template).includes("C:\\q\\w64\\q.exe"));
    assert.ok(!text(template).includes("Set QHOME"));
    assert.ok(!text(template).includes("Install KDB-X"));
    assert.strictEqual(handlers(template).length, 2);
    handlers(template)[0]({ preventDefault() {} });
    assert.strictEqual(post.calledOnceWith(<any>"repl"), true);
  });

  it("should keep the button and link labels on one line", () => {
    for (const [windows, q] of [
      ["", ""],
      ["true", ""],
      ["", "/home/me/.kx/bin/q"],
    ]) {
      view.windows = windows;
      view.q = q;
      const controls =
        text(view["render"]()).match(/<(?:button|a\s+href="#")[^>]*>/g) ?? [];
      assert.ok(controls.length > 0);
      for (const control of controls) assert.ok(/nowrap/.test(control));
    }
  });
});

function text(template: any): string {
  if (typeof template === "string") {
    return template;
  }
  if (!template || typeof template !== "object") {
    return "";
  }
  if (Array.isArray(template)) {
    return template.map(text).join("");
  }
  return [
    ...(template.strings || []),
    ...(template.values || []).map(text),
  ].join("");
}

function handlers(template: any, found: any[] = []): any[] {
  if (!template || typeof template !== "object") {
    return found;
  }
  if (Array.isArray(template)) {
    template.forEach((each) => handlers(each, found));
    return found;
  }
  for (const value of template.values || []) {
    if (typeof value === "function") {
      found.push(value);
    } else {
      handlers(value, found);
    }
  }
  return found;
}
