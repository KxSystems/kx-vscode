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
import http from "http";
import { pickPort } from "pick-port";
import { Uri, env } from "vscode";
import { randomBytes } from "crypto";
import { URLSearchParams } from "url";
import axios from "axios";
import querystring from "querystring";

export interface QResponse {
  result: any;
  kind: number;
  meta: any;
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

export function wrapExpressions(expressions: string[], serialize = false) {
  return `{[script]result:eval parse script;kind:type[result];response:(\`result\`kind\`meta)!(result;kind;$[kind=98h;meta[result];kind]);${serialize ? ".j.j[response]" : "response"}}["${expressions.join("")}"]`;
}

export class InsightsClient {
  private declare access_token: string;
  private declare refresh_token: string;

  constructor(private readonly server: string) {}

  get isConnected() {
    return !!this.refresh_token;
  }

  login() {
    return new Promise<void>((resolve, reject) => {
      pickPort({
        ip: "127.0.0.1",
        type: "tcp",
        minPort: 9000,
        maxPort: 9999,
      })
        .then((port) => {
          const hostname = "localhost";
          const state = randomBytes(20).toString("hex");

          const server = http.createServer((req, res) => {
            res.setHeader("Content-Type", "text/plain");

            if (req.url) {
              const params = new URLSearchParams(
                req.url.replace("/redirect?", ""),
              );
              if (params.get("state") === state) {
                const code = params.get("code");
                if (code) {
                  axios
                    .post(
                      `${this.server}auth/realms/insights/protocol/openid-connect/token/`,
                      querystring.stringify({
                        code,
                        state,
                        scope: "profile",
                        response_type: "code",
                        client_id: "insights-app",
                        grant_type: "authorization_code",
                        redirect_uri: `http://${hostname}:${port}/redirect`,
                      }),
                      {
                        headers: {
                          "Content-Type": "application/x-www-form-urlencoded",
                        },
                      },
                    )
                    .then((response) => {
                      this.access_token = response.data?.access_token;
                      this.refresh_token = response.data?.refresh_token;
                      res.end(this.access_token);
                      resolve();
                    })
                    .catch((err) => {
                      res.end(`${err}`);
                      reject(err);
                    });
                }
              }
            }
          });

          setTimeout(() => {
            server.close();
            reject(new Error("Timeout"));
          }, 30 * 1000);

          server.listen(port, hostname, () => {
            const uri = `${this.server}auth/realms/insights/protocol/openid-connect/auth?client_id=insights-app&response_type=code&scope=profile&redirect_uri=http://${hostname}:${port}/redirect&state=${state}`;
            env.openExternal(Uri.parse(uri));
          });
        })
        .catch(reject);
    });
  }

  async execute(script: string): Promise<QResponse> {
    const response = await axios.post(
      `${this.server}servicebroker/scratchpad/display`,
      {
        expression: script,
        language: "q",
      },
      {
        headers: {
          Authorization: `Bearer ${this.access_token}`,
          Username: "kxi-user",
          "Content-Type": "application/json",
        },
      },
    );

    if (response.data.error) {
      throw new Error(response.data.errorMsg);
    }

    return JSON.parse(JSON.parse(response.data.data));
  }
}
