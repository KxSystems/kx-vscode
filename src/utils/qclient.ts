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

import nodeq from "node-q";
import { commands } from "vscode";

export interface QResponse {
  result: any;
  type: number;
}

export class QClient {
  private con: nodeq.Connection | undefined;

  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly useTLS?: boolean,
    private readonly user?: string,
    private readonly password?: string,
  ) {}

  async connect() {
    this.con = await new Promise<nodeq.Connection>((resolve, reject) => {
      nodeq.connect(
        {
          host: this.host,
          port: this.port,
          useTLS: this.useTLS,
          user: this.user,
          password: this.password,
        },
        (err, con) => {
          if (err) {
            reject(err);
          } else if (con) {
            resolve(con);
          } else {
            reject(new Error("Not connected"));
          }
        },
      );
    });
  }

  execute(script: string) {
    return new Promise<QResponse>((resolve, reject) => {
      if (this.con) {
        this.con.k(script, (err, res) => {
          if (err) {
            reject(err);
          } else {
            resolve(res);
          }
        });
      } else {
        reject(new Error("Not connected"));
      }
    });
  }

  disconnect() {
    return new Promise<void>((resolve, reject) => {
      if (this.con) {
        this.con.close(() => resolve());
      } else {
        reject(new Error("Not connected"));
      }
    });
  }
}

export function wrapExpressions(expressions: string[]) {
  return `{[script]result:eval parse script;kind:type[result];(\`result\`kind\`meta)!(result;kind;$[kind=98h;meta[result];kind])}["${expressions.join("")}"]`;
}
