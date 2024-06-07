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

import { env } from "node:process";
import path from "path";
import {
  ConfigurationTarget,
  EventEmitter,
  ExtensionContext,
  Position,
  Range,
  Selection,
  TextDocument,
  TextDocumentContentProvider,
  Uri,
  WorkspaceEdit,
  commands,
  extensions,
  languages,
  window,
  workspace,
} from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";
import {
  installTools,
  startLocalProcess,
  stopLocalProcess,
  stopLocalProcessByServerName,
} from "./commands/installTools";
import {
  activeConnection,
  addInsightsConnection,
  addKdbConnection,
  addNewConnection,
  connect,
  disconnect,
  enableTLS,
  refreshGetMeta,
  removeConnection,
  rerunQuery,
} from "./commands/serverCommand";
import { showInstallationDetails } from "./commands/walkthroughCommand";
import { ext } from "./extensionVariables";
import { ExecutionTypes } from "./models/execution";
import { InsightDetails, Insights } from "./models/insights";
import { QueryResult } from "./models/queryResult";
import { Server, ServerDetails } from "./models/server";
import {
  InsightsNode,
  KdbNode,
  KdbTreeProvider,
} from "./services/kdbTreeProvider";
import {
  QueryHistoryProvider,
  QueryHistoryTreeItem,
} from "./services/queryHistoryProvider";
import { KdbResultsViewProvider } from "./services/resultsPanelProvider";
import {
  checkLocalInstall,
  checkOpenSslInstalled,
  getInsights,
  getServers,
  initializeLocalServers,
  kdbOutputLog,
} from "./utils/core";
import { runQFileTerminal } from "./utils/execution";
import AuthSettings from "./utils/secretStorage";
import { Telemetry } from "./utils/telemetryClient";
import { DataSourceEditorProvider } from "./services/dataSourceEditorProvider";
import {
  FileTreeItem,
  WorkspaceTreeProvider,
  addWorkspaceFile,
} from "./services/workspaceTreeProvider";
import {
  ConnectionLensProvider,
  checkOldDatasourceFiles,
  connectWorkspaceCommands,
  importOldDSFiles,
  pickConnection,
  runActiveEditor,
} from "./commands/workspaceCommand";
import { createDefaultDataSourceFile } from "./models/dataSource";
import { connectBuildTools, lintCommand } from "./commands/buildToolsCommand";
import { CompletionProvider } from "./services/completionProvider";
import { QuickFixProvider } from "./services/quickFixProvider";
import crypto from "crypto";

let client: LanguageClient;

export async function activate(context: ExtensionContext) {
  ext.context = context;
  ext.outputChannel = window.createOutputChannel("kdb");
  ext.openSslVersion = await checkOpenSslInstalled();
  ext.isBundleQCreated = false;
  // clear necessary contexts
  commands.executeCommand("setContext", "kdb.connected.active", false);
  commands.executeCommand("setContext", "kdb.insightsConnected", false);
  commands.executeCommand("setContext", "kdb.connected", []);

  const servers: Server | undefined = getServers();
  const insights: Insights | undefined = getInsights();

  ext.serverProvider = new KdbTreeProvider(servers!, insights!);
  ext.queryHistoryProvider = new QueryHistoryProvider();
  ext.resultsViewProvider = new KdbResultsViewProvider(
    ext.context.extensionUri,
  );
  ext.scratchpadTreeProvider = new WorkspaceTreeProvider(
    "**/*.kdb.{q,py}",
    "scratchpad",
  );
  ext.dataSourceTreeProvider = new WorkspaceTreeProvider(
    "**/*.kdb.json",
    "datasource",
  );

  commands.executeCommand("setContext", "kdb.QHOME", env.QHOME);

  window.registerTreeDataProvider("kdb-servers", ext.serverProvider);

  window.registerTreeDataProvider(
    "kdb-query-history",
    ext.queryHistoryProvider,
  );
  window.registerTreeDataProvider(
    "kdb-scratchpad-explorer",
    ext.scratchpadTreeProvider,
  );
  window.registerTreeDataProvider(
    "kdb-datasource-explorer",
    ext.dataSourceTreeProvider,
  );

  // initialize local servers
  if (servers !== undefined) {
    initializeLocalServers(servers);
    ext.serverProvider.refresh(servers);
  }

  // initialize the secret store
  AuthSettings.init(context);
  ext.secretSettings = AuthSettings.instance;

  kdbOutputLog("kdb extension is now active!", "INFO");

  try {
    // check for installed q runtime
    await checkLocalInstall();
  } catch (err) {
    window.showErrorMessage(`${err}`);
  }

  context.subscriptions.push(
    window.registerWebviewViewProvider(
      KdbResultsViewProvider.viewType,
      ext.resultsViewProvider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
    commands.registerCommand(
      "kdb.resultsPanel.update",
      (results: string, isInsights: boolean, dataSourceType?: string) => {
        ext.resultsViewProvider.updateResults(
          results,
          isInsights,
          dataSourceType,
        );
      },
    ),
    commands.registerCommand("kdb.resultsPanel.clear", () => {
      ext.resultsViewProvider.updateResults("");
    }),
    commands.registerCommand("kdb.resultsPanel.export.csv", () => {
      ext.resultsViewProvider.exportToCsv();
    }),
    commands.registerCommand("kdb.datasource.import.ds", async () => {
      await importOldDSFiles();
    }),
    commands.registerCommand(
      "kdb.connect",
      async (viewItem: KdbNode | InsightsNode) => {
        await connect(viewItem.label);
      },
    ),
    commands.registerCommand(
      "kdb.connect.via.dialog",
      async (connLabel: string) => {
        await connect(connLabel);
      },
    ),
    commands.registerCommand(
      "kdb.active.connection",
      async (viewItem: KdbNode) => {
        activeConnection(viewItem);
      },
    ),
    commands.registerCommand("kdb.enableTLS", async (viewItem: KdbNode) => {
      await enableTLS(viewItem.children[0]);
    }),
    commands.registerCommand(
      "kdb.insightsRemove",
      async (viewItem: InsightsNode) => {
        await removeConnection(viewItem);
      },
    ),
    commands.registerCommand(
      "kdb.disconnect",
      async (viewItem: InsightsNode | KdbNode | string) => {
        const connLabel =
          typeof viewItem === "string" ? viewItem : viewItem.label;
        await disconnect(connLabel);
      },
    ),
    commands.registerCommand("kdb.addConnection", async () => {
      await addNewConnection();
    }),
    commands.registerCommand(
      "kdb.newConnection.createNewInsightConnection",
      async (insightsData: InsightDetails) => {
        await addInsightsConnection(insightsData);
      },
    ),
    commands.registerCommand(
      "kdb.newConnection.createNewConnection",
      async (kdbData: ServerDetails) => {
        await addKdbConnection(kdbData, false);
      },
    ),
    commands.registerCommand(
      "kdb.newConnection.createNewBundledConnection",
      async (kdbData: ServerDetails) => {
        await addKdbConnection(kdbData, true);
      },
    ),
    commands.registerCommand(
      "kdb.removeConnection",
      async (viewItem: KdbNode) => {
        await removeConnection(viewItem);
      },
    ),
    commands.registerCommand("kdb.refreshServerObjects", async () => {
      ext.serverProvider.reload();
      await refreshGetMeta();
    }),
    commands.registerCommand(
      "kdb.insights.refreshMeta",
      async (viewItem: InsightsNode) => {
        await refreshGetMeta(viewItem.label);
      },
    ),
    commands.registerCommand(
      "kdb.queryHistory.rerun",
      (viewItem: QueryHistoryTreeItem) => {
        rerunQuery(viewItem.details);
      },
    ),
    commands.registerCommand("kdb.queryHistory.clear", () => {
      ext.kdbQueryHistoryList.length = 0;
      ext.kdbQueryHistoryNodes.length = 0;
      ext.queryHistoryProvider.refresh();
    }),
    commands.registerCommand("kdb.showInstallationDetails", async () => {
      await showInstallationDetails();
    }),
    commands.registerCommand("kdb.installTools", async () => {
      await installTools();
    }),
    commands.registerCommand(
      "kdb.startLocalProcess",
      async (viewItem: KdbNode) => {
        await startLocalProcess(viewItem);
      },
    ),
    commands.registerCommand(
      "kdb.stopLocalProcess",
      async (viewItem: KdbNode) => {
        await commands.executeCommand("kdb.disconnect", viewItem);
        await stopLocalProcess(viewItem);
      },
    ),
    commands.registerCommand("kdb.terminal.run", () => {
      const filename = ext.activeTextEditor?.document.fileName;
      if (filename) runQFileTerminal(filename);
    }),
    commands.registerCommand("kdb.terminal.start", () => {
      if (env.QHOME) {
        runQFileTerminal();
      } else {
        checkLocalInstall();
      }
    }),
    commands.registerCommand("kdb.runScratchpad", async () => {
      await runActiveEditor();
    }),
    commands.registerCommand("kdb.execute.selectedQuery", async () => {
      await runActiveEditor(ExecutionTypes.QuerySelection);
    }),
    commands.registerCommand("kdb.execute.fileQuery", async () => {
      await runActiveEditor(ExecutionTypes.QueryFile);
    }),
    commands.registerCommand("kdb.execute.pythonScratchpadQuery", async () => {
      await runActiveEditor(ExecutionTypes.PythonQuerySelection);
    }),
    // TODO renable it when the scratchpad reset API is fixed
    // commands.registerCommand("kdb.scratchpad.reset", async () => {
    //   await resetScratchPad();
    // }),
    commands.registerCommand(
      "kdb.execute.pythonFileScratchpadQuery",
      async () => {
        await runActiveEditor(ExecutionTypes.PythonQueryFile);
      },
    ),
    commands.registerCommand(
      "kdb.createDataSource",
      async (item: FileTreeItem) => {
        const uri = await addWorkspaceFile(item, "datasource", ".kdb.json");

        if (uri) {
          const edit = new WorkspaceEdit();

          edit.replace(
            uri,
            new Range(0, 0, 1, 0),
            JSON.stringify(createDefaultDataSourceFile(), null, 2),
          );

          workspace.applyEdit(edit);

          await commands.executeCommand(
            "vscode.openWith",
            uri,
            DataSourceEditorProvider.viewType,
          );
          await commands.executeCommand("workbench.action.files.save", uri);
        }
      },
    ),
    commands.registerCommand("kdb.refreshDataSourceExplorer", () => {
      ext.dataSourceTreeProvider.reload();
    }),
    commands.registerCommand(
      "kdb.createScratchpad",
      async (item: FileTreeItem) => {
        const uri = await addWorkspaceFile(item, "workbook", ".kdb.q");
        if (uri) {
          await window.showTextDocument(uri);
          await commands.executeCommand("workbench.action.files.save", uri);
        }
      },
    ),
    commands.registerCommand(
      "kdb.createPythonScratchpad",
      async (item: FileTreeItem) => {
        const uri = await addWorkspaceFile(item, "workbook", ".kdb.py");
        if (uri) {
          await window.showTextDocument(uri);
          await commands.executeCommand("workbench.action.files.save", uri);
        }
      },
    ),
    commands.registerCommand("kdb.refreshScratchpadExplorer", () => {
      ext.scratchpadTreeProvider.reload();
    }),
    commands.registerCommand("kdb.pickConnection", async () => {
      const editor = ext.activeTextEditor;
      if (editor) {
        await pickConnection(editor.document.uri);
      }
    }),
    commands.registerCommand("kdb.renameFile", async (item: FileTreeItem) => {
      if (item && item.resourceUri) {
        const document = await workspace.openTextDocument(item.resourceUri);
        await window.showTextDocument(document);
        await commands.executeCommand("revealInExplorer");
        await commands.executeCommand("renameFile");
      }
    }),
    commands.registerCommand("kdb.deleteFile", async (item: FileTreeItem) => {
      if (item && item.resourceUri) {
        const document = await workspace.openTextDocument(item.resourceUri);
        await window.showTextDocument(document);
        await commands.executeCommand("revealInExplorer");
        await commands.executeCommand("deleteFile");
      }
    }),
    commands.registerCommand("kdb.execute.block", async () => {
      if (ext.activeTextEditor) {
        const range = await commands.executeCommand<Range>(
          "kdb.qls.expressionRange",
          ext.activeTextEditor.document,
          ext.activeTextEditor.selection.active,
        );
        if (range) {
          ext.activeTextEditor.selection = new Selection(
            range.start,
            range.end,
          );
          await runActiveEditor(ExecutionTypes.QuerySelection);
        }
      }
    }),
    commands.registerCommand("kdb.toggleParameterCache", async () => {
      if (ext.activeTextEditor) {
        const doc = ext.activeTextEditor.document;
        const res = await commands.executeCommand<{
          params: string[];
          start: Position;
          end: Position;
        }>(
          "kdb.qls.parameterCache",
          doc,
          ext.activeTextEditor.selection.active,
        );
        if (res) {
          const edit = new WorkspaceEdit();
          const start = new Position(res.start.line, res.start.character);
          const end = new Position(res.end.line, res.end.character);
          const text = doc.getText(new Range(start, end));
          const match =
            /\.axdebug\.temp[A-F0-9]{6}.*?\.axdebug\.temp[A-F0-9]{6}\s*;\s*/s.exec(
              text,
            );
          if (match) {
            const offset = doc.offsetAt(start);
            edit.delete(
              doc.uri,
              new Range(
                doc.positionAt(offset + match.index),
                doc.positionAt(offset + match.index + match[0].length),
              ),
            );
          } else {
            const hash = crypto.randomBytes(3).toString("hex").toUpperCase();
            const expr1 = `.axdebug.temp${hash}: (${res.params.join(";")});`;
            const expr2 = `${res.params.map((param) => `\`${param}`).join("")} set' .axdebug.temp${hash};`;

            if (start.line === end.line) {
              edit.insert(doc.uri, start, " ");
              edit.insert(doc.uri, start, expr1);
              edit.insert(doc.uri, start, expr2);
            } else {
              const space = ext.activeTextEditor.options.insertSpaces;
              const count = ext.activeTextEditor.options.indentSize as number;
              edit.insert(doc.uri, start, "\n");
              edit.insert(doc.uri, start, space ? " ".repeat(count) : "\t");
              edit.insert(doc.uri, start, expr1);
              edit.insert(doc.uri, start, "\n");
              edit.insert(doc.uri, start, space ? " ".repeat(count) : "\t");
              edit.insert(doc.uri, start, expr2);
            }
          }
          await workspace.applyEdit(edit);
        }
      }
    }),

    DataSourceEditorProvider.register(context),

    languages.registerCodeLensProvider(
      { pattern: "**/*.kdb.{q,py}" },
      new ConnectionLensProvider(),
    ),
    commands.registerCommand("kdb.qlint", async () => {
      const editor = ext.activeTextEditor;
      if (editor) {
        await lintCommand(editor.document);
      }
    }),
    languages.registerCodeActionsProvider(
      { language: "q" },
      new QuickFixProvider(),
    ),
    ext.diagnosticCollection,
    workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("kdb.connectionMap")) {
        ext.dataSourceTreeProvider.reload();
        ext.scratchpadTreeProvider.reload();
      }
    }),
  );

  checkOldDatasourceFiles();

  const lastResult: QueryResult | undefined = undefined;
  const resultSchema = "vscode-kdb-q";
  const resultProvider = new (class implements TextDocumentContentProvider {
    onDidChangeEmitter = new EventEmitter<Uri>();
    onDidChange = this.onDidChangeEmitter.event;

    provideTextDocumentContent(_uri: Uri): string {
      const result = lastResult!;

      return result.result;
    }
  })();

  context.subscriptions.push(
    workspace.registerTextDocumentContentProvider(resultSchema, resultProvider),
  );

  context.subscriptions.push(
    languages.registerCompletionItemProvider(
      { language: "q" },
      new CompletionProvider(),
    ),
  );

  connectWorkspaceCommands();
  await connectBuildTools();

  //q language server
  const serverModule = path.join(context.extensionPath, "out", "server.js");
  const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "q" }],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher("**/*.{q,quke}"),
    },
  };

  client = new LanguageClient(
    "kdb LangServer",
    "kdb Language Server",
    serverOptions,
    clientOptions,
  );

  await client.start();

  context.subscriptions.push(
    createServerCommand(client, "kdb.qls.expressionRange"),
  );
  context.subscriptions.push(
    createServerCommand(client, "kdb.qls.parameterCache"),
  );

  Telemetry.sendEvent("Extension.Activated");
  const yamlExtension = extensions.getExtension("redhat.vscode-yaml");
  if (yamlExtension) {
    const actualSchema = await workspace.getConfiguration().get("yaml.schemas");
    const schemaJSON = {
      "https://code.kx.com/insights/enterprise/packaging/schemas/pipeline.json":
        "*pipelines/*.yaml",
      "https://code.kx.com/insights/enterprise/packaging/schemas/table.json":
        "tables/*.yaml",
      "https://code.kx.com/insights/enterprise/packaging/schemas/deploymentconfig.json":
        "deployment_config.yaml",
      "https://code.kx.com/insights/enterprise/packaging/schemas/router.json":
        "router.yaml",
      "https://code.kx.com/insights/enterprise/packaging/schemas/shard.json":
        "*shard.yaml",
    };
    Object.assign(actualSchema ? actualSchema : {}, schemaJSON);
    await yamlExtension.activate().then(() => {
      workspace
        .getConfiguration()
        .update("yaml.schemas", actualSchema, ConfigurationTarget.Global);
    });
  }
}

export async function deactivate(): Promise<void> {
  await Telemetry.dispose();

  // cleanup of local q instance processes
  Object.keys(ext.localProcessObjects).forEach((index) => {
    stopLocalProcessByServerName(index);
  });

  if (!ext.client) {
    return undefined;
  }
  return ext.client.stop();
}

function createServerCommand(client: LanguageClient, cmd: string) {
  return commands.registerCommand(
    cmd,
    (document: TextDocument, position: Position) =>
      client.sendRequest(cmd, {
        textDocument: { uri: `${document.uri}` },
        position: { line: position.line, character: position.character },
      }),
  );
}
