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
  Diagnostic,
  DiagnosticSeverity,
  ProgressLocation,
  Range,
  TextDocument,
  Uri,
  window,
  workspace,
} from "vscode";
import { spawn } from "child_process";
import { tmpdir, platform, arch } from "os";
import fs from "fs";
import Path from "path";
import { ext } from "../extensionVariables";

const enum LinterErrorClass {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
}

interface LinterResult {
  fileName: string;
  namespace: string;
  label: string;
  errorClass: LinterErrorClass;
  description: string;
  problemText: string;
  errorMessage: string;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  fname: string;
}

function getLinter(args: string[]) {
  if (platform() === "darwin" && arch() === "arm64") {
    return spawn("arch", ["-x86_64", "q", ...args]);
  }
  return spawn("q", args);
}

function getLinterResults(uri: Uri) {
  return new Promise<LinterResult[]>((resolve, reject) => {
    if (!process.env.QHOME) {
      reject(new Error("QHOME is not set"));
    }
    if (!process.env.AXLIBRARIES_HOME) {
      reject(new Error("AXLIBRARIES_HOME is not set"));
    }
    const results = Path.join(
      tmpdir(),
      `kdb-qlint-${new Date().getTime()}.json`,
    );
    const linter = getLinter([
      `${process.env.AXLIBRARIES_HOME}/ws/qlint.q_`,
      "-src",
      uri.path,
      "-out",
      results,
    ]);
    linter.on("exit", () => {
      fs.readFile(results, "utf8", (error, data) => {
        if (error) {
          reject(error);
        } else {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (error) {
            reject(error);
          }
        }
      });
    });
    linter.on("error", (error) => reject(error));
  });
}

function createDiagnosticFromResult(result: LinterResult) {
  return new Diagnostic(
    new Range(
      result.startLine - 1,
      result.startCol - 1,
      result.endLine - 1,
      result.endCol,
    ),
    result.description,
    result.errorClass === LinterErrorClass.WARNING
      ? DiagnosticSeverity.Warning
      : result.errorClass === LinterErrorClass.ERROR
        ? DiagnosticSeverity.Error
        : result.errorClass === LinterErrorClass.INFO
          ? DiagnosticSeverity.Information
          : DiagnosticSeverity.Hint,
  );
}

export async function lint(uri: Uri) {
  if (!uri.path.endsWith(".q") && !uri.path.endsWith(".quke")) {
    return;
  }
  await window.withProgress(
    { title: "Linting", location: ProgressLocation.Window, cancellable: false },
    async () => {
      const results = await getLinterResults(uri);
      ext.diagnosticCollection.set(
        uri,
        results.map(createDiagnosticFromResult),
      );
    },
  );
}

export async function updateLintng(document: TextDocument) {
  const linting = workspace
    .getConfiguration("kdb", document)
    .get<boolean>("linting", false);

  if (linting) {
    await lint(document.uri);
  }
}
