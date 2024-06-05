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
  CancellationError,
  ConfigurationTarget,
  EventEmitter,
  ExtensionContext,
  ProgressLocation,
  Range,
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
import { InsightsClient, wrapExpressions } from "./utils/qclient";

let client: LanguageClient;

const connection = new InsightsClient("https://fstc83yi5b.ft1.cld.kx.com/");

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

  ext.outputChannel.appendLine("kdb extension is now active!");

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
      async (viewItem: InsightsNode | KdbNode) => {
        await disconnect(viewItem.label);
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
    commands.registerCommand("kdb.refreshServerObjects", () => {
      ext.serverProvider.reload();
    }),
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
    commands.registerCommand("kdb.execute.selectedQuery", () => {
      return window
        .withProgress(
          {
            title: "Executing",
            cancellable: true,
            location: ProgressLocation.Window,
          },
          async (_progress, token) => {
            if (ext.activeTextEditor) {
              const exprs = await commands.executeCommand<string[]>(
                "kdb.parseExpressions",
                ext.activeTextEditor.document,
              );
              const wrapped = wrapExpressions(exprs, true);
              if (!connection.isConnected) {
                await connection.login(token);
                await connection.meta(token);
                await connection.executeData(token);
              }
              const res = await connection.execute(wrapped, token);
              ext.outputChannel.appendLine(JSON.stringify(res, null, 2));
            }
          },
        )
        .then(
          () => {},
          (err) => {
            if (err instanceof CancellationError) {
              // LOG
            } else {
              window.showErrorMessage(`${err}`);
            }
          },
        );
      //   const client = new QClient("localhost", 5002);
      //   await client.connect();
      //   try {
      //     const res = await client.execute(wrapped);
      //     ext.outputChannel.appendLine(JSON.stringify(res));
      //   } catch (error) {
      //     ext.outputChannel.appendLine(`${error}`);
      //   } finally {
      //     client.disconnect();
      //   }

      //await runActiveEditor(ExecutionTypes.QuerySelection);
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
    commands.registerCommand("kdb.parseExpressions", (document: TextDocument) =>
      client.sendRequest("kdb.parseExpressions", { uri: `${document.uri}` }),
    ),
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
