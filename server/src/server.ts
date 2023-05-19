import {
  Connection,
  createConnection,
  InitializeParams,
  InitializeResult,
  ProposedFeatures,
} from "vscode-languageserver/node";
import QLangServer from "./langServer";

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
