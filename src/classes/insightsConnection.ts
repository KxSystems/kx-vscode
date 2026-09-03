/*
 * Copyright (c) 1998-2026 KX Systems Inc.
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
import * as crypto from "crypto";
import { jwtDecode } from "jwt-decode";
import * as url from "url";
import { CancellationToken } from "vscode-languageclient";

import { ext } from "../extensionVariables";
import { ScratchpadLogger } from "./scratchpadLogger";
import {
  InsightsApiConfig,
  InsightsConfig,
  InsightsEndpoints,
} from "../models/config";
import {
  GetDataObjectPayload,
  Scope,
  getDataBodyPayload,
} from "../models/data";
import { DataSourceFiles, DataSourceTypes } from "../models/dataSource";
import { JwtUser } from "../models/jwt_user";
import { MetaInfoType, MetaObject, MetaObjectPayload } from "../models/meta";
import { PREVIEW, parseValue } from "../models/query";
import { StructuredTextResults } from "../models/queryResult";
import { ScratchpadRequestBody } from "../models/scratchpad";
import { ScratchpadResult } from "../models/scratchpadResult";
import { SCOPE, UDARequestBody } from "../models/uda";
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
import { MessageKind, notify } from "../utils/notifications";
import { getHeaders, isEncodedPng } from "../utils/queryUtils";
import { normalizeAssemblyTarget } from "../utils/shared";
import { retrieveUDAtoCreateReqBody } from "../utils/uda";

const logger = "insightsConnection";

/**
 * Builds a human-readable message from an error thrown by an Insights REST
 * request. Handles the cases where the gateway/coordinator goes away mid-query:
 * a 500 with a plain-text reason (e.g. "Coordinator connection has closed"), a
 * 502 with an HTML error page, or a dropped socket with no response at all.
 */
export function extractInsightsRequestError(error: any): string {
  const response = error?.response;
  if (response) {
    const data = response.data;
    const detail =
      typeof data === "string" && data.trim() && !data.trim().startsWith("<")
        ? data.trim()
        : response.statusText || "";
    return `Request failed with status ${response.status}${
      detail ? `: ${detail}` : ""
    }`;
  }
  return error?.message ?? String(error);
}

export class InsightsConnection {
  public connected: boolean;
  public connLabel: string;
  public node: InsightsNode;
  public meta?: MetaObject;
  public config?: InsightsConfig;
  public apiConfig?: InsightsApiConfig;
  public insightsVersion?: string;
  public connEndpoints?: InsightsEndpoints;
  private scratchpadLogger?: ScratchpadLogger;

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
      this.startLogger();
    } else this.connected = false;
    return this.connected;
  }

  public disconnect(): boolean {
    ext.context.secrets.delete(this.node.details.alias);
    if (this.scratchpadLogger) {
      this.scratchpadLogger.disconnect();
      this.scratchpadLogger = undefined;
    }
    this.connected = false;
    return this.connected;
  }

  /**
   * Opens the scratchpad log websocket, which carries the stdout the extension
   * renders as images. Bound to the connection rather than to which connection
   * is active, because notebooks and workbooks run against the connection they
   * are mapped to — closing this when another connection became active meant
   * their output never arrived. Safe to call repeatedly.
   */
  private startLogger() {
    if (
      this.insightsVersion &&
      isBaseVersionGreaterOrEqual(this.insightsVersion, "1.18")
    ) {
      if (!this.scratchpadLogger) {
        this.scratchpadLogger = new ScratchpadLogger(
          this.node.details,
          this.connLabel,
        );
      }

      this.scratchpadLogger.connect();
    }
  }

  public async setActive() {
    // A safety net only: the logger normally starts on connect. Still called
    // here for connections that were established before the version was known.
    this.startLogger();
  }

  public setInactive() {
    // Deliberately does not close the log websocket — see startLogger().
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
    if (!this.connected) {
      return undefined;
    }

    // The endpoint itself only exists from 1.13; all it decides is whether the
    // query environment prefix is used. The endpoints are resolved either way —
    // an older instance has its own set, and until they are defined nothing,
    // not even the meta, can be requested.
    if (
      this.insightsVersion &&
      isBaseVersionGreaterOrEqual(this.insightsVersion, "1.13")
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

      if (options !== undefined) {
        notify("REST", MessageKind.DEBUG, {
          logger,
          params: { url: options.url },
        });

        const configResponse = await axios(options);

        this.apiConfig = configResponse.data;
      }
    }

    this.defineEndpoints();
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
      this.insightsVersion = `${major}.${minor}`;
    }
  }

  public defineEndpoints() {
    const scratchpadEndpoints = {
      scratchpad: "scratchpadmanager/scratchpad/display",
      import: "scratchpadmanager/scratchpad/import/data",
      importSql: "scratchpadmanager/scratchpad/import/sql",
      importQsql: "scratchpadmanager/scratchpad/import/qsql",
      importUDA: "scratchpadmanager/scratchpad/import/uda",
      cancel: "scratchpadmanager/scratchpad/cancel",
      reset: "scratchpadmanager/reset",
      websocket: "scratchpadmanager/websocket",
    };

    const getVersionGroup = (): string => {
      if (
        !this.insightsVersion ||
        !isBaseVersionGreaterOrEqual(this.insightsVersion, "1.11")
      ) {
        return "pre-1.11";
      }
      if (!isBaseVersionGreaterOrEqual(this.insightsVersion, "1.14")) {
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

  /**
   * The scope a target string stands for. The names the dropdown offers are the
   * cleaned ones — no `-qe` suffix, no `:port` — so each is looked up in the
   * meta to get the name the gateway knows. An instance is left out when a DAP
   * names one already, and both are left out for an assembly on its own, which
   * is what hands the request to the resource coordinator.
   */
  public scopeForTarget(target: string): Scope {
    const [plainAssembly, tier, plainDap] =
      normalizeAssemblyTarget(target).split(/\s+/);

    const dap = this.retrieveCorrectDAPName(plainDap, tier);
    const assembly = this.retrieveCorrectAssemblyName(plainAssembly);

    // Only the keys there is something to say about: a scope carrying
    // `tier: undefined` reads as a tier that was named and not found.
    return {
      affinity: "soft",
      ...(assembly === undefined ? {} : { assembly }),
      ...(dap || !tier ? {} : { tier }),
      ...(dap === undefined ? {} : { dap }),
    };
  }

  /**
   * What a `scope` parameter is sent as. The form holds the target string the
   * dropdown wrote, and the request wants the dictionary it stands for. A value
   * that is already a dictionary is sent as it is — a file written before the
   * dropdown, or a datasource converted from one, kept working. Nothing chosen
   * is nothing to send.
   */
  public scopeValue(value: unknown): Scope | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== "string") {
      return <Scope>value;
    }
    if (!value.trim()) {
      return undefined;
    }
    const parsed = parseValue(value);
    return parsed && typeof parsed === "object"
      ? <Scope>parsed
      : this.scopeForTarget(value);
  }

  /**
   * A getData payload with its scope as the request wants it. The payload is
   * built where no connection is at hand — the query file has no idea which one
   * it will run on — so the target string it carries is resolved here.
   */
  public scopedApiPayload(
    payload: Partial<getDataBodyPayload>,
  ): Partial<getDataBodyPayload> {
    if (!(SCOPE in payload)) {
      return payload;
    }
    const { scope: _, ...rest } = payload;
    const scope = this.scopeValue(payload.scope);
    return scope === undefined ? rest : { ...rest, scope };
  }

  public generateQSqlBody(
    query: string,
    assemblyTarget: string,
    version?: string,
    options?: { agg?: string; labels?: { [key: string]: string } },
  ) {
    const scope = this.scopeForTarget(assemblyTarget);

    const extras = {
      ...(options?.agg === undefined ? {} : { agg: options.agg }),
      ...(options?.labels === undefined ? {} : { labels: options.labels }),
    };

    if (version && isBaseVersionGreaterOrEqual(version, "1.13")) {
      return { query, scope, ...extras };
    }

    // The older body names the parts rather than nesting them, and carries the
    // tier as it was given: leaving it out is what 1.13 added.
    const [, tier] = normalizeAssemblyTarget(assemblyTarget).split(/\s+/);

    return {
      query,
      assembly: scope.assembly,
      tier,
      dap: scope.dap,
      ...extras,
    };
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
    timeout?: number,
  ): Promise<GetDataObjectPayload | undefined> {
    if (this.connected) {
      const udaName = (body as UDARequestBody).name
        ? (body as UDARequestBody).name
        : "";
      if (udaName !== "") {
        // The parameters are the whole body, and parameterTypes is dropped on
        // purpose: a REST request has nowhere to put it. The gateway casts each
        // parameter using the type the UDA registered, and where a parameter
        // registers several, "auto-casting uses the first type in the list"
        // (kdb Insights, .kxi.metaParam). Sending the key would only add a
        // parameter the UDA has no argument for. runUDADataSource warns when a
        // chosen type is about to be overridden this way; the scratchpad path,
        // which does take parameterTypes, honours the choice.
        body = body.params;
      }
      if (timeout) {
        body.opts = {
          ...body.opts,
          timeout: timeout * 1000, // DAPs use milliseconds
        };
      }
      const requestUrl = this.generateDatasourceEndpoints(type, udaName);
      const options = await this.getOptions(
        false,
        getHeaders(undefined, "struct-text"),
        "POST",
        requestUrl,
        body,
      );

      if (!options) {
        return undefined;
      }

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
          return {
            error: "",
            results: response.data.payload,
          };
        })
        .catch((error: any) => {
          // Only a gateway error carries a header; when the coordinator or the
          // gateway goes away mid-query the body is plain text or an HTML error
          // page, and a dropped socket has no response at all. Reading
          // error.response.data.header on those threw a TypeError out of this
          // handler, which runDataSource logged and never showed (KXI-69283).
          const errorMsg = extractInsightsRequestError(error);
          notify(
            `Datasource execution failed: ${errorMsg}`,
            MessageKind.DEBUG,
            {
              logger,
              params: { status: error?.response?.status, error },
            },
          );
          const header = error?.response?.data?.header;
          return {
            error: header?.ai || errorMsg,
            stacktrace: header?.bt,
            arrayBuffer: undefined,
          };
        });
    }
  }

  public async importScratchpad(
    variableName: string,
    params: DataSourceFiles,
    silent?: boolean,
    token?: CancellationToken,
    timeout?: number,
  ): Promise<void> {
    if (this.connected && this.connEndpoints) {
      let coreUrl: string;
      const body: any = {
        output: variableName,
        isTableView: false,
      };
      switch (params.dataSource.selectedType) {
        case DataSourceTypes.API: {
          body.params = this.scopedApiPayload(
            params.dataSource.api.payload || {},
          );
          coreUrl = this.connEndpoints.scratchpad.import;
          break;
        }
        case DataSourceTypes.SQL: {
          body.params = { query: params.dataSource.sql.query };
          coreUrl = this.connEndpoints.scratchpad.importSql;
          break;
        }
        case DataSourceTypes.QSQL: {
          body.params = this.generateQSqlBody(
            params.dataSource.qsql.query,
            params.dataSource.qsql.selectedTarget,
            this.insightsVersion,
            {
              agg: params.dataSource.qsql.agg,
              labels: params.dataSource.qsql.labels,
            },
          );

          coreUrl = this.connEndpoints.scratchpad.importQsql;
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
        getHeaders(timeout),
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

      return await axios(options)
        .then((response: any) => {
          if (!token?.isCancellationRequested) {
            if (response.data.error) {
              notify(
                `Error occured while populating scratchpad: ${response.data.errorMsg || "Unknown error"}`,
                silent ? MessageKind.DEBUG : MessageKind.ERROR,
                {
                  logger,
                  params: {
                    status: response.status,
                    stacktrace: response.data.stacktrace,
                  },
                },
              );
            } else {
              notify(
                `Scratchpad variable (${variableName}) populated.`,
                silent ? MessageKind.DEBUG : MessageKind.INFO,
                {
                  logger,
                  params: { status: response.status },
                },
              );
            }
          }
        })
        .catch((error: any) => {
          if (!token?.isCancellationRequested) {
            const errorMsg = extractInsightsRequestError(error);
            notify(
              `Error occured while populating scratchpad: ${errorMsg}`,
              silent ? MessageKind.DEBUG : MessageKind.ERROR,
              {
                logger,
                params: { status: error?.response?.status },
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
      // The preview API runs down the same path as a UDA but is registered as a
      // system API, so the flag is not what says it is there — its presence in
      // the meta is.
      return this.meta.payload.api.some(
        (apiItem: { api: string; uda: boolean }) =>
          apiItem.api === udaName &&
          (apiItem.uda === true || apiItem.api === PREVIEW),
      );
    }

    return false;
  }

  public async getUDAScratchpadQuery(
    udaReqBody: UDARequestBody,
    timeout?: number,
  ): Promise<any | undefined> {
    if (this.connected && this.connEndpoints) {
      const isTableView = udaReqBody.returnFormat === "structuredText";
      const udaURL = new url.URL(
        this.connEndpoints.scratchpad.importUDA,
        this.node.details.server,
      );
      const options = await this.getOptions(
        true,
        getHeaders(timeout),
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
    timeout?: number,
    requestID?: string,
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
        requestID: requestID || crypto.randomUUID(),
      };

      if (this.insightsVersion) {
        if (isBaseVersionGreaterOrEqual(this.insightsVersion, "1.12")) {
          body.returnFormat = isTableView ? "structuredText" : "text";
        } else {
          body.isTableView = isTableView;
        }
      }

      const options = await this.getOptions(
        true,
        getHeaders(timeout),
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

      return await axios(options)
        .then((response: any) => {
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
              if (isTableView && !isEncodedPng(response.data.data)) {
                if (
                  this.insightsVersion &&
                  isBaseVersionGreaterOrEqual(this.insightsVersion, "1.12")
                ) {
                  response.data = JSON.parse(
                    response.data.data,
                  ) as StructuredTextResults;
                }
              }
              return response.data;
            }
            return response.data;
          }
        })
        .catch((error: any) => {
          const errorMsg = extractInsightsRequestError(error);
          notify(`Scratchpad query failed: ${errorMsg}`, MessageKind.DEBUG, {
            logger,
            params: { status: error?.response?.status },
          });
          return {
            error: true,
            errorMsg,
          } as ScratchpadResult;
        });
    } else {
      this.noConnectionOrEndpoints();
    }
    return undefined;
  }

  public async cancelScratchpad(
    isPython?: boolean,
  ): Promise<boolean | undefined> {
    if (this.connected && this.connEndpoints) {
      const scratchpadURL = new url.URL(
        this.connEndpoints.scratchpad.cancel,
        this.node.details.server,
      );
      const options = await this.getOptions(
        true,
        getHeaders(),
        "POST",
        scratchpadURL.toString(),
        undefined,
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
            `Scratchpad cancel request sent for ${this.connLabel}${isPython ? ", however, Python queries may ignore this." : "."}`,
            MessageKind.INFO,
            { logger, telemetry: "Connection.Cancel.ie.sp" },
          );
          return true;
        })
        .catch((error: any) => {
          notify(
            `Scratchpad cancel request error: ${
              error?.response?.data?.message ??
              extractInsightsRequestError(error)
            }`,
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

  public async resetScratchpad(): Promise<boolean | undefined> {
    if (this.connected && this.connEndpoints) {
      const scratchpadURL = new url.URL(
        this.connEndpoints.scratchpad.reset,
        this.node.details.server,
      );
      const options = await this.getOptions(
        true,
        getHeaders(),
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
            { logger, telemetry: "Connection.Reset.ie.sp" },
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
