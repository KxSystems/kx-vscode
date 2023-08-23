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

import path from "path";
import {
  CancellationToken,
  commands,
  CompletionItem,
  CompletionItemKind,
  EventEmitter,
  ExtensionContext,
  languages,
  Position,
  TextDocument,
  TextDocumentContentProvider,
  Uri,
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
  addDataSource,
  deleteDataSource,
  openDataSource,
  populateScratchpad,
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
  addNewConnection,
  connect,
  connectInsights,
  disconnect,
  removeConnection,
  removeInsightsConnection,
  runQuery,
} from "./commands/serverCommand";
import { showInstallationDetails } from "./commands/walkthroughCommand";
import { ext } from "./extensionVariables";
import { ExecutionTypes } from "./models/execution";
import { Insights } from "./models/insights";
import { QueryResult } from "./models/queryResult";
import { Server } from "./models/server";
import {
  KdbDataSourceProvider,
  KdbDataSourceTreeItem,
} from "./services/dataSourceTreeProvider";
import {
  InsightsNode,
  KdbNode,
  KdbTreeProvider,
} from "./services/kdbTreeProvider";
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

let client: LanguageClient;

export async function activate(context: ExtensionContext) {
  ext.context = context;
  ext.outputChannel = window.createOutputChannel("kdb");
  ext.openSslVersion = await checkOpenSslInstalled();

  const servers: Server | undefined = getServers();
  const insights: Insights | undefined = getInsights();

  ext.serverProvider = new KdbTreeProvider(servers!, insights!);
  ext.dataSourceProvider = new KdbDataSourceProvider();
  ext.resultsViewProvider = new KdbResultsViewProvider(
    ext.context.extensionUri
  );

  window.registerTreeDataProvider("kdb-servers", ext.serverProvider);
  window.registerTreeDataProvider(
    "kdb-datasources-explorer",
    ext.dataSourceProvider
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

  // check for installed q runtime
  await checkLocalInstall();

  context.subscriptions.push(
    window.registerWebviewViewProvider(
      KdbResultsViewProvider.viewType,
      ext.resultsViewProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    ),
    commands.registerCommand(
      "kdb.resultsPanel.update",
      (results: string, dataSourceType?: string) => {
        ext.resultsViewProvider.updateResults(results, dataSourceType);
      }
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
      "kdb.insightsConnect",
      async (viewItem: InsightsNode) => {
        await connectInsights(viewItem);
      }
    ),
    commands.registerCommand(
      "kdb.insightsRemove",
      async (viewItem: InsightsNode) => {
        await removeInsightsConnection(viewItem);
      }
    ),
    commands.registerCommand("kdb.disconnect", async () => {
      await disconnect();
    }),
    commands.registerCommand("kdb.addConnection", async () => {
      await addNewConnection();
    }),
    commands.registerCommand(
      "kdb.removeConnection",
      async (viewItem: KdbNode) => {
        await removeConnection(viewItem);
      }
    ),
    commands.registerCommand("kdb.refreshServerObjects", () => {
      ext.serverProvider.reload();
    }),
    commands.registerCommand("kdb.dataSource.addDataSource", async () => {
      await addDataSource();
    }),
    commands.registerCommand(
      "kdb.dataSource.populateScratchpad",
      async (dataSourceForm: any) => {
        await populateScratchpad(dataSourceForm);
      }
    ),
    commands.registerCommand(
      "kdb.dataSource.saveDataSource",
      async (dataSourceForm: any) => {
        await saveDataSource(dataSourceForm);
      }
    ),
    commands.registerCommand(
      "kdb.dataSource.runDataSource",
      async (dataSourceForm: any) => {
        await runDataSource(dataSourceForm);
      }
    ),
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
      }
    ),
    commands.registerCommand(
      "kdb.dataSource.deleteDataSource",
      async (viewItem: KdbDataSourceTreeItem) => {
        await deleteDataSource(viewItem);
      }
    ),
    commands.registerCommand(
      "kdb.dataSource.openDataSource",
      async (viewItem: KdbDataSourceTreeItem) => {
        await openDataSource(viewItem, context.extensionUri);
      }
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
      }
    ),
    commands.registerCommand(
      "kdb.stopLocalProcess",
      async (viewItem: KdbNode) => {
        await stopLocalProcess(viewItem);
      }
    ),
    commands.registerCommand("kdb.terminal.run", () => {
      const filename = window.activeTextEditor?.document.fileName;
      if (filename) runQFileTerminal(filename);
    }),
    commands.registerCommand("kdb.execute.selectedQuery", async () => {
      runQuery(ExecutionTypes.QuerySelection);
    }),
    commands.registerCommand("kdb.execute.fileQuery", async () => {
      runQuery(ExecutionTypes.QueryFile);
    })
  );

  const lastResult: QueryResult | undefined = undefined;
  const resultSchema = "vscode-kdb-q";
  const resultProvider = new (class implements TextDocumentContentProvider {
    onDidChangeEmitter = new EventEmitter<Uri>();
    onDidChange = this.onDidChangeEmitter.event;

    provideTextDocumentContent(uri: Uri): string {
      const result = lastResult!;

      return result.result;
    }
  })();

  context.subscriptions.push(
    workspace.registerTextDocumentContentProvider(resultSchema, resultProvider)
  );

  context.subscriptions.push(
    languages.registerCompletionItemProvider("q", {
      provideCompletionItems(
        document: TextDocument,
        position: Position,
        token: CancellationToken
      ) {
        const items: CompletionItem[] = [];
        const getInsertText = (x: string) => {
          if ((x.match(/\./g) || []).length > 1) {
            return x.substr(1);
          }
          return x;
        };

        ext.keywords.forEach((x) =>
          items.push({ label: x, kind: CompletionItemKind.Keyword })
        );
        ext.functions.forEach((x) =>
          items.push({
            label: x,
            insertText: getInsertText(x),
            kind: CompletionItemKind.Function,
          })
        );
        ext.tables.forEach((x) =>
          items.push({
            label: x,
            insertText: getInsertText(x),
            kind: CompletionItemKind.Value,
          })
        );
        ext.variables.forEach((x) =>
          items.push({
            label: x,
            insertText: getInsertText(x),
            kind: CompletionItemKind.Variable,
          })
        );

        return items;
      },
    })
  );

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
      fileEvents: workspace.createFileSystemWatcher("**/*.q"),
    },
  };

  client = new LanguageClient(
    "kdb LangServer",
    "kdb Language Server",
    serverOptions,
    clientOptions
  );

  context.subscriptions.push(
    commands.registerCommand("kdb.sendServerCache", (code) => {
      client.sendNotification("analyzeServerCache", code);
    })
  );

  context.subscriptions.push(
    commands.registerCommand("kdb.sendOnHover", (hoverItems) => {
      client.sendNotification("prepareOnHover", hoverItems);
    })
  );

  client.start().then(() => {
    const configuration = workspace.getConfiguration("kdb.sourceFiles");
    client.sendNotification("analyzeSourceCode", {
      globsPattern: configuration.get("globsPattern"),
      ignorePattern: configuration.get("ignorePattern"),
    });
  });

  Telemetry.sendEvent("Extension.Activated");
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
