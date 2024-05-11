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

import { ext } from "../extensionVariables";
import axios, { AxiosRequestConfig } from "axios";
import { ProgressLocation, window } from "vscode";
import * as url from "url";
import { MetaObject, MetaObjectPayload } from "../models/meta";
import { getCurrentToken } from "../services/kdbInsights/codeFlowLogin";
import { InsightsNode } from "../services/kdbTreeProvider";
import { GetDataObjectPayload } from "../models/data";
import { isCompressed, uncompress } from "../ipc/c";
import { DataSourceFiles, DataSourceTypes } from "../models/dataSource";
import { jwtDecode } from "jwt-decode";
import { JwtUser } from "../models/jwt_user";
import { Telemetry } from "../utils/telemetryClient";
import { handleScratchpadTableRes, handleWSResults } from "../utils/queryUtils";

export class InsightsConnection {
  public connected: boolean;
  public connLabel: string;
  public node: InsightsNode;
  public meta?: MetaObject;

  constructor(connLabel: string, node: InsightsNode) {
    this.connected = false;
    this.connLabel = connLabel;
    this.node = node;
  }

  public async connect(): Promise<boolean> {
    ext.context.secrets.delete(this.node.details.alias);
    await getCurrentToken(
      this.node.details.server,
      this.node.details.alias,
    ).then((token) => {
      this.connected = token ? true : false;
    });
    return this.connected;
  }

  public disconnect(): boolean {
    ext.context.secrets.delete(this.node.details.alias);
    this.connected = false;
    return this.connected;
  }

  public update() {
    //will be added the feature to retrieve server objects from insights
  }

  public async getMeta(): Promise<MetaObjectPayload | undefined> {
    if (this.connected) {
      const metaUrl = new url.URL(
        ext.insightsServiceGatewayUrls.meta,
        this.node.details.server,
      );

      const token = await getCurrentToken(
        this.node.details.server,
        this.node.details.alias,
      );

      if (token === undefined) {
        ext.outputChannel.appendLine(
          "Error retrieving access token for insights.",
        );
        window.showErrorMessage("Failed to retrieve access token for insights");
        return undefined;
      }

      const options = {
        headers: { Authorization: `Bearer ${token.accessToken}` },
      };

      const metaResponse = await axios.post(metaUrl.toString(), {}, options);
      const meta: MetaObject = metaResponse.data;
      this.meta = meta;
      return meta.payload;
    }
    return undefined;
  }

  public async getDataInsights(
    targetUrl: string,
    body: string,
  ): Promise<GetDataObjectPayload | undefined> {
    if (this.connected) {
      const requestUrl = new url.URL(
        targetUrl,
        this.node.details.server,
      ).toString();
      const token = await getCurrentToken(
        this.node.details.server,
        this.node.details.alias,
      );
      if (token === undefined) {
        ext.outputChannel.appendLine(
          "Error retrieving access token for insights connection named: " +
            this.connLabel,
        );
        window.showErrorMessage(
          "Failed to retrieve access token for insights connection named: " +
            this.connLabel,
        );
        return undefined;
      }
      const headers = {
        Authorization: `Bearer ${token.accessToken}`,
        Accept: "application/octet-stream",
        "Content-Type": "application/json",
      };

      const options: AxiosRequestConfig = {
        method: "post",
        url: requestUrl,
        data: body,
        headers: headers,
        responseType: "arraybuffer",
      };
      const results = await window.withProgress(
        {
          location: ProgressLocation.Notification,
          cancellable: false,
        },
        async (progress, token) => {
          token.onCancellationRequested(() => {
            ext.outputChannel.appendLine("User cancelled the execution.");
          });

          progress.report({ message: "Query executing..." });

          return await axios(options)
            .then((response: any) => {
              ext.outputChannel.appendLine(
                `request status: ${response.status}`,
              );
              if (isCompressed(response.data)) {
                response.data = uncompress(response.data);
              }
              return {
                error: "",
                arrayBuffer: response.data.buffer
                  ? response.data.buffer
                  : response.data,
              };
            })
            .catch((error: any) => {
              ext.outputChannel.appendLine(
                `request status: ${error.response.status}`,
              );
              return {
                error: { buffer: error.response.data },
                arrayBuffer: undefined,
              };
            });
        },
      );
      return results;
    }
  }

  public async importScratchpad(
    variableName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params: DataSourceFiles,
  ): Promise<void> {
    let dsTypeString = "";
    if (this.connected) {
      let queryParams, coreUrl: string;
      switch (params.dataSource.selectedType) {
        case DataSourceTypes.API:
          queryParams = {
            table: params.dataSource.api.table,
            startTS: params.dataSource.api.startTS,
            endTS: params.dataSource.api.endTS,
          };
          coreUrl = ext.insightsScratchpadUrls.import;
          dsTypeString = "API";
          break;
        case DataSourceTypes.SQL:
          queryParams = { query: params.dataSource.sql.query };
          coreUrl = ext.insightsScratchpadUrls.importSql;
          dsTypeString = "SQL";
          break;
        case DataSourceTypes.QSQL:
          const assemblyParts =
            params.dataSource.qsql.selectedTarget.split(" ");
          queryParams = {
            assembly: assemblyParts[0],
            target: assemblyParts[1],
            query: params.dataSource.qsql.query,
          };
          coreUrl = ext.insightsScratchpadUrls.importQsql;
          dsTypeString = "QSQL";
          break;
        default:
          break;
      }

      const scratchpadURL = new url.URL(coreUrl!, this.node.details.server);

      const token = await getCurrentToken(
        this.node.details.server,
        this.node.details.alias,
      );

      if (token === undefined) {
        ext.outputChannel.appendLine(
          "Error retrieving access token for insights.",
        );
        window.showErrorMessage("Failed to retrieve access token for insights");
        return undefined;
      }

      const username = jwtDecode<JwtUser>(token.accessToken);
      if (username === undefined || username.preferred_username === "") {
        ext.outputChannel.appendLine(
          "JWT did not contain a valid preferred username",
        );
      }
      const headers = {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          username: username.preferred_username!,
          json: true,
        },
      };
      const body = {
        output: variableName,
        isTableView: false,
        params: queryParams,
      };
      window.withProgress(
        {
          location: ProgressLocation.Notification,
          cancellable: false,
        },
        async (progress, token) => {
          token.onCancellationRequested(() => {
            ext.outputChannel.appendLine(
              "User cancelled the scratchpad import.",
            );
          });

          progress.report({ message: "Populating scratchpad..." });

          const scratchpadResponse = await axios.post(
            scratchpadURL.toString(),
            body,
            headers,
          );

          ext.outputChannel.append(JSON.stringify(scratchpadResponse.data));
          window.showInformationMessage(
            `Executed successfully, stored in ${variableName}`,
          );
          Telemetry.sendEvent(
            "Datasource." + dsTypeString + ".Scratchpad.Populated",
          );

          const p = new Promise<void>((resolve) => resolve());
          return p;
        },
      );
    }
  }

  public async getScratchpadQuery(
    query: string,
    context?: string,
    isPython?: boolean,
  ): Promise<any | undefined> {
    if (this.connected) {
      const isTableView = ext.resultsViewProvider.isVisible();
      const scratchpadURL = new url.URL(
        ext.insightsAuthUrls.scratchpadURL,
        this.node.details.server,
      );
      const token = await getCurrentToken(
        this.node.details.server,
        this.node.details.alias,
      );
      if (token === undefined) {
        ext.outputChannel.appendLine(
          "Error retrieving access token for insights.",
        );
        window.showErrorMessage("Failed to retrieve access token for insights");
        return undefined;
      }
      const username = jwtDecode<JwtUser>(token.accessToken);
      if (username === undefined || username.preferred_username === "") {
        ext.outputChannel.appendLine(
          "JWT did not contain a valid preferred username",
        );
      }
      const body = {
        expression: query,
        isTableView,
        language: !isPython ? "q" : "python",
        context: context || ".",
        sampleFn: "first",
        sampleSize: 10000,
      };
      const headers = {
        Authorization: `Bearer ${token.accessToken}`,
        Username: username.preferred_username,
        "Content-Type": "application/json",
      };

      const spReponse = await window.withProgress(
        {
          location: ProgressLocation.Notification,
          cancellable: false,
        },
        async (progress, token) => {
          token.onCancellationRequested(() => {
            ext.outputChannel.appendLine(
              "User cancelled the scratchpad execution.",
            );
          });

          progress.report({ message: "Query is executing..." });
          const spRes = await axios
            .post(scratchpadURL.toString(), body, { headers })
            .then((response: any) => {
              if (isTableView && !response.data.error) {
                const buffer = new Uint8Array(
                  response.data.data.map((x: string) => parseInt(x, 16)),
                ).buffer;

                response.data.data = handleWSResults(buffer);
                response.data.data = handleScratchpadTableRes(
                  response.data.data,
                );
              }
              return response.data;
            });
          return spRes;
        },
      );
      return spReponse;
    }
    return undefined;
  }

  public async resetScratchpad(): Promise<boolean> {
    if (this.connected) {
      const scratchpadURL = new url.URL(
        ext.insightsScratchpadUrls.reset!,
        this.node.details.server,
      );

      const token = await getCurrentToken(
        this.node.details.server,
        this.node.details.alias,
      );

      if (token === undefined) {
        ext.outputChannel.appendLine(
          "Error retrieving access token for insights.",
        );
        window.showErrorMessage("Failed to retrieve access token for insights");
        return false;
      }

      const username = jwtDecode<JwtUser>(token.accessToken);
      if (username === undefined || username.preferred_username === "") {
        ext.outputChannel.appendLine(
          "JWT did not contain a valid preferred username",
        );
        return false;
      }
      const headers = {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          username: username.preferred_username!,
          json: true,
        },
      };
      return await window.withProgress(
        {
          location: ProgressLocation.Notification,
          cancellable: false,
        },
        async (progress, token) => {
          token.onCancellationRequested(() => {
            ext.outputChannel.appendLine(
              "User cancelled the scratchpad reset.",
            );
            return false;
          });

          progress.report({ message: "Reseting scratchpad..." });

          const res = await axios
            .post(scratchpadURL.toString(), null, headers)
            .then((response: any) => {
              console.log(response);
              ext.outputChannel.append("Scratchpad.Reseted");
              window.showInformationMessage(
                `Executed successfully, scratchpad reseted at ${this.connLabel} connection`,
              );
              Telemetry.sendEvent("Scratchpad.Reseted");
              return true;
            })
            .catch((error: any) => {
              console.log(error);
              window.showErrorMessage(
                "Error ocurried while reseting scratchpad, try again.",
              );
              return false;
            });

          return res;
        },
      );
    } else {
      return false;
    }
  }

  public async pingInsights(): Promise<boolean> {
    if (this.connected) {
      const pingURL = new url.URL(
        ext.insightsServiceGatewayUrls.ping,
        this.node.details.server,
      );

      const userToken = await getCurrentToken(
        this.node.details.server,
        this.node.details.alias,
      );

      if (userToken === undefined) {
        ext.outputChannel.appendLine(
          "Error retrieving access token for insights.",
        );
        window.showErrorMessage("Failed to retrieve access token for insights");
        return false;
      }

      const body = {
        labels: {},
      };

      return await window.withProgress(
        {
          location: ProgressLocation.Notification,
          cancellable: false,
        },
        async (progress, token) => {
          token.onCancellationRequested(() => {
            ext.outputChannel.appendLine("User cancelled the ping request.");
            return false;
          });

          progress.report({ message: "Pinging insights..." });

          const res = await axios
            .request({
              method: "post",
              url: pingURL.toString(),
              data: body,
              headers: { Authorization: `Bearer ${userToken.accessToken}` },
              timeout: 1000,
            })
            .then((response: any) => {
              console.log(response);
              Telemetry.sendEvent("Insights.Pinged");
              return true;
            })
            .catch((error: any) => {
              console.log(error);
              window.showErrorMessage(
                `The Insights connection: ${this.connLabel} cannot be reached, the connection closed.`,
              );
              return false;
            });

          return res;
        },
      );
    } else {
      return false;
    }
  }
}
