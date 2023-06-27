import * as crypto from "crypto";
import * as fs from "fs-extra";
import * as http from "http";
import open from "open";
import { join } from "path";
import * as querystring from "querystring";
import * as requestPromise from "request-promise";
import * as url from "url";
import { ext } from "../../extensionVariables";

interface IDeferred<T> {
  resolve: (result: T | Promise<T>) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reject: (reason: any) => void;
}

export interface IToken {
  accessToken: string;
  accessTokenExpirationDate: Date;
  refreshToken: string;
}

const defaultTimeout = 5 * 60 * 1000; // 5 min
const closeTimeout = 10 * 1000; // 10 sec

const commonRequestParams = {
  client_id: "insights-app",
  redirect_uri: ext.insightsAuthUrls.callbackURL,
};

export async function signIn(insightsUrl: string) {
  const { server, codePromise } = createServer();

  try {
    await startServer(server);

    const authParams = {
      response_type: "code",
      scope: "profile",
      state: crypto.randomBytes(20).toString("hex"),
    };

    const authorizationUrl = new url.URL(
      ext.insightsAuthUrls.authURL,
      insightsUrl
    );

    authorizationUrl.search = queryString(authParams);

    await open(authorizationUrl.toString());

    const code = await codePromise;

    return await getToken(insightsUrl, code);
  } catch (error) {
    throw error;
  } finally {
    setTimeout(() => server.close(), closeTimeout);
  }
}

export async function signOut(
  insightsUrl: string,
  token: string
): Promise<void> {
  const queryParams = queryString({
    grant_type: ext.insightsGrantType.authorizationCode,
    token,
  });
  const options = {
    body: queryParams,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  };
  const requestUrl = new url.URL(ext.insightsAuthUrls.revoke, insightsUrl);

  await requestPromise.post(requestUrl.toString(), options);
}

async function refreshToken(
  insightsUrl: string,
  token: string
): Promise<IToken> {
  return await tokenRequest(insightsUrl, {
    grant_type: ext.insightsGrantType.refreshToken,
    refresh_token: token,
  });
}

async function getToken(insightsUrl: string, code: string): Promise<IToken> {
  return await tokenRequest(insightsUrl, {
    code,
    grant_type: ext.insightsGrantType.authorizationCode,
  });
}

async function tokenRequest(insightsUrl: string, params: any): Promise<IToken> {
  const queryParams = queryString(params);
  const options = {
    body: queryParams,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  };

  const requestUrl = new url.URL(ext.insightsAuthUrls.tokenURL, insightsUrl);
  const response = await requestPromise.post(requestUrl.toString(), options);
  const result = JSON.parse(response);
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function queryString(options: any): string {
  return querystring
    .stringify(Object.assign(commonRequestParams, options))
    .replace(/%2B/g, "+");
}

function createServer() {
  let deferredCode: IDeferred<string>;
  const codePromise = new Promise<string>(
    (resolve, reject) => (deferredCode = { resolve, reject })
  );
  const codeTimer = setTimeout(
    () => deferredCode.reject(new Error("Timeout waiting for code.")),
    defaultTimeout
  );
  const cancelCodeTimer = () => clearTimeout(codeTimer);

  const server = http.createServer((req, res) => {
    const reqUrl = new url.URL(
      req.url!,
      `${ext.networkProtocols.http}${ext.localhost}`
    );
    switch (reqUrl.pathname) {
      case "/":
        sendFile(
          res,
          join(
            ext.context.asAbsolutePath("resources"),
            "codeFlowResult",
            "index.html"
          ),
          "text/html; charset=utf-8"
        );
        break;
      case "/redirect":
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
      case "/main.css":
        sendFile(
          res,
          join(
            ext.context.asAbsolutePath("resources"),
            "codeFlowResult",
            "main.css"
          ),
          "text/css; charset=utf-8"
        );
        break;
      default:
        res.writeHead(404);
        res.end();
        break;
    }
  });

  codePromise.then(cancelCodeTimer, cancelCodeTimer);

  return {
    codePromise,
    server,
  };
}

function startServer(server: http.Server): Promise<number> {
  let deferredCode: IDeferred<number>;
  const portPromise = new Promise<number>(
    (resolve, reject) => (deferredCode = { resolve, reject })
  );
  const portTimer = setTimeout(
    () => deferredCode.reject(new Error("Timeout waiting for port")),
    closeTimeout
  );
  const cancelPortTimer = () => clearTimeout(portTimer);

  server.on("listening", () => deferredCode.resolve(9010));
  server.on("error", (error) => deferredCode.reject(error));
  server.on("close", () => deferredCode.reject(new Error("Closed")));

  server.listen(9010, ext.localhost);

  portPromise.then(cancelPortTimer, cancelPortTimer);
  return portPromise;
}

function sendFile(
  res: http.ServerResponse,
  filePath: string,
  contentType: string
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
