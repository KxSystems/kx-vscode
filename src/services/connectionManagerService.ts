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
import { InsightsConnection } from "../classes/insightsConnection";
import { sanitizeQuery } from "../utils/queryUtils";
import {
  getHash,
  getInsights,
  getServerName,
  getServers,
  removeLocalConnectionContext,
  updateInsights,
  updateServers,
} from "../utils/core";
import { Insights } from "../models/insights";
import { Server } from "../models/server";

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
  ): LocalConnection | InsightsConnection | undefined {
    return ext.connectedConnectionList.find(
      (connection: LocalConnection | InsightsConnection) =>
        connLabel === connection.connLabel,
    );
  }

  public isKdbConnection(connection: KdbNode | InsightsNode): boolean {
    return connection instanceof KdbNode;
  }

  public isConnected(connLabel: string): boolean {
    return ext.connectedContextStrings.includes(connLabel);
  }

  public retrieveLocalConnectionString(connection: KdbNode): string {
    return connection.details.serverName + ":" + connection.details.serverPort;
  }

  public removeConnectionFromContextString(connLabel: string): void {
    const index = ext.connectedContextStrings.indexOf(connLabel);
    if (index > -1) {
      ext.connectedContextStrings.splice(index, 1);
    }
  }

  /* istanbul ignore next */
  public async connect(connLabel: string): Promise<void> {
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
          this.isNotConnectedBehaviour(connLabel);
          return;
        }
        if (conn) {
          ext.outputChannel.appendLine(
            `Connection established successfully to: ${connLabel}`,
          );

          Telemetry.sendEvent("Connection.Connected.QProcess");

          ext.connectedConnectionList.push(localConnection);

          this.isConnectedBehaviour(connection);
        }
      });
    } else {
      ext.context.secrets.delete(connection.details.alias);
      const insightsConn: InsightsConnection = new InsightsConnection(
        connLabel,
        connection,
      );
      await insightsConn.connect();
      if (insightsConn.connected) {
        Telemetry.sendEvent("Connection.Connected.Insights");
        ext.connectedConnectionList.push(insightsConn);
        this.isConnectedBehaviour(connection);
      } else {
        this.isNotConnectedBehaviour(connLabel);
      }
    }
  }

  public setActiveConnection(node: KdbNode | InsightsNode): void {
    const connection = this.retrieveConnectedConnection(node.label);
    if (!connection) {
      return;
    }
    commands.executeCommand("setContext", "kdb.connected.active", [
      `${node.label}`,
    ]);
    Telemetry.sendEvent("Connection.Connected.Active");
    ext.activeConnection = connection;
    ext.serverProvider.reload();
  }

  public disconnect(connLabel: string): void {
    const connection = this.retrieveConnectedConnection(connLabel);
    const connectionNode = this.retrieveConnection(connLabel);
    if (!connection) {
      return;
    }
    const isLocal = connection instanceof LocalConnection;
    /* istanbul ignore next */
    if (isLocal && connectionNode) {
      connection.getConnection()?.close(() => {
        ext.connectedConnectionList.splice(
          ext.connectedConnectionList.indexOf(connection),
          1,
        );
        ext.activeConnection = undefined;
        ext.connectionNode = undefined;

        commands.executeCommand("setContext", "kdb.connected.active", false);
        Telemetry.sendEvent("Connection.Disconnected");
        ext.outputChannel.appendLine(
          `Connection stopped from ${connection.connLabel}`,
        );
        ext.serverProvider.reload();
      });
    } else {
      connection.disconnect();
      this.disconnectBehaviour(connection);
    }
  }

  public async removeConnection(
    connNode: KdbNode | InsightsNode,
  ): Promise<void> {
    const isConnected = this.isConnected(connNode.label);
    if (isConnected) {
      this.removeConnectionFromContextString(connNode.label);
      this.disconnect(connNode.label);
    }
    if (connNode instanceof InsightsNode) {
      const insights: Insights | undefined = getInsights();
      const key = getHash(connNode.details.server);
      if (insights != undefined && insights[key]) {
        const uInsights = Object.keys(insights).filter((insight) => {
          return insight !== key;
        });

        const updatedInsights: Insights = {};
        uInsights.forEach((insight) => {
          updatedInsights[insight] = insights[insight];
        });

        await updateInsights(updatedInsights);
        ext.serverProvider.refreshInsights(updatedInsights);
      }
    } else {
      const servers: Server | undefined = getServers();

      const key =
        connNode.details.serverAlias != ""
          ? getHash(
              `${connNode.details.serverName}${connNode.details.serverPort}${connNode.details.serverAlias}`,
            )
          : getHash(
              `${connNode.details.serverName}${connNode.details.serverPort}`,
            );
      if (servers != undefined && servers[key]) {
        const uServers = Object.keys(servers).filter((server) => {
          return server !== key;
        });

        const updatedServers: Server = {};
        uServers.forEach((server) => {
          updatedServers[server] = servers[server];
        });

        removeLocalConnectionContext(getServerName(connNode.details));

        await updateServers(updatedServers);
        ext.serverProvider.refresh(updatedServers);
      }
    }
  }

  public isConnectedBehaviour(connNode: KdbNode | InsightsNode): void {
    ext.connectedContextStrings.push(connNode.label);
    commands.executeCommand(
      "setContext",
      "kdb.connected",
      ext.connectedContextStrings,
    );
    this.setActiveConnection(connNode);
    ext.connectionNode = connNode;
    ext.serverProvider.reload();
  }

  public isNotConnectedBehaviour(connLabel: string): void {
    window.showErrorMessage(`Connection failed to: ${connLabel}`);
    Telemetry.sendEvent("Connection.Failed");
  }

  public disconnectBehaviour(
    connection: LocalConnection | InsightsConnection,
  ): void {
    const connType = connection instanceof LocalConnection ? "KDB" : "Insights";
    ext.connectedConnectionList.splice(
      ext.connectedConnectionList.indexOf(connection),
      1,
    );
    if (ext.activeConnection === connection) {
      ext.activeConnection = undefined;
      ext.connectionNode = undefined;
      commands.executeCommand("setContext", "kdb.connected.active", false);
    }
    Telemetry.sendEvent("Connection.Disconnected." + connType);
    ext.outputChannel.appendLine(
      `Connection stopped from ${connection.connLabel}`,
    );
    ext.serverProvider.reload();
  }

  public async executeQuery(
    command: string,
    context?: string,
    stringfy?: boolean,
  ): Promise<any> {
    if (!ext.activeConnection) {
      return;
    }
    command = sanitizeQuery(command);
    if (ext.activeConnection instanceof LocalConnection) {
      return await ext.activeConnection?.executeQuery(
        command,
        context,
        stringfy,
      );
    } else {
      return await ext.activeConnection.getScratchpadQuery(command);
    }
  }
}