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

import * as crypto from "node:crypto";
import {
  IncomingHttpHeaders,
  IncomingMessage,
  ServerResponse,
} from "node:http";
import * as https from "node:https";
import * as querystring from "node:querystring";
import * as url from "node:url";
import { WebSocket, WebSocketServer } from "ws";

import { selfSignedCert } from "./cert";
import { apiConfig, config, meta, structuredText, USERNAME } from "./fixtures";

// Everything a request carries, in the terms the assertions are written in:
// which endpoint the extension chose, and what it sent there.
export interface Request {
  method: string;
  path: string;
  body: any;
  headers: IncomingHttpHeaders;
}

// What a successful scratchpad query answers with in text mode.
export const RESULT = "e2e insights result";

// What a failing request reports back.
export const FAILURE = "fake insights failure";

/**
 * A stand-in KDB Insights instance. It speaks the parts of the REST API an
 * InsightsConnection uses — the OAuth code flow, the two configuration
 * endpoints, meta, the scratchpad and the service gateway — over HTTPS with a
 * self-signed certificate, because Insights connections are required to be
 * https:// (see validateInsightsServerUrl).
 *
 * Which endpoints the extension picks depends on the instance version and on
 * whether query environments are enabled, so those are settings here rather
 * than fixed: `version` is what getInsightsVersion() reads out of the
 * configuration, and both are read on every request, so a test can change them
 * before connecting.
 *
 * Requests are matched on the shape of the path rather than the exact route of
 * one version, so an endpoint the extension got wrong is still answered and
 * fails as an assertion on `requests` rather than as a timeout.
 */
export class FakeInsights {
  readonly requests: Request[] = [];

  // The version the instance reports, and so which endpoint group and request
  // bodies the extension uses. The default carries the scratchpad log
  // websocket, which only 1.18 and later have.
  version = "1.18.0";

  queryEnvironments = false;

  // Any query carrying this comes back as a failure instead of a result.
  static readonly FAILS = "FAIL_QUERY";

  // The headers each scratchpad log websocket connected with, so a test can
  // tell that the socket was established and how it authenticated.
  readonly upgrades: IncomingHttpHeaders[] = [];

  private readonly realm = "insights";
  private server?: https.Server;
  private wss?: WebSocketServer;
  private readonly sockets = new Set<WebSocket>();

  listen(port: number) {
    const { key, cert } = selfSignedCert();

    return new Promise<void>((resolve, reject) => {
      this.server = https.createServer({ key, cert }, (req, res) =>
        this.serve(req, res).catch((error) => {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: String(error) }));
        }),
      );

      this.wss = new WebSocketServer({ noServer: true });
      this.server.on("upgrade", (req, socket, head) => {
        this.upgrades.push(req.headers);
        this.wss!.handleUpgrade(req, socket, head, (ws) => {
          this.sockets.add(ws);
          ws.on("close", () => this.sockets.delete(ws));
        });
      });

      this.server.once("error", (error: NodeJS.ErrnoException) =>
        reject(
          error.code === "EADDRINUSE"
            ? new Error(
                `Port ${port} is taken, so the stand-in Insights instance cannot start. ` +
                  "Another end to end window is probably still open.",
              )
            : error,
        ),
      );
      this.server.listen(port, "127.0.0.1", resolve);
    });
  }

  async close() {
    for (const socket of this.sockets) {
      socket.terminate();
    }
    this.sockets.clear();
    this.wss?.close();
    this.wss = undefined;

    const server = this.server;
    this.server = undefined;
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }

  clear() {
    this.requests.length = 0;
  }

  // Every request whose path ends the given way, in order. Paths are matched by
  // suffix so a test names the endpoint it cares about rather than repeating
  // the version's prefix.
  calls(suffix: string) {
    return this.requests.filter((request) => request.path.endsWith(suffix));
  }

  // Only the requests carrying user code. The extension also asks for the
  // configuration and the meta over the same connection — the meta again
  // before every datasource query — and starts a scratchpad with an empty
  // expression before the first one.
  queries() {
    return this.requests.filter(
      (request) =>
        !request.path.endsWith("/meta") &&
        (request.path.includes("/servicegateway/") ||
          request.path.includes("/scratchpad/import/") ||
          (request.path.includes("/scratchpad/display") &&
            request.body?.expression)),
    );
  }

  // Pushes a line of scratchpad stdout down the log websocket, the way a
  // running query does.
  log(value: string, handle: "STDOUT" | "STDERR" = "STDOUT") {
    const message = JSON.stringify({
      channel: "logging",
      data: [{ handle, value }],
    });
    for (const socket of this.sockets) {
      socket.send(message);
    }
  }

  image(data: string, requestID = "") {
    const message = JSON.stringify({
      channel: "image",
      data: { format: "PNG", encoding: "base64", requestID, data },
    });
    for (const socket of this.sockets) {
      socket.send(message);
    }
  }

  private async serve(req: IncomingMessage, res: ServerResponse) {
    const parsed = url.parse(req.url || "", true);
    const path = (parsed.pathname || "").replace(/\/+$/, "") || "/";
    const method = req.method || "GET";
    const body = parseBody(req, await readBody(req));

    this.requests.push({ method, path, body, headers: req.headers });

    const send = (status: number, payload: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(payload));
    };

    // The OAuth code flow, as codeFlowLogin drives it. Answering the discovery
    // probe with a 200 is what puts the endpoints at /realms rather than
    // /auth/realms.
    if (path === `/realms/${this.realm}/.well-known/openid-configuration`) {
      return send(200, { issuer: `/realms/${this.realm}` });
    }

    if (path === `/realms/${this.realm}/protocol/openid-connect/auth`) {
      const redirect = parsed.query.redirect_uri as string;
      const state = encodeURIComponent(parsed.query.state as string);
      const code = crypto.randomBytes(16).toString("hex");
      res.writeHead(302, {
        Location: `${redirect}?code=${code}&state=${state}`,
      });
      return res.end();
    }

    if (path === `/realms/${this.realm}/protocol/openid-connect/token`) {
      return send(200, {
        access_token: accessToken(),
        refresh_token: crypto.randomBytes(16).toString("hex"),
        expires_in: 3600,
        token_type: "Bearer",
      });
    }

    if (path === `/realms/${this.realm}/protocol/openid-connect/revoke`) {
      return send(200, {});
    }

    if (path === "/kxicontroller/config") {
      return send(200, config(this.version));
    }

    if (path === "/api/config") {
      return send(200, apiConfig(this.version, this.queryEnvironments));
    }

    // Before the service gateway, which every other path under it falls to.
    if (path.endsWith("/meta")) {
      return send(200, meta);
    }

    if (path.includes("/scratchpad/display")) {
      const expression: string = body.expression || "";
      if (expression.includes(FakeInsights.FAILS)) {
        return send(200, { error: true, errorMsg: FAILURE });
      }
      // The scratchpad the extension starts before the first query.
      if (expression === "") {
        return send(200, {});
      }
      return send(200, {
        data:
          body.returnFormat === "structuredText"
            ? JSON.stringify(structuredText())
            : RESULT,
      });
    }

    if (path.includes("/scratchpad/import/")) {
      return send(
        200,
        JSON.stringify(body).includes(FakeInsights.FAILS)
          ? { error: true, errorMsg: FAILURE }
          : { error: "" },
      );
    }

    if (path.endsWith("/scratchpad/cancel") || path.endsWith("/reset")) {
      return send(200, {});
    }

    if (path.startsWith("/servicegateway/")) {
      // A failing datasource answers with a status the extension reads the
      // reason out of, rather than a body carrying an error flag.
      // The payload is structured text because that is what the extension's
      // struct-text accept header asks these endpoints for — rows here instead
      // leave the notebook renderer with nothing it can lay out.
      return JSON.stringify(body).includes(FakeInsights.FAILS)
        ? send(500, { header: { ai: FAILURE }, payload: {} })
        : send(200, { payload: structuredText() });
    }

    send(404, { error: `no stand-in route for ${method} ${path}` });
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function parseBody(req: IncomingMessage, raw: string): any {
  if (!raw) {
    return {};
  }
  if ((req.headers["content-type"] || "").includes("x-www-form-urlencoded")) {
    return querystring.parse(raw);
  }
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function base64url(input: string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Unsigned, but well formed: the extension only decodes it, to read the
// username it sends back as a header.
function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  return [
    base64url(JSON.stringify({ alg: "none", typ: "JWT" })),
    base64url(
      JSON.stringify({
        preferred_username: USERNAME,
        iat: now,
        exp: now + 3600,
      }),
    ),
    "e2esignature",
  ].join(".");
}
