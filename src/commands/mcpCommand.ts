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

import { env, window, workspace } from "vscode";

import { ext } from "../extensionVariables";
import { KdbNode } from "../services/kdbTreeProvider";
import {
  EXPLAINED_KEY,
  isMcpEnabled,
  removeAllMcpAccess,
  setMcpAccess,
} from "../services/mcp/mcpAccess";
import {
  claimName,
  forgetPortClaim,
  getPortClaims,
  MCP_HOST,
  workspaceKey,
} from "../services/mcp/mcpPorts";
import {
  kdbMcpServer,
  startMcpServerIfNeeded,
  stopMcpServerIfUnused,
  workspaceName,
} from "../services/mcp/mcpServer";
import { agentToolTimeoutSeconds } from "../services/mcp/qTimeout";
import { MessageKind, notify } from "../utils/notifications";

const logger = "mcpCommand";

// The environment variable the env var configs read the token from
const MCP_TOKEN_ENV = "KDB_MCP_TOKEN";

export async function regenerateMcpToken(): Promise<void> {
  await kdbMcpServer.regenerateToken();
  notify(
    "The kdb MCP token was replaced. Copilot picks it up automatically; Codex and Claude Code need their config updated with the new token.",
    MessageKind.INFO,
    { logger, telemetry: "MCP.RegenerateToken" },
  );
}

// Tells the user MCP is turned off, and returns true when it is
function reportIfMcpOff(): boolean {
  if (isMcpEnabled()) {
    return false;
  }
  notify(
    "MCP access is turned off. Turn on the kdb.mcp.enabled setting first.",
    MessageKind.INFO,
    { logger },
  );
  return true;
}

// Shown once, the first time any connection is allowed
async function confirmFirstAllow(label: string): Promise<boolean> {
  if (ext.context.globalState.get<boolean>(EXPLAINED_KEY)) {
    return true;
  }
  const allow = "Allow";
  const choice = await window.showInformationMessage(
    `Allow AI agents to query '${label}'?`,
    {
      modal: true,
      detail:
        "AI agents such as Copilot, Codex and Claude Code, in VS Code or a terminal, will be able to run q on this connection through the kdb extension's MCP server, while it's connected in this window. The q they run can change data, write files and run system commands on that process.\n\nYour agent will also ask you to approve the server, and to approve each query unless you set it to always allow them. You can remove access at any time.\n\nDon't type passwords or other credentials into the agent's chat, and don't have it write them into q. What the agent runs and gets back stays in its chat history. The extension doesn't log the q text.",
    },
    allow,
  );
  if (choice !== allow) {
    return false;
  }
  await ext.context.globalState.update(EXPLAINED_KEY, true);
  return true;
}

export async function allowMcpAccess(viewItem?: KdbNode): Promise<void> {
  if (!(viewItem instanceof KdbNode)) {
    return;
  }
  if (reportIfMcpOff()) {
    return;
  }
  if (!workspace.isTrusted) {
    notify(
      "MCP access is only available in trusted workspaces.",
      MessageKind.WARNING,
      { logger },
    );
    return;
  }
  if (!(await confirmFirstAllow(viewItem.label))) {
    return;
  }

  await setMcpAccess(viewItem.label, true);
  ext.serverProvider.reload();
  notify(`MCP access allowed on ${viewItem.label}`, MessageKind.DEBUG, {
    logger,
    telemetry: "MCP.AllowAccess",
  });
  // Starts the server if this connection is already connected
  await startMcpServerIfNeeded(true);
}

export async function removeMcpAccess(viewItem?: KdbNode): Promise<void> {
  if (!(viewItem instanceof KdbNode)) {
    return;
  }
  await setMcpAccess(viewItem.label, false);
  ext.serverProvider.reload();
  await stopMcpServerIfUnused();
  notify(`MCP access removed from ${viewItem.label}`, MessageKind.DEBUG, {
    logger,
    telemetry: "MCP.RemoveAccess",
  });
}

export async function removeAllMcpAccessCommand(): Promise<void> {
  await removeAllMcpAccess();
  ext.serverProvider.reload();
  await stopMcpServerIfUnused();
  notify("MCP access removed from all connections.", MessageKind.INFO, {
    logger,
    telemetry: "MCP.RemoveAllAccess",
  });
}

// The agent-side server name, e.g. kdb-taxi-analysis
export function mcpServerName(workspaceLabel: string): string {
  const slug = workspaceLabel
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-/, "")
    .replace(/-$/, "");
  return slug ? `kdb-${slug}` : "kdb";
}

export async function generateMcpConfig(): Promise<void> {
  if (reportIfMcpOff()) {
    return;
  }

  // Only hand out the port this window is listening on: guessing the setting
  // could point the agent at another window's server, which shares the token
  const port = kdbMcpServer.currentPort;
  if (!kdbMcpServer.running || port === undefined) {
    notify(
      "The kdb MCP server isn't running in this window. Allow MCP access on a connection and connect to it, then generate the config.",
      MessageKind.INFO,
      { logger },
    );
    return;
  }
  await copyMcpConfig(
    mcpServerName(workspaceName()),
    port,
    await kdbMcpServer.getToken(),
  );
}

// Asks for the agent and where the token comes from, then copies the config
// for the server at that port
async function copyMcpConfig(
  name: string,
  port: number,
  token: string,
): Promise<void> {
  const url = `http://${MCP_HOST}:${port}/mcp`;
  const envVar = MCP_TOKEN_ENV;
  const bearer = `Bearer ${token}`;
  const envBearer = `Bearer \${${envVar}}`;

  const mcpJson = (authorization: string) =>
    JSON.stringify(
      {
        mcpServers: {
          [name]: {
            type: "http",
            url,
            headers: { Authorization: authorization },
          },
        },
      },
      null,
      2,
    );
  // tool_timeout_sec outlasts the extension's own deadline, which Codex's
  // default of 60 seconds would cut short
  const codexToml = (...lines: string[]) =>
    [
      `[mcp_servers.${name}]`,
      `url = ${JSON.stringify(url)}`,
      ...lines,
      `tool_timeout_sec = ${agentToolTimeoutSeconds()}`,
    ].join("\n");

  // Step 1: which agent. Step 2: where the token lives. The env var choice
  // keeps the token out of the config, so the config survives regeneration.
  const agent = await window.showQuickPick(
    [
      { label: "Claude Code", agent: "claude" as const },
      { label: "Codex", agent: "codex" as const },
    ],
    { title: "Generate MCP config", placeHolder: "Which agent?" },
  );
  if (!agent) {
    return;
  }

  const choices =
    agent.agent === "claude"
      ? [
          {
            label: "Token from environment variable (recommended)",
            description: `.mcp.json uses \${${envVar}}`,
            text: mcpJson(envBearer),
            usesEnv: true,
            terminal: false,
          },
          {
            label: "Token in the config",
            description: ".mcp.json with the token written in",
            text: mcpJson(bearer),
            usesEnv: false,
            terminal: false,
          },
          {
            label: "Token in the config, as a command",
            description: "run in a terminal",
            text: `claude mcp add --transport http ${name} ${url} --header "Authorization: ${bearer}"`,
            usesEnv: false,
            terminal: true,
          },
        ]
      : [
          {
            label: "Token from environment variable (recommended)",
            description: `config.toml uses ${envVar}`,
            text: codexToml(`bearer_token_env_var = ${JSON.stringify(envVar)}`),
            usesEnv: true,
            terminal: false,
          },
          {
            label: "Token in the config",
            description: "config.toml with the token written in",
            text: codexToml(
              `http_headers = { Authorization = ${JSON.stringify(bearer)} }`,
            ),
            usesEnv: false,
            terminal: false,
          },
        ];

  const picked = await window.showQuickPick(choices, {
    title: `Generate MCP config for ${agent.label}`,
    placeHolder: "Where should the token come from?",
  });
  if (!picked) {
    return;
  }

  await env.clipboard.writeText(picked.text);
  const exportLine = "Copy export line";
  const where = agent.agent === "claude" ? ".mcp.json" : "~/.codex/config.toml";
  let message: string;
  if (picked.terminal) {
    message = `Copied. Paste into a terminal to add the server to ${agent.label}. It contains your MCP token, so keep it out of source control.`;
  } else if (picked.usesEnv) {
    message = `Copied. Paste into ${where}, then set ${envVar} in your environment (the export line) and restart the agent.`;
  } else {
    message = `Copied. Paste into ${where}. It contains your MCP token, so keep it out of source control.`;
  }
  const choice = await notify(
    message,
    MessageKind.INFO,
    { logger, telemetry: "MCP.GenerateConfig" },
    ...(picked.usesEnv ? [exportLine] : []),
  );
  if (choice === exportLine) {
    await env.clipboard.writeText(`export ${envVar}='${token}'`);
    notify(
      `Copied the export line. Add it to ~/.bashrc (WSL or Linux), or set ${envVar} as a Windows user environment variable.`,
      MessageKind.INFO,
      { logger },
    );
  }
}

// Lists the port each workspace has saved, with a config to copy or the port
// to forget. Config for another workspace works without its server running:
// it's the same token, on the port that workspace keeps.
export async function showMcpServers(): Promise<void> {
  const claims = Object.entries(getPortClaims());
  if (claims.length === 0) {
    notify(
      "No workspace has a kdb MCP server port saved yet. A port is saved the first time a workspace's server starts.",
      MessageKind.INFO,
      { logger },
    );
    return;
  }

  const current = workspaceKey();
  const server = await window.showQuickPick(
    claims.map(([key, port]) => ({
      label: claimName(key),
      description: `port ${port}${key === current ? " · this window" : ""}`,
      key,
      port,
    })),
    { title: "kdb MCP servers", placeHolder: "Which workspace?" },
  );
  if (!server) {
    return;
  }

  const action = await window.showQuickPick(
    [
      { label: "Generate MCP config", action: "copy" as const },
      {
        label: "Forget port",
        description: "the next start picks a port again",
        action: "forget" as const,
      },
    ],
    { title: `kdb MCP server: ${server.label}` },
  );
  if (!action) {
    return;
  }

  if (action.action === "copy") {
    await copyMcpConfig(
      mcpServerName(server.label),
      server.port,
      await kdbMcpServer.getToken(),
    );
    return;
  }
  // This window's own port is in use, so it stays saved
  if (server.key === current) {
    notify(
      "This window is using that port, so it can't be forgotten here. Open the other workspace to forget it.",
      MessageKind.INFO,
      { logger },
    );
    return;
  }
  await forgetPortClaim(server.key);
  notify(`Forgot the MCP port for ${server.label}`, MessageKind.INFO, {
    logger,
  });
}
