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

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomBytes, timingSafeEqual } from "crypto";
import { createServer, IncomingMessage, Server, ServerResponse } from "http";
import {
  commands,
  Disposable,
  EventEmitter,
  ExtensionContext,
  lm,
  McpHttpServerDefinition,
  Uri,
  window,
  workspace,
} from "vscode";

import { isMcpEnabled, updateMcpContext } from "./mcpAccess";
import {
  askForAnotherPort,
  choosePort,
  claimName,
  describePortHolder,
  MCP_HOST,
  McpHealth,
  probeHealth,
  getPortClaims,
  keyHash,
  savePortClaim,
  workspaceKey,
} from "./mcpPorts";
import { checkProcessTimeouts } from "./qTimeout";
import { isAllowedAndConnected, registerTools } from "./tools";
import { ext } from "../../extensionVariables";
import { MessageKind, notify } from "../../utils/notifications";

const logger = "mcp";

const TOKEN_KEY = "kdb.mcp.token";

const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost", "[::1]"]);

// workspace.name carries a remote suffix ("kx-vscode [WSL: Ubuntu-22.04]"), so
// use the .code-workspace file or the first folder, which stay the same
// whether the folder is opened locally or remotely
export function workspaceName(): string {
  const key = workspaceKey();
  return key ? claimName(key) : "no folder";
}

class KdbMcpServer implements Disposable {
  private server?: Server;
  private starting?: { generation: number; promise: Promise<boolean> };
  // Bumped by stop(), so a start still in progress knows to give up
  private generation = 0;
  // The user picked Don't start; cleared by an explicit action
  private declined = false;
  private toldSessionOnly = false;
  private port?: number;
  private token?: string;
  private readonly changed = new EventEmitter<void>();

  // Fired on start, stop, port change and token change, for the provider
  readonly onDidChange = this.changed.event;

  get running(): boolean {
    return this.server !== undefined;
  }

  get currentPort(): number | undefined {
    return this.port;
  }

  // The token is shared by every window through SecretStorage
  async getToken(): Promise<string> {
    if (!this.token) {
      this.token = await ext.context.secrets.get(TOKEN_KEY);
    }
    if (!this.token) {
      this.token = randomBytes(32).toString("base64url");
      await ext.context.secrets.store(TOKEN_KEY, this.token);
    }
    return this.token;
  }

  async regenerateToken(): Promise<void> {
    this.token = randomBytes(32).toString("base64url");
    await ext.context.secrets.store(TOKEN_KEY, this.token);
    this.changed.fire();
  }

  // Another window replaced the token
  async reloadToken(): Promise<void> {
    this.token = await ext.context.secrets.get(TOKEN_KEY);
    this.changed.fire();
  }

  definition(): McpHttpServerDefinition | undefined {
    if (!this.running || !this.port || !this.token) {
      return undefined;
    }
    return new McpHttpServerDefinition(
      `kdb (${workspaceName()})`,
      Uri.parse(`http://${MCP_HOST}:${this.port}/mcp`),
      { Authorization: `Bearer ${this.token}` },
    );
  }

  // retry: an explicit user action, so ask about a taken port again even
  // after Don't start
  start(retry = false): Promise<boolean> {
    if (retry) {
      this.declined = false;
    }
    if (this.server) {
      return Promise.resolve(true);
    }
    if (this.starting?.generation !== this.generation) {
      const starting = {
        generation: this.generation,
        promise: this.listen(this.generation).finally(() => {
          if (this.starting === starting) {
            this.starting = undefined;
          }
        }),
      };
      this.starting = starting;
    }
    return this.starting.promise;
  }

  async stop(): Promise<void> {
    // A start in progress sees the new generation and closes what it opened
    this.generation++;
    const server = this.server;
    if (!server) {
      return;
    }
    this.server = undefined;
    this.port = undefined;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    notify("MCP server stopped", MessageKind.DEBUG, { logger });
    this.changed.fire();
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start(true);
  }

  dispose(): void {
    void this.stop();
    this.changed.dispose();
  }

  private async listen(generation: number): Promise<boolean> {
    const cancelled = () =>
      generation !== this.generation || !workspace.isTrusted || !isMcpEnabled();
    if (cancelled() || this.declined) {
      return false;
    }
    const key = workspaceKey();
    const choice = choosePort();
    let port = choice.port;

    for (;;) {
      if (cancelled()) {
        return false;
      }
      const result = await this.bind(port);
      let health: McpHealth | undefined;
      if (!(result instanceof Server) && result.code === "EADDRINUSE") {
        health = await probeHealth(port);
        // Another window for this workspace already serves on this port. Leave
        // it running and don't start here; the next connect tries again.
        if (
          key &&
          health?.keyHash === keyHash(key) &&
          health.pid !== process.pid
        ) {
          notify(
            `MCP port ${port} is already used by another VS Code window for workspace '${health.workspace}'. Close that window, or set kdb.mcp.port in this workspace to use another port.`,
            MessageKind.INFO,
            { logger },
          );
          return false;
        }
      }
      if (result instanceof Server) {
        if (cancelled()) {
          result.close();
          return false;
        }
        this.server = result;
        break;
      }

      const inUse = result.code === "EADDRINUSE";
      if (!inUse || choice.source === "setting") {
        notify(
          inUse
            ? `Port ${port} is in use, so the kdb MCP server couldn't start. This workspace sets kdb.mcp.port, so choose another port there.`
            : `The kdb MCP server couldn't start on port ${port}.`,
          MessageKind.ERROR,
          { logger, params: result },
        );
        return false;
      }

      const holder = describePortHolder(health);
      notify(`MCP port ${port} is used by ${holder}`, MessageKind.DEBUG, {
        logger,
      });
      const next = await askForAnotherPort(port, `is used by ${holder}`);
      if (next === undefined) {
        this.declined = true;
        return false;
      }
      port = next;
    }

    this.port = port;
    if (key && choice.source !== "setting") {
      // No saved port until now: the first start for this workspace
      const firstStart = getPortClaims()[key] === undefined;
      await savePortClaim(key, port);
      if (firstStart) {
        this.offerConfig(port);
      }
    } else if (!key && !this.toldSessionOnly) {
      this.toldSessionOnly = true;
      notify(
        `No folder is open, so the kdb MCP server uses port ${port} for this session only. Agent configs made now may need updating next time.`,
        MessageKind.INFO,
        { logger },
      );
    }
    if (choice.source === "saved" && port !== choice.port) {
      void this.tellPortMoved(choice.port, port);
    }
    notify(
      `MCP server listening on http://${MCP_HOST}:${port}/mcp for workspace '${workspaceName()}'`,
      MessageKind.DEBUG,
      { logger },
    );
    this.changed.fire();
    return true;
  }

  // Codex and Claude Code need the port in their configs, which Copilot doesn't
  private offerConfig(port: number): void {
    const copy = "Copy MCP config";
    void notify(
      `The kdb MCP server for this workspace is on port ${port}. Copy the config to connect Codex or Claude Code to it.`,
      MessageKind.INFO,
      { logger },
      copy,
    ).then((picked) => {
      if (picked === copy) {
        void commands.executeCommand("kdb.mcp.generateConfig");
      }
    });
  }

  // Copilot follows the provider, but Codex and Claude Code configs name the
  // port
  private async tellPortMoved(from: number, to: number): Promise<void> {
    const generate = "Generate MCP config";
    const picked = await notify(
      `The kdb MCP server for this workspace moved from port ${from} to ${to}. Codex and Claude Code configs made for port ${from} need generating again. Copilot updates by itself.`,
      MessageKind.INFO,
      { logger },
      generate,
    );
    if (picked === generate) {
      await commands.executeCommand("kdb.mcp.generateConfig");
    }
  }

  private async bind(port: number): Promise<Server | NodeJS.ErrnoException> {
    const server = createServer((req, res) => {
      void this.handle(req, res, port);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, MCP_HOST, () => {
          server.off("error", reject);
          resolve();
        });
      });
    } catch (error) {
      return error as NodeJS.ErrnoException;
    }
    server.on("error", (error) =>
      notify("MCP server error", MessageKind.DEBUG, { logger, params: error }),
    );
    return server;
  }

  private async handle(
    req: IncomingMessage,
    res: ServerResponse,
    port: number,
  ): Promise<void> {
    try {
      // The Host check blocks DNS rebinding; the Origin check blocks browsers
      const host = req.headers.host;
      if (host !== `${MCP_HOST}:${port}` && host !== `localhost:${port}`) {
        return reply(res, 403, { error: "Host not allowed" });
      }
      if (!isLocalOrigin(req.headers.origin)) {
        return reply(res, 403, { error: "Origin not allowed" });
      }
      const path = new URL(req.url ?? "/", `http://${MCP_HOST}`).pathname;

      // Unauthenticated so a port probe never sends the token. It reveals the
      // workspace name, a hash of the folder and the pid, not the path.
      if (path === "/health") {
        if (req.method !== "GET") {
          res.setHeader("Allow", "GET");
          return reply(res, 405, { error: "Method not allowed" });
        }
        const key = workspaceKey();
        return reply(res, 200, {
          server: "kdb-mcp",
          workspace: workspaceName(),
          keyHash: key === undefined ? undefined : keyHash(key),
          pid: process.pid,
        });
      }

      if (!this.authorized(req.headers.authorization)) {
        res.setHeader("WWW-Authenticate", "Bearer");
        return reply(res, 401, { error: "Unauthorized" });
      }

      if (path === "/mcp") {
        // Stateless: no sessions, so no GET stream or DELETE
        if (req.method !== "POST") {
          res.setHeader("Allow", "POST");
          return reply(res, 405, { error: "Method not allowed" });
        }
        if (!workspace.isTrusted || !isMcpEnabled()) {
          return reply(res, 503, { error: "MCP access is turned off" });
        }
        await this.serveMcp(req, res);
        return;
      }

      return reply(res, 404, { error: "Not found" });
    } catch (error) {
      notify("MCP request failed", MessageKind.DEBUG, {
        logger,
        params: error,
      });
      if (!res.headersSent) {
        reply(res, 500, { error: "Internal error" });
      }
    }
  }

  private async serveMcp(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const server = new McpServer({
      name: "kdb",
      version: ext.context.extension.packageJSON.version ?? "0.0.0",
    });
    registerTools(server, workspaceName());
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res);
  }

  private authorized(header: string | undefined): boolean {
    if (!this.token || !header?.startsWith("Bearer ")) {
      return false;
    }
    const given = Buffer.from(header.slice("Bearer ".length).trim());
    const expected = Buffer.from(this.token);
    return given.length === expected.length && timingSafeEqual(given, expected);
  }
}

function isLocalOrigin(origin: string | undefined): boolean {
  if (origin === undefined) {
    return true;
  }
  try {
    const url = new URL(origin);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      LOCAL_HOSTNAMES.has(url.hostname)
    );
  } catch {
    return false;
  }
}

function reply(res: ServerResponse, status: number, body: object): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

export const kdbMcpServer = new KdbMcpServer();

function hasAllowedConnection(): boolean {
  return ext.connectedConnectionList.some(isAllowedAndConnected);
}

// The server runs only while an allowed connection is connected in this
// window. It never opens a connection itself.
export async function startMcpServerIfNeeded(retry = false): Promise<void> {
  if (hasAllowedConnection()) {
    await kdbMcpServer.start(retry);
    if (kdbMcpServer.running) {
      void checkProcessTimeouts(
        ext.connectedConnectionList.filter(isAllowedAndConnected),
      );
    }
  }
}

// Frees the port once the last allowed connection is disconnected or loses
// its access
export async function stopMcpServerIfUnused(): Promise<void> {
  if (!hasAllowedConnection()) {
    await kdbMcpServer.stop();
  }
}

export function registerMcpServer(context: ExtensionContext): void {
  updateMcpContext();

  context.subscriptions.push(
    kdbMcpServer,
    lm.registerMcpServerDefinitionProvider("kdb.mcp", {
      onDidChangeMcpServerDefinitions: kdbMcpServer.onDidChange,
      provideMcpServerDefinitions: () => {
        const definition = kdbMcpServer.definition();
        return definition ? [definition] : [];
      },
    }),
    context.secrets.onDidChange((event) => {
      if (event.key === TOKEN_KEY) {
        void kdbMcpServer.reloadToken();
      }
    }),
    workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("kdb.mcp.enabled")) {
        // The tree marker only shows while MCP is on
        ext.serverProvider.reload();
        if (isMcpEnabled()) {
          void startMcpServerIfNeeded();
        } else {
          void kdbMcpServer.stop();
        }
      } else if (event.affectsConfiguration("kdb.mcp.port")) {
        // Also retries a start that failed because the port was taken
        void (kdbMcpServer.running
          ? kdbMcpServer.restart()
          : startMcpServerIfNeeded(true));
      }
    }),
    workspace.onDidGrantWorkspaceTrust(() => void startMcpServerIfNeeded()),
    // Access is saved for every window, so another window may have changed it
    // while this one was in the background. Its menus and markers only update
    // from its own changes, so refresh them when it's focused again.
    window.onDidChangeWindowState((state) => {
      if (state.focused) {
        updateMcpContext();
        ext.serverProvider.reload();
        void stopMcpServerIfUnused();
      }
    }),
  );
}
