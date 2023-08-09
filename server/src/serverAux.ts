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

// THIS FILE WILL BE REMOVED, IT'S JUST FOR THE MOMENT IN THE TRANSITION OF LSP
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  CompletionItem,
  Diagnostic,
  DiagnosticSeverity,
  DocumentHighlight,
  DocumentHighlightKind,
  Hover,
  InitializeParams,
  InitializeResult,
  MarkupKind,
  ProposedFeatures,
  ServerCapabilities,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  TextDocuments,
  createConnection,
} from "vscode-languageserver/node";
import { AnalyzerContent } from "./utils/analyzer";

interface GlobalSettings {
  maxNumberOfProblems: number;
}

const connection = createConnection(ProposedFeatures.all);

const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

connection.onInitialize((params: InitializeParams) => {
  const capabilities: ServerCapabilities = {
    // The kind of text document synchronization that the server supports.
    textDocumentSync: TextDocumentSyncKind.Incremental,
    // Whether the server supports resolving additional information for a completion item.
    completionProvider: { resolveProvider: true },
    // Whether the server supports providing hover information for a symbol.
    hoverProvider: true,
    // Whether the server supports providing document highlights for a symbol.
    documentHighlightProvider: true,
    // Whether the server supports providing definitions for a symbol.
    definitionProvider: true,
    // Whether the server supports providing symbols for a document.
    documentSymbolProvider: true,
    // Whether the server supports providing symbols for the workspace.
    workspaceSymbolProvider: true,
    // Whether the server supports finding references to a symbol.
    referencesProvider: true,
    // Whether the server supports renaming a symbol.
    renameProvider: { prepareProvider: true },
    // Whether the server supports providing signature help for a symbol.
    signatureHelpProvider: { triggerCharacters: ["[", ";"] },
    // Whether the server supports providing semantic tokens for a document.
    semanticTokensProvider: {
      documentSelector: null,
      legend: {
        tokenTypes: ["variable", "parameter", "type", "class"],
        tokenModifiers: [],
      },
      full: true,
    },
    // Whether the server supports providing call hierarchy information for a symbol.
    callHierarchyProvider: true,
  };

  const res: InitializeResult = {
    capabilities,
  };

  return res;
});

connection.onInitialized(() => {
  connection.console.log("Q Language Server Started.");
});

const defaultSettings: GlobalSettings = { maxNumberOfProblems: 1000 };
let globalSettings: GlobalSettings = defaultSettings;
const documentSettings: Map<string, Thenable<GlobalSettings>> = new Map();

connection.onDidChangeConfiguration((change) => {
  globalSettings = <GlobalSettings>(
    (change.settings.qLanguageServer || defaultSettings)
  );

  // Revalidate all open text documents
  documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<GlobalSettings> {
  let result = documentSettings.get(resource);
  if (!result) {
    result = connection.workspace.getConfiguration({
      scopeUri: resource,
      section: "qLanguageServer",
    });
    documentSettings.set(resource, result);
  }
  return result;
}

documents.onDidClose((e) => {
  documentSettings.delete(e.document.uri);
});

documents.onDidChangeContent((change) => {
  validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const settings = await getDocumentSettings(textDocument.uri);
  const text = textDocument.getText();
  const pattern = /\b[A-Z]{2,}\b/g;
  let m: RegExpExecArray | null;

  let problems = 0;
  const diagnostics: Diagnostic[] = [];
  while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
    problems++;
    const diagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Warning,
      range: {
        start: textDocument.positionAt(m.index),
        end: textDocument.positionAt(m.index + m[0].length),
      },
      message: `${m[0]} is all uppercase.`,
      source: "ex",
    };
    diagnostic.relatedInformation = [
      {
        location: {
          uri: textDocument.uri,
          range: Object.assign({}, diagnostic.range),
        },
        message: "Spelling matters",
      },
      {
        location: {
          uri: textDocument.uri,
          range: Object.assign({}, diagnostic.range),
        },
        message: "Particularly for names",
      },
    ];

    diagnostics.push(diagnostic);
  }

  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles((_change) => {
  connection.console.log("File change event received with success.");
});

connection.onCompletion(
  (textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    const document = documents.get(textDocumentPosition.textDocument.uri);
    if (document) {
      const keyword = AnalyzerContent.getCurrentWord(
        textDocumentPosition,
        document
      );
      return AnalyzerContent.getCompletionItems(keyword);
    }
    return [];
  }
);

function debugConsole(msg: string): void {
  connection.console.info(msg);
}

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  if (item.data === 1) {
    item.detail = "q Language details";
    item.documentation = "q documentation";
  }
  return item;
});

connection.onHover((textDocumentPosition, token): Hover | null => {
  const document = documents.get(textDocumentPosition.textDocument.uri);
  if (document) {
    const keyword = AnalyzerContent.getCurrentWord(
      textDocumentPosition,
      document
    );
    const teste = AnalyzerContent.getCompletionItems(keyword);
    debugConsole(JSON.stringify(teste));
    const data = document.getText({
      start: { character: 0, line: textDocumentPosition.position.line },
      end: { character: 255, line: textDocumentPosition.position.line },
    });
    return {
      contents: {
        language: "q",
        kind: MarkupKind.Markdown,
        value: [
          "```cpp",
          data,
          "```",
          // '___',
          "Some doc",
          "",
          "_@param_ `document` ",
        ].join("\n"),
      },
    };
  }
  return null;
});

connection.onDocumentHighlight((textPosition) => {
  const position = textPosition.position;
  return [
    DocumentHighlight.create(
      {
        start: { line: position.line + 1, character: position.character },
        end: { line: position.line + 1, character: position.character + 5 },
      },
      DocumentHighlightKind.Write
    ),
  ];
});
documents.listen(connection);

connection.listen();
