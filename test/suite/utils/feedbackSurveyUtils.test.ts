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
import {
  feedbackSurveyDialog,
  handleFeedbackSurvey,
} from "../../../src/utils/feedbackSurveyUtils";

/**
 * The survey notification, in the three parts a user meets it in: when it is
 * raised, what it says, and what each of the ways out of it does.
 *
 * The wording is asserted literally. It is the whole of what a user is shown,
 * so a change to it is a change to the product and should be made deliberately
 * rather than passed through by a test that only counts the buttons.
 */

const MESSAGE =
  "Got 2 Minutes? Help us make the KX extension even better for your workflows.";
const TAKE_SURVEY = "Take Survey";
const SILENCE = "Don't show me this message next time";

const SETTING = "kdb.hideSurvey";

describe("FeedbackSurveyUtils", () => {
  describe("feedbackSurveyDialog", () => {
    let showSurveyDialogStub: sinon.SinonStub;

    beforeEach(() => {
      showSurveyDialogStub = sinon
        .stub(vscode.window, "showInformationMessage")
        .resolves();
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should increment extSurveyTriggerCount and return immediately if hideSurvey is true", async () => {
      const result = await feedbackSurveyDialog(false, 0, true);
      assert.deepStrictEqual(result, {
        sawSurveyAlready: false,
        extSurveyTriggerCount: 1,
      });
      sinon.assert.notCalled(showSurveyDialogStub);
    });

    it("should set sawSurveyAlready to true and reset extSurveyTriggerCount when extSurveyTriggerCount >= 3 and sawSurveyAlready is false", async () => {
      const result = await feedbackSurveyDialog(false, 3, false);
      assert.deepStrictEqual(result, {
        sawSurveyAlready: true,
        extSurveyTriggerCount: 0,
      });
      sinon.assert.calledOnce(showSurveyDialogStub);
    });

    it("should reset extSurveyTriggerCount when extSurveyTriggerCount >= 5 and sawSurveyAlready is true", async () => {
      const result = await feedbackSurveyDialog(true, 5, false);
      assert.deepStrictEqual(result, {
        sawSurveyAlready: true,
        extSurveyTriggerCount: 0,
      });
      sinon.assert.calledOnce(showSurveyDialogStub);
    });

    it("should increment extSurveyTriggerCount and not show survey dialog for other cases", async () => {
      const result = await feedbackSurveyDialog(false, 1, false);
      assert.deepStrictEqual(result, {
        sawSurveyAlready: false,
        extSurveyTriggerCount: 2,
      });
      sinon.assert.notCalled(showSurveyDialogStub);
    });
  });

  describe("the survey notification", () => {
    let shown: sinon.SinonStub;
    let openExternal: sinon.SinonStub;
    let update: sinon.SinonStub;
    let sendEvent: sinon.SinonStub;
    let outputChannel: vscode.LogOutputChannel;
    let telemetry: typeof ext.telemetry;

    beforeEach(() => {
      shown = sinon.stub(vscode.window, "showInformationMessage").resolves();
      openExternal = sinon.stub(vscode.env, "openExternal").resolves(true);
      update = sinon.stub().resolves();

      sinon.stub(vscode.workspace, "getConfiguration").returns(<any>{
        get: sinon.stub().returns(false),
        update,
      });

      sendEvent = sinon.stub();
      outputChannel = ext.outputChannel;
      telemetry = ext.telemetry;
      ext.outputChannel = vscode.window.createOutputChannel("kdb", {
        log: true,
      });
      ext.telemetry = <any>{ sendEvent, sendError: sinon.stub() };
    });

    afterEach(() => {
      sinon.restore();
      ext.outputChannel.dispose();
      ext.outputChannel = outputChannel;
      ext.telemetry = telemetry;
    });

    const raise = () => feedbackSurveyDialog(false, 3, false);

    it("asks in the wording the user is shown", async () => {
      await raise();

      assert.strictEqual(shown.firstCall.args[0], MESSAGE);
    });

    it("offers taking the survey and being left alone, in that order", async () => {
      await raise();

      assert.deepStrictEqual(shown.firstCall.args.slice(1), [
        TAKE_SURVEY,
        SILENCE,
      ]);
    });

    it("opens the survey when the survey is taken", async () => {
      shown.resolves(TAKE_SURVEY);

      await raise();

      assert.strictEqual(
        openExternal.firstCall.args[0].toString(),
        ext.urlLinks.survey,
      );
      sinon.assert.notCalled(update);
    });

    it("hides the survey for good when the user asks not to be asked again", async () => {
      shown.resolves(SILENCE);

      await raise();

      sinon.assert.calledOnceWithExactly(
        update,
        "hideSurvey",
        true,
        vscode.ConfigurationTarget.Global,
      );
      sinon.assert.notCalled(openExternal);
    });

    it("reports the survey being silenced", async () => {
      shown.resolves(SILENCE);

      await raise();

      sinon.assert.calledWith(sendEvent, "Help.Hide.Survey");
    });

    /**
     * Closing the notification with its × resolves the same way a notification
     * that scrolled out of sight does: with nothing. It is not an answer, so
     * neither the survey nor the setting may be touched by it — the user is
     * asked again at the next interval.
     */
    it("does nothing when the notification is closed", async () => {
      shown.resolves(undefined);

      const result = await raise();

      sinon.assert.notCalled(openExternal);
      sinon.assert.notCalled(update);
      assert.deepStrictEqual(result, {
        sawSurveyAlready: true,
        extSurveyTriggerCount: 0,
      });
    });
  });

  describe("when the survey is raised", () => {
    let shown: sinon.SinonStub;

    beforeEach(() => {
      shown = sinon.stub(vscode.window, "showInformationMessage").resolves();
    });

    afterEach(() => {
      sinon.restore();
    });

    /**
     * Which openings of VS Code the survey is raised on, counted the way the
     * extension counts them: the state one opening returns is the state the
     * next one is asked with.
     */
    const openings = async (count: number, hideSurvey = false) => {
      const raised: number[] = [];
      let state = { sawSurveyAlready: false, extSurveyTriggerCount: 0 };

      for (let opening = 1; opening <= count; opening++) {
        const before = shown.callCount;
        state = await feedbackSurveyDialog(
          state.sawSurveyAlready,
          state.extSurveyTriggerCount,
          hideSurvey,
        );
        if (shown.callCount > before) {
          raised.push(opening);
        }
      }

      return { raised, state };
    };

    it("first asks on the third opening after the extension is installed", async () => {
      const { raised } = await openings(3);

      assert.deepStrictEqual(raised, [3]);
    });

    it("asks every fifth opening after that", async () => {
      const { raised } = await openings(13);

      assert.deepStrictEqual(raised, [3, 8, 13]);
    });

    it("never asks while the survey is hidden", async () => {
      const { raised, state } = await openings(13, true);

      assert.deepStrictEqual(raised, []);
      assert.deepStrictEqual(state, {
        sawSurveyAlready: false,
        extSurveyTriggerCount: 13,
      });
    });
  });

  describe("handleFeedbackSurvey", () => {
    let shown: sinon.SinonStub;
    let stored: Map<string, unknown>;
    let hidden: boolean;
    let context: vscode.ExtensionContext;

    beforeEach(() => {
      shown = sinon.stub(vscode.window, "showInformationMessage").resolves();
      stored = new Map<string, unknown>();
      hidden = false;

      sinon.stub(vscode.workspace, "getConfiguration").returns(<any>{
        get: (section: string, fallback: unknown) =>
          section === "hideSurvey" ? hidden : fallback,
        update: sinon.stub().resolves(),
      });

      context = ext.context;
      ext.context = <any>{
        globalState: {
          get: (key: string, fallback: unknown) =>
            stored.has(key) ? stored.get(key) : fallback,
          update: async (key: string, value: unknown) => {
            stored.set(key, value);
          },
        },
      };
    });

    afterEach(() => {
      sinon.restore();
      ext.context = context;
    });

    const open = async (times: number) => {
      for (let opening = 0; opening < times; opening++) {
        await handleFeedbackSurvey();
      }
    };

    it("carries the count between openings and asks on the third", async () => {
      await open(2);
      sinon.assert.notCalled(shown);
      assert.strictEqual(stored.get("extSurveyTriggerCount"), 2);

      await open(1);

      sinon.assert.calledOnce(shown);
      assert.deepStrictEqual(
        {
          seen: stored.get("sawSurveyAlready"),
          count: stored.get("extSurveyTriggerCount"),
        },
        { seen: true, count: 0 },
      );
    });

    it("asks nothing while the setting hides it", async () => {
      hidden = true;

      await open(13);

      sinon.assert.notCalled(shown);
      assert.strictEqual(stored.get("sawSurveyAlready"), false);
    });
  });

  describe("the setting that hides the survey", () => {
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
        default: false,
        description: "Hide the extension survey dialog box",
        scope: "machine",
      });
    });
  });
});
