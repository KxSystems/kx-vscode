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
  compareVersions,
  getInsights,
  getKeyForServerName,
  getServerName,
  getServers,
  kdbOutputLog,
  removeLocalConnectionContext,
  updateInsights,
  updateServers,
} from "../utils/core";
import { refreshDataSourcesPanel } from "../utils/dataSource";
import { MetaInfoType } from "../models/meta";
import { retrieveConnLabelsNames } from "../utils/connLabel";
import {
  ExportedConnections,
  Insights,
  kdbAuthMap,
  Server,
} from "../models/connectionsModels";

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
      (connection: LocalConnection | InsightsConnection) => {
        if (!connLabel) {
          return false;
        }
        const escapedConnLabel = connLabel.replace(
          /[-[\]{}()*+?.,\\^$|#\s]/g,
          "\\$&",
        );
        const regex = new RegExp(
          `\\d+\\.\\d+\\.\\d+\\.\\d+:\\d+ \\[${escapedConnLabel}\\]`,
        );
        return (
          connLabel === connection.connLabel || regex.test(connection.connLabel)
        );
      },
    );
  }

  public retrieveListOfConnectionsNames(): Set<string> {
    return new Set(
      ext.connectionsList.map((conn) => {
        if (conn instanceof KdbNode) {
          return conn.details.serverAlias;
        } else {
          return conn.details.alias;
        }
      }),
    );
  }

  public checkConnAlias(
    alias: string,
    isInsights: boolean,
    localAlreadyExists?: boolean,
  ): string {
    if (isInsights) {
      return alias !== "local" ? alias : "localInsights";
    } else {
      return localAlreadyExists && alias === "local" ? alias + "KDB" : alias;
    }
  }

  public isKdbConnection(connection: KdbNode | InsightsNode): boolean {
    return connection instanceof KdbNode;
  }

  public isConnected(connLabel: string): boolean {
    const escapedConnLabel = connLabel.replace(
      /[-[\]{}()*+?.,\\^$|#\s]/g,
      "\\$&",
    );
    const regex = new RegExp(
      `\\d+\\.\\d+\\.\\d+\\.\\d+:\\d+ \\[${escapedConnLabel}\\]`,
    );
    return (
      ext.connectedContextStrings.includes(connLabel) ||
      ext.connectedContextStrings.some((context) => regex.test(context))
    );
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
          kdbOutputLog(
            `Connection established successfully to: ${connLabel}`,
            "CONNECTION",
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
        kdbOutputLog(
          `Connection established successfully to: ${connLabel}`,
          "CONNECTION",
        );
        kdbOutputLog(
          `${connLabel} connection insights version: ${insightsConn.insightsVersion}`,
          "CONNECTION",
        );
        ext.connectedConnectionList.push(insightsConn);
        this.isConnectedBehaviour(connection);
      } else {
        this.isNotConnectedBehaviour(connLabel);
      }
      refreshDataSourcesPanel();
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

    if (node instanceof InsightsNode) {
      commands.executeCommand("setContext", "kdb.pythonEnabled", true);
    } else if (connection instanceof LocalConnection) {
      // check if pykx namespace is defined
      connection
        .execute("`pykx in key`")
        .then((res) => {
          commands.executeCommand("setContext", "kdb.pythonEnabled", !!res);
        })
        .catch(() => {
          commands.executeCommand("setContext", "kdb.pythonEnabled", false);
        });
    }

    ext.connectionNode = node;
    ext.serverProvider.reload();
  }

  public disconnect(connLabel: string): void {
    const connection = this.retrieveConnectedConnection(connLabel);
    const connectionNode = this.retrieveConnection(connection?.connLabel ?? "");
    if (!connection || !connectionNode) {
      return;
    }
    /* istanbul ignore next */
    connection.disconnect();
    this.disconnectBehaviour(connection);
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
      const insights = getInsights();
      const key = getKeyForServerName(connNode.details.alias);
      if (insights && insights[key]) {
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

      const key = getKeyForServerName(connNode.details.serverAlias || "");
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
    ext.latestLblsChanged.length = 0;
    ext.latestLblsChanged.push(...retrieveConnLabelsNames(connNode));
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
    ext.connectedContextStrings.splice(
      ext.connectedContextStrings.indexOf(connection.connLabel),
      1,
    );
    commands.executeCommand(
      "setContext",
      "kdb.connected",
      ext.connectedContextStrings,
    );
    if (ext.activeConnection === connection) {
      ext.activeConnection = undefined;
      ext.connectionNode = undefined;
      commands.executeCommand("setContext", "kdb.connected.active", false);
      commands.executeCommand("setContext", "kdb.pythonEnabled", false);
    }
    Telemetry.sendEvent("Connection.Disconnected." + connType);
    kdbOutputLog(
      `[CONNECTION] Connection closed: ${connection.connLabel}`,
      "INFO",
    );
    ext.serverProvider.reload();
  }

  public async executeQuery(
    command: string,
    connLabel?: string,
    context?: string,
    stringify?: boolean,
    isPython?: boolean,
  ): Promise<any> {
    let selectedConn;
    if (connLabel) {
      selectedConn = this.retrieveConnectedConnection(connLabel);
    } else {
      if (!ext.activeConnection) {
        return;
      }
      selectedConn = ext.activeConnection;
    }
    if (!selectedConn) {
      return;
    }
    command = sanitizeQuery(command);
    if (selectedConn instanceof LocalConnection) {
      return await selectedConn.executeQuery(
        command,
        context,
        stringify,
        isPython,
      );
    } else {
      return await selectedConn.getScratchpadQuery(command, context, isPython);
    }
  }

  public async resetScratchpad(): Promise<void> {
    if (
      !ext.activeConnection ||
      !(ext.activeConnection instanceof InsightsConnection)
    ) {
      kdbOutputLog(
        "[RESET SCRATCHPAD] Please activate an Insights connection to use this feature.",
        "ERROR",
      );
      return;
    }

    if (
      ext.activeConnection.insightsVersion &&
      compareVersions(ext.activeConnection.insightsVersion, 1.12)
    ) {
      const confirmationPrompt = `Are you sure you want to reset the scratchpad from the connection ${ext.activeConnection.connLabel}?`;
      const selection = await window.showInformationMessage(
        confirmationPrompt,
        "Yes",
        "No",
      );

      if (selection === "Yes") {
        await ext.activeConnection.resetScratchpad();
      }
    } else {
      kdbOutputLog(
        "[RESET SCRATCHPAD] Please connect to an Insights connection with version superior to 1.11",
        "ERROR",
      );
    }
  }

  public async refreshAllGetMetas(): Promise<void> {
    if (ext.connectedConnectionList.length > 0) {
      const promises = ext.connectedConnectionList.map(async (connection) => {
        if (connection instanceof InsightsConnection) {
          await connection.getMeta();
        }
      });
      await Promise.all(promises);
    }
  }

  public async refreshGetMeta(connLabel: string): Promise<void> {
    const connection = this.retrieveConnectedConnection(connLabel);
    if (connection instanceof InsightsConnection) {
      await connection.getMeta();
    }
  }

  public getMetaInfoType(value: string): MetaInfoType | undefined {
    return MetaInfoType[value as keyof typeof MetaInfoType];
  }

  public retrieveMetaContent(
    connLabel: string,
    metaTypeString: string,
  ): string {
    const metaType = this.getMetaInfoType(metaTypeString.toUpperCase());
    if (!metaType) {
      kdbOutputLog(
        "[META] The meta info type that you try to open is not valid",
        "ERROR",
      );
      return "";
    }
    const connection = this.retrieveConnectedConnection(connLabel);
    if (!connection) {
      kdbOutputLog(
        "[META] The connection that you try to open meta info is not connected",
        "ERROR",
      );
      return "";
    }
    if (connection instanceof LocalConnection) {
      kdbOutputLog(
        "[META] The connection that you try to open meta info is not an Insights connection",
        "ERROR",
      );
      return "";
    }

    return connection.returnMetaObject(metaType);
  }

  public async retrieveUserPass() {
    for (const connection of ext.connectionsList) {
      if (connection instanceof KdbNode) {
        const authCredentials = await ext.secretSettings.getAuthData(
          connection.children[0],
        );
        if (authCredentials) {
          const [username, password] = authCredentials.split(":");
          const authMap: kdbAuthMap = {
            [connection.children[0]]: {
              username,
              password,
            },
          };
          ext.kdbAuthMap.push(authMap);
        }
      }
    }
  }

  public async retrieveInsightsConnVersion(connLabel: string): Promise<number> {
    const connection = this.retrieveConnectedConnection(connLabel);
    if (!connection || !(connection instanceof InsightsConnection)) {
      return 0;
    }
    return connection.insightsVersion ? connection.insightsVersion : 0;
  }

  public exportConnection(connLabel?: string, includeAuth?: boolean): string {
    const exportedContent: ExportedConnections = {
      connections: {
        Insights: [],
        KDB: [],
      },
    };
    if (connLabel) {
      const connection = this.retrieveConnection(connLabel);
      if (!connection) {
        return "";
      }
      if (connection instanceof KdbNode) {
        exportedContent.connections.KDB.push(connection.details);
      } else {
        exportedContent.connections.Insights.push(connection.details);
      }
    } else {
      ext.connectionsList.forEach((connection) => {
        if (connection instanceof KdbNode) {
          exportedContent.connections.KDB.push(connection.details);
        } else {
          exportedContent.connections.Insights.push(connection.details);
        }
      });
    }

    if (exportedContent.connections.KDB.length > 0) {
      for (const kdbConn of exportedContent.connections.KDB) {
        if (!includeAuth) {
          kdbConn.auth = false;
          kdbConn.username = undefined;
          kdbConn.password = undefined;
        } else {
          const auth = ext.kdbAuthMap.find((auth) => {
            return Object.keys(auth)[0] === kdbConn.serverAlias;
          });
          if (auth) {
            kdbConn.auth = true;
            kdbConn.username = auth[kdbConn.serverAlias].username;
            kdbConn.password = auth[kdbConn.serverAlias].password;
          }
        }
      }
    }
    ext.kdbAuthMap.length = 0;
    return exportedContent.connections.Insights.length === 0 &&
      exportedContent.connections.KDB.length === 0
      ? ""
      : JSON.stringify(exportedContent, null, 2);
  }
}
