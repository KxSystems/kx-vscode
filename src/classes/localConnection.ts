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
/* istanbul ignore file */

import * as nodeq from "node-q";
import { window } from "vscode";
import { ext } from "../extensionVariables";
import { delay } from "../utils/core";
import { convertStringToArray, handleQueryResults } from "../utils/execution";
import { queryWrapper } from "../utils/queryUtils";
import { QueryResult, QueryResultType } from "../models/queryResult";

export class LocalConnection {
  public connected: boolean;
  public connLabel: string;
  private options: nodeq.ConnectionParameters;
  private connection?: nodeq.Connection;
  private isError: boolean = false;
  private result?: string;

  constructor(
    connectionString: string,
    connLabel: string,
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
    this.options = options;
    this.connected = false;
  }

  public getConnection(): nodeq.Connection | undefined {
    return this.connection;
  }

  public connect(callback: nodeq.AsyncValueCallback<LocalConnection>): void {
    nodeq.connect(this.options, (err, conn) => {
      if (err || !conn) {
        ext.serverProvider.reload();

        window.showErrorMessage(
          `Connection to server ${this.options.host}:${this.options.port} failed!  Details: ${err?.message}`,
        );
        ext.outputChannel.appendLine(
          `Connection to server ${this.options.host}:${this.options.port} failed!  Details: ${err?.message}`,
        );
        return;
      }
      conn.addListener("close", () => {
        ext.outputChannel.appendLine(
          `Connection stopped from ${this.options.host}:${this.options.port}`,
        );
        this.connected = false;
      });

      if (this.connection && this.connected) {
        this.connection.close(() => {
          this.onConnect(err, conn, callback);
        });
      } else {
        this.onConnect(err, conn, callback);
      }
    });
  }

  public disconnect(): void {
    if (this.connected) {
      this.connection?.close();
      this.connected = false;
    }
  }

  public update(): void {
    this.updateGlobal();
    this.updateReservedKeywords();
  }

  public async execute(query: string): Promise<string | Error> {
    let result;
    let error;
    // try 5 times, then fail
    let retryCount = 0;
    while (this.connection === undefined) {
      if (retryCount > ext.maxRetryCount) {
        return "timeout";
      }
      await delay(500);
      retryCount++;
    }

    this.connection.k(query, function (err: Error, res: string) {
      if (err) {
        error = err;
        result = "";
        return;
      }
      result = res;
    });

    // wait for result (lack of await using callbacks)
    while (result === undefined || result === null) {
      await delay(500);
    }

    if (error) {
      throw error;
    }

    return result;
  }

  public async executeQuery(
    command: string,
    context?: string,
    stringify?: boolean,
  ): Promise<any> {
    await this.waitForConnection();

    if (!this.connection) {
      return "timeout";
    }
    const wrapper = queryWrapper();
    this.connection.k(
      wrapper,
      context ?? ".",
      command,
      !!stringify,
      (err: Error, res: QueryResult) => {
        if (err) {
          this.isError = true;
          this.result = handleQueryResults(
            err.toString(),
            QueryResultType.Error,
          );
        }
        if (res) {
          this.handleQueryResult(res);
        }
      },
    );

    const result = await this.waitForResult();

    if (ext.resultsViewProvider.isVisible() && stringify) {
      if (this.isError) {
        this.isError = false;
        return result;
      }
      return convertStringToArray(result);
    }

    return result;
  }

  public async executeQueryRaw(command: string): Promise<string> {
    let result;
    let retryCount = 0;
    let error;
    while (this.connection === undefined) {
      if (retryCount > ext.maxRetryCount) {
        return "timeout";
      }
      await delay(500);
      retryCount++;
    }
    this.connection.k(command, (err: Error, res: string) => {
      if (err) {
        error = err;
        result = "";
        return;
      }
      result = res;
    });

    while (result === undefined || result === null) {
      await delay(500);
    }

    if (error) {
      throw error;
    }

    return result;
  }

  private async waitForConnection(): Promise<void> {
    let retryCount = 0;
    while (this.connection === undefined) {
      if (retryCount > ext.maxRetryCount) {
        throw new Error("timeout");
      }
      await delay(500);
      retryCount++;
    }
  }

  private handleQueryResult(res: QueryResult): void {
    if (res.errored) {
      this.isError = true;
      this.result = handleQueryResults(
        res.error + (res.backtrace ? "\n" + res.backtrace : ""),
        QueryResultType.Error,
      );
    } else {
      this.result = res.result;
    }
  }

  private async waitForResult(): Promise<any> {
    while (this.result === undefined || this.result === null) {
      await delay(500);
    }
    const result = this.result;
    this.result = undefined;
    return result;
  }

  private updateGlobal() {
    const globalQuery =
      '{[q] t:system"T";tm:@[{$[x>0;[system"T ",string x;1b];0b]};0;{0b}];r:$[tm;@[0;(q;::);{[tm; t; msgs] if[tm;system"T ",string t];\'msgs}[tm;t]];@[q;::;{\'x}]];if[tm;system"T ",string t];r}{do[1000;2+2];{@[{.z.ide.ns.r1:x;:.z.ide.ns.r1};x;{r:y;:r}[;x]]}({:x!{![sv[`;] each x cross `Tables`Functions`Variables; system each "afv" cross enlist[" "] cross enlist string x]} each x} [{raze x,.z.s\'[{x where{@[{1#get x};x;`]~1#.q}\'[x]}` sv\'x,\'key x]}`]),(enlist `.z)!flip (`.z.Tables`.z.Functions`.z.Variables)!(enlist 0#`;enlist `ac`bm`exit`pc`pd`pg`ph`pi`pm`po`pp`ps`pw`vs`ts`s`wc`wo`ws;enlist `a`b`e`f`h`i`k`K`l`o`q`u`w`W`x`X`n`N`p`P`z`Z`t`T`d`D`c`zd)}';
    this.connection?.k(globalQuery, (err, result) => {
      if (err) {
        window.showErrorMessage(
          `Failed to retrieve kdb+ global variables: '${err.message}`,
        );
        return;
      }

      this.updateGlobals(result);
    });
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  private updateGlobals(result: any): void {
    const globals = result;
    const entries: [string, any][] = Object.entries(globals);

    ext.functions.length = 0;
    ext.tables.length = 0;
    ext.variables.length = 0;

    entries.forEach(([key, value]) => {
      key = key === "null" ? "." : key + ".";
      const f = value[key + "Functions"];
      const t = value[key + "Tables"];
      let v = value[key + "Variables"];
      key = key === "." || key === ".q." ? "" : key;

      if (f instanceof Array) {
        f.forEach((obj: any) => ext.functions.push(`${key}${obj}`));
      }

      if (t instanceof Array) {
        t.forEach((obj: any) => ext.tables.push(`${key}${obj}`));
      }

      if (v instanceof Array) {
        v = v.filter((x: any) => !t.includes(x));
        v.forEach((obj: any) => ext.variables.push(`${key}${obj}`));
      }
    });
  }
  /* eslint-disable */

  private updateReservedKeywords() {
    const reservedQuery = ".Q.res";
    this.connection?.k(reservedQuery, (err, result) => {
      if (err) {
        window.showErrorMessage(
          `Failed to retrieve kdb+ reserved keywords: '${err.message}`,
        );
        return;
      }

      ext.keywords = result;
    });
  }

  private onConnect(
    err: Error | undefined,
    conn: nodeq.Connection,
    callback: nodeq.AsyncValueCallback<LocalConnection>,
  ): void {
    this.connected = true;
    this.connection = conn;

    this.update();
    callback(err, this);
  }
}
