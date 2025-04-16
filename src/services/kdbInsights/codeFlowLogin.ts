/*
 * Copyright (c) 1998-2025 Kx Systems Inc.
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
import * as fs from "fs-extra";
import * as http from "http";
import { join } from "path";
import * as querystring from "querystring";
import * as url from "url";
import { ext } from "../../extensionVariables";
import { Uri, env } from "vscode";
import { pickPort } from "pick-port";
import https from "https";

interface IDeferred<T> {
  resolve: (result: T | Promise<T>) => void;

  reject: (reason: any) => void;
}

function getAuthUrl(insightsUrl: string, realm: string) {
  return new url.URL(
    `auth/realms/${realm}/protocol/openid-connect/auth`,
    insightsUrl,
  );
}

function getTokenUrl(insightsUrl: string, realm: string) {
  return new url.URL(
    `auth/realms/${realm}/protocol/openid-connect/token`,
    insightsUrl,
  );
}

function getRevokeUrl(insightsUrl: string, realm: string) {
  return new url.URL(
    `auth/realms/${realm}/protocol/openid-connect/revoke`,
    insightsUrl,
  );
}

export interface IToken {
  accessToken: string;
  accessTokenExpirationDate: Date;
  refreshToken: string;
}

export function getHttpsAgent(insecure: boolean | undefined) {
  return new https.Agent({ rejectUnauthorized: !insecure });
}

const defaultTimeout = 3 * 60 * 1000; // 3 min
const closeTimeout = 10 * 1000; // 10 sec

const commonRequestParams = {
  client_id: "insights-app",
};

export async function signIn(
  insightsUrl: string,
  realm: string,
  insecure: boolean,
) {
  const { server, codePromise } = createServer();

  try {
    const port = await startServer(server);

    const authParams = {
      response_type: "code",
      scope: "profile",
      redirect_uri: `http://localhost:${port}/redirect`,
      state: crypto.randomBytes(20).toString("hex"),
    };

    const authorizationUrl = getAuthUrl(insightsUrl, realm);

    authorizationUrl.search = queryString(authParams);

    await env.openExternal(Uri.parse(authorizationUrl.toString()));

    const code = await codePromise;
    return await getToken(insightsUrl, realm, insecure, code);
  } finally {
    setImmediate(() => server.close());
  }
}

export async function signOut(
  insightsUrl: string,
  realm: string,
  insecure: boolean,
  token: string,
): Promise<void> {
  const queryParams = queryString({
    grant_type: ext.insightsGrantType.authorizationCode,
    token,
  });
  const body = {
    body: queryParams,
  };
  const headers: AxiosRequestConfig = {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    httpsAgent: getHttpsAgent(insecure),
  };
  const requestUrl = getRevokeUrl(insightsUrl, realm);

  await axios.post(requestUrl.toString(), body, headers).then((res) => {
    return res.data;
  });
}

export async function refreshToken(
  insightsUrl: string,
  realm: string,
  insecure: boolean,
  token: string,
): Promise<IToken | undefined> {
  return await tokenRequest(insightsUrl, realm, insecure, {
    grant_type: ext.insightsGrantType.refreshToken,
    refresh_token: token,
  });
}

/* istanbul ignore next */
export async function getCurrentToken(
  serverName: string,
  serverAlias: string,
  realm: string,
  insecure: boolean,
): Promise<IToken | undefined> {
  if (serverName === "" || serverAlias === "") {
    return undefined;
  }

  let token: IToken | undefined;
  const existingToken = await ext.context.secrets.get(serverAlias);

  if (existingToken !== undefined) {
    const storedToken: IToken = JSON.parse(existingToken);
    if (new Date(storedToken.accessTokenExpirationDate) < new Date()) {
      token = await refreshToken(
        serverName,
        realm,
        insecure,
        storedToken.refreshToken,
      );
      if (token === undefined) {
        token = await signIn(serverName, realm, insecure);
        ext.context.secrets.store(serverAlias, JSON.stringify(token));
      }
      ext.context.secrets.store(serverAlias, JSON.stringify(token));
      return token;
    } else {
      return storedToken;
    }
  } else {
    token = await signIn(serverName, realm, insecure);
    ext.context.secrets.store(serverAlias, JSON.stringify(token));
  }
  return token;
}

/* istanbul ignore next */
async function getToken(
  insightsUrl: string,
  realm: string,
  insecure: boolean,
  code: string,
): Promise<IToken | undefined> {
  return await tokenRequest(insightsUrl, realm, insecure, {
    code,
    grant_type: ext.insightsGrantType.authorizationCode,
  });
}

async function tokenRequest(
  insightsUrl: string,
  realm: string,
  insecure: boolean,
  params: any,
): Promise<IToken | undefined> {
  const queryParams = queryString(params);
  const headers: AxiosRequestConfig = {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    timeout: closeTimeout,
    signal: AbortSignal.timeout(closeTimeout),
    httpsAgent: getHttpsAgent(insecure),
  };

  const requestUrl = getTokenUrl(insightsUrl, realm);

  let response;
  if (params.grant_type === "refresh_token") {
    try {
      response = await axios.post(requestUrl.toString(), queryParams, headers);
    } catch {
      return undefined;
    }
  } else {
    response = await axios.post(requestUrl.toString(), queryParams, headers);
  }

  const result = response.data;
  const expirationDate = new Date();

  if (Number.isInteger(result.expires_in)) {
    expirationDate.setSeconds(expirationDate.getSeconds() + result.expires_in);
  }

  return {
    accessToken: result.access_token,
    accessTokenExpirationDate: expirationDate,
    refreshToken: result.refresh_token,
  };
}

function queryString(options: any): string {
  return querystring
    .stringify(Object.assign(commonRequestParams, options))
    .replace(/%2B/g, "+");
}

function createServer() {
  let deferredCode: IDeferred<string>;
  const codePromise = new Promise<string>(
    (resolve, reject) => (deferredCode = { resolve, reject }),
  );
  const codeTimer = setTimeout(
    () => deferredCode.reject(new Error("Timeout waiting for code.")),
    defaultTimeout,
  );
  const cancelCodeTimer = () => clearTimeout(codeTimer);

  const server = http.createServer((req, res) => {
    const reqUrl = new url.URL(
      req.url!,
      `${ext.networkProtocols.http}${ext.localhost}`,
    );
    switch (reqUrl.pathname) {
      case "/": {
        sendFile(
          res,
          join(
            ext.context.asAbsolutePath("resources"),
            "codeFlowResult",
            "index.html",
          ),
          "text/html; charset=utf-8",
        );
        break;
      }
      case "/redirect": {
        const error =
          reqUrl.searchParams.get("error_description") ||
          reqUrl.searchParams.get("error");
        const code = reqUrl.searchParams.get("code");

        if (!error && code) {
          deferredCode.resolve(code);
          res.writeHead(302, { Location: "/" });
        } else {
          const err = new Error(error || "No code received.");
          deferredCode.reject(err);
          res.writeHead(302, {
            Location: `/?error=${querystring.escape(err.message)}`,
          });
        }

        res.end();
        break;
      }
      case "/main.css": {
        sendFile(
          res,
          join(
            ext.context.asAbsolutePath("resources"),
            "codeFlowResult",
            "main.css",
          ),
          "text/css; charset=utf-8",
        );
        break;
      }
      default: {
        res.writeHead(404);
        res.end();
        break;
      }
    }
  });

  codePromise.then(cancelCodeTimer, cancelCodeTimer);

  return {
    codePromise,
    server,
  };
}

function startServer(server: http.Server): Promise<number> {
  return new Promise((resolve, reject) => {
    let deferredCode: IDeferred<number>;
    const portPromise = new Promise<number>(
      (resolve, reject) => (deferredCode = { resolve, reject }),
    );
    const portTimer = setTimeout(
      () => deferredCode.reject(new Error("Timeout waiting for port")),
      closeTimeout,
    );
    const cancelPortTimer = () => clearTimeout(portTimer);

    pickPort({
      ip: "127.0.0.1",
      type: "tcp",
      minPort: 9000,
      maxPort: 9999,
    })
      .then((port) => {
        server.on("listening", () => deferredCode.resolve(port));
        server.on("error", (error) => deferredCode.reject(error));
        server.on("close", () => deferredCode.reject(new Error("Closed")));
        server.listen(port, ext.localhost);
        portPromise.then(cancelPortTimer, cancelPortTimer);
        env
          .asExternalUri(Uri.parse(`http://localhost:${port}`))
          .then(() => resolve(portPromise));
      })
      .catch(reject);
  });
}

function sendFile(
  res: http.ServerResponse,
  filePath: string,
  contentType: string,
) {
  fs.readFile(filePath, (_err: any, _body: any) => {
    if (!_err) {
      res.writeHead(200, {
        "Content-Length": _body.length,
        "Content-Type": contentType,
      });
      res.end(_body);
    }
  });
}
