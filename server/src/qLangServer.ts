/*
 * Copyright (c) 1998-2026 KX Systems Inc.
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

import { readFile, stat } from "fs/promises";
import { delimiter, join, sep } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import {
  CallHierarchyIncomingCall,
  CallHierarchyIncomingCallsParams,
  CallHierarchyItem,
  CallHierarchyOutgoingCall,
  CallHierarchyOutgoingCallsParams,
  CallHierarchyPrepareParams,
  CompletionItem,
  CompletionItemKind,
  CompletionParams,
  Connection,
  DefinitionParams,
  DidChangeWatchedFilesParams,
  DocumentSymbol,
  DocumentSymbolParams,
  FoldingRange,
  FoldingRangeKind,
  FoldingRangeParams,
  InitializeParams,
  Location,
  NotebookDocuments,
  Range,
  ReferenceParams,
  RenameParams,
  SelectionRange,
  SelectionRangeParams,
  SemanticTokens,
  SemanticTokensParams,
  ServerCapabilities,
  SymbolKind,
  TextDocumentChangeEvent,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  TextDocuments,
  TextEdit,
  WorkspaceEdit,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

import {
  RCurly,
  LCurly,
  RBracket,
  LineComment,
  EndOfLine,
  WhiteSpace,
  CommentEndOfLine,
  CommentLiteral,
  Documentation,
} from "./parser";
import {
  Name,
  Namespace,
  Param,
  Peek,
  RangeFrom,
  Relative,
  Scope,
  Source,
  Token,
  Type,
} from "./parser";
import { CommentBegin, CommentEnd, ExitCommentBegin } from "./parser/ranges";

const logger = "qLangServer";

const enum MessageKind {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARNING = "WARNING",
  ERROR = "ERROR",
}

export default class QLangServer {
  declare private connection: Connection;
  declare private params: InitializeParams;
  declare private opened: Set<string>;
  declare private cached: Map<string, Source>;
  declare private modules: Map<string, string | undefined>;
  declare public documents: TextDocuments<TextDocument>;
  declare public notebooks: NotebookDocuments<TextDocument>;

  constructor(connection: Connection, params: InitializeParams) {
    this.connection = connection;
    this.params = params;
    this.opened = new Set();
    this.cached = new Map();
    this.modules = new Map();
    this.documents = new TextDocuments(TextDocument);
    this.documents.listen(this.connection);
    this.documents.onDidOpen(this.onDidOpen.bind(this));
    this.documents.onDidClose(this.onDidClose.bind(this));
    this.documents.onDidChangeContent(this.onDidChangeContent.bind(this));
    this.notebooks = new NotebookDocuments(this.documents);
    this.notebooks.listen(this.connection);
    this.connection.onDocumentSymbol(this.onDocumentSymbol.bind(this));
    this.connection.onReferences(this.onReferences.bind(this));
    this.connection.onDefinition(this.onDefinition.bind(this));
    this.connection.onRenameRequest(this.onRenameRequest.bind(this));
    this.connection.onCompletion(this.onCompletion.bind(this));
    this.connection.languages.callHierarchy.onPrepare(
      this.onPrepareCallHierarchy.bind(this),
    );
    this.connection.languages.callHierarchy.onIncomingCalls(
      this.onIncomingCallsCallHierarchy.bind(this),
    );
    this.connection.languages.callHierarchy.onOutgoingCalls(
      this.onOutgoingCallsCallHierarchy.bind(this),
    );
    this.connection.languages.semanticTokens.on(
      this.onSemanticTokens.bind(this),
    );
    this.connection.onDidChangeWatchedFiles(
      this.onDidChangeWatchedFiles.bind(this),
    );
    this.connection.onRequest(
      "kdb.qls.expressionRange",
      this.onExpressionRange.bind(this),
    );
    this.connection.onRequest(
      "kdb.qls.parameterCache",
      this.onParameterCache.bind(this),
    );
    this.connection.onSelectionRanges(this.onSelectionRanges.bind(this));
    this.connection.onFoldingRanges(this.onFoldingRanges.bind(this));
  }

  public capabilities(): ServerCapabilities {
    return {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      documentSymbolProvider: true,
      referencesProvider: true,
      definitionProvider: true,
      renameProvider: true,
      completionProvider: { resolveProvider: false, triggerCharacters: ["."] },
      selectionRangeProvider: true,
      callHierarchyProvider: true,
      semanticTokensProvider: {
        legend: {
          tokenTypes: ["variable", "function"],
          tokenModifiers: ["declaration", "readonly"],
        },
        full: true,
      },
      notebookDocumentSync: {
        notebookSelector: [
          {
            notebook: { notebookType: "kx-notebook" },
            cells: [{ language: "q" }],
          },
        ],
      },
      foldingRangeProvider: true,
    };
  }

  private async getLinting(uri: string): Promise<boolean> {
    const res = await this.connection.workspace.getConfiguration({
      scopeUri: uri,
      section: "kdb.linting",
    });
    return res ?? false;
  }

  private async getRefactoring(uri: string): Promise<"Workspace" | "Window"> {
    const res = await this.connection.workspace.getConfiguration({
      scopeUri: uri,
      section: "kdb.refactoring",
    });
    return res ?? "Workspace";
  }

  private async getConnectionMap(
    uri: string,
  ): Promise<{ [key: string]: string }> {
    const res = await this.connection.workspace.getConfiguration({
      scopeUri: uri,
      section: "kdb.connectionMap",
    });
    return res ?? {};
  }

  private async getQHome(uri: string): Promise<string | undefined> {
    const workspace = await this.connection.workspace.getConfiguration({
      scopeUri: uri,
      section: "kdb.qHomeDirectoryWorkspace",
    });
    const global = await this.connection.workspace.getConfiguration({
      scopeUri: uri,
      section: "kdb.qHomeDirectory",
    });
    return workspace || global || process.env.QHOME || undefined;
  }

  private notify(
    message: string,
    kind: MessageKind,
    options: {
      logger?: string;
      params?: any;
      telemetry?: string | boolean;
    } = {},
  ) {
    this.connection.sendNotification("notify", {
      message,
      kind,
      options,
    });
  }

  public onDidChangeWatchedFiles({ changes }: DidChangeWatchedFilesParams) {
    for (const change of changes) {
      this.invalidate(change.uri);
    }
    this.modules.clear();
  }

  private invalidate(uri: string) {
    for (const key of this.cached.keys()) {
      if (key === uri || key.startsWith(uri + "\0")) {
        this.cached.delete(key);
      }
    }
  }

  public onDidOpen({ document }: TextDocumentChangeEvent<TextDocument>) {
    this.opened.add(document.uri);
  }

  public async onDidChangeContent({
    document,
  }: TextDocumentChangeEvent<TextDocument>) {
    const uri = document.uri;

    if (this.opened.has(uri)) this.opened.delete(uri);
    else this.invalidate(uri);

    if (await this.getLinting(uri)) {
      const source = await this.getSource(uri);
      const diagnostics = source.errors
        .filter((token) => token.error)
        .map((token) => token.error!);
      this.connection.sendDiagnostics({ uri, diagnostics });
    }
  }

  public onDidClose({ document }: TextDocumentChangeEvent<TextDocument>) {
    this.connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
  }

  public async onDocumentSymbol({
    textDocument: { uri },
  }: DocumentSymbolParams): Promise<DocumentSymbol[]> {
    const source = await this.getSource(uri);
    return source.symbols.map((token) => createSymbol(token, source));
  }

  public async onReferences({
    textDocument: { uri },
    position,
  }: ReferenceParams): Promise<Location[]> {
    this.notify("onReferences", MessageKind.DEBUG, {
      logger,
      telemetry: "Language.References",
    });

    const source = await this.getSource(uri);
    const target = source.tokenAt(position);

    return (await this.getSources(uri))
      .map((source) =>
        source.references
          .filter(
            (token) =>
              token.scope === Scope(target) && Name(token) === Name(target),
          )
          .map((token) => Location.create(source.uri, RangeFrom(token))),
      )
      .flat();
  }

  public async onDefinition({
    textDocument: { uri },
    position,
  }: DefinitionParams): Promise<Location[]> {
    this.notify("onDefinition", MessageKind.DEBUG, {
      logger,
      telemetry: "Language.Definition",
    });

    const source = await this.getSource(uri);
    const target = source.tokenAt(position);

    return (await this.getSources(uri))
      .map((source) =>
        source.definitions
          .filter(
            (token) =>
              Scope(token) === Scope(target) && Name(token) === Name(target),
          )
          .map((token) => Location.create(source.uri, RangeFrom(token))),
      )
      .flat();
  }

  public async onRenameRequest({
    textDocument: { uri },
    position,
    newName,
  }: RenameParams): Promise<WorkspaceEdit | null> {
    this.notify("onRenameRequest", MessageKind.DEBUG, {
      logger,
      telemetry: "Language.RenameRequest",
    });

    const source = await this.getSource(uri);
    const target = source.tokenAt(position);

    if (!target) {
      return null;
    }

    return (await this.getSources(uri)).reduce(
      (edit, source) => {
        const references = source.references;
        if (references.length > 0) {
          const name = Token({
            image: newName,
            namespace: target?.namespace,
          });
          edit.changes![source.uri] = references
            .filter(
              (token) =>
                token.scope === Scope(target) && Name(token) === Name(target),
            )
            .map((token) =>
              TextEdit.replace(RangeFrom(token), Relative(name, token)),
            );
        }
        return edit;
      },
      { changes: {} } as WorkspaceEdit,
    );
  }

  public async onCompletion({
    textDocument: { uri },
    position,
  }: CompletionParams): Promise<CompletionItem[]> {
    const source = await this.getSource(uri);
    const target = source.tokenAt(position);
    const scope = Scope(target);

    // Range of the (possibly dotted) word already typed before the cursor. A
    // member completion must replace this whole prefix via a textEdit; relying
    // on VS Code's default range appends after `bar.` and yields `bar.bar.f`
    // (the q wordPattern excludes the trailing dot from the current word).
    const prefix =
      this.documents
        .get(uri)
        ?.getText(
          Range.create(position.line, 0, position.line, position.character),
        )
        .match(/[.\w]*$/)?.[0] ?? "";
    const range = Range.create(
      position.line,
      position.character - prefix.length,
      position.line,
      position.character,
    );

    const items = new Map<string, CompletionItem>();

    for (const source of await this.getSources(uri)) {
      for (const token of source.references) {
        if (Scope(token) && Scope(token) !== scope) {
          continue;
        }
        const name = Name(token);
        if (!items.has(name)) {
          items.set(name, {
            // Use the qualified name (e.g. `bar.h`) so members show and filter
            // correctly under a dotted prefix like `bar.`; the raw image would
            // be the bare `h`, which VS Code filters out against `bar.`.
            label: name,
            labelDetails: {
              detail: ` .${Namespace(token)}`,
            },
            kind: CompletionItemKind.Variable,
            filterText: name,
            textEdit: TextEdit.replace(range, name),
          });
        }
      }
    }

    const res = [...items.values()];

    if (res.length > 0) {
      this.notify("onCompletion", MessageKind.DEBUG, {
        logger,
        telemetry: "Language.Completion",
      });
    }

    return res;
  }

  public async onExpressionRange({
    textDocument: { uri },
    position,
  }: TextDocumentPositionParams) {
    const source = await this.getSource(uri);
    const target = source.tokenAt(position);
    if (!target) {
      return null;
    }

    const tokens = source.tokens.filter(
      (token) => token.index === target?.index,
    );

    const start = RangeFrom(tokens[0]);
    const end = RangeFrom(Peek(tokens)!);

    return Range.create(start.start, end.end);
  }

  public async onParameterCache({
    textDocument: { uri },
    position,
  }: TextDocumentPositionParams) {
    this.notify("onParameterCache", MessageKind.DEBUG, {
      logger,
      telemetry: "Language.ParameterCache",
    });

    const source = await this.getSource(uri);
    const target = source.tokenAt(position);
    if (!target) {
      return null;
    }
    const scope = Scope(target);
    if (!scope) {
      return null;
    }
    const curly = source.tokens.find(
      (token) => Type(token) === RCurly && Scope(token) === scope,
    );
    if (!curly) {
      return null;
    }
    const bracket = source.tokens.find(
      (token) =>
        Scope(token) === scope && Param(token) && Type(token) === RBracket,
    );
    if (!bracket) {
      return null;
    }
    const args = source.definitions.filter(
      (token) => Scope(token) === scope && Param(token),
    );
    if (args.length === 0) {
      return null;
    }
    return {
      params: args.reverse().map((value) => value.image),
      start: RangeFrom(bracket).end,
      end: RangeFrom(curly).start,
    };
  }

  public async onSelectionRanges({
    textDocument: { uri },
    positions,
  }: SelectionRangeParams): Promise<SelectionRange[]> {
    const source = await this.getSource(uri);
    const ranges: SelectionRange[] = [];

    for (const position of positions) {
      const target = source.tokenAt(position);
      if (target) {
        ranges.push(SelectionRange.create(RangeFrom(target)));
      }
    }
    return ranges;
  }

  public async onFoldingRanges({
    textDocument: { uri },
  }: FoldingRangeParams): Promise<FoldingRange[]> {
    const source = await this.getSource(uri);
    const ranges: FoldingRange[] = [];

    let range: FoldingRange | undefined;
    let startLine: number;
    let endLine: number;

    const start = () => {
      range = {
        startLine,
        endLine: -1,
        kind: FoldingRangeKind.Comment,
      };
    };

    const end = () => {
      if (range) {
        range.endLine = endLine;
        ranges.push(range);
        range = undefined;
      }
    };

    for (const token of source.tokens) {
      startLine = (token.startLine || 0) - 1;
      endLine = (token.endLine || 0) - 1;
      switch (token.tokenType) {
        case EndOfLine:
        case WhiteSpace:
        case CommentEndOfLine:
        case CommentLiteral:
          break;
        case ExitCommentBegin:
        case LineComment:
        case Documentation:
          if (!range) start();
          break;
        case CommentBegin:
          endLine--;
          end();
          start();
          break;
        case CommentEnd:
          end();
          break;
        default:
          endLine--;
          end();
          break;
      }
    }
    end();
    return ranges;
  }

  public async onPrepareCallHierarchy({
    textDocument: { uri },
    position,
  }: CallHierarchyPrepareParams): Promise<CallHierarchyItem[]> {
    this.notify("onCallHierarchy", MessageKind.DEBUG, {
      logger,
      telemetry: "Language.CallHierarchy",
    });

    const source = await this.getSource(uri);
    const target = source.tokenAt(position);

    return [
      {
        data: target,
        kind: SymbolKind.Variable,
        name: Name(target),
        uri: uri,
        range: RangeFrom(target!),
        selectionRange: RangeFrom(target!),
      },
    ];
  }

  public async onIncomingCallsCallHierarchy({
    item: { data, uri, name },
  }: CallHierarchyIncomingCallsParams): Promise<CallHierarchyIncomingCall[]> {
    const incoming: CallHierarchyIncomingCall[] = [];

    if (!data) return incoming;

    for (const source of await this.getSources(uri)) {
      source.references.forEach((token) => {
        if (Name(token) === name) {
          const call = <CallHierarchyIncomingCall>{
            from: {
              data: false,
              kind: SymbolKind.Variable,
              name: Name(token),
              uri: source.uri,
              range: RangeFrom(token),
              selectionRange: RangeFrom(token),
            },
            fromRanges: [],
          };
          incoming.push(call);
        }
      });
    }

    return incoming;
  }

  public async onOutgoingCallsCallHierarchy({
    item: { data, uri, name },
  }: CallHierarchyOutgoingCallsParams): Promise<CallHierarchyOutgoingCall[]> {
    const outgoing: CallHierarchyOutgoingCall[] = [];

    if (!data) return outgoing;

    for (const source of await this.getSources(uri)) {
      source.references.forEach((token) => {
        if (Name(token) === name) {
          const call = <CallHierarchyOutgoingCall>{
            to: {
              data: false,
              kind: SymbolKind.Variable,
              name: Name(token),
              uri: source.uri,
              range: RangeFrom(token),
              selectionRange: RangeFrom(token),
            },
            fromRanges: [],
          };
          outgoing.push(call);
        }
      });
    }

    return outgoing;
  }

  public async onSemanticTokens({
    textDocument: { uri },
  }: SemanticTokensParams): Promise<SemanticTokens> {
    const source = await this.getSource(uri);
    const result = { data: [] } as SemanticTokens;

    let range: Range = Range.create(0, 0, 0, 0);
    let line = 0;
    let character = 0;
    let delta = 0;

    for (const token of source.references) {
      if (Scope(token)) {
        line = range.start.line;
        character = range.start.character;
        range = RangeFrom(token);
        delta = range.start.line - line;
        result.data.push(
          delta,
          delta ? range.start.character : range.start.character - character,
          token.image.length,
          0,
          3,
        );
      }
    }
    return result;
  }

  private async related(
    uri: string,
  ): Promise<{ uri: string; alias?: string }[]> {
    const res: { uri: string; alias?: string }[] = [];

    for (const file of await this.relatedFiles(uri)) {
      res.push({ uri: file });
    }
    for (const { alias, file } of await this.relatedModules(uri)) {
      res.push({ uri: file, alias });
    }

    return res;
  }

  private async relatedModules(
    uri: string,
  ): Promise<{ alias: string; file: string }[]> {
    const source = await this.getSource(uri);
    const res: { alias: string; file: string }[] = [];

    for (const { alias, module } of source.imports) {
      const file = await this.resolveModule(module, uri);
      if (file) {
        res.push({ alias, file });
      }
    }

    return res;
  }

  private async resolveModule(
    module: string,
    uri: string,
  ): Promise<string | undefined> {
    if (this.modules.has(module)) {
      return this.modules.get(module);
    }

    const roots: string[] = [];

    if (process.env.QPATH) {
      roots.push(...process.env.QPATH.split(delimiter).filter(Boolean));
    }

    const folders = await this.connection.workspace.getWorkspaceFolders();
    if (folders) {
      for (const folder of folders) {
        const dir = fileURLToPath(folder.uri);
        roots.push(dir, join(dir, "mod"));
      }
    }

    const qHome = await this.getQHome(uri);
    if (qHome) {
      roots.push(join(qHome, "mod"));
    }

    const name = module.split(/[.:]/).join(sep);
    const candidates = [
      `${name}.k`,
      `${name}.q`,
      join(name, "init.k"),
      join(name, "init.q"),
    ];

    let resolved: string | undefined;

    outer: for (const root of roots) {
      for (const candidate of candidates) {
        const file = join(root, candidate);
        try {
          if ((await stat(file)).isFile()) {
            resolved = pathToFileURL(file).href;
            break outer;
          }
        } catch {
          // not present in this root; try the next candidate
        }
      }
    }

    this.modules.set(module, resolved);
    return resolved;
  }

  private async relatedFiles(uri: string): Promise<string[]> {
    const res = [uri];

    if (uri.startsWith("vscode-notebook-cell:")) {
      const notebook = this.notebooks.getNotebookDocument(
        uri.replace(/^vscode-notebook-cell:([^#]*).*$/, "file://$1"),
      );
      if (notebook) {
        for (const cell of notebook.cells) {
          res.push(cell.document);
        }
        uri = notebook.uri;
      } else {
        return res;
      }
    }

    const folders = await this.connection.workspace.getWorkspaceFolders();

    if (!folders) {
      return res;
    }

    let workspace: string | undefined;

    for (const folder of folders) {
      if (uri.replace(folder.uri, "").startsWith("/")) {
        workspace = folder.uri;
        break;
      }
    }

    if (!workspace) {
      return res;
    }

    const map = await this.getConnectionMap(uri);
    const connections = new Map<string, string[]>();
    let current: string | undefined;

    for (const key of Object.keys(map)) {
      const target = map[key];
      let uris = connections.get(target);

      if (!uris) {
        uris = [];
        connections.set(target, uris);
      }
      uris.push(workspace + "/" + key);

      if (uri.endsWith(key)) current = target;
    }

    if (current) {
      const related = connections.get(current);
      if (related) {
        for (const target of related) {
          if (target !== uri) res.push(target);
        }
      }
    }

    return res;
  }

  private async getSource(uri: string, alias?: string): Promise<Source> {
    const key = alias ? uri + "\0" + alias : uri;
    let source = this.cached.get(key);
    if (!source) {
      const document = this.documents.get(uri);
      let text = "";
      if (document) {
        text = document.getText();
      } else if (uri.startsWith("file:")) {
        try {
          // fileURLToPath throws on Windows for a non-absolute URL (no drive
          // letter), so keep it inside the guard alongside the read.
          text = await readFile(fileURLToPath(uri), { encoding: "utf8" });
        } catch (error) {
          this.notify(`Unable to read '${uri}'.`, MessageKind.DEBUG, {
            logger,
            params: `${error}`,
          });
          text = "";
        }
      }
      source = Source.create(uri, text, alias);
      this.cached.set(key, source);
    }
    return source;
  }

  private async getSources(uri: string): Promise<Source[]> {
    const res: Source[] = [];

    switch (await this.getRefactoring(uri)) {
      case "Workspace":
        for (const { uri: target, alias } of await this.related(uri)) {
          res.push(await this.getSource(target, alias));
        }
        break;
      case "Window":
        for (const target of this.documents.all()) {
          res.push(await this.getSource(target.uri));
        }
        break;
    }
    return res;
  }
}

function createSymbol(token: Token, source: Source): DocumentSymbol {
  return DocumentSymbol.create(
    Type(token) === LCurly ? " " : Scope(token) ? token.image : Name(token),
    undefined,
    Type(token) === LCurly
      ? SymbolKind.Object
      : Param(token)
        ? SymbolKind.Array
        : SymbolKind.Variable,
    RangeFrom(token),
    RangeFrom(token),
    source.definitions
      .filter((value) => value.scope === token)
      .map((value) => createSymbol(value, source)),
  );
}
