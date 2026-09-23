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
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as sinon from "sinon";
import * as vscode from "vscode";

import { ext } from "../../../src/extensionVariables";
import { showRegistrationNotification } from "../../../src/utils/registration";

/**
 * The newsletter notification, in the parts a user meets it in: whether it is
 * raised at all, what it says, and what each of the ways out of it does.
 *
 * The wording is asserted literally. It is the whole of what a user is shown,
 * so a change to it is a change to the product and should be made deliberately
 * rather than passed through by a test that only counts the buttons.
 */

const MESSAGE = "Subscribe to the kdb VS Code extension newsletter?";
const OPT_IN = "Opt-In";
const IGNORE = "Ignore";

const SETTING = "kdb.hideSubscribeRegistrationNotification";

/**
 * The notification is raised without being awaited — showRegistrationNotification
 * answers before the user does — so an assertion on what an answer led to has to
 * let the answer be handled first.
 */
const answered = () => new Promise((done) => setImmediate(done));

describe("Registration", () => {
  let getConfigurationStub: sinon.SinonStub;
  let showInformationMessageStub: sinon.SinonStub;

  beforeEach(() => {
    getConfigurationStub = sinon.stub(vscode.workspace, "getConfiguration");
    showInformationMessageStub = sinon.stub(
      vscode.window,
      "showInformationMessage",
    ) as sinon.SinonStub<
      [
        message: string,
        options: vscode.MessageOptions,
        ...items: vscode.MessageItem[],
      ],
      Thenable<vscode.MessageItem>
    >;
  });

  afterEach(() => {
    getConfigurationStub.restore();
    showInformationMessageStub.restore();
  });

  it("should show registration notification if setting is false", async () => {
    getConfigurationStub.returns({
      get: sinon.stub().returns(false),
      update: sinon.stub(),
    });
    showInformationMessageStub.resolves("Opt-In");
    await showRegistrationNotification();
    sinon.assert.calledOnce(showInformationMessageStub);
  });

  it("should not show registration notification if setting is true", async () => {
    getConfigurationStub.returns({
      get: sinon.stub().returns(true),
      update: sinon.stub(),
    });
    await showRegistrationNotification();
    sinon.assert.notCalled(showInformationMessageStub);
  });

  describe("the newsletter notification", () => {
    let openExternal: sinon.SinonStub;
    let update: sinon.SinonStub;

    beforeEach(() => {
      openExternal = sinon.stub(vscode.env, "openExternal").resolves(true);
      update = sinon.stub().resolves();
      showInformationMessageStub.resolves(undefined);
      getConfigurationStub.returns({
        get: sinon.stub().returns(false),
        update,
      });
    });

    afterEach(() => {
      openExternal.restore();
    });

    const raise = async () => {
      showRegistrationNotification();
      await answered();
    };

    it("asks in the wording the user is shown", async () => {
      await raise();

      assert.strictEqual(showInformationMessageStub.firstCall.args[0], MESSAGE);
    });

    it("offers opting in and ignoring it, in that order", async () => {
      await raise();

      assert.deepStrictEqual(
        showInformationMessageStub.firstCall.args.slice(1),
        [OPT_IN, IGNORE],
      );
    });

    it("opens the newsletter when the user opts in", async () => {
      showInformationMessageStub.resolves(OPT_IN);

      await raise();

      assert.strictEqual(
        openExternal.firstCall.args[0].toString(),
        ext.kdbNewsletterUrl,
      );
      sinon.assert.notCalled(update);
    });

    /**
     * Ignoring is not "not now": it is the only answer that turns the
     * notification off, so it hides it for good and the user is never asked
     * again.
     */
    it("stops asking when the user ignores it", async () => {
      showInformationMessageStub.resolves(IGNORE);

      await raise();

      sinon.assert.calledOnceWithExactly(
        update,
        SETTING,
        true,
        vscode.ConfigurationTarget.Global,
      );
      sinon.assert.notCalled(openExternal);
    });

    /**
     * Closing the notification with its × resolves the same way a notification
     * that scrolled out of sight does: with nothing. It is not an answer, so
     * neither the newsletter nor the setting may be touched by it, and the user
     * is asked again next time.
     */
    it("does nothing when the notification is closed", async () => {
      showInformationMessageStub.resolves(undefined);

      await raise();

      sinon.assert.notCalled(openExternal);
      sinon.assert.notCalled(update);
    });

    it("asks nothing at all once the setting hides it", async () => {
      getConfigurationStub.returns({
        get: sinon.stub().returns(true),
        update,
      });

      await raise();

      sinon.assert.notCalled(showInformationMessageStub);
      sinon.assert.notCalled(openExternal);
      sinon.assert.notCalled(update);
    });
  });

  describe("the setting that hides the newsletter notification", () => {
    let declared: any;

    before(() => {
      const config = JSON.parse(
        readFileSync(
          resolve(__dirname, "..", "..", "..", "..", "package.json"),
          { encoding: "utf8" },
        ),
      );
      declared = config.contributes.configuration.properties[SETTING];
    });

    it("is offered in settings as a toggle that starts off", () => {
      assert.deepStrictEqual(declared, {
        type: "boolean",
        description: "Hide subscribe for registration notification",
        default: false,
        scope: "machine",
      });
    });
  });
});
