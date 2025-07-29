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

import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";

import { feedbackSurveyDialog } from "../../../src/utils/feedbackSurveyUtils";

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
});
