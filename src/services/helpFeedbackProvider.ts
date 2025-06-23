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

import * as path from "path";
import * as vscode from "vscode";

export class HelpFeedbackProvider implements vscode.TreeDataProvider<HelpItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    HelpItem | undefined | void
  > = new vscode.EventEmitter<HelpItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<HelpItem | undefined | void> =
    this._onDidChangeTreeData.event;

  getTreeItem(element: HelpItem): vscode.TreeItem {
    return element;
  }

  getChildren(): HelpItem[] {
    return [
      new HelpItem(
        "Extension Documentation",
        "kdb.help.openDocumentation",
        "help-doc.svg",
      ),
      new HelpItem(
        "Suggest a Feature",
        "kdb.help.suggestFeature",
        "feature.svg",
      ),
      new HelpItem(
        "Provide Feedback",
        "kdb.help.provideFeedback",
        "feedback.svg",
      ),
      new HelpItem("Report a Bug", "kdb.help.reportBug", "bug.svg"),
    ];
  }
}

class HelpItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    commandId: string,
    iconFileName: string,
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.command = { command: commandId, title: label };
    this.iconPath = {
      light: vscode.Uri.file(
        path.join(__dirname, "..", "resources", "light", iconFileName),
      ),
      dark: vscode.Uri.file(
        path.join(__dirname, "..", "resources", "dark", iconFileName),
      ),
    };
  }
}
