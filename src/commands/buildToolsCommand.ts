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
import { spawn } from "child_process";
import { tmpdir } from "os";
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

const prefix: { [key: string]: string } = {
  win32: Path.join("w64", "q.exe"),
  darwin: Path.join("m64", "q"),
  linux: Path.join("l64", "q"),
  l64arm: Path.join("l64arm", "q"),
};

function getBuidToolsHome() {
  return process.env.AXLIBRARIES_HOME;
}

function getRuntime() {
  const home = workspace
    .getConfiguration("kdb")
    .get<string>("qHomeDirectory", "");

  if (!home) {
    throw new Error("kdb q runtime not found");
  }

  const platform =
    process.platform === "linux" && process.arch === "arm64"
      ? "l64arm"
      : process.platform;

  const target = prefix[platform];

  if (!target) {
    throw new Error(`Build Tools not supported on ${platform}`);
  }

  return Path.join(home, target);
}

function getTool(args: string[]) {
  if (process.platform === "darwin" && process.arch === "arm64") {
    return spawn("/usr/bin/arch", ["-x86_64", getRuntime(), ...args]);
  }
  return spawn(getRuntime(), args);
}

function getLinter() {
  const home = getBuidToolsHome();
  if (home) {
    return Path.join(home, "ws", "qlint.q_");
  }
  throw new Error("AXLIBRARIES_HOME is not set");
}

function initBuildTools() {
  return new Promise<void>((resolve, reject) => {
    const home = getBuidToolsHome();
    if (home) {
      // if (process.platform === "darwin") {
      //   const xattr = spawn(
      //     "/usr/bin/xattr",
      //     [
      //       "-d",
      //       "com.apple.quarantine",
      //       Path.join(home, "ws", "lib", "*.{so,dylib}"),
      //     ],
      //     { shell: true },
      //   );
      //   xattr.on("exit", () => resolve());
      //   xattr.on("error", (error) => reject(error));
      // } else {
      resolve();
      // }
    } else {
      reject(new Error("AXLIBRARIES_HOME is not set"));
    }
  });
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
          getLinter(),
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
                resolve(JSON.parse(data));
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
    {
      title: "Linting",
      location: ProgressLocation.Window,
      cancellable: true,
    },
    async (_progress, token) => {
      try {
        const results = await getLinterResults(document.uri);
        if (token.isCancellationRequested) {
          cache.delete(document.uri.path);
          return [];
        }
        return results.map((result) => {
          const diagnostic = new Diagnostic(
            new Range(
              result.startLine - 1,
              result.startCol - 1,
              result.endLine - 1,
              result.endCol,
            ),
            result.description,
            severity[result.errorClass],
          );
          diagnostic.source = "qlint";
          diagnostic.code = result.label;
          return diagnostic;
        });
      } catch (error) {
        throw new Error(`Linting Failed ${error}`);
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
  const home = getBuidToolsHome();
  if (home) {
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

    if (ext.activeTextEditor) {
      const document = ext.activeTextEditor.document;
      if (isAutoLintingSupported(document)) {
        await setDiagnostics(document);
      }
    }
  }
}
