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
import { CancellationError, CancellationToken, Uri, env } from "vscode";
import { randomBytes } from "crypto";
import { URLSearchParams } from "url";
import axios, { Cancel, CancelToken } from "axios";
import url from "url";
import querystring from "querystring";
import { jwtDecode } from "jwt-decode";

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
  private declare access_token?: string;
  private declare refresh_token?: string;
  private declare access_token_exp?: Date;
  private declare refresh_token_exp?: Date;
  private declare username?: string;

  constructor(private readonly server: string) {}

  get isConnected() {
    return (
      this.access_token_exp &&
      this.access_token_exp.getTime() - 10 * 1000 > Date.now()
    );
  }

  login(token: CancellationToken) {
    const controller = toController(token);

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
                      `${getTokenUrl(this.server)}`,
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
                        signal: controller.signal,
                      },
                    )
                    .then((response) => {
                      this.access_token = response.data?.access_token;
                      this.refresh_token = response.data?.refresh_token;

                      if (this.refresh_token) {
                        let decoded = jwtDecode(this.refresh_token);
                        if (decoded.exp) {
                          this.refresh_token_exp = new Date(decoded.exp * 1000);
                        }
                        if (this.access_token) {
                          decoded = jwtDecode(this.access_token);
                          if (decoded.exp) {
                            this.access_token_exp = new Date(
                              decoded.exp * 1000,
                            );
                          }
                          if ("preferred_username" in decoded) {
                            this.username =
                              decoded.preferred_username as string;
                          }
                          res.end(JSON.stringify(decoded, null, 2));
                          resolve();
                          return;
                        }
                      }
                      reject(new Error("No tokens"));
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
            reject(new CancellationError());
          }, 30 * 1000);

          controller.signal.addEventListener("abort", () => {
            server.close();
            reject(new CancellationError());
          });

          server.listen(port, hostname, () => {
            const uri = `${getAuthUrl(this.server)}?client_id=insights-app&response_type=code&scope=profile&redirect_uri=http://${hostname}:${port}/redirect&state=${state}`;
            env.openExternal(Uri.parse(uri));
          });
        })
        .catch(reject);
    });
  }

  execute(script: string, token: CancellationToken) {
    const controller = toController(token);

    return new Promise<QResponse>((resolve, reject) => {
      axios
        .post(
          `${this.server}servicebroker/scratchpad/display`,
          {
            expression: script,
            language: "q",
            context: ".",
          },
          {
            headers: {
              Authorization: `Bearer ${this.access_token}`,
              Username: this.username,
            },
            signal: controller.signal,
          },
        )
        .then((response) => {
          if (response.data.error) {
            reject(
              new Error(`${response.data.errorMsg || response.data.error}`),
            );
          } else {
            if (response.data.data) {
              try {
                resolve(JSON.parse(JSON.parse(response.data.data)));
              } catch (error) {
                reject(error);
              }
            } else {
              reject(new Error("No data"));
            }
          }
        })
        .catch(reject);
    });
  }

  async executeData(token: CancellationToken) {
    const controller = toController(token);

    const response = await axios.post(
      `${this.server}/servicegateway/data`,
      {
        table: "trips",
        startTS: "2023-12-06T00:00:00.000000000",
        endTS: "2023-12-11T00:00:00.000000000",
      },
      {
        headers: {
          Authorization: `Bearer ${this.access_token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      },
    );
    console.log(response);
    return response;
  }

  async meta(token: CancellationToken) {
    const controller = toController(token);

    const response = await axios.post(
      `${this.server}/servicegateway/meta`,
      {},
      {
        headers: {
          Authorization: `Bearer ${this.access_token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      },
    );
    console.log(response);
    return response;
  }
}

function getRealm(insightsUrl: string) {
  const server = new url.URL(insightsUrl);
  const realm = server.hostname.replace(/\.ft[0-9]+\.cld\.kx\.com$/, "");
  if (realm && realm !== server.hostname) {
    return `-${realm}`;
  }
  return "";
}

function getAuthUrl(insightsUrl: string) {
  return new url.URL(
    `auth/realms/insights${getRealm(insightsUrl)}/protocol/openid-connect/auth`,
    insightsUrl,
  );
}

function getTokenUrl(insightsUrl: string) {
  return new url.URL(
    `auth/realms/insights${getRealm(insightsUrl)}/protocol/openid-connect/token`,
    insightsUrl,
  );
}

function getRevokeUrl(insightsUrl: string) {
  return new url.URL(
    `auth/realms/insights${getRealm(insightsUrl)}/protocol/openid-connect/revoke`,
    insightsUrl,
  );
}

function toController(token: CancellationToken): AbortController {
  const controller = new AbortController();

  token.onCancellationRequested(() => {
    controller.abort();
  });

  if (token.isCancellationRequested) {
    controller.abort();
  }

  return controller;
}
