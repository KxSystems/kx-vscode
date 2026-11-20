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
  isMcpEnabled,
  removeAllMcpAccess,
  setMcpAccess,
} from "../services/mcp/mcpAccess";
import {
  kdbMcpServer,
  startMcpServerIfNeeded,
  stopMcpServerIfUnused,
  workspaceName,
} from "../services/mcp/mcpServer";
import { MessageKind, notify } from "../utils/notifications";

const logger = "mcpCommand";

export async function regenerateMcpToken(): Promise<void> {
  await kdbMcpServer.regenerateToken();
  notify(
    "The kdb MCP token was replaced. Copilot picks it up automatically; Codex and Claude Code need their config updated with the new token.",
    MessageKind.INFO,
    { logger, telemetry: "MCP.RegenerateToken" },
  );
}

const EXPLAINED_KEY = "kdb.mcp.explained";

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
        "Agents in VS Code (Copilot, Codex, Claude Code) will be able to run read-only q on this connection while it's connected in this window, through the kdb extension's MCP server. They can't change data, write files or run system commands.\n\nYour agent will also ask you to approve the server, and each call unless you choose to always allow it. You can remove access at any time.",
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
  if (!isMcpEnabled()) {
    notify(
      "MCP access is turned off. Turn on the kdb.mcp.enabled setting first.",
      MessageKind.INFO,
      { logger },
    );
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

  await setMcpAccess(viewItem.label, "read");
  ext.serverProvider.reload();
  notify(
    `MCP access (read only) allowed on ${viewItem.label}`,
    MessageKind.DEBUG,
    { logger, telemetry: "MCP.AllowAccess" },
  );
  // Starts the server if this connection is already connected
  await startMcpServerIfNeeded(true);
}

export async function removeMcpAccess(viewItem?: KdbNode): Promise<void> {
  if (!(viewItem instanceof KdbNode)) {
    return;
  }
  await setMcpAccess(viewItem.label, undefined);
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
export function mcpServerName(workspace: string): string {
  const slug = workspace
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug ? `kdb-${slug}` : "kdb";
}

export async function generateMcpConfig(): Promise<void> {
  if (!isMcpEnabled()) {
    notify(
      "MCP access is turned off. Turn on the kdb.mcp.enabled setting first.",
      MessageKind.INFO,
      { logger },
    );
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
  const url = `http://127.0.0.1:${port}/mcp`;
  const name = mcpServerName(workspaceName());
  const token = await kdbMcpServer.getToken();
  const header = `Authorization: Bearer ${token}`;

  const options = [
    {
      label: "Claude Code: command",
      description: "run in a terminal",
      text: `claude mcp add --transport http ${name} ${url} --header "${header}"`,
    },
    {
      label: "Claude Code: .mcp.json entry",
      description: "paste into .mcp.json in your project folder",
      text: JSON.stringify(
        {
          mcpServers: {
            [name]: {
              type: "http",
              url,
              headers: { Authorization: `Bearer ${token}` },
            },
          },
        },
        null,
        2,
      ),
    },
  ];

  const picked = await window.showQuickPick(options, {
    title: "Copy MCP config",
    placeHolder: "Which config do you want to copy?",
  });
  if (!picked) {
    return;
  }

  await env.clipboard.writeText(picked.text);
  notify(
    `Copied (${picked.description}). It contains your MCP token, so keep it out of source control.` +
      "",
    MessageKind.INFO,
    { logger, telemetry: "MCP.GenerateConfig" },
  );
}
