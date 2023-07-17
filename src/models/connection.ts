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

import * as nodeq from "@windozer/node-q";
import { commands, window } from "vscode";
import { ext } from "../extensionVariables";
import { delay } from "../utils/core";
import { handleQueryResults } from "../utils/execution";
import { queryWrapper } from "../utils/queryUtils";
import { QueryResult, QueryResultType } from "./queryResult";

export class Connection {
  private options: nodeq.ConnectionParameters;
  private connection?: nodeq.Connection;
  public connected: boolean;

  constructor(connectionString: string, creds?: string[], tls?: boolean) {
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

    this.options = options;
    this.connected = false;
  }

  public disconnect(): void {
    if (this.connected) {
      this.connection?.close();
      this.connected = false;
    }
  }

  public async execute(command: string): Promise<string | Error> {
    let result;

    // try 5 times, then fail
    let retryCount = 0;
    while (this.connection === undefined) {
      if (retryCount > ext.maxRetryCount) {
        return "timeout";
      }
      await delay(500);
      retryCount++;
    }

    this.connection.k(command, function (err: Error, res: string) {
      if (err) throw err;
      result = res;
    });

    // wait for result (lack of await using callbacks)
    while (result === undefined || result === null) {
      await delay(500);
    }

    return result;
  }

  public async executeQuery(
    command: string,
    context?: string
  ): Promise<string> {
    let result;
    let retryCount = 0;
    while (this.connection === undefined) {
      if (retryCount > ext.maxRetryCount) {
        return "timeout";
      }
      await delay(500);
      retryCount++;
    }

    const wrapper = queryWrapper();
    this.connection.k(
      wrapper,
      context ?? ".",
      command,
      (err: Error, res: QueryResult) => {
        if (err) {
          result = handleQueryResults(err.toString(), QueryResultType.Error);
        } else if (res) {
          if (res.errored) {
            result = handleQueryResults(res.error, QueryResultType.Error);
          } else {
            result = res.result;
          }
        }
      }
    );

    while (result === undefined || result === null) {
      await delay(500);
    }

    return result;
  }

  public async executeQueryRaw(command: string): Promise<string> {
    let result;
    let retryCount = 0;
    while (this.connection === undefined) {
      if (retryCount > ext.maxRetryCount) {
        return "timeout";
      }
      await delay(500);
      retryCount++;
    }
    this.connection.k(command, (err: Error, res: string) => {
      if (err) throw err;
      result = res;
    });

    while (result === undefined || result === null) {
      await delay(500);
    }

    return result;
  }

  public connect(callback: nodeq.AsyncValueCallback<Connection>): void {
    nodeq.connect(this.options, (err, conn) => {
      if (err || !conn) {
        commands.executeCommand("setContext", "kdb.connected", false);
        ext.connectionNode = undefined;
        ext.serverProvider.reload();

        window.showErrorMessage(
          `Connection to server ${this.options.host}:${this.options.port} failed!  Details: ${err?.message}`
        );
        ext.outputChannel.appendLine(
          `Connection to server ${this.options.host}:${this.options.port} failed!  Details: ${err?.message}`
        );
        return;
      }

      conn.addListener("close", () => {
        ext.outputChannel.appendLine(
          `Connection stopped from ${this.options.host}:${this.options.port}`
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

  private updateGlobal() {
    const globalQuery =
      '{[q] t:system"T";tm:@[{$[x>0;[system"T ",string x;1b];0b]};0;{0b}];r:$[tm;@[0;(q;::);{[tm; t; msgs] if[tm;system"T ",string t];\'msgs}[tm;t]];@[q;::;{\'x}]];if[tm;system"T ",string t];r}{do[1000;2+2];{@[{.z.ide.ns.r1:x;:.z.ide.ns.r1};x;{r:y;:r}[;x]]}({:x!{![sv[`;] each x cross `Tables`Functions`Variables; system each "afv" cross enlist[" "] cross enlist string x]} each x} [{raze x,.z.s\'[{x where{@[{1#get x};x;`]~1#.q}\'[x]}` sv\'x,\'key x]}`]),(enlist `.z)!flip (`.z.Tables`.z.Functions`.z.Variables)!(enlist 0#`;enlist `ac`bm`exit`pc`pd`pg`ph`pi`pm`po`pp`ps`pw`vs`ts`s`wc`wo`ws;enlist `a`b`e`f`h`i`k`K`l`o`q`u`w`W`x`X`n`N`p`P`z`Z`t`T`d`D`c`zd)}';
    this.connection?.k(globalQuery, (err, result) => {
      if (err) {
        window.showErrorMessage(
          `Failed to retrieve kdb+ global variables: '${err.message}`
        );
        return;
      }

      this.updateGlobals(result);
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private updateGlobals(result: any): void {
    const globals = result;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entries: [string, any][] = Object.entries(globals);

    entries.forEach(([key, value]) => {
      key = key === "null" ? "." : key + ".";

      const f = value[key + "Functions"];
      const t = value[key + "Tables"];
      let v = value[key + "Variables"];

      key = key === "." || key === ".q." ? "" : key;

      if (f instanceof Array) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        f.forEach((obj: any) => ext.functions.push(`${key}${obj}`));
      }

      if (t instanceof Array) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        t.forEach((obj: any) => ext.tables.push(`${key}${obj}`));
      }

      if (v instanceof Array) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        v = v.filter((x: any) => !t.includes(x));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        v.forEach((obj: any) => ext.variables.push(`${key}${obj}`));
      }
    });
  }

  private updateReservedKeywords() {
    const reservedQuery = ".Q.res";
    this.connection?.k(reservedQuery, (err, result) => {
      if (err) {
        window.showErrorMessage(
          `Failed to retrieve kdb+ reserved keywords: '${err.message}`
        );
        return;
      }

      ext.keywords = result;
    });
  }

  private onConnect(
    err: Error | undefined,
    conn: nodeq.Connection,
    callback: nodeq.AsyncValueCallback<Connection>
  ): void {
    this.connected = true;
    this.connection = conn;

    this.updateGlobal();
    this.updateReservedKeywords();

    callback(err, this);
  }
}
