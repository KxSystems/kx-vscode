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

import Path from "path";
import fs from "fs";
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
import { spawn, exec } from "child_process";
import { tmpdir, platform, arch } from "os";
import { ext } from "../extensionVariables";

const cache = new Map<string, Thenable<Diagnostic[]>>();

const enum LinterErrorClass {
  ERROR = "error",
  WARNING = "warning",
  INFO = "info",
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

function initBuildTools() {
  return new Promise<void>((resolve, reject) => {
    if (!process.env.QHOME) {
      return reject(new Error("QHOME is not set"));
    }
    if (!process.env.AXLIBRARIES_HOME) {
      return reject(new Error("AXLIBRARIES_HOME is not set"));
    }
    if (platform() === "darwin") {
      const xattr = exec(
        "xattr -dr com.apple.quarantine $AXLIBRARIES_HOME/ws/lib/*.{so,dylib}",
      );
      xattr.on("exit", () => resolve());
      xattr.on("error", (error) => reject(error));
    } else {
      resolve();
    }
  });
}

function getTool(args: string[]) {
  if (platform() === "darwin" && arch() === "arm64") {
    return spawn("arch", ["-x86_64", "q", ...args]);
  }
  return spawn("q", args);
}

function isLintingSupported(document: TextDocument) {
  const path = document.uri.path;
  return path.endsWith(".q") || path.endsWith(".quke");
}

function isAutoLintingEnabled(document: TextDocument) {
  return workspace
    .getConfiguration("kdb", document)
    .get<boolean>("linting", false);
}

function isAutoLintingSupported(document: TextDocument) {
  return isLintingSupported(document) && isAutoLintingEnabled(document);
}

function getLinterResults(uri: Uri) {
  return new Promise<LinterResult[]>((resolve, reject) => {
    initBuildTools()
      .then(() => {
        const results = Path.join(
          tmpdir(),
          `kdb-qlint-${new Date().getTime()}.json`,
        );
        const linter = getTool([
          `${process.env.AXLIBRARIES_HOME}/ws/qlint.q_`,
          "-src",
          uri.path,
          "-out",
          results,
          "-quiet",
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
      })
      .catch(reject);
  });
}

const severity: { [key: string]: DiagnosticSeverity } = {
  [LinterErrorClass.ERROR]: DiagnosticSeverity.Error,
  [LinterErrorClass.WARNING]: DiagnosticSeverity.Warning,
  [LinterErrorClass.INFO]: DiagnosticSeverity.Information,
};

function lint(document: TextDocument) {
  return window.withProgress(
    { title: "Linting", location: ProgressLocation.Window, cancellable: false },
    async () => {
      try {
        return (await getLinterResults(document.uri)).map(
          (result) =>
            new Diagnostic(
              new Range(
                result.startLine - 1,
                result.startCol - 1,
                result.endLine - 1,
                result.endCol,
              ),
              `${result.label}: ${result.description}`,
              severity[result.errorClass],
            ),
        );
      } catch (error) {
        window.showErrorMessage(`Linting Failed ${error}`);
        return [];
      }
    },
  );
}

async function setDiagnostics(document: TextDocument) {
  let diagnostics = cache.get(document.uri.path);
  if (!diagnostics) {
    diagnostics = lint(document);
    cache.set(document.uri.path, diagnostics);
  }
  ext.diagnosticCollection.set(document.uri, await diagnostics);
}

export async function lintCommand(document: TextDocument) {
  if (isLintingSupported(document)) {
    await setDiagnostics(document);
  }
}

export async function connectBuildTools() {
  workspace.onDidSaveTextDocument(async (document) => {
    if (isAutoLintingSupported(document)) {
      await setDiagnostics(document);
    }
  });

  workspace.onDidOpenTextDocument(async (document) => {
    if (isAutoLintingSupported(document)) {
      await setDiagnostics(document);
    }
  });

  workspace.onDidCloseTextDocument((document) => {
    if (isLintingSupported(document)) {
      ext.diagnosticCollection.delete(document.uri);
    }
  });

  workspace.onDidChangeTextDocument((event) => {
    if (isLintingSupported(event.document)) {
      if (event.contentChanges.length > 0) {
        cache.delete(event.document.uri.path);
        ext.diagnosticCollection.delete(event.document.uri);
      }
    }
  });

  if (window.activeTextEditor) {
    const document = window.activeTextEditor.document;
    if (isAutoLintingSupported(document)) {
      await setDiagnostics(document);
    }
  }
}
