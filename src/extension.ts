import { AzureExtensionApiProvider } from "@microsoft/vscode-azext-utils/api";
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
  Range,
  TextDocument,
  TextDocumentContentProvider,
  Uri,
  window,
  workspace,
} from "vscode";
import {
  addNewConnection,
  connect,
  executeQuery,
  removeConnection,
} from "./commands/serverCommand";
import {
  checkWalkthrough,
  hideWalkthrough,
} from "./commands/walkthroughCommand";
import { ext } from "./extensionVariables";
import { QueryResult } from "./models/queryResult";
import { Server } from "./models/server";
import { runQFileTerminal } from "./utils/execution";
import { KdbNode, KdbTreeProvider } from "./services/kdbTreeProvider";
import { checkLocalInstall, formatTable, isTable } from "./utils/core";
import AuthSettings from "./utils/secretStorage";
import { Telemetry } from "./utils/telemetryClient";

export async function activate(context: ExtensionContext) {
  ext.context = context;
  ext.outputChannel = window.createOutputChannel("kxdb");
  ext.azureAccount = (<AzureExtensionApiProvider>(
    extensions.getExtension("ms-vscode.azure-account")!.exports
  )).getApi("1.0.0");

  const server: Server | undefined = workspace
    .getConfiguration()
    .get<Server>("kdb.servers");
  ext.serverProvider = new KdbTreeProvider(server!);
  window.registerTreeDataProvider("kdb-servers", ext.serverProvider);

  AuthSettings.init(context);
  ext.secretSettings = AuthSettings.instance;

  await checkLocalInstall();

  const result = await checkWalkthrough();
  if (result != undefined && result != true) {
    commands.executeCommand(
      "workbench.action.openWalkthrough",
      "kx.kxdb-vscode#qinstallation",
      false
    );
  }

  function runQuery(serverName: string) {
    const editor = window.activeTextEditor;
    if (editor) {
      const query = editor?.document.getText(
        new Range(editor.selection.start, editor.selection.end)
      );
      executeQuery(query, serverName);
    }
  }

  context.subscriptions.push(
    commands.registerCommand("kxdb.connect", async (viewItem: KdbNode) => {
      await connect(viewItem);
    }),
    commands.registerCommand("kxdb.disconnect", async () => {
      ext.connection?.disconnect();
      commands.executeCommand("setContext", "kdb.connected", false);
      ext.connectionNode = undefined;
      ext.serverProvider.reload();
    }),
    commands.registerCommand("kxdb.addConnection", async () => {
      await addNewConnection();
    }),
    commands.registerCommand(
      "kxdb.removeConnection",
      async (viewItem: KdbNode) => {
        await removeConnection(viewItem);
      }
    ),
    commands.registerCommand("kxdb.hideWalkthrough", async () => {
      hideWalkthrough();
    }),
    commands.registerCommand("kxbd.terminal.run", () => {
      const filename = window.activeTextEditor?.document.fileName;
      if (filename) runQFileTerminal(filename);
    }),
    commands.registerCommand(
      "kxbd.execute.query",
      async (viewItem: KdbNode) => {
        runQuery(viewItem.label);
      }
    )
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

  // Telemetry.sendEvent('Extension.Activated');
}

export async function deactivate() {
  Telemetry.dispose();
  // await stopQ();
  if (!ext.client) {
    return undefined;
  }
  return ext.client.stop();
}
