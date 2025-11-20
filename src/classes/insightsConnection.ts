/*
 * Copyright (c) 1998-2025 KX Systems Inc.
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

import axios, { AxiosRequestConfig } from "axios";
import { jwtDecode } from "jwt-decode";
import * as url from "url";

import { ext } from "../extensionVariables";
import { isCompressed, uncompress } from "../ipc/c";
import {
  InsightsApiConfig,
  InsightsConfig,
  InsightsEndpoints,
} from "../models/config";
import { GetDataObjectPayload } from "../models/data";
import { DataSourceFiles, DataSourceTypes } from "../models/dataSource";
import { JwtUser } from "../models/jwt_user";
import { MetaInfoType, MetaObject, MetaObjectPayload } from "../models/meta";
import { StructuredTextResults } from "../models/queryResult";
import { ScratchpadRequestBody } from "../models/scratchpad";
import { UDARequestBody } from "../models/uda";
import {
  getCurrentToken,
  getHttpsAgent,
  IToken,
} from "../services/kdbInsights/codeFlowLogin";
import { InsightsNode } from "../services/kdbTreeProvider";
import {
  isBaseVersionGreaterOrEqual,
  invalidUsernameJWT,
  tokenUndefinedError,
} from "../utils/core";
import { convertTimeToTimestamp } from "../utils/dataSource";
import { MessageKind, notify } from "../utils/notifications";
import { handleScratchpadTableRes, handleWSResults } from "../utils/queryUtils";
import { normalizeAssemblyTarget } from "../utils/shared";
import { retrieveUDAtoCreateReqBody } from "../utils/uda";

const logger = "insightsConnection";

const customHeadersOctet = {
  Accept: "application/octet-stream",
  "Content-Type": "application/json",
};
const customHeadersJson = {
  "Content-Type": "application/json",
  Accept: "application/json",
  json: true,
};

export class InsightsConnection {
  public connected: boolean;
  public connLabel: string;
  public node: InsightsNode;
  public meta?: MetaObject;
  public config?: InsightsConfig;
  public apiConfig?: InsightsApiConfig;
  public insightsVersion?: number;
  public connEndpoints?: InsightsEndpoints;

  constructor(connLabel: string, node: InsightsNode) {
    this.connected = false;
    this.connLabel = connLabel;
    this.node = node;
  }

  public async connect(): Promise<boolean> {
    ext.context.secrets.delete(this.node.details.alias);
    const token = await this.getTokens();
    if (token) {
      this.connected = true;
      await this.getConfig();
      await this.getApiConfig();
      await this.getMeta();
    } else this.connected = false;
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

  public async getTokens() {
    return await getCurrentToken(
      this.node.details.server,
      this.node.details.alias,
      this.node.details.realm || "insights",
      !!this.node.details.insecure,
    );
  }

  public async getOptions(
    needUsername?: boolean,
    customHeaders?: any,
    method: string = "GET",
    url?: string,
    data?: any,
  ): Promise<AxiosRequestConfig | undefined> {
    const token = await this.getTokens();

    if (!token) {
      tokenUndefinedError(this.connLabel);
      return undefined;
    }

    if (!customHeaders) {
      customHeaders = {};
    }

    const options: AxiosRequestConfig = {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        ...customHeaders,
      },
      httpsAgent: getHttpsAgent(this.node.details.insecure),
      method,
      data,
      url,
    };

    if (needUsername && options.headers) {
      const username = jwtDecode<JwtUser>(token.accessToken);
      if (!username || !username.preferred_username) {
        invalidUsernameJWT(this.connLabel);
        return undefined;
      }
      options.headers.username = username.preferred_username;
    }

    return options;
  }

  public returnMetaObject(metaType: MetaInfoType): string {
    if (!this.meta) {
      notify(
        `Meta data is undefined for connection ${this.connLabel}`,
        MessageKind.ERROR,
        { logger },
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
        notify(`Invalid meta type: ${metaType}`, MessageKind.ERROR, {
          logger,
        });
        return "";
    }

    return JSON.stringify(objectToReturn);
  }

  public async getMeta(): Promise<MetaObjectPayload | undefined> {
    if (this.connected && this.connEndpoints) {
      const metaUrl = new url.URL(
        this.connEndpoints?.serviceGateway.meta,
        this.node.details.server,
      );
      const options = await this.getOptions(
        false,
        undefined,
        "POST",
        metaUrl.toString(),
        { advanced: true },
      );

      if (!options) {
        return undefined;
      }

      notify("REST", MessageKind.DEBUG, {
        logger,
        params: { url: options.url },
      });

      const metaResponse = await axios(options);
      const meta: MetaObject = metaResponse.data;
      this.meta = meta;
      return meta.payload;
    }
    return undefined;
  }

  public async getApiConfig() {
    if (
      this.connected &&
      this.insightsVersion &&
      isBaseVersionGreaterOrEqual(this.insightsVersion, 1.13)
    ) {
      const configUrl = new url.URL(
        ext.insightsAuthUrls.apiConfigUrl,
        this.node.details.server,
      );
      const options = await this.getOptions(
        true,
        {},
        "GET",
        configUrl.toString(),
      );

      if (options === undefined) {
        return undefined;
      }

      notify("REST", MessageKind.DEBUG, {
        logger,
        params: { url: options.url },
      });

      const configResponse = await axios(options);

      this.apiConfig = configResponse.data;
      this.defineEndpoints();
    }
  }

  public async getConfig() {
    if (this.connected) {
      const configUrl = new url.URL(
        ext.insightsAuthUrls.configURL,
        this.node.details.server,
      );
      const options = await this.getOptions(
        false,
        {},
        "GET",
        configUrl.toString(),
      );

      if (options === undefined) {
        return undefined;
      }

      notify("REST", MessageKind.DEBUG, {
        logger,
        params: { url: options.url },
      });

      const configResponse = await axios(options);

      this.config = configResponse.data;
      this.getInsightsVersion();
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
    const scratchpadEndpoints = {
      scratchpad: "scratchpadmanager/scratchpad/display",
      import: "scratchpadmanager/scratchpad/import/data",
      importSql: "scratchpadmanager/scratchpad/import/sql",
      importQsql: "scratchpadmanager/scratchpad/import/qsql",
      importUDA: "scratchpadmanager/scratchpad/import/uda",
      reset: "scratchpadmanager/reset",
    };

    const getVersionGroup = (): string => {
      if (
        !this.insightsVersion ||
        !isBaseVersionGreaterOrEqual(this.insightsVersion, 1.11)
      ) {
        return "pre-1.11";
      }
      if (!isBaseVersionGreaterOrEqual(this.insightsVersion, 1.14)) {
        return "v1.11-1.13";
      }
      return "v1.14+";
    };

    const versionGroup = getVersionGroup();
    let serviceGatewayEndpoints;
    const qePrefix = this.apiConfig?.queryEnvironmentsEnabled ? "qe/" : "";

    switch (versionGroup) {
      case "pre-1.11":
        scratchpadEndpoints.scratchpad = "servicebroker/scratchpad/display";
        scratchpadEndpoints.import = "servicebroker/scratchpad/import/data";
        scratchpadEndpoints.importSql = "servicebroker/scratchpad/import/sql";
        scratchpadEndpoints.importQsql = "servicebroker/scratchpad/import/qsql";
        scratchpadEndpoints.importUDA = "servicebroker/scratchpad/import/uda";
        scratchpadEndpoints.reset = "scratchpadmanager/reset";

        serviceGatewayEndpoints = {
          meta: "servicegateway/meta",
          data: "servicegateway/data",
          sql: "servicegateway/qe/sql",
          qsql: "servicegateway/qe/qsql",
          udaBase: "servicegateway/",
        };
        break;

      case "v1.11-1.13":
        serviceGatewayEndpoints = {
          meta: `servicegateway/${qePrefix}api/v3/meta`,
          data: "servicegateway/data",
          sql: `servicegateway/${qePrefix}sql`,
          qsql: `servicegateway/${qePrefix}qsql`,
          udaBase: "servicegateway/",
        };
        break;

      case "v1.14+":
      default:
        serviceGatewayEndpoints = {
          meta: `servicegateway/${qePrefix}api/v3/meta`,
          data: "servicegateway/data",
          sql: `servicegateway/${qePrefix}kxi/sql`,
          qsql: `servicegateway/${qePrefix}kxi/qsql`,
          udaBase: "servicegateway/",
        };
        break;
    }

    this.connEndpoints = {
      scratchpad: scratchpadEndpoints,
      serviceGateway: serviceGatewayEndpoints,
    };
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

  public generateDatasourceEndpoints(
    type: DataSourceTypes,
    udaName: string,
  ): string {
    let endpoint: string = "";
    switch (type) {
      case DataSourceTypes.UDA:
        endpoint =
          this.retrieveEndpoints("serviceGateway", "udaBase") +
          udaName.split(".").slice(1).join("/");
        break;
      case DataSourceTypes.API:
        endpoint = this.retrieveEndpoints("serviceGateway", "data") || "";
        break;
      case DataSourceTypes.SQL:
        endpoint = this.retrieveEndpoints("serviceGateway", "sql") || "";
        break;
      case DataSourceTypes.QSQL:
      default:
        endpoint = this.retrieveEndpoints("serviceGateway", "qsql") || "";
        break;
    }
    return new url.URL(endpoint, this.node.details.server).toString();
  }

  public generateQSqlBody(
    query: string,
    assemblyTarget: string,
    version?: number,
  ) {
    const [plainAssembly, tier, plainDap] =
      normalizeAssemblyTarget(assemblyTarget).split(/\s+/);

    const assembly = this.retrieveCorrectAssemblyName(plainAssembly);
    const dap = this.retrieveCorrectDAPName(plainDap, tier);

    if (version && isBaseVersionGreaterOrEqual(version, 1.13)) {
      return {
        query,
        scope: {
          affinity: "soft",
          assembly,
          tier: dap ? undefined : tier,
          dap: dap,
        },
      };
    }

    return { query, assembly, tier, dap };
  }

  public retrieveCorrectAssemblyName(
    plainAssembly: string,
  ): string | undefined {
    if (this.meta?.payload?.dap) {
      const foundDap = this.meta.payload.dap.find((dap: any) =>
        dap.assembly?.startsWith(plainAssembly),
      );

      return foundDap ? foundDap.assembly : undefined;
    } else {
      return;
    }
  }

  public retrieveCorrectDAPName(
    plainDAP: string | undefined,
    tier: string | undefined,
  ): string | undefined {
    if (this.meta?.payload?.dap && plainDAP) {
      const foundDap = this.meta.payload.dap.find(
        (dap: any) => dap.dap?.startsWith(plainDAP) && dap.instance === tier,
      );

      return foundDap ? foundDap.dap : undefined;
    } else {
      return;
    }
  }

  public async getDatasourceQuery(
    type: DataSourceTypes,
    body: any,
  ): Promise<GetDataObjectPayload | undefined> {
    if (this.connected) {
      const udaName = (body as UDARequestBody).name
        ? (body as UDARequestBody).name
        : "";
      if (udaName !== "") {
        body = body.params;
        // TODO: This will be necessary when the parametertypes issue is fixed just remove the line above
        // body = {
        //   ...body.params,
        //   parameterTypes: body.parameterTypes,
        // };
      }
      const requestUrl = this.generateDatasourceEndpoints(type, udaName);
      const options = await this.getOptions(
        false,
        customHeadersOctet,
        "POST",
        requestUrl,
        body,
      );

      if (!options) {
        return undefined;
      }
      options.responseType = "arraybuffer";

      notify("REST", MessageKind.DEBUG, {
        logger,
        params: { url: options.url },
      });

      return await axios(options)
        .then((response: any) => {
          notify(
            `Datasource execution status: ${response.status}.`,
            MessageKind.DEBUG,
            { logger },
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
          notify(
            `Datasource execution status: ${error.response.status}.`,
            MessageKind.DEBUG,
            { logger, params: error },
          );
          return {
            error: { buffer: error.response.data },
            arrayBuffer: undefined,
          };
        });
    }
  }

  public async importScratchpad(
    variableName: string,
    params: DataSourceFiles,
    silent?: boolean,
  ): Promise<void> {
    let dsTypeString = "";
    if (this.connected && this.connEndpoints) {
      let coreUrl: string;
      const body: any = {
        output: variableName,
        isTableView: false,
      };
      switch (params.dataSource.selectedType) {
        case DataSourceTypes.API: {
          body.params = {
            table: params.dataSource.api.table,
            startTS: convertTimeToTimestamp(params.dataSource.api.startTS),
            endTS: convertTimeToTimestamp(params.dataSource.api.endTS),
          };
          coreUrl = this.connEndpoints.scratchpad.import;
          dsTypeString = "API";
          break;
        }
        case DataSourceTypes.SQL: {
          body.params = { query: params.dataSource.sql.query };
          coreUrl = this.connEndpoints.scratchpad.importSql;
          dsTypeString = "SQL";
          break;
        }
        case DataSourceTypes.QSQL: {
          body.params = this.generateQSqlBody(
            params.dataSource.qsql.query,
            params.dataSource.qsql.selectedTarget,
            this.insightsVersion,
          );

          coreUrl = this.connEndpoints.scratchpad.importQsql;
          dsTypeString = "QSQL";
          break;
        }
        case DataSourceTypes.UDA: {
          const uda = params.dataSource.uda;
          const udaReqBody = await retrieveUDAtoCreateReqBody(uda, this);

          if (udaReqBody.error) {
            notify("Unable to create UDA request body.", MessageKind.ERROR, {
              logger,
              params: udaReqBody.error,
            });
            return;
          }
          body.params = udaReqBody.params;
          body.parameterTypes = udaReqBody.parameterTypes;
          body.language = udaReqBody.language;
          body.name = udaReqBody.name;
          body.returnFormat = udaReqBody.returnFormat;
          body.sampleFn = udaReqBody.sampleFn;
          body.sampleSize = udaReqBody.sampleSize;

          coreUrl = this.connEndpoints.scratchpad.importUDA;
          break;
        }
        default:
          break;
      }

      const scratchpadURL = new url.URL(coreUrl!, this.node.details.server);
      const options = await this.getOptions(
        true,
        customHeadersJson,
        "POST",
        scratchpadURL.toString(),
        body,
      );

      if (options === undefined) {
        return;
      }

      notify("REST", MessageKind.DEBUG, {
        logger,
        params: { url: options.url },
      });

      return await axios(options).then((response: any) => {
        if (response.data.error) {
          notify(
            "Error occured while populating scratchpad.",
            silent ? MessageKind.DEBUG : MessageKind.ERROR,
            {
              logger,
              params: { status: response.status },
              telemetry:
                "Datasource." + dsTypeString + ".Scratchpad.Populated.Errored",
            },
          );
        } else {
          notify(
            `Scratchpad variable (${variableName}) populated.`,
            silent ? MessageKind.DEBUG : MessageKind.INFO,
            {
              logger,
              params: { status: response.status },
              telemetry: "Datasource." + dsTypeString + ".Scratchpad.Populated",
            },
          );
        }
      });
    } else {
      this.noConnectionOrEndpoints();
    }
  }

  public async generateToken(): Promise<IToken | undefined> {
    const token = await getCurrentToken(
      this.node.details.server,
      this.node.details.alias,
      this.node.details.realm || "insights",
      !!this.node.details.insecure,
    );
    if (token === undefined) {
      tokenUndefinedError(this.connLabel);
    }
    return token;
  }

  public async isUDAAvailable(udaName: string): Promise<boolean> {
    if (!this.meta || !this.meta.payload.api) {
      return false;
    }

    if (!this.connected || !this.connEndpoints) {
      return false;
    }

    if (this.meta.payload.api && Array.isArray(this.meta.payload.api)) {
      return this.meta.payload.api.some(
        (apiItem: { api: string; uda: boolean }) =>
          apiItem.api === udaName && apiItem.uda === true,
      );
    }

    return false;
  }

  public async getUDAScratchpadQuery(
    udaReqBody: UDARequestBody,
  ): Promise<any | undefined> {
    if (this.connected && this.connEndpoints) {
      const isTableView = udaReqBody.returnFormat === "structuredText";
      const udaURL = new url.URL(
        this.connEndpoints.scratchpad.importUDA,
        this.node.details.server,
      );
      const options = await this.getOptions(
        true,
        customHeadersJson,
        "POST",
        udaURL.toString(),
        udaReqBody,
      );
      if (!options) {
        return;
      }

      notify("REST", MessageKind.DEBUG, {
        logger,
        params: { url: options.url },
      });

      return await axios(options).then((response: any) => {
        if (response.data.error) {
          return response.data;
        } else {
          notify(`Status: ${response.status}`, MessageKind.DEBUG, {
            logger,
          });
          if (!response.data.error) {
            if (isTableView) {
              response.data = JSON.parse(
                response.data.data,
              ) as StructuredTextResults;
            }
            return response.data;
          }
          return response.data;
        }
      });
    } else {
      this.noConnectionOrEndpoints();
    }
    return undefined;
  }

  public async getScratchpadQuery(
    query: string,
    context?: string,
    isPython?: boolean,
    isTableView?: boolean,
  ): Promise<any | undefined> {
    if (this.connected && this.connEndpoints) {
      if (isTableView === undefined) {
        isTableView = ext.isResultsTabVisible;
      }
      const scratchpadURL = new url.URL(
        this.connEndpoints.scratchpad.scratchpad,
        this.node.details.server,
      );
      const body: ScratchpadRequestBody = {
        expression: query,
        language: !isPython ? "q" : "python",
        context: context || ".",
        sampleFn: "first",
        sampleSize: 10000,
      };

      if (this.insightsVersion) {
        /* TODO: Workaround for Python structuredText bug */
        if (
          !isPython &&
          isBaseVersionGreaterOrEqual(this.insightsVersion, 1.12)
        ) {
          body.returnFormat = isTableView ? "structuredText" : "text";
        } else {
          body.isTableView = isTableView;
        }
      }

      const options = await this.getOptions(
        true,
        customHeadersJson,
        "POST",
        scratchpadURL.toString(),
        body,
      );

      if (options === undefined) {
        return;
      }

      notify("REST", MessageKind.DEBUG, {
        logger,
        params: { url: options.url },
      });

      return await axios(options).then((response: any) => {
        if (response.data.error) {
          return response.data;
        } else if (query === "") {
          notify(
            `Scratchpad created for connection: ${this.connLabel}.`,
            MessageKind.DEBUG,
            { logger },
          );
        } else {
          notify(`Status: ${response.status}`, MessageKind.DEBUG, {
            logger,
          });
          if (!response.data.error) {
            if (isTableView) {
              if (
                /* TODO: Workaround for Python structuredText bug */
                !isPython &&
                this.insightsVersion &&
                isBaseVersionGreaterOrEqual(this.insightsVersion, 1.12)
              ) {
                response.data = JSON.parse(
                  response.data.data,
                ) as StructuredTextResults;
              } else {
                const buffer = new Uint8Array(
                  response.data.data.map((x: string) => parseInt(x, 16)),
                ).buffer;

                response.data.data = handleWSResults(buffer, isTableView);
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
    } else {
      this.noConnectionOrEndpoints();
    }
    return undefined;
  }

  public async resetScratchpad(): Promise<boolean | undefined> {
    if (this.connected && this.connEndpoints) {
      const scratchpadURL = new url.URL(
        this.connEndpoints.scratchpad.reset,
        this.node.details.server,
      );
      const options = await this.getOptions(
        true,
        customHeadersJson,
        "POST",
        scratchpadURL.toString(),
        null,
      );

      if (!options) {
        return;
      }

      notify("REST", MessageKind.DEBUG, {
        logger,
        params: { url: options.url },
      });

      return await axios(options)
        .then((_response: any) => {
          notify(
            `Scratchpad reset for ${this.connLabel} executed successfully.`,
            MessageKind.INFO,
            { logger, telemetry: "Scratchpad.Reseted" },
          );
          return true;
        })
        .catch((_error: any) => {
          notify(
            `Error occurred while resetting scratchpad for ${this.connLabel}, try again.`,
            MessageKind.ERROR,
            { logger },
          );
          return false;
        });
    } else {
      this.noConnectionOrEndpoints();
      return false;
    }
  }

  public noConnectionOrEndpoints(): void {
    notify(
      `No connection or endpoints defined for ${this.connLabel}`,
      MessageKind.ERROR,
      { logger },
    );
  }
}
