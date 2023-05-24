import { AzureExtensionApiProvider } from "@microsoft/vscode-azext-utils/api";
import path from "path";
import {
  CancellationToken,
  commands,
  CompletionItem,
  CompletionItemKind,
  EventEmitter,
  ExtensionContext,
  extensions,
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
  installTools,
  startLocalProcess,
  stopLocalProcess,
  stopLocalProcessByServerName,
} from "./commands/installTools";
import {
  addNewConnection,
  connect,
  disconnect,
  removeConnection,
  runQuery,
} from "./commands/serverCommand";
import {
  hideWalkthrough,
  showInstallationDetails,
  showWalkthrough,
} from "./commands/walkthroughCommand";
import { ext } from "./extensionVariables";
import { ExecutionTypes } from "./models/execution";
import { QueryResult } from "./models/queryResult";
import { Server } from "./models/server";
import { KdbNode, KdbTreeProvider } from "./services/kdbTreeProvider";
import {
  checkLocalInstall,
  formatTable,
  getServers,
  initializeLocalServers,
  isTable,
} from "./utils/core";
import { runQFileTerminal } from "./utils/execution";
import AuthSettings from "./utils/secretStorage";
import { Telemetry } from "./utils/telemetryClient";

let client: LanguageClient;

export async function activate(context: ExtensionContext) {
  ext.context = context;
  ext.outputChannel = window.createOutputChannel("kdb");

  // integration wtih Azure Account extension (https://marketplace.visualstudio.com/items?itemName=ms-vscode.azure-account)
  ext.azureAccount = (<AzureExtensionApiProvider>(
    extensions.getExtension("ms-vscode.azure-account")!.exports
  )).getApi("1.0.0");

  const servers: Server | undefined = getServers();
  ext.serverProvider = new KdbTreeProvider(servers!);
  window.registerTreeDataProvider("kdb-servers", ext.serverProvider);

  // initialize local servers
  if (servers !== undefined) {
    initializeLocalServers(servers);
    ext.serverProvider.refresh(servers);
  }

  // initialize the secret store
  AuthSettings.init(context);
  ext.secretSettings = AuthSettings.instance;

  // check for installed q runtime
  await checkLocalInstall();

  // hide walkthrough if requested
  if (await showWalkthrough()) {
    commands.executeCommand(
      "workbench.action.openWalkthrough",
      "kx.kdb-vscode#qinstallation",
      false
    );
  }

  context.subscriptions.push(
    commands.registerCommand("kdb.connect", async (viewItem: KdbNode) => {
      await connect(viewItem);
    }),
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
    commands.registerCommand("kdb.hideWalkthrough", async () => {
      await hideWalkthrough();
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

      const headers = result.meta.map((m) => m.c);
      const aligns = result.meta.map((m) => (m.t === "f" ? "." : "1"));
      const opts = { align: aligns, keys: result.keys };
      const data = result.data;

      const text: string = isTable(result)
        ? formatTable(headers, data, opts)
        : data;
      return text;
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
    "kdb+ LangServer",
    "kdb+ Language Server",
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

  // Telemetry.sendEvent('Extension.Activated');
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
