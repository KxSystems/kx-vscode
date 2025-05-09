/*
 * Copyright (c) 1998-2025 Kx Systems Inc.
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

export async function feedbackSurveyDialog() {
  const context = ext.context;

  const hideSurvey = vscode.workspace
    .getConfiguration("kdb")
    .get<boolean>("hideSurvey", false);
  const sawSurveyTwice = context.globalState.get<boolean>(
    "sawSurveyTwice",
    false,
  );
  let extSurveyTriggerCount =
    context.globalState.get<number>("extSurveyTriggerCount", 0) || 0;

  extSurveyTriggerCount += 1;
  await context.globalState.update(
    "extSurveyTriggerCount",
    extSurveyTriggerCount,
  );

  if (hideSurvey) return;

  if (!sawSurveyTwice && extSurveyTriggerCount === 1) {
    await showSurveyDialog();
    return;
  }

  if (!sawSurveyTwice && extSurveyTriggerCount >= 4) {
    await context.globalState.update("sawSurveyTwice", true);
    await context.globalState.update("extSurveyTriggerCount", 0);
    await showSurveyDialog();
    return;
  }

  if (sawSurveyTwice && extSurveyTriggerCount >= 5) {
    await context.globalState.update("extSurveyTriggerCount", 0);
    await showSurveyDialog();
    return;
  }

  return;
}

async function showSurveyDialog() {
  const SURVEY_URL = "https://t.maze.co/333268148";
  const result = await vscode.window.showInformationMessage(
    "Got 2 Minutes? Help us make the KX extension even better for your workflows.",
    "Take Survey",
    "Don't show me this message next time",
  );
  if (result === "Take Survey") {
    vscode.env.openExternal(vscode.Uri.parse(SURVEY_URL));
  } else {
    await vscode.workspace
      .getConfiguration("kdb")
      .update("hideSurvey", true, vscode.ConfigurationTarget.Global);
  }
}
