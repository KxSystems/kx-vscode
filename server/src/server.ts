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

import {
  Connection,
  DidChangeConfigurationNotification,
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

connection.onInitialized(() => {
  connection.client.register(DidChangeConfigurationNotification.type, {
    section: "kdb",
  });
});

connection.listen();
