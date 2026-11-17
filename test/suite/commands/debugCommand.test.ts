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

import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";

import {
  DEBUG_TYPE,
  debugFile,
  registerDebugger,
} from "../../../src/commands/debugCommand";
import * as notifications from "../../../src/utils/notifications";

describe("debugCommand", () => {
  function document(path: string, languageId = "q", isDirty = false) {
    return <vscode.TextDocument>(<unknown>{
      uri: vscode.Uri.file(path),
      languageId,
      isDirty,
      save: sinon.stub().resolves(true),
    });
  }

  function editor(doc: vscode.TextDocument) {
    sinon
      .stub(vscode.window, "activeTextEditor")
      .value(<vscode.TextEditor>{ document: doc });
  }

  let startDebugging: sinon.SinonStub;
  let showErrorMessage: sinon.SinonStub;

  beforeEach(() => {
    startDebugging = sinon.stub(vscode.debug, "startDebugging").resolves(true);
    showErrorMessage = sinon.stub(vscode.window, "showErrorMessage");
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("debugFile", () => {
    it("should start a q debug session for the active file", async () => {
      editor(document("/tmp/prog.q"));
      await debugFile();
      sinon.assert.calledOnce(startDebugging);
      assert.deepStrictEqual(startDebugging.firstCall.args[1], {
        type: DEBUG_TYPE,
        request: "launch",
        name: "q: Debug File",
        program: vscode.Uri.file("/tmp/prog.q").fsPath,
      });
    });

    it("should save a dirty file first", async () => {
      const doc = document("/tmp/prog.q", "q", true);
      editor(doc);
      await debugFile();
      sinon.assert.calledOnce(doc.save as sinon.SinonStub);
      sinon.assert.calledOnce(startDebugging);
    });

    it("should debug the file it is given", async () => {
      editor(document("/tmp/other.q"));
      sinon
        .stub(vscode.workspace, "openTextDocument")
        .resolves(document("/tmp/given.q"));
      await debugFile(vscode.Uri.file("/tmp/given.q"));
      assert.strictEqual(
        startDebugging.firstCall.args[1].program,
        vscode.Uri.file("/tmp/given.q").fsPath,
      );
    });

    it("should refuse when there is no active editor", async () => {
      sinon.stub(vscode.window, "activeTextEditor").value(undefined);
      await debugFile();
      sinon.assert.notCalled(startDebugging);
      sinon.assert.calledOnce(showErrorMessage);
    });

    it("should refuse a file that is not q", async () => {
      editor(document("/tmp/prog.py", "python"));
      await debugFile();
      sinon.assert.notCalled(startDebugging);
      sinon.assert.calledOnce(showErrorMessage);
    });

    it("should debug a workbook", async () => {
      editor(document("/tmp/book.kdb.q"));
      await debugFile();
      sinon.assert.notCalled(showErrorMessage);
      assert.strictEqual(
        startDebugging.firstCall.args[1].program,
        vscode.Uri.file("/tmp/book.kdb.q").fsPath,
      );
    });
  });

  describe("registerDebugger", () => {
    let provider: vscode.DebugConfigurationProvider;
    let factory: vscode.DebugAdapterDescriptorFactory;
    let context: vscode.ExtensionContext;
    let started: (session: vscode.DebugSession) => void;
    let terminated: (session: vscode.DebugSession) => void;
    let running: vscode.DebugSession[];

    function launch(program = "/p.q") {
      return provider.resolveDebugConfiguration!(undefined, {
        type: DEBUG_TYPE,
        request: "launch",
        name: "n",
        program,
      });
    }

    function start(id: string, type = DEBUG_TYPE, program = "/run.q") {
      const session = <vscode.DebugSession>(<unknown>{
        id,
        type,
        name: id,
        configuration: { program },
      });
      running.push(session);
      started(session);
      return session;
    }

    beforeEach(() => {
      running = [];
      sinon.stub(vscode.debug, "onDidStartDebugSession").callsFake(((
        listener: (session: vscode.DebugSession) => void,
      ) => {
        started = listener;
        return { dispose() {} };
      }) as never);
      sinon.stub(vscode.debug, "onDidTerminateDebugSession").callsFake(((
        listener: (session: vscode.DebugSession) => void,
      ) => {
        terminated = listener;
        return { dispose() {} };
      }) as never);
      sinon
        .stub(vscode.debug, "registerDebugConfigurationProvider")
        .callsFake((_type, value) => {
          provider = value;
          return { dispose() {} };
        });
      sinon
        .stub(vscode.debug, "registerDebugAdapterDescriptorFactory")
        .callsFake((_type, value) => {
          factory = value;
          return { dispose() {} };
        });
      context = <vscode.ExtensionContext>(<unknown>{
        subscriptions: [],
        asAbsolutePath: (path: string) => `/ext/${path}`,
      });
      registerDebugger(context);
    });

    afterEach(() => {
      running.forEach((session) => terminated(session));
    });

    it("should start without asking when nothing is being debugged", async () => {
      const notify = sinon.stub(notifications, "notify");
      assert.ok(await launch());
      sinon.assert.notCalled(notify);
    });

    it("should keep the running session when the new one is cancelled", async () => {
      start("a");
      const notify = sinon.stub(notifications, "notify").resolves("Cancel");
      const stop = sinon.stub(vscode.debug, "stopDebugging").resolves();
      assert.strictEqual(await launch("/dir/next.q"), undefined);
      sinon.assert.calledWithMatch(
        notify,
        "run.q is being debugged. Stop it and debug next.q instead?",
        sinon.match.any,
        sinon.match.any,
        "Stop and Debug",
        "Cancel",
      );
      sinon.assert.notCalled(stop);
    });

    it("should stop the running session before starting the new one", async () => {
      const session = start("a");
      sinon.stub(notifications, "notify").resolves("Stop and Debug");
      const stop = sinon.stub(vscode.debug, "stopDebugging").resolves();
      const configuration = await launch("/next.q");
      assert.strictEqual(configuration?.program, "/next.q");
      sinon.assert.calledOnceWithExactly(stop, session);
    });

    it("should ask once for requests made while asking", async () => {
      start("a");
      let answer!: (choice: string) => void;
      const notify = sinon
        .stub(notifications, "notify")
        .returns(new Promise((resolve) => (answer = resolve)) as never);
      sinon.stub(vscode.debug, "stopDebugging").resolves();
      const first = launch();
      assert.strictEqual(await launch(), undefined);
      answer("Stop and Debug");
      assert.ok(await first);
      sinon.assert.calledOnce(notify);
    });

    it("should not ask about sessions of other debuggers", async () => {
      start("a", "node");
      const notify = sinon.stub(notifications, "notify");
      assert.ok(await launch());
      sinon.assert.notCalled(notify);
    });

    it("should not ask once the running session has ended", async () => {
      terminated(start("a"));
      const notify = sinon.stub(notifications, "notify");
      assert.ok(await launch());
      sinon.assert.notCalled(notify);
    });

    it("should register its disposables", () => {
      assert.ok(context.subscriptions.length >= 4);
    });

    it("should keep the debug console closed", async () => {
      const configuration = await provider.resolveDebugConfiguration!(
        undefined,
        { type: DEBUG_TYPE, request: "launch", name: "n", program: "/p.q" },
      );
      assert.strictEqual(configuration?.internalConsoleOptions, "neverOpen");
    });

    it("should debug the active q file without a launch.json", async () => {
      editor(document("/tmp/prog.q"));
      const configuration = await provider.resolveDebugConfiguration!(
        undefined,
        { type: "", request: "", name: "" },
      );
      assert.strictEqual(configuration?.type, DEBUG_TYPE);
      assert.strictEqual(configuration?.request, "launch");
      assert.strictEqual(
        configuration?.program,
        vscode.Uri.file("/tmp/prog.q").fsPath,
      );
    });

    it("should not debug without a launch.json when no q file is active", async () => {
      editor(document("/tmp/prog.py", "python"));
      const configuration = await provider.resolveDebugConfiguration!(
        undefined,
        { type: "", request: "", name: "" },
      );
      assert.strictEqual(configuration, undefined);
    });

    it("should create an inline adapter and notify the start", () => {
      const notify = sinon.stub(notifications, "notify");
      const descriptor = factory.createDebugAdapterDescriptor(
        <vscode.DebugSession>{},
        undefined,
      );
      assert.ok(descriptor instanceof vscode.DebugAdapterInlineImplementation);
      sinon.assert.calledWithMatch(
        notify,
        sinon.match.string,
        sinon.match.any,
        {
          telemetry: "Debug.Start",
        },
      );
    });
  });
});
