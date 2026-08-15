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
import { renderPlot } from "../utils/plotUtils";
import { hexToBase64, PNG_HEX_IEND, PNG_HEX_PREFIX } from "../utils/queryUtils";
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

  // Hex digits accumulated so far for an image being captured off stdout, and
  // whether a capture is in progress (a zero length capture is still a capture).
  private capture = "";
  private capturing = false;
  // Trailing text held back because it could be the start of a signature split
  // across two frames. Never longer than the signature, so ordinary log output
  // is only ever delayed when it genuinely looks like the start of an image.
  private pending = "";
  // Serialises plot rendering so images appear in the order they were emitted.
  private rendering: Promise<void> = Promise.resolve();

  private readonly MAX_DELAY = 30000;
  private readonly PING_MS = 30000;
  // Hex digits, so twice the image size — 16MB of PNG. Beyond this the run is
  // treated as ordinary text rather than buffered indefinitely.
  private readonly MAX_CAPTURE = 32 * 1024 * 1024;

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
      this.resetCapture();

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
        this.processStdOut(value);
      }
    });
  }

  /**
   * Splits stdout into image runs and ordinary text. An image is emitted by the
   * process as `-1 "0x",raze string png;`, so it reaches us as printable ASCII
   * hex that survives transport intact — which is why this has to look at the
   * raw value, before decodeQUTF rewrites escapes.
   * @param value A raw stdout chunk, which may hold part of an image, several
   * images, or none
   */
  private processStdOut(value: string) {
    let rest = this.pending + value;
    this.pending = "";

    while (rest.length > 0) {
      if (!this.capturing) {
        // Case insensitive, but on a copy so the indices still line up with the
        // original — the payload's case is preserved for the hex decode.
        const at = rest.toLowerCase().indexOf(PNG_HEX_PREFIX);
        if (at < 0) {
          const held = this.partialSignature(rest);
          this.write(rest.slice(0, rest.length - held));
          this.pending = rest.slice(rest.length - held);
          return;
        }
        this.write(rest.slice(0, at));
        this.capturing = true;
        this.capture = "";
        rest = rest.slice(at + 2); // drop the "0x" marker
      }

      // The run ends at the first non-hex character, or at the image's own IEND
      // chunk — whichever comes first. Relying on IEND matters because the log
      // service is not guaranteed to preserve the newline `-1` writes, and
      // without a terminator the image would be buffered indefinitely.
      const end = rest.search(/[^0-9a-fA-F]/);
      this.capture += end < 0 ? rest : rest.slice(0, end);
      rest = end < 0 ? "" : rest.slice(end);

      if (this.capture.length > this.MAX_CAPTURE) {
        this.write(`0x${this.capture}`);
        this.capturing = false;
        this.capture = "";
        continue;
      }
      if (end < 0 && !this.isComplete()) {
        return; // chunk boundary — resume on the next frame
      }
      this.flushCapture();
      // The newline belonged to the image's own line, so drop it rather than
      // emitting an empty console entry.
      rest = rest.replace(/^\r?\n/, "");
    }
  }

  /**
   * Whether the captured run is a whole image, i.e. it closes with the IEND
   * chunk on a byte boundary.
   */
  private isComplete(): boolean {
    return (
      this.capture.length % 2 === 0 &&
      this.capture.toLowerCase().endsWith(PNG_HEX_IEND)
    );
  }

  /**
   * Length of the trailing run of text that could still turn into a signature
   * once the next frame arrives, so it must not reach the console yet.
   * @param text The text about to be written
   * @returns How many characters to hold back, 0 when none could match
   */
  private partialSignature(text: string): number {
    const lower = text.toLowerCase();
    const max = Math.min(PNG_HEX_PREFIX.length - 1, lower.length);

    for (let len = max; len > 0; len--) {
      if (lower.endsWith(PNG_HEX_PREFIX.slice(0, len))) {
        return len;
      }
    }
    return 0;
  }

  /**
   * Renders the captured hex run as an image, or puts it back on the console if
   * it did not parse.
   */
  private flushCapture() {
    const hex = `0x${this.capture}`;
    this.capturing = false;
    this.capture = "";

    const data = hexToBase64(hex);
    if (!data) {
      this.write(hex);
      return;
    }

    notify("GG Plot displayed", MessageKind.DEBUG, {
      logger,
      telemetry: "Results.Graphics.Displayed.ie.stdout",
    });

    this.rendering = this.rendering
      .then(() => renderPlot(data, this.connLabel))
      .catch((error) => {
        notify(errorMessage(error), MessageKind.DEBUG, { logger });
      });
  }

  private write(text: string) {
    if (text.length > 0) {
      ExecutionConsole.start().appendStdOut(decodeQUTF(text), this.connLabel);
    }
  }

  /**
   * Drops any half captured image and flushes held back text, so nothing bleeds
   * into the next session's output. A partial image is unrecoverable once the
   * stream breaks, but held back text is ordinary log output and is kept.
   */
  private resetCapture() {
    const pending = this.pending;
    this.capturing = false;
    this.capture = "";
    this.pending = "";
    this.write(pending);
  }

  public disconnect() {
    this.isManualClose = true;
    this.resetCapture();
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
