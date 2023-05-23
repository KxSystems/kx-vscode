import {
  Connection,
  InitializeParams,
  InitializeResult,
  ProposedFeatures,
} from "vscode-languageserver";
import { createConnection } from "vscode-languageserver/node";
import QLangServer from "./qLangServer";

const connection: Connection = createConnection(ProposedFeatures.all);

connection.onInitialize(
  async (params: InitializeParams): Promise<InitializeResult> => {
    const server = await QLangServer.initialize(connection, params);
    return {
      capabilities: server.capabilities(),
    };
  }
);

connection.listen();
