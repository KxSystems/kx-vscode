/*
 * Copyright (c) 1998-2023 Kx Systems Inc.
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
      const action = new CodeAction(
        `Suppress ${diagnostic.code}`,
        CodeActionKind.QuickFix,
      );
      action.diagnostics = [diagnostic];
      action.edit = new WorkspaceEdit();
      action.edit.insert(
        document.uri,
        new Position(range.start.line, 0),
        `// @qlintsuppress ${diagnostic.code}(1)\n`,
      );
      return [action];
    }
  }
}
