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

import { LocalConnection } from "../classes/localConnection";
import { window, commands } from "vscode";
import { ext } from "../extensionVariables";
import { InsightsNode, KdbNode } from "./kdbTreeProvider";
import { Telemetry } from "../utils/telemetryClient";

export class ConnectionManagementService {
  public retrieveConnection(
    connLabel: string,
  ): KdbNode | InsightsNode | undefined {
    return ext.connectionsList.find(
      (connections: KdbNode | InsightsNode) => connLabel === connections.label,
    );
  }

  public retrieveConnectedConnection(
    connLabel: string,
  ): LocalConnection | undefined {
    return ext.connectedConnectionList.find(
      (connection: LocalConnection) => connLabel === connection.connLabel,
    );
  }

  public isKdbConnection(connection: KdbNode | InsightsNode): boolean {
    return connection instanceof KdbNode;
  }

  public isLocalConnection(): boolean {
    return ext.activeConnection instanceof LocalConnection;
  }

  public retrieveLocalConnectionString(connection: KdbNode): string {
    return connection.details.serverName + ":" + connection.details.serverPort;
  }

  public async connect(connLabel: string): Promise<void> {
    // check if connection exists
    const connection = this.retrieveConnection(connLabel);
    if (!connection) {
      return;
    }

    if (connection instanceof KdbNode) {
      const connectionString = this.retrieveLocalConnectionString(connection);
      const authCredentials = connection.details.auth
        ? await ext.secretSettings.getAuthData(connection.children[0])
        : undefined;
      const localConnection = new LocalConnection(
        connectionString,
        connLabel,
        authCredentials ? authCredentials.split(":") : undefined,
        connection.details.tls,
      );
      await localConnection.connect((err, conn) => {
        if (err) {
          window.showErrorMessage(err.message);
          return;
        }

        if (conn) {
          ext.outputChannel.appendLine(
            `Connection established successfully to: ${connLabel}`,
          );

          commands.executeCommand("setContext", "kdb.connected", [
            `${connLabel}` + " (connected)",
          ]);

          ext.connectionNode = connection;
          Telemetry.sendEvent("Connection.Connected.QProcess");
          ext.serverProvider.reload();

          this.setActiveConnection(connLabel);
        }
      });
      ext.connectedConnectionList.push(localConnection);
      ext.activeConnection = localConnection;
    } else {
      //   work with Insights nodes
    }
  }

  public setActiveConnection(connLabel: string): void {
    const connection = this.retrieveConnectedConnection(connLabel);
    if (!connection) {
      return;
    }
    commands.executeCommand("setContext", "kdb.connected.active", [
      `${connLabel}` + " (active)",
    ]);
    Telemetry.sendEvent("Connection.Connected.Active");
    ext.activeConnection = connection;
    ext.connection = connection;
  }

  public disconnect(connLabel: string): void {
    const connection = this.retrieveConnectedConnection(connLabel);
    if (!connection) {
      return;
    }
    const isLocal = this.isLocalConnection();
    if (isLocal) {
      connection.getConnection()?.close(() => {
        ext.connectedConnectionList.splice(
          ext.connectedConnectionList.indexOf(connection),
          1,
        );
        ext.activeConnection = undefined;
        ext.connectionNode = undefined;
        commands.executeCommand("setContext", "kdb.connected", false);
        commands.executeCommand("setContext", "kdb.connected.active", false);
        Telemetry.sendEvent("Connection.Disconnected");
        ext.outputChannel.appendLine(
          `Connection stopped from ${connection.connLabel}`,
        );
      });
    }
  }

  public async executeQuery(
    command: string,
    context?: string,
    stringfy?: boolean,
  ): Promise<any> {
    const connection = ext.activeConnection;
    if (!connection) {
      return;
    }
    const isLocal = this.isLocalConnection();
    if (isLocal) {
      const result = await connection?.executeQuery(command, context, stringfy);
      return result;
    } else {
      // Work with Insights nodes
      return;
    }
  }
}
