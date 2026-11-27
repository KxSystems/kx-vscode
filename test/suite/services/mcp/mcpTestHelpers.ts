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

import * as assert from "assert";
import * as http from "http";
import * as net from "net";
import * as vscode from "vscode";

import { LocalConnection } from "../../../../src/classes/localConnection";
import { KdbNode } from "../../../../src/services/kdbTreeProvider";

// The secrets and globalState keys the MCP code uses
export const TOKEN_KEY = "kdb.mcp.token";
export const ACCESS_KEY = "kdb.mcp.access";

// The label KdbNode gives a connection named local-q with no alias, on
// 127.0.0.1:5001. Access is keyed on the node label, not the bare name.
export const LOCAL_NODE_LABEL = "local-q[127.0.0.1:5001]";

// A tree node for a local connection with no alias
export function kdbNode(label: string, children: string[] = []): KdbNode {
  return new KdbNode(
    children,
    label,
    {
      serverAlias: "",
      serverName: "127.0.0.1",
      serverPort: "5001",
      tls: false,
      auth: false,
    },
    vscode.TreeItemCollapsibleState.None,
  );
}

// A connected local connection with the given label, without opening q
export function connectedLocal(label: string): LocalConnection {
  return Object.assign(Object.create(LocalConnection.prototype), {
    connected: true,
    connLabel: label,
  });
}

// A port nothing is using right now
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as net.AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

// Serves the handler on 127.0.0.1, on the given port or a free one
export function serveHttp(
  handler: http.RequestListener,
  port = 0,
): Promise<{ port: number; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      const { port: bound } = server.address() as net.AddressInfo;
      resolve({
        port: bound,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

export type HttpReply = {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
};

// Sends a request with the Host header the server expects, unless given one
export function httpRequest(
  port: number,
  method: string,
  path: string,
  headers: http.OutgoingHttpHeaders = {},
  body?: string,
): Promise<HttpReply> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path,
        method,
        headers: { Host: `127.0.0.1:${port}`, ...headers },
      },
      (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (text += chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: text,
          }),
        );
      },
    );
    req.on("error", reject);
    req.end(body);
  });
}

// Listeners run without awaiting, so poll until the state settles
export async function waitUntil(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 3000;
  while (!condition()) {
    if (Date.now() > deadline) {
      assert.fail("timed out waiting for the state to change");
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
