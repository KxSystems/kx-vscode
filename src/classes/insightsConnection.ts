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
import { MetaInfoType, MetaObject, MetaObjectPayload } from "../models/meta";
import {
  getCurrentToken,
  getHttpsAgent,
} from "../services/kdbInsights/codeFlowLogin";
import { InsightsNode } from "../services/kdbTreeProvider";
import { GetDataObjectPayload } from "../models/data";
import { isCompressed, uncompress } from "../ipc/c";
import { DataSourceFiles, DataSourceTypes } from "../models/dataSource";
import { jwtDecode } from "jwt-decode";
import { JwtUser } from "../models/jwt_user";
import { Telemetry } from "../utils/telemetryClient";
import { handleScratchpadTableRes, handleWSResults } from "../utils/queryUtils";
import {
  compareVersions,
  invalidUsernameJWT,
  kdbOutputLog,
  tokenUndefinedError,
} from "../utils/core";
import { InsightsConfig, InsightsEndpoints } from "../models/config";
import { convertTimeToTimestamp } from "../utils/dataSource";
import { ScratchpadRequestBody } from "../models/scratchpad";
import { StructuredTextResults } from "../models/queryResult";

export class InsightsConnection {
  public connected: boolean;
  public connLabel: string;
  public node: InsightsNode;
  public meta?: MetaObject;
  public config?: InsightsConfig;
  public insightsVersion?: number;
  public connEndpoints?: InsightsEndpoints;

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
      this.node.details.realm || "insights",
      !!this.node.details.insecure,
    ).then(async (token) => {
      this.connected = token ? true : false;
      if (token) {
        await this.getConfig();
        await this.getMeta();
        await this.getScratchpadQuery("", undefined, false, true);
      }
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

  private async getOptions() {
    const token = await getCurrentToken(
      this.node.details.server,
      this.node.details.alias,
      this.node.details.realm || "insights",
      !!this.node.details.insecure,
    );

    if (token === undefined) {
      tokenUndefinedError(this.connLabel);
      return undefined;
    }

    const options: AxiosRequestConfig = {
      headers: { Authorization: `Bearer ${token.accessToken}` },
      httpsAgent: getHttpsAgent(this.node.details.insecure),
    };

    return options;
  }

  public async getMeta(): Promise<MetaObjectPayload | undefined> {
    if (this.connected) {
      const metaUrl = new url.URL(
        ext.insightsServiceGatewayUrls.meta,
        this.node.details.server,
      );

      const options = await this.getOptions();

      if (options === undefined) {
        return undefined;
      }

      const metaResponse = await axios.post(metaUrl.toString(), {}, options);
      const meta: MetaObject = metaResponse.data;
      this.meta = meta;
      return meta.payload;
    }
    return undefined;
  }

  public async getConfig() {
    if (this.connected) {
      const configUrl = new url.URL(
        ext.insightsAuthUrls.configURL,
        this.node.details.server,
      );

      const options = await this.getOptions();

      if (options === undefined) {
        return undefined;
      }

      const configResponse = await axios.get(configUrl.toString(), options);
      this.config = configResponse.data;
      this.getInsightsVersion();
      this.defineEndpoints();
    }
  }

  public getInsightsVersion() {
    const match = this.config?.version.match(/-\d+(\.\d+){2}(-|$)/);
    const version = match ? match[0].replace(/-/g, "") : null;
    if (version) {
      const [major, minor, _path] = version.split(".");
      this.insightsVersion = parseFloat(`${major}.${minor}`);
    }
  }

  public defineEndpoints() {
    this.connEndpoints = {
      scratchpad: {
        scratchpad: "servicebroker/scratchpad/display",
        import: "servicebroker/scratchpad/import/data",
        importSql: "servicebroker/scratchpad/import/sql",
        importQsql: "servicebroker/scratchpad/import/qsql",
        reset: "servicebroker/scratchpad/reset",
      },
      serviceGateway: {
        meta: "servicegateway/meta",
        data: "servicegateway/data",
        sql: "servicegateway/qe/sql",
        qsql: "servicegateway/qe/qsql",
      },
    };
    // uncomment this WHEN the insights version is available
    // if (this.insightsVersion) {
    //   if (compareVersions(this.insightsVersion, 1.12)) {
    //     this.connEndpoints = {
    //       scratchpad: {
    //         scratchpad: "scratchpad/execute/display",
    //         import: "scratchpad/execute/import/data",
    //         importSql: "scratchpad/execute/import/sql",
    //         importQsql: "scratchpad/execute/import/qsql",
    //         reset: "scratchpad/reset",
    //       },
    //       serviceGateway: {
    //         meta: "servicegateway/meta",
    //         data: "servicegateway/data",
    //         sql: "servicegateway/qe/sql",
    //         qsql: "servicegateway/qe/qsql",
    //       },
    //     };
    //   }
    // }
  }

  public retrieveEndpoints(
    parentKey: "scratchpad" | "serviceGateway",
    childKey: string,
  ): string | undefined {
    if (this.connEndpoints) {
      const parent = this.connEndpoints[parentKey];
      if (parent) {
        return parent[childKey as keyof typeof parent];
      }
      return undefined;
    }
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
        this.node.details.realm || "insights",
        !!this.node.details.insecure,
      );
      if (token === undefined) {
        tokenUndefinedError(this.connLabel);
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
        httpsAgent: getHttpsAgent(this.node.details.insecure),
      };
      const results = await window.withProgress(
        {
          location: ProgressLocation.Notification,
          cancellable: false,
        },
        async (progress, token) => {
          token.onCancellationRequested(() => {
            kdbOutputLog(`User cancelled the Datasource Run.`, "WARNING");
          });

          progress.report({ message: "Query executing..." });

          return await axios(options)
            .then((response: any) => {
              kdbOutputLog(
                `[Datasource RUN] Status: ${response.status}.`,
                "INFO",
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
              kdbOutputLog(
                `[Datasource RUN] Status: ${error.response.status}.`,
                "INFO",
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
    if (this.connected && this.connEndpoints) {
      let queryParams, coreUrl: string;
      switch (params.dataSource.selectedType) {
        case DataSourceTypes.API:
          queryParams = {
            table: params.dataSource.api.table,
            startTS: convertTimeToTimestamp(params.dataSource.api.startTS),
            endTS: convertTimeToTimestamp(params.dataSource.api.endTS),
          };
          coreUrl = this.connEndpoints.scratchpad.import;
          dsTypeString = "API";
          break;
        case DataSourceTypes.SQL:
          queryParams = { query: params.dataSource.sql.query };
          coreUrl = this.connEndpoints.scratchpad.importSql;
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
          coreUrl = this.connEndpoints.scratchpad.importQsql;
          dsTypeString = "QSQL";
          break;
        default:
          break;
      }

      const scratchpadURL = new url.URL(coreUrl!, this.node.details.server);

      const token = await getCurrentToken(
        this.node.details.server,
        this.node.details.alias,
        this.node.details.realm || "insights",
        !!this.node.details.insecure,
      );

      if (token === undefined) {
        tokenUndefinedError(this.connLabel);
        return undefined;
      }

      const username = jwtDecode<JwtUser>(token.accessToken);
      if (username === undefined || username.preferred_username === "") {
        invalidUsernameJWT(this.connLabel);
      }
      const headers: AxiosRequestConfig = {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          username: username.preferred_username!,
          json: true,
        },
        httpsAgent: getHttpsAgent(this.node.details.insecure),
      };
      const body = {
        output: variableName,
        isTableView: false,
        params: queryParams,
      };
      await window.withProgress(
        {
          location: ProgressLocation.Notification,
          cancellable: false,
        },
        async (progress, token) => {
          token.onCancellationRequested(() => {
            kdbOutputLog(`User cancelled the scratchpad import.`, "WARNING");
          });

          progress.report({ message: "Populating scratchpad..." });

          return await axios
            .post(scratchpadURL.toString(), body, headers)
            .then((response: any) => {
              if (response.data.error) {
                kdbOutputLog(
                  `[SCRATCHPAD] Error occured while populating scratchpad: ${response.data.errorMsg}`,
                  "ERROR",
                );
              } else {
                kdbOutputLog(
                  `Executed successfully, stored in ${variableName}.`,
                  "INFO",
                );
                kdbOutputLog(`[SCRATCHPAD] Status: ${response.status}`, "INFO");
                kdbOutputLog(
                  `[SCRATCHPAD] Populated scratchpad with the following params: ${JSON.stringify(body.params)}`,
                  "INFO",
                );
                window.showInformationMessage(
                  `Executed successfully, stored in ${variableName}.`,
                );
                Telemetry.sendEvent(
                  "Datasource." + dsTypeString + ".Scratchpad.Populated",
                );
              }
            });
        },
      );
    } else {
      this.noConnectionOrEndpoints();
    }
  }

  public async getScratchpadQuery(
    query: string,
    context?: string,
    isPython?: boolean,
    isStarting?: boolean,
  ): Promise<any | undefined> {
    if (this.connected && this.connEndpoints) {
      const isTableView = ext.isResultsTabVisible;
      const scratchpadURL = new url.URL(
        this.connEndpoints.scratchpad.scratchpad,
        this.node.details.server,
      );
      const token = await getCurrentToken(
        this.node.details.server,
        this.node.details.alias,
        this.node.details.realm || "insights",
        !!this.node.details.insecure,
      );
      if (token === undefined) {
        tokenUndefinedError(this.connLabel);
        return undefined;
      }
      const username = jwtDecode<JwtUser>(token.accessToken);
      if (username === undefined || username.preferred_username === "") {
        invalidUsernameJWT(this.connLabel);
      }
      const body: ScratchpadRequestBody = {
        expression: query,
        language: !isPython ? "q" : "python",
        context: context || ".",
        sampleFn: "first",
        sampleSize: 10000,
      };

      if (this.insightsVersion) {
        /* TODO: Workaround for Python structuredText bug */
        if (!isPython && compareVersions(this.insightsVersion, 1.12)) {
          body.returnFormat = isTableView ? "structuredText" : "text";
        } else {
          body.isTableView = isTableView;
        }
      }

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
            kdbOutputLog(`User cancelled the scratchpad execution.`, "WARNING");
          });

          if (isStarting) {
            progress.report({ message: "Starting scratchpad..." });
          }

          const spRes = await axios
            .post(scratchpadURL.toString(), body, {
              headers,
              httpsAgent: getHttpsAgent(this.node.details.insecure),
            })
            .then((response: any) => {
              if (response.data.error) {
                return response.data;
              } else if (query === "") {
                kdbOutputLog(
                  `[SCRATCHPAD] scratchpad created for connection: ${this.connLabel}`,
                  "INFO",
                );
              } else {
                kdbOutputLog(`[SCRATCHPAD] Status: ${response.status}`, "INFO");
                if (!response.data.error) {
                  if (isTableView) {
                    if (
                      /* TODO: Workaround for Python structuredText bug */
                      !isPython &&
                      this.insightsVersion &&
                      compareVersions(this.insightsVersion, 1.12)
                    ) {
                      response.data = JSON.parse(
                        response.data.data,
                      ) as StructuredTextResults;
                    } else {
                      const buffer = new Uint8Array(
                        response.data.data.map((x: string) => parseInt(x, 16)),
                      ).buffer;

                      response.data.data = handleWSResults(buffer);
                      response.data.data = handleScratchpadTableRes(
                        response.data.data,
                      );
                    }
                  }
                  return response.data;
                }
                return response.data;
              }
            });
          return spRes;
        },
      );
      return spReponse;
    } else {
      this.noConnectionOrEndpoints();
    }
    return undefined;
  }

  public async resetScratchpad(): Promise<boolean> {
    if (this.connected && this.connEndpoints) {
      const scratchpadURL = new url.URL(
        this.connEndpoints.scratchpad.reset,
        this.node.details.server,
      );

      const token = await getCurrentToken(
        this.node.details.server,
        this.node.details.alias,
        this.node.details.realm || "insights",
        !!this.node.details.insecure,
      );

      if (token === undefined) {
        tokenUndefinedError(this.connLabel);
        return false;
      }

      const username = jwtDecode<JwtUser>(token.accessToken);
      if (username === undefined || username.preferred_username === "") {
        invalidUsernameJWT(this.connLabel);
        return false;
      }
      const headers: AxiosRequestConfig = {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          username: username.preferred_username!,
          json: true,
        },
        httpsAgent: getHttpsAgent(this.node.details.insecure),
      };
      return await window.withProgress(
        {
          location: ProgressLocation.Notification,
          cancellable: false,
        },
        async (progress, token) => {
          token.onCancellationRequested(() => {
            kdbOutputLog(`User cancelled the scratchpad reset.`, "WARNING");
            return false;
          });
          progress.report({ message: "Reseting scratchpad..." });
          const res = await axios
            .post(scratchpadURL.toString(), null, headers)
            .then((_response: any) => {
              kdbOutputLog(
                `[SCRATCHPAD] Executed successfully, scratchpad reseted at ${this.connLabel} connection.`,
                "INFO",
              );
              window.showInformationMessage(
                `Executed successfully, scratchpad reseted at ${this.connLabel} connection`,
              );
              Telemetry.sendEvent("Scratchpad.Reseted");
              return true;
            })
            .catch((_error: any) => {
              kdbOutputLog(
                `[SCRATCHPAD] Error ocurried while reseting scratchpad in connection ${this.connLabel}, try again.`,
                "ERROR",
              );
              window.showErrorMessage(
                "Error ocurried while reseting scratchpad, try again.",
              );
              return false;
            });

          return res;
        },
      );
    } else {
      this.noConnectionOrEndpoints();
      return false;
    }
  }

  public returnMetaObject(metaType: MetaInfoType): string {
    if (!this.meta) {
      kdbOutputLog(
        `Meta data is undefined for connection ${this.connLabel}`,
        "ERROR",
      );
      return "";
    }

    let objectToReturn;

    switch (metaType) {
      case MetaInfoType.META:
        objectToReturn = this.meta.payload;
        break;
      case MetaInfoType.SCHEMA:
        objectToReturn = this.meta.payload.schema;
        break;
      case MetaInfoType.API:
        objectToReturn = this.meta.payload.api;
        break;
      case MetaInfoType.AGG:
        objectToReturn = this.meta.payload.agg;
        break;
      case MetaInfoType.DAP:
        objectToReturn = this.meta.payload.dap;
        break;
      case MetaInfoType.RC:
        objectToReturn = this.meta.payload.rc;
        break;
      default:
        kdbOutputLog(`Invalid meta type: ${metaType}`, "ERROR");
        return "";
    }

    return JSON.stringify(objectToReturn);
  }

  public noConnectionOrEndpoints(): void {
    kdbOutputLog(
      `No connection or endpoints defined for ${this.connLabel}`,
      "ERROR",
    );
  }
}
