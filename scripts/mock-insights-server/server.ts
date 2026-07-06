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

// Standalone mock of a KDB Insights instance's REST API, for exercising
// InsightsConnection (src/classes/insightsConnection.ts) and the OAuth code
// flow (src/services/kdbInsights/codeFlowLogin.ts) against a real HTTPS
// server without a live Insights deployment.
//
// Run with:  node --experimental-strip-types scripts/mock-insights-server/server.ts

import * as crypto from "crypto";
import { IncomingMessage, ServerResponse } from "http";
import * as https from "https";
import * as querystring from "querystring";
import * as url from "url";

import { loadOrCreateSelfSignedCert } from "./cert.ts";
import {
  apiConfigResponse,
  configResponse,
  metaResponse,
  mockUsername,
  sampleRows,
  structuredTextFromRows,
} from "./fixtures.ts";

const port = Number(process.env.PORT || 8443);
const realm = "insights";

function base64url(input: string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function makeAccessToken(): string {
  const header = { alg: "none", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    preferred_username: mockUsername,
    iat: now,
    exp: now + 3600,
  };
  return `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}.mocksignature`;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(data);
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
  const contentType = req.headers["content-type"] || "";
  if (!raw) return {};
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return querystring.parse(raw);
  }
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function log(req: IncomingMessage, status: number): void {
  console.log(`[mock-insights] ${req.method} ${req.url} -> ${status}`);
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const parsed = url.parse(req.url || "", true);
  const pathname = (parsed.pathname || "").replace(/\/+$/, "") || "/";
  const method = req.method || "GET";
  const raw = await readBody(req);
  const body = parseBody(req, raw);

  const respond = (status: number, payload: unknown) => {
    sendJson(res, status, payload);
    log(req, status);
  };

  // --- OIDC discovery / code flow (see codeFlowLogin.ts) ---
  if (
    method === "GET" &&
    pathname === `/realms/${realm}/.well-known/openid-configuration`
  ) {
    respond(200, { issuer: `https://localhost:${port}/realms/${realm}` });
    return;
  }

  if (
    method === "GET" &&
    pathname === `/realms/${realm}/protocol/openid-connect/auth`
  ) {
    const redirectUri = parsed.query.redirect_uri as string;
    const state = parsed.query.state as string;
    const code = crypto.randomBytes(16).toString("hex");
    const location = `${redirectUri}?code=${code}&state=${encodeURIComponent(state)}`;
    res.writeHead(302, { Location: location });
    res.end();
    log(req, 302);
    return;
  }

  if (
    method === "POST" &&
    pathname === `/realms/${realm}/protocol/openid-connect/token`
  ) {
    respond(200, {
      access_token: makeAccessToken(),
      refresh_token: crypto.randomBytes(16).toString("hex"),
      expires_in: 3600,
      token_type: "Bearer",
    });
    return;
  }

  if (
    method === "POST" &&
    pathname === `/realms/${realm}/protocol/openid-connect/revoke`
  ) {
    respond(200, {});
    return;
  }

  // --- Instance / API config (see InsightsConnection.getConfig/getApiConfig) ---
  if (method === "GET" && pathname === "/kxicontroller/config") {
    respond(200, configResponse);
    return;
  }

  if (method === "GET" && pathname === "/api/config") {
    respond(200, apiConfigResponse);
    return;
  }

  // --- Meta (see InsightsConnection.getMeta) ---
  if (method === "POST" && pathname === "/servicegateway/api/v3/meta") {
    respond(200, metaResponse);
    return;
  }

  // --- Scratchpad (see InsightsConnection.{get,import,cancel,reset}Scratchpad) ---
  if (method === "POST" && pathname === "/scratchpadmanager/scratchpad/display") {
    const expression: string = body.expression || "";
    if (expression === "") {
      respond(200, {});
      return;
    }
    if (body.returnFormat === "structuredText") {
      respond(200, { data: JSON.stringify(structuredTextFromRows(sampleRows)) });
    } else {
      respond(200, { data: `mock result for: ${expression}` });
    }
    return;
  }

  if (
    method === "POST" &&
    [
      "/scratchpadmanager/scratchpad/import/data",
      "/scratchpadmanager/scratchpad/import/sql",
      "/scratchpadmanager/scratchpad/import/qsql",
      "/scratchpadmanager/scratchpad/import/uda",
    ].includes(pathname)
  ) {
    respond(200, { error: "" });
    return;
  }

  if (method === "POST" && pathname === "/scratchpadmanager/scratchpad/cancel") {
    respond(200, {});
    return;
  }

  if (method === "POST" && pathname === "/scratchpadmanager/reset") {
    respond(200, {});
    return;
  }

  // --- Datasource queries: API / SQL / QSQL / UDA (see getDatasourceQuery) ---
  if (
    method === "POST" &&
    (pathname === "/servicegateway/data" ||
      pathname === "/servicegateway/kxi/sql" ||
      pathname === "/servicegateway/kxi/qsql" ||
      pathname.startsWith("/servicegateway/"))
  ) {
    respond(200, { payload: sampleRows });
    return;
  }

  respond(404, { error: `No mock route for ${method} ${pathname}` });
}

const { key, cert } = loadOrCreateSelfSignedCert();

const server = https.createServer({ key, cert }, (req, res) => {
  handleRequest(req, res).catch((err) => {
    console.error(err);
    sendJson(res, 500, { error: String(err) });
  });
});

server.listen(port, () => {
  console.log(`Mock Insights API listening on https://localhost:${port}`);
  console.log(
    `Add a KDB Insights connection in the extension with server https://localhost:${port}/`,
  );
  console.log(
    "The cert is self-signed: trust scripts/mock-insights-server/certs/cert.pem, " +
      "or run the Extension Development Host with NODE_TLS_REJECT_UNAUTHORIZED=0 " +
      "(the OIDC discovery probe in codeFlowLogin.ts does not honor the connection's " +
      "'insecure' flag).",
  );
});
