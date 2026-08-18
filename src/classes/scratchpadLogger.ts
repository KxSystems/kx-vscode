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

import * as url from "url";
import { WebSocket } from "ws";

import { InsightDetails } from "../models/connectionsModels";
import { getCurrentToken } from "../services/kdbInsights/codeFlowLogin";
import { decodeQUTF } from "../utils/decode";
import { ExecutionConsole } from "../utils/executionConsole";
import { MessageKind, notify } from "../utils/notifications";
import { errorMessage } from "../utils/shared";

const logger = "scratchpadLogger";

interface LogMessage {
  channel: "logging";
  data: Array<{ handle: "STDOUT" | "STDERR"; value: string }>;
}

export class ScratchpadLogger {
  private connecting = false;
  private isManualClose = false;
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private url = "";
  private ws: WebSocket | null = null;

  private readonly MAX_DELAY = 30000;
  private readonly PING_MS = 30000;

  constructor(
    private readonly connection: InsightDetails,
    private readonly connLabel = "",
  ) {
    this.url = new url.URL(
      "scratchpadmanager/websocket",
      connection.server.replace(/^http(s?):\/\//, "ws$1://"),
    ).toString();
  }

  public async connect() {
    // Called when the connection is established and again whenever it becomes
    // active, so it has to be idempotent — a second socket would duplicate
    // every log line and leak the first. `connecting` is needed as well as
    // `ws`, since the token is awaited before the socket exists.
    if (this.connecting || this.ws) {
      return;
    }
    this.connecting = true;
    try {
      await this.open();
    } finally {
      this.connecting = false;
    }
  }

  private async open() {
    const { alias, server, realm, insecure } = this.connection;
    const token = await getCurrentToken(
      server,
      alias,
      realm || "insights",
      !!insecure,
    );

    if (!token) {
      notify(
        `Unable to get token for ${this.connection.alias}`,
        MessageKind.ERROR,
        {
          logger,
        },
      );
      return;
    }

    this.isManualClose = false;
    this.ws = new WebSocket(this.url, {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
      },
      // The REST calls go through getHttpsAgent, so without this an instance
      // presenting a self-signed certificate connects but never delivers the
      // stdout the console and the plots are rendered from.
      rejectUnauthorized: !insecure,
    });

    this.ws.on("upgrade", (response) => {
      const networkSocket = response.socket;
      networkSocket.setKeepAlive(true, 15000);
    });

    this.ws.on("open", () => {
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      notify(`${this.connection.alias} websocket opened`, MessageKind.DEBUG, {
        logger,
      });
    });

    this.ws.on("message", (data) => {
      const msgString = data.toString();
      try {
        const msg = JSON.parse(msgString);
        this.processLogs(msg.data);
      } catch (error) {
        notify(errorMessage(error), MessageKind.DEBUG, { logger });
      }
    });

    this.ws.on("close", (code, reason) => {
      // Cleared so the idempotency guard in connect() lets the reconnect below,
      // or a later reconnect by the connection, open a new socket.
      this.ws = null;
      this.stopHeartbeat();

      if (!this.isManualClose) {
        notify(
          `${this.connection.alias} websocket closed unexpectedly: ${code} ${reason}`,
          MessageKind.DEBUG,
          {
            logger,
          },
        );
        this.scheduleReconnect();
      } else {
        notify(
          `${this.connection.alias} websocket closed gracefully`,
          MessageKind.DEBUG,
          {
            logger,
          },
        );
      }
    });

    this.ws.on("error", ({ message }) => {
      notify(
        `${this.connection.alias} websocket error: ${message}`,
        MessageKind.ERROR,
        {
          logger,
        },
      );
    });
  }

  private processLogs(data: LogMessage["data"]) {
    const queryConsole = ExecutionConsole.start();

    data.forEach(({ handle, value }) => {
      if (handle === "STDERR") {
        queryConsole.appendStdErr(decodeQUTF(value), this.connLabel);
      } else if (handle === "STDOUT") {
        queryConsole.appendStdOut(decodeQUTF(value), this.connLabel);
      }
    });
  }

  public disconnect() {
    this.isManualClose = true;
    this.ws?.close();
  }

  private scheduleReconnect() {
    // exponential backoff: 2^n * 1000ms + random jitter
    const delay = Math.min(
      Math.pow(2, this.reconnectAttempts) * 1000 + Math.random() * 200,
      this.MAX_DELAY,
    );

    notify(
      `${this.connection.alias} attempting websocket reconnect in ${delay.toFixed(1)}ms...`,
      MessageKind.DEBUG,
      {
        logger,
      },
    );
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();

    notify(
      `${this.connection.alias} websocket start heartbeat`,
      MessageKind.DEBUG,
      {
        logger,
      },
    );

    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        notify(`${this.connection.alias} websocket ping`, MessageKind.DEBUG, {
          logger,
        });
        this.ws.ping();
      }
    }, this.PING_MS);
  }

  private stopHeartbeat() {
    notify(
      `${this.connection.alias} websocket stop heartbeat`,
      MessageKind.DEBUG,
      {
        logger,
      },
    );

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
