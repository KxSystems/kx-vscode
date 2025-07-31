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

import * as vscode from "vscode";

import { ext } from "../extensionVariables";
import { MessageKind, notify } from "./notifications";

const logger = "feedbackSurveyUtils";

export async function feedbackSurveyDialog(
  sawSurveyAlready: boolean,
  extSurveyTriggerCount: number,
  hideSurvey: boolean,
): Promise<{
  sawSurveyAlready: boolean;
  extSurveyTriggerCount: number;
}> {
  extSurveyTriggerCount += 1;

  if (hideSurvey) {
    return { sawSurveyAlready, extSurveyTriggerCount };
  }

  if (!sawSurveyAlready && extSurveyTriggerCount >= 3) {
    sawSurveyAlready = true;
    extSurveyTriggerCount = 0;
    await showSurveyDialog();
    return { sawSurveyAlready, extSurveyTriggerCount };
  }

  if (sawSurveyAlready && extSurveyTriggerCount >= 5) {
    extSurveyTriggerCount = 0;
    await showSurveyDialog();
    return { sawSurveyAlready, extSurveyTriggerCount };
  }

  return { sawSurveyAlready, extSurveyTriggerCount };
}

async function showSurveyDialog() {
  const SURVEY_URL = ext.urlLinks.survey;
  const result = await notify(
    "Got 2 Minutes? Help us make the KX extension even better for your workflows.",
    MessageKind.INFO,
    {},
    "Take Survey",
    "Don't show me this message next time",
  );
  if (result === "Take Survey") {
    vscode.env.openExternal(vscode.Uri.parse(SURVEY_URL));
  } else if (result === "Don't show me this message next time") {
    notify("Take survey message silenced.", MessageKind.DEBUG, {
      logger,
      telemetry: "Help&Feedback.Hide.Survey",
    });

    await vscode.workspace
      .getConfiguration("kdb")
      .update("hideSurvey", true, vscode.ConfigurationTarget.Global);
  }
}

/* c8 ignore next */
export async function handleFeedbackSurvey() {
  const context = ext.context;

  const hideSurvey = vscode.workspace
    .getConfiguration("kdb")
    .get<boolean>("hideSurvey", false);
  const sawSurveyAlready = context.globalState.get<boolean>(
    "sawSurveyAlready",
    false,
  );
  const extSurveyTriggerCount =
    context.globalState.get<number>("extSurveyTriggerCount", 0) || 0;

  const updatedValues = await feedbackSurveyDialog(
    sawSurveyAlready,
    extSurveyTriggerCount,
    hideSurvey,
  );

  await context.globalState.update(
    "sawSurveyAlready",
    updatedValues.sawSurveyAlready,
  );
  await context.globalState.update(
    "extSurveyTriggerCount",
    updatedValues.extSurveyTriggerCount,
  );
}
