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

import { readFileSync } from "fs-extra";
import * as nodeq from "node-q";
import { join } from "path";
import { commands } from "vscode";

import { ext } from "../extensionVariables";
import { RowLimit } from "../models/notebook";
import {
  QueryResult,
  QueryResultType,
  withErrorPrefix,
} from "../models/queryResult";
import { ServerObject } from "../models/serverObject";
import { handleQueryResults } from "../utils/execution";
import { kdbOutputLog } from "../utils/loggers";
import { MessageKind, notify } from "../utils/notifications";
import { appendStacktrace, queryWrapper } from "../utils/queryUtils";

const logger = "localConnection";

export class LocalConnection {
  public connected: boolean;
  public connLabel: string;
  public labels: string[];

  // When useAPI is false, the remote q process supports running any arbitrary q string.
  // When useAPI is true, the remote q process only supports calls to named functions,
  // and the extension can only rely on calling those functions predefined in the vscode.q library
  public useAPI: boolean;
  private options: nodeq.ConnectionParameters;
  private connection?: nodeq.Connection;

  constructor(
    connectionString: string,
    connLabel: string,
    labels: string[],
    creds?: string[],
    tls?: boolean,
  ) {
    const params = connectionString.split(":");
    if (!params) {
      throw new Error("Missing or invalid connection string");
    }

    const options: nodeq.ConnectionParameters = {
      nanos2date: false,
      socketNoDelay: true,
    };

    if (tls != undefined) {
      options.useTLS = tls;
    } else {
      options.useTLS = false;
    }

    if (params.length > 0) {
      options.host = params[0];
    }
    if (params.length > 1) {
      options.port = +params[1];
    }

    if (creds != undefined) {
      options.user = creds[0];
      options.password = creds[1];
    }

    this.connLabel = connLabel;
    this.labels = labels;
    this.options = options;
    this.connected = false;
    this.useAPI = false;
  }

  public getConnection(): nodeq.Connection | undefined {
    return this.connection;
  }

  public async connect() {
    const options = await this.getCustomAuthOptions();
    return new Promise<nodeq.Connection>((resolve, reject) => {
      nodeq.connect(options, (err, conn) => {
        if (err || !conn) {
          ext.serverProvider.reload();
          this.connection = undefined;
          this.connected = false;
          return reject(err);
        }

        conn.addListener("close", () => {
          commands.executeCommand("kdb.connections.disconnect", this.connLabel);
          notify(
            `Connection closed: ${this.options.host}:${this.options.port}`,
            MessageKind.DEBUG,
            { logger },
          );
        });

        this.connection = conn;
        this.connected = true;

        // Set useAPI to true if connecting a process with .vscode defined, so the functions
        // in that namespace will be used instead of sending the functions with each request.
        this.connection?.k(".vscode.getManifest", null, (err) => {
          this.useAPI = !err;
          this.update();
          notify(
            (this.useAPI
              ? ".vscode namespace found, using functions"
              : ".vscode namespace not found, using lambdas") +
              ` on ${this.connLabel}`,
            MessageKind.DEBUG,
            {
              logger,
            },
          );
          resolve(conn);
        });
      });
    });
  }

  public disconnect(): void {
    if (this.connected) {
      this.connection?.close();
      this.connection = undefined;
      this.connected = false;
    }
  }

  public async setActive() {
    // noop
  }

  public setInactive() {
    // noop
  }

  public update(): void {
    this.updateGlobal();
  }

  public async executeQuery(
    command: string,
    context?: string,
    stringify?: boolean,
    isPython?: boolean,
    rowLimit?: RowLimit,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.connection) {
        return reject(new Error("Not connected."));
      }

      const wrapper = queryWrapper(!!isPython, this.useAPI);

      // Only notebooks send rowLimit. formatQ.q and evaluatePy.q pick these
      // rows before their TABULAR_LIMIT cut, so the last rows are the last of
      // the whole result. A vscode.q loaded on a secure process before this
      // key existed ignores it.
      const limitArgs = rowLimit && {
        rowLimit: { size: rowLimit.limit, from: rowLimit.from },
      };

      // Different objects are needed because of the difference between snake_case and camelCase
      // for sampleFn/sampleSize and sample_fn/sample_size
      const args = isPython
        ? {
            code: command,
            returnFormat: stringify ? "text" : "structuredText",
            sample_fn: "first",
            sample_size: 10000,
            ...limitArgs,
          }
        : {
            ctx: context ?? ".",
            code: command,
            returnFormat: stringify ? "text" : "structuredText",
            sampleFn: null,
            sampleSize: null,
            ...limitArgs,
          };

      this.connection.k(wrapper, args, (err: Error, res: QueryResult) => {
        if (err) {
          resolve(
            handleQueryResults(
              withErrorPrefix(err.message),
              QueryResultType.Error,
            ),
          );
        } else if (!isQueryResponse(res)) {
          // A custom .z.pg, or a gateway that wraps every result, can answer
          // with something other than the dictionary the wrapper builds.
          resolve(unreadableResponse());
        } else if (res.error) {
          resolve(
            handleQueryResults(
              appendStacktrace(
                withErrorPrefix(`${res.errorMsg}`),
                res.stacktrace,
              ),
              QueryResultType.Error,
            ),
          );
        } else {
          const result = res.data === null ? "" : res.data;
          // The Array.isArray check handles the case where the response is a serialized PNG,
          // rather than the requested format, as the back end disregards the return format
          // if the result of the expression is a byte array starting with the PNG signature 0x89504e470d0a1a0a
          if (stringify || Array.isArray(result)) {
            resolve(result);
          } else {
            try {
              resolve(JSON.parse(result));
            } catch {
              // An envelope that reuses the wrapper's key names passes
              // isQueryResponse with data that is not structured text.
              resolve(unreadableResponse());
            }
          }
        }
        this.updateGlobal();
      });
    });
  }

  public async executeQueryRaw(code: string, args: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.connection) {
        return reject(new Error("Not connected."));
      }

      this.connection.k(code, ...args, (err: Error, res: any) => {
        if (err) reject(err);
        else resolve(res || "");
      });
    });
  }

  public async loadServerObjects(): Promise<ServerObject[]> {
    if (!this.connection) {
      notify(
        "Please connect to a KDB instance to view the objects",
        MessageKind.INFO,
      );
      return new Array<ServerObject>();
    }

    let code;

    if (this.useAPI) {
      code = ".vscode.listMem";
    } else {
      const script = readFileSync(
        ext.context.asAbsolutePath(join("resources", "q", "listMem.q")),
      ).toString();
      // TODO why is this newline added?
      code = "\n" + script;
    }

    const result = await this.executeQueryRaw(code, [null]);

    if (!Array.isArray(result)) {
      kdbOutputLog(
        `[${logger}] Server object query returned ${typeof result}, expected a table; no objects will be listed.`,
        "WARNING",
        true,
      );
      return new Array<ServerObject>();
    }

    return (result as ServerObject[]).filter(
      (item) => ext.qNamespaceFilters.indexOf(item.name) === -1,
    );
  }

  private updateGlobal() {
    const globalQuery = this.useAPI
      ? ".vscode.listMem"
      : readFileSync(
          ext.context.asAbsolutePath(join("resources", "q", "listMem.q")),
        ).toString();

    this.connection?.k(globalQuery, null, (err, result) => {
      if (err) {
        notify("Failed to retrieve kdb+ global variables.", MessageKind.ERROR, {
          logger,
          params: err,
        });
        return;
      }

      this.updateGlobals(result);
    });
  }

  private updateGlobals(globals: unknown): void {
    ext.functions.length = 0;
    ext.tables.length = 0;
    ext.variables.length = 0;

    if (!Array.isArray(globals)) {
      notify(
        "Global variable query did not return a table, completions will be empty.",
        MessageKind.DEBUG,
        { logger },
      );
      return;
    }

    (
      globals as {
        id: number;
        pid: number;
        name: string;
        fname: string;
        typeNum: number;
        namespace: string;
        context: string;
        isNs: number;
      }[]
    ).forEach(({ fname, typeNum, name, namespace, isNs }) => {
      if (!isNs && namespace !== ".vscode") {
        const fullName = namespace === ".q" ? name : fname;

        if (typeNum === 100) {
          ext.functions.push(fullName);
        } else if (typeNum === 98 || typeNum === 99) {
          ext.tables.push(fullName);
        } else if (typeNum < 98) {
          ext.variables.push(fullName);
        }
      }
    });
  }

  async getCustomAuthOptions(): Promise<nodeq.ConnectionParameters> {
    if (ext.customAuth) {
      const { kdb } = await ext.customAuth.auth({
        name: this.connLabel,
        labels: this.labels,
        kdb: {
          host: this.options.host,
          port: this.options.port,
          user: this.options.user,
          password: this.options.password,
          unixSocket: this.options.unixSocket,
          socketTimeout: this.options.socketTimeout,
          socketNoDelay: this.options.socketNoDelay,
        },
      });
      if (kdb) {
        return { ...this.options, ...kdb };
      }
    }
    return this.options;
  }
}

// What the query wrappers (evaluateQ.q/formatQ.q, evaluatePy.q) answer with: a
// dictionary carrying data, error and errorMsg. A failure has a message; a
// success has text, a byte list (a PNG) or nothing as its data. A gateway's own
// envelope can reuse those key names, so the values are checked too.
function isQueryResponse(res: unknown): res is QueryResult {
  if (typeof res !== "object" || res === null) {
    return false;
  }
  const { data, error, errorMsg } = res as Record<string, unknown>;
  if (error === true) {
    return typeof errorMsg === "string";
  }
  return (
    error === false &&
    (data === null || typeof data === "string" || Array.isArray(data))
  );
}

function unreadableResponse() {
  return handleQueryResults(
    withErrorPrefix(
      "The process returned a response the extension could not read. A custom .z.pg handler or a gateway may be changing query results.",
    ),
    QueryResultType.Error,
  );
}
