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

import {
  CodeAction,
  CodeActionKind,
  CodeActionProvider,
  Command,
  Position,
  ProviderResult,
  Range,
  TextDocument,
  WorkspaceEdit,
} from "vscode";

import { ext } from "../extensionVariables";

export class QuickFixProvider implements CodeActionProvider {
  provideCodeActions(
    document: TextDocument,
    range: Range,
  ): ProviderResult<(CodeAction | Command)[]> {
    const diagnostics = ext.diagnosticCollection.get(document.uri) || [];
    const diagnostic = diagnostics.find(
      (item) => item.source === "qlint" && item.range.isEqual(range),
    );

    if (diagnostic) {
      const once = new CodeAction("Suppress warning", CodeActionKind.QuickFix);

      once.diagnostics = [diagnostic];
      once.edit = new WorkspaceEdit();
      once.edit.insert(
        document.uri,
        new Position(range.start.line, 0),
        `//@qlintsuppress ${diagnostic.code}(1)\n`,
      );
      const always = new CodeAction(
        `Suppress all warnings (${diagnostic.code})`,
        CodeActionKind.QuickFix,
      );

      always.diagnostics = [diagnostic];
      always.edit = new WorkspaceEdit();
      always.edit.insert(
        document.uri,
        new Position(0, 0),
        `//@qlintsuppress ${diagnostic.code}\n`,
      );
      return [once, always];
    }
  }
}
