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
  commands,
  ConfigurationTarget,
  EventEmitter,
  ExtensionContext,
  extensions,
  languages,
  Range,
  TextDocumentContentProvider,
  Uri,
  window,
  workspace,
  WorkspaceEdit,
} from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";
import {
  addDataSource,
  deleteDataSource,
  openDataSource,
  populateScratchpad,
  refreshDataSource,
  renameDataSource,
  runDataSource,
  saveDataSource,
} from "./commands/dataSourceCommand";
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
  resetScratchPad,
} from "./commands/serverCommand";
import { showInstallationDetails } from "./commands/walkthroughCommand";
import { ext } from "./extensionVariables";
import { ExecutionTypes } from "./models/execution";
import { InsightDetails, Insights } from "./models/insights";
import { QueryResult } from "./models/queryResult";
import { Server, ServerDetails } from "./models/server";
import {
  KdbDataSourceProvider,
  KdbDataSourceTreeItem,
} from "./services/dataSourceTreeProvider";
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
  addWorkspaceFile,
  FileTreeItem,
  WorkspaceTreeProvider,
} from "./services/workspaceTreeProvider";
import {
  ConnectionLensProvider,
  connectWorkspaceCommsnds,
  pickConnection,
  runActiveEditor,
} from "./commands/workspaceCommand";
import { createDefaultDataSourceFile } from "./models/dataSource";
import { connectBuildTools, lintCommand } from "./commands/buildToolsCommand";
import { CompletionProvider } from "./services/completionProvider";
import { QuickFixProvider } from "./services/quickFixProvider";

let client: LanguageClient;

export async function activate(context: ExtensionContext) {
  ext.context = context;
  ext.outputChannel = window.createOutputChannel("kdb");
  ext.openSslVersion = await checkOpenSslInstalled();
  ext.isBundleQCreated = false;

  const servers: Server | undefined = getServers();
  const insights: Insights | undefined = getInsights();

  ext.serverProvider = new KdbTreeProvider(servers!, insights!);
  ext.dataSourceProvider = new KdbDataSourceProvider();
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
      (results: string, dataSourceType?: string) => {
        ext.resultsViewProvider.updateResults(results, dataSourceType);
      },
    ),
    commands.registerCommand("kdb.resultsPanel.clear", () => {
      ext.resultsViewProvider.updateResults("");
    }),
    commands.registerCommand("kdb.resultsPanel.export.csv", () => {
      ext.resultsViewProvider.exportToCsv();
    }),
    commands.registerCommand("kdb.connect", async (viewItem: KdbNode) => {
      await connect(viewItem);
    }),
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
      "kdb.insightsConnect",
      async (viewItem: InsightsNode) => {
        await connect(viewItem);
      },
    ),
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
    commands.registerCommand("kdb.dataSource.addDataSource", async () => {
      await addDataSource();
    }),
    commands.registerCommand(
      "kdb.dataSource.populateScratchpad",
      async (dataSourceForm: any) => {
        await populateScratchpad(dataSourceForm);
      },
    ),
    commands.registerCommand(
      "kdb.dataSource.saveDataSource",
      async (dataSourceForm: any) => {
        await saveDataSource(dataSourceForm);
      },
    ),
    commands.registerCommand(
      "kdb.dataSource.runDataSource",
      async (dataSourceForm: any) => {
        await runDataSource(dataSourceForm);
      },
    ),
    commands.registerCommand("kdb.dataSource.refreshDataSource", async () => {
      await refreshDataSource();
    }),
    commands.registerCommand(
      "kdb.dataSource.renameDataSource",
      async (viewItem: KdbDataSourceTreeItem) => {
        window
          .showInputBox({ prompt: "Enter new name for the DataSource" })
          .then(async (newName) => {
            if (newName) {
              await renameDataSource(viewItem.label, newName);
            }
          });
      },
    ),
    commands.registerCommand(
      "kdb.dataSource.deleteDataSource",
      async (viewItem: KdbDataSourceTreeItem) => {
        await deleteDataSource(viewItem);
      },
    ),
    commands.registerCommand(
      "kdb.dataSource.openDataSource",
      async (viewItem: KdbDataSourceTreeItem) => {
        await openDataSource(viewItem, context.extensionUri);
      },
    ),
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
    commands.registerCommand("kdb.execute.selectedQuery", async () => {
      await runActiveEditor(ExecutionTypes.QuerySelection);
    }),
    commands.registerCommand("kdb.execute.fileQuery", async () => {
      await runActiveEditor(ExecutionTypes.QueryFile);
    }),
    commands.registerCommand("kdb.execute.pythonScratchpadQuery", async () => {
      await runActiveEditor(ExecutionTypes.PythonQuerySelection);
    }),
    commands.registerCommand("kdb.scratchpad.reset", async () => {
      await resetScratchPad();
    }),
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
        }
      },
    ),
    commands.registerCommand("kdb.refreshDataSourceExplorer", () => {
      ext.dataSourceTreeProvider.reload();
    }),
    commands.registerCommand(
      "kdb.createScratchpad",
      async (item: FileTreeItem) => {
        const uri = await addWorkspaceFile(item, "scratchpad", ".kdb.q");
        if (uri) {
          await window.showTextDocument(uri);
        }
      },
    ),
    commands.registerCommand(
      "kdb.createPythonScratchpad",
      async (item: FileTreeItem) => {
        const uri = await addWorkspaceFile(item, "scratchpad", ".kdb.py");
        if (uri) {
          await window.showTextDocument(uri);
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

  connectWorkspaceCommsnds();
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
    Object.assign(actualSchema, schemaJSON);
    await yamlExtension.activate().then(() => {
      workspace
        .getConfiguration()
        .update("yaml.schemas", actualSchema, ConfigurationTarget.Global);
    });
  }
}

export async function deactivate(): Promise<void> {
  await Telemetry.dispose();
  if (ext.dataSourceProvider) {
    ext.dataSourceProvider.dispose();
  }

  // cleanup of local q instance processes
  Object.keys(ext.localProcessObjects).forEach((index) => {
    stopLocalProcessByServerName(index);
  });

  if (!ext.client) {
    return undefined;
  }
  return ext.client.stop();
}
