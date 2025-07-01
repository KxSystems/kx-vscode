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

import { env } from "node:process";
import path from "path";
import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

import { connectBuildTools, lintCommand } from "./commands/buildToolsCommand";
import { connectClientCommands } from "./commands/clientCommands";
import {
  installTools,
  startLocalProcess,
  stopLocalProcess,
  stopLocalProcessByServerName,
} from "./commands/installTools";
import {
  activeConnection,
  addAuthConnection,
  addInsightsConnection,
  addKdbConnection,
  addNewConnection,
  connect,
  copyQuery,
  disconnect,
  editConnection,
  editInsightsConnection,
  editKdbConnection,
  enableTLS,
  executeQuery,
  exportConnections,
  importConnections,
  openMeta,
  refreshGetMeta,
  removeConnection,
  rerunQuery,
  resetScratchpad,
} from "./commands/serverCommand";
import { showInstallationDetails } from "./commands/walkthroughCommand";
import {
  ConnectionLensProvider,
  checkOldDatasourceFiles,
  connectWorkspaceCommands,
  importOldDSFiles,
  pickConnection,
  pickTarget,
  resetScratchpadFromEditor,
  runActiveEditor,
  setServerForUri,
} from "./commands/workspaceCommand";
import { ext } from "./extensionVariables";
import { CommandRegistration } from "./models/commandRegistration";
import {
  InsightDetails,
  Insights,
  Server,
  ServerDetails,
} from "./models/connectionsModels";
import { createDefaultDataSourceFile } from "./models/dataSource";
import { ExecutionTypes } from "./models/execution";
import { QueryResult } from "./models/queryResult";
import { ChartEditorProvider } from "./services/chartEditorProvider";
import { CompletionProvider } from "./services/completionProvider";
import { DataSourceEditorProvider } from "./services/dataSourceEditorProvider";
import { HelpFeedbackProvider } from "./services/helpFeedbackProvider";
import {
  InsightsMetaNode,
  InsightsNode,
  KdbNode,
  KdbTreeProvider,
  MetaObjectPayloadNode,
} from "./services/kdbTreeProvider";
import { KxNotebookController } from "./services/notebookController";
import {
  inputVariable,
  KxNotebookTargetActionProvider,
} from "./services/notebookProviders";
import { KxNotebookSerializer } from "./services/notebookSerializer";
import {
  QueryHistoryProvider,
  QueryHistoryTreeItem,
} from "./services/queryHistoryProvider";
import { QuickFixProvider } from "./services/quickFixProvider";
import { KdbResultsViewProvider } from "./services/resultsPanelProvider";
import {
  FileTreeItem,
  WorkspaceTreeProvider,
} from "./services/workspaceTreeProvider";
import {
  createNewLabel,
  deleteLabel,
  getWorkspaceLabels,
  getWorkspaceLabelsConnMap,
  renameLabel,
  setLabelColor,
} from "./utils/connLabel";
import {
  checkLocalInstall,
  checkOpenSslInstalled,
  fixUnnamedAlias,
  getInsights,
  getServers,
  hasWorkspaceOrShowOption,
  initializeLocalServers,
} from "./utils/core";
import { runQFileTerminal } from "./utils/execution";
import { handleFeedbackSurvey } from "./utils/feedbackSurveyUtils";
import { getIconPath } from "./utils/iconsUtils";
import { MessageKind, notify, Runner } from "./utils/notifications";
import AuthSettings from "./utils/secretStorage";
import { Telemetry } from "./utils/telemetryClient";
import {
  activateTextDocument,
  addWorkspaceFile,
  openWith,
  setUriContent,
} from "./utils/workspace";

const logger = "extension";

let client: LanguageClient;

export async function activate(context: vscode.ExtensionContext) {
  ext.context = context;
  ext.outputChannel = vscode.window.createOutputChannel("kdb");
  ext.openSslVersion = await checkOpenSslInstalled();
  ext.isBundleQCreated = false;

  getWorkspaceLabelsConnMap();
  getWorkspaceLabels();

  // clear necessary contexts
  vscode.commands.executeCommand("setContext", "kdb.connected.active", false);
  vscode.commands.executeCommand("setContext", "kdb.pythonEnabled", false);
  vscode.commands.executeCommand("setContext", "kdb.connected", []);
  vscode.commands.executeCommand("setContext", "kdb.kdbQHCopyList", []);

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

  fixUnnamedAlias();

  vscode.commands.executeCommand("setContext", "kdb.QHOME", env.QHOME);

  vscode.window.registerTreeDataProvider("kdb-servers", ext.serverProvider);

  vscode.window.registerTreeDataProvider(
    "kdb-query-history",
    ext.queryHistoryProvider,
  );
  vscode.window.registerTreeDataProvider(
    "kdb-scratchpad-explorer",
    ext.scratchpadTreeProvider,
  );
  vscode.window.registerTreeDataProvider(
    "kdb-datasource-explorer",
    ext.dataSourceTreeProvider,
  );

  vscode.window.registerTreeDataProvider(
    "kdb-help-feedback-view",
    new HelpFeedbackProvider(),
  );

  // initialize local servers
  if (servers !== undefined) {
    initializeLocalServers(servers);
    ext.serverProvider.refresh(servers);
  }

  // initialize the secret store
  AuthSettings.init(context);
  ext.secretSettings = AuthSettings.instance;

  vscode.commands.executeCommand("kdb-results.focus");

  try {
    // check for installed q runtime
    await checkLocalInstall(true);
  } catch (err) {
    notify(`${err}`, MessageKind.DEBUG, { logger });
  }

  registerAllExtensionCommands();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      KdbResultsViewProvider.viewType,
      ext.resultsViewProvider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),

    DataSourceEditorProvider.register(context),
    ChartEditorProvider.register(context),

    vscode.languages.registerCodeLensProvider(
      { pattern: "**/*.{q,py,sql}" },
      new ConnectionLensProvider(),
    ),

    vscode.languages.registerCodeActionsProvider(
      { language: "q" },
      new QuickFixProvider(),
    ),
    ext.diagnosticCollection,
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("kdb.connectionMap")) {
        ext.dataSourceTreeProvider.reload();
        ext.scratchpadTreeProvider.reload();
      }
      if (event.affectsConfiguration("kdb.connectionLabelsMap")) {
        ext.serverProvider.reload();
      }
      if (event.affectsConfiguration("kdb.connectionLabels")) {
        ext.serverProvider.reload();
      }
    }),
  );

  checkOldDatasourceFiles();

  const lastResult: QueryResult | undefined = undefined;
  const resultSchema = "vscode-kdb-q";
  const resultProvider = new (class
    implements vscode.TextDocumentContentProvider
  {
    onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
    onDidChange = this.onDidChangeEmitter.event;

    provideTextDocumentContent(_uri: vscode.Uri): string {
      const result = lastResult!;

      return result.result;
    }
  })();

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      resultSchema,
      resultProvider,
    ),
  );

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { language: "q" },
      new CompletionProvider(),
    ),
  );

  context.subscriptions.push(
    vscode.workspace.registerNotebookSerializer(
      "kx-notebook",
      new KxNotebookSerializer(),
    ),
    new KxNotebookController(),
  );

  context.subscriptions.push(
    vscode.notebooks.registerNotebookCellStatusBarItemProvider(
      "kx-notebook",
      new KxNotebookTargetActionProvider(),
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
    documentSelector: [{ language: "q" }],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher("**/*.{q,quke}"),
    },
  };

  client = new LanguageClient(
    "kdb LangServer",
    "kdb Language Server",
    serverOptions,
    clientOptions,
  );

  await client.start();

  connectClientCommands(context, client);

  const yamlExtension = vscode.extensions.getExtension("redhat.vscode-yaml");
  if (yamlExtension) {
    const actualSchema = await vscode.workspace
      .getConfiguration()
      .get("yaml.schemas");
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
      vscode.workspace
        .getConfiguration()
        .update(
          "yaml.schemas",
          actualSchema,
          vscode.ConfigurationTarget.Global,
        );
    });
  }
  const authExtension = vscode.extensions.getExtension("KX.kdb-auth");
  if (authExtension) {
    const api = await authExtension.activate();
    if ("auth" in api) {
      notify("Custom authentication activated.", MessageKind.DEBUG, {
        logger,
        telemetry: "CustomAuth.Extension.Actived",
      });
      ext.customAuth = api;
    }
  }
  handleFeedbackSurvey();

  notify("kdb extension is now active.", MessageKind.DEBUG, {
    logger,
    telemetry: "Extension.Activated",
  });
}

function registerHelpCommands(): CommandRegistration[] {
  const helpCommands: CommandRegistration[] = [
    {
      command: "kdb.help.openDocumentation",
      callback: () => {
        vscode.commands
          .executeCommand(
            "workbench.extensions.action.showExtensionDetails",
            "KX.kdb",
          )
          .then(undefined, () => {
            notify("Help&Feedback documentation selected.", MessageKind.DEBUG, {
              logger,
              telemetry: "Help&Feedback.Open.ExtensionDocumentation",
            });
            vscode.commands.executeCommand("extension.open", "KX.kdb");
          });
      },
    },
    {
      command: "kdb.help.suggestFeature",
      callback: () => {
        notify("Help&Feedback suggest a feature selected.", MessageKind.DEBUG, {
          logger,
          telemetry: "Help&Feedback.Open.SuggestFeature",
        });
        vscode.env.openExternal(vscode.Uri.parse(ext.urlLinks.suggestFeature));
      },
    },
    {
      command: "kdb.help.provideFeedback",
      callback: () => {
        notify("Help&Feedback survey selected.", MessageKind.DEBUG, {
          logger,
          telemetry: "Help&Feedback.Open.Survey",
        });
        vscode.env.openExternal(vscode.Uri.parse(ext.urlLinks.survey));
      },
    },
    {
      command: "kdb.help.reportBug",
      callback: () => {
        notify("Help&Feedback report a bug selected.", MessageKind.DEBUG, {
          logger,
          telemetry: "Help&Feedback.Open.ReportBug",
        });
        vscode.env.openExternal(vscode.Uri.parse(ext.urlLinks.reportBug));
      },
    },
  ];

  return helpCommands;
}

function registerResultsPanelCommands(): CommandRegistration[] {
  const resultsCommands: CommandRegistration[] = [
    {
      command: "kdb.resultsPanel.update",
      callback: (
        results: any,
        isInsights: boolean,
        connVersion?: number,
        isPython?: boolean,
      ) => {
        ext.resultsViewProvider.updateResults(
          results,
          isInsights,
          connVersion,
          isPython,
        );
      },
    },
    {
      command: "kdb.resultsPanel.clear",
      callback: () => ext.resultsViewProvider.updateResults(""),
    },
    {
      command: "kdb.resultsPanel.export.csv",
      callback: () => ext.resultsViewProvider.exportToCsv(),
    },
  ];

  return resultsCommands;
}

function registerDatasourceCommands(): CommandRegistration[] {
  const dataSourceCommands: CommandRegistration[] = [
    {
      command: "kdb.datasource.import",
      callback: async () => await importOldDSFiles(),
    },
    {
      command: "kdb.datasource.create",
      callback: async (item: FileTreeItem) => {
        if (hasWorkspaceOrShowOption("adding datasources")) {
          const uri = await addWorkspaceFile(
            item ? item.resourceUri : undefined,
            "datasource",
            ".kdb.json",
          );
          await vscode.workspace.openTextDocument(uri);
          await setUriContent(
            uri,
            JSON.stringify(createDefaultDataSourceFile(), null, 2),
          );
          await openWith(uri, DataSourceEditorProvider.viewType);
          await vscode.commands.executeCommand(
            "workbench.action.files.save",
            uri,
          );
          await setServerForUri(uri, undefined);
        }
      },
    },
    {
      command: "kdb.datasource.refreshDataSourceExplorer",
      callback: () => ext.dataSourceTreeProvider.reload(),
    },
  ];

  return dataSourceCommands;
}

function registerScratchpadCommands(): CommandRegistration[] {
  const scratchpadCommands: CommandRegistration[] = [
    {
      command: "kdb.scratchpad.run",
      callback: async () => {
        await runActiveEditor();
      },
    },
    {
      command: "kdb.scratchpad.reset",
      callback: async (viewItem?: InsightsNode) => {
        const connLabel = viewItem ? viewItem.label : undefined;
        await resetScratchpad(connLabel);
      },
    },
    {
      command: "kdb.scratchpad.editor.reset",
      callback: async () => {
        await resetScratchpadFromEditor();
      },
    },
    {
      command: "kdb.scratchpad.create",
      callback: async (item: FileTreeItem) => {
        if (hasWorkspaceOrShowOption("adding workbooks")) {
          const uri = await addWorkspaceFile(
            item ? item.resourceUri : undefined,
            "workbook",
            ".kdb.q",
          );
          await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(uri);
          await vscode.commands.executeCommand(
            "workbench.action.files.save",
            uri,
          );
          await setServerForUri(uri, undefined);
        }
      },
    },
    {
      command: "kdb.scratchpad.python.run",
      callback: async () => {
        await runActiveEditor(ExecutionTypes.PythonQuerySelection);
      },
    },
    {
      command: "kdb.scratchpad.python.run.file",
      callback: async () => {
        await runActiveEditor(ExecutionTypes.PythonQueryFile);
      },
    },
    {
      command: "kdb.execute.sql",
      callback: async () => {
        await runActiveEditor(ExecutionTypes.PythonQueryFile);
      },
    },
    {
      command: "kdb.scratchpad.python.create",
      callback: async (item: FileTreeItem) => {
        if (hasWorkspaceOrShowOption("adding workbooks")) {
          const uri = await addWorkspaceFile(
            item ? item.resourceUri : undefined,
            "workbook",
            ".kdb.py",
          );
          await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(uri);
          await vscode.commands.executeCommand(
            "workbench.action.files.save",
            uri,
          );
          await setServerForUri(uri, undefined);
        }
      },
    },
    {
      command: "kdb.scratchpad.explorer.refresh",
      callback: () => {
        ext.scratchpadTreeProvider.reload();
      },
    },
  ];

  return scratchpadCommands;
}

function registerQueryHistoryCommands(): CommandRegistration[] {
  const queryHistoryCommands: CommandRegistration[] = [
    {
      command: "kdb.queryHistory.clear",
      callback: () => {
        ext.kdbQueryHistoryList.length = 0;
        ext.kdbQueryHistoryNodes.length = 0;
        ext.queryHistoryProvider.refresh();
      },
    },
    {
      command: "kdb.queryHistory.rerun",
      callback: async (viewItem: QueryHistoryTreeItem) => {
        rerunQuery(viewItem.details);
      },
    },
    {
      command: "kdb.queryHistory.copyQuery",
      callback: async (viewItem: QueryHistoryTreeItem) => {
        copyQuery(viewItem.details);
      },
    },
  ];

  return queryHistoryCommands;
}

function registerConnectionsCommands(): CommandRegistration[] {
  const connectionCommands: CommandRegistration[] = [
    {
      command: "kdb.connections.connect",
      callback: async (viewItem: KdbNode | InsightsNode) => {
        await connect(viewItem.label);
      },
    },
    {
      command: "kdb.connections.connect.via.dialog",
      callback: async (connLabel: string) => {
        await connect(connLabel);
      },
    },
    {
      command: "kdb.connections.setActive",
      callback: async (viewItem: KdbNode) => {
        activeConnection(viewItem);
      },
    },
    {
      command: "kdb.connections.addAuthentication",
      callback: async (viewItem: KdbNode) => {
        const username = await vscode.window.showInputBox({
          prompt: "Username",
          title: "Add Authentication",
        });
        if (username) {
          const password = await vscode.window.showInputBox({
            prompt: "Password",
            title: "Add Authentication",
            password: true,
          });
          if (password) {
            await addAuthConnection(viewItem.children[0], username, password);
          }
        }
      },
    },
    {
      command: "kdb.connections.enableTLS",
      callback: async (viewItem: KdbNode) => {
        await enableTLS(viewItem.children[0]);
      },
    },
    {
      command: "kdb.connections.remove.insights",
      callback: async (viewItem: InsightsNode) => {
        await removeConnection(viewItem);
      },
    },
    {
      command: "kdb.connections.remove.kdb",
      callback: async (viewItem: KdbNode) => {
        await removeConnection(viewItem);
      },
    },
    {
      command: "kdb.connections.disconnect",
      callback: async (viewItem: InsightsNode | KdbNode | string) => {
        const connLabel =
          typeof viewItem === "string" ? viewItem : viewItem.label;
        await disconnect(connLabel);
      },
    },
    {
      command: "kdb.connections.export.all",
      callback: () => {
        notify("Export all conections.", MessageKind.DEBUG, {
          logger,
          telemetry: "Connections.Export.All",
        });
        exportConnections();
      },
    },
    {
      command: "kdb.connections.export.single",
      callback: async (viewItem: KdbNode | InsightsNode) => {
        notify("Export single conection.", MessageKind.DEBUG, {
          logger,
          telemetry: "Connections.Export.Single",
        });
        exportConnections(viewItem.label);
      },
    },
    {
      command: "kdb.connections.import",
      callback: async () => {
        notify("Import conections.", MessageKind.DEBUG, {
          logger,
          telemetry: "Connections.Import",
        });
        await importConnections();
      },
    },
    {
      command: "kdb.connections.content.selectView",
      callback: async (viewItem) => {
        const connLabel = viewItem.connLabel
          ? viewItem.connLabel.split("[")[1].split("]")[0]
          : undefined;
        if (connLabel) {
          const executorName = viewItem.coreIcon.substring(2);
          executeQuery(
            viewItem.label,
            connLabel,
            executorName,
            "",
            false,
            false,
            true,
          );
        } else {
          notify("Connection label not found", MessageKind.ERROR, {
            logger,
          });
        }
      },
    },
    {
      command: "kdb.connections.open.meta",
      callback: async (viewItem: InsightsMetaNode | MetaObjectPayloadNode) => {
        await openMeta(viewItem);
      },
    },
    {
      command: "kdb.connections.add",
      callback: async () => {
        await addNewConnection();
      },
    },
    {
      command: "kdb.connections.edit",
      callback: async (viewItem: KdbNode | InsightsNode) => {
        await editConnection(viewItem);
      },
    },
    {
      command: "kdb.connections.add.insights",
      callback: async (insightsData: InsightDetails, labels: string[]) => {
        await addInsightsConnection(insightsData, labels);
      },
    },
    {
      command: "kdb.connections.add.kdb",
      callback: async (kdbData: ServerDetails, labels: string[]) => {
        await addKdbConnection(kdbData, false, labels);
      },
    },
    {
      command: "kdb.connections.add.bundleq",
      callback: async (kdbData: ServerDetails, labels: string[]) => {
        await addKdbConnection(kdbData, true, labels);
      },
    },
    {
      command: "kdb.connections.edit.insights",
      callback: async (
        insightsData: InsightDetails,
        oldAlias: string,
        labels: string[],
      ) => {
        await editInsightsConnection(insightsData, oldAlias, labels);
      },
    },
    {
      command: "kdb.connections.edit.kdb",
      callback: async (
        kdbData: ServerDetails,
        oldAlias: string,
        editAuth: boolean,
        labels: string[],
      ) => {
        await editKdbConnection(kdbData, oldAlias, false, editAuth, labels);
      },
    },
    {
      command: "kdb.connections.edit.bundleq",
      callback: async (
        kdbData: ServerDetails,
        oldAlias: string,
        labels: string[],
      ) => {
        await editKdbConnection(kdbData, oldAlias, true, false, labels);
      },
    },
    {
      command: "kdb.connections.refresh.serverObjects",
      callback: async () => {
        const runner = Runner.create(() => {
          ext.serverProvider.reload();
          return refreshGetMeta();
        });
        runner.location = vscode.ProgressLocation.Notification;
        runner.title = "Refreshing server objects for all connections.";
        await runner.execute();
      },
    },
    {
      command: "kdb.connections.refresh.meta",
      callback: async (viewItem: InsightsNode) => {
        const runner = Runner.create(() => refreshGetMeta(viewItem.label));
        runner.location = vscode.ProgressLocation.Notification;
        runner.title = `Refreshing meta data for ${viewItem.label || "all connections"}.`;
        await runner.execute();
      },
    },
    {
      command: "kdb.connections.labels.add",
      callback: async (name: string, colorName: string) => {
        await createNewLabel(name, colorName);
      },
    },
    {
      command: "kdb.connections.labels.rename",
      callback: async (item) => {
        if (item) {
          const name = await vscode.window.showInputBox({
            prompt: "Enter label name",
            value: item.label,
          });
          if (name) {
            renameLabel(item.label, name);
          }
        }
      },
    },
    {
      command: "kdb.connections.labels.edit",
      callback: async (item) => {
        if (item) {
          const colors = ext.labelColors.map((color) => ({
            label: color.name,
            iconPath: getIconPath(`label-${color.name.toLowerCase()}.svg`),
          }));
          const picked = await vscode.window.showQuickPick(colors, {
            title: "Select label color",
            placeHolder: item.source.color.name,
          });
          if (picked) {
            setLabelColor(item.label, picked.label);
          }
        }
      },
    },
    {
      command: "kdb.connections.labels.delete",
      callback: (item) => {
        if (item) {
          deleteLabel(item.label);
        }
      },
    },
    {
      command: "kdb.connections.localProcess.stop",
      callback: async (viewItem: KdbNode) => {
        await vscode.commands.executeCommand(
          "kdb.connections.disconnect",
          viewItem,
        );
        await stopLocalProcess(viewItem);
      },
    },
    {
      command: "kdb.connections.localProcess.start",
      callback: async (viewItem: KdbNode) => {
        await startLocalProcess(viewItem);
      },
    },
  ];

  return connectionCommands;
}

function registerExecuteCommands(): CommandRegistration[] {
  const editorCommands: CommandRegistration[] = [
    {
      command: "kdb.execute.selectedQuery",
      callback: async () => {
        await runActiveEditor(ExecutionTypes.QuerySelection);
      },
    },
    {
      command: "kdb.execute.fileQuery",
      callback: async (item) => {
        if (item instanceof vscode.Uri) {
          await activateTextDocument(item);
        }
        await runActiveEditor(ExecutionTypes.QueryFile);
      },
    },
    {
      command: "kdb.execute.terminal.run.file",
      callback: () => {
        if (env.QHOME) {
          runQFileTerminal();
        } else {
          checkLocalInstall();
        }
      },
    },
    {
      command: "kdb.execute.terminal.run",
      callback: async () => {
        if (ext.activeTextEditor) {
          const uri = vscode.Uri.joinPath(
            ext.context.globalStorageUri,
            "kdb-vscode-repl.q",
          );
          const text = ext.activeTextEditor.document.getText();
          try {
            await vscode.workspace.fs.writeFile(
              uri,
              Buffer.from(text, "utf-8"),
            );
            runQFileTerminal(`"${uri.fsPath}"`);
          } catch (error) {
            notify(`Unable to write temp file.`, MessageKind.ERROR, {
              logger,
              params: error,
            });
          }
        }
      },
    },
  ];

  return editorCommands;
}

function registerFileCommands(): CommandRegistration[] {
  const fileCommands: CommandRegistration[] = [
    {
      command: "kdb.file.rename",
      callback: async (item: FileTreeItem) => {
        if (item && item.resourceUri) {
          if (item.resourceUri.path.endsWith(".kdb.json")) {
            await openWith(item.resourceUri, DataSourceEditorProvider.viewType);
          } else {
            const document = await vscode.workspace.openTextDocument(
              item.resourceUri,
            );
            await vscode.window.showTextDocument(document);
          }
          await vscode.commands.executeCommand("revealInExplorer");
          await vscode.commands.executeCommand("renameFile");
        }
      },
    },
    {
      command: "kdb.file.delete",
      callback: async (item: FileTreeItem) => {
        if (item && item.resourceUri) {
          if (item.resourceUri.path.endsWith(".kdb.json")) {
            await openWith(item.resourceUri, DataSourceEditorProvider.viewType);
          } else {
            const document = await vscode.workspace.openTextDocument(
              item.resourceUri,
            );
            await vscode.window.showTextDocument(document);
          }
          await vscode.commands.executeCommand("revealInExplorer");
          await vscode.commands.executeCommand("deleteFile");
        }
      },
    },
    {
      command: "kdb.file.pickConnection",
      callback: async () => {
        const editor = ext.activeTextEditor;
        if (editor) {
          await pickConnection(editor.document.uri);
        }
      },
    },
    {
      command: "kdb.file.pickTarget",
      callback: async (cell?: vscode.NotebookCell) => {
        const editor = ext.activeTextEditor;
        if (editor) {
          await pickTarget(editor.document.uri, cell);
        }
      },
    },
    {
      command: "kdb.file.inputVariable",
      callback: async (cell: vscode.NotebookCell) => {
        await inputVariable(cell);
      },
    },
    {
      command: "kdb.file.populateScratchpad",
      callback: async () => {
        await runActiveEditor(ExecutionTypes.PopulateScratchpad);
      },
    },
  ];

  return fileCommands;
}

function registerInstallCommands(): CommandRegistration[] {
  const installCommands: CommandRegistration[] = [
    {
      command: "kdb.install.showDetails",
      callback: async () => {
        await showInstallationDetails();
      },
    },
    {
      command: "kdb.install.tools",
      callback: async () => {
        await installTools();
      },
    },
  ];

  return installCommands;
}

function registerLSCommands(): CommandRegistration[] {
  const lsCommands: CommandRegistration[] = [
    {
      command: "kdb.ls.q.lint",
      callback: async () => {
        const editor = ext.activeTextEditor;
        if (editor) {
          await lintCommand(editor.document);
        }
      },
    },
  ];

  return lsCommands;
}

function registerNotebookCommands(): CommandRegistration[] {
  const notebookCommands: CommandRegistration[] = [
    {
      command: "kdb.createNotebook",
      callback: async () => {
        const notebook = await vscode.workspace.openNotebookDocument(
          "kx-notebook",
          {
            cells: [
              {
                kind: 2,
                value: "",
                languageId: "q",
              },
            ],
          },
        );
        await vscode.window.showNotebookDocument(notebook);
      },
    },
  ];

  return notebookCommands;
}

function registerAllExtensionCommands(): void {
  const allCommands: CommandRegistration[] = [
    ...registerHelpCommands(),
    ...registerResultsPanelCommands(),
    ...registerDatasourceCommands(),
    ...registerScratchpadCommands(),
    ...registerQueryHistoryCommands(),
    ...registerConnectionsCommands(),
    ...registerExecuteCommands(),
    ...registerFileCommands(),
    ...registerInstallCommands(),
    ...registerLSCommands(),
    ...registerNotebookCommands(),
  ];

  allCommands.forEach((command) => {
    ext.context.subscriptions.push(
      vscode.commands.registerCommand(command.command, command.callback),
    );
  });
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
