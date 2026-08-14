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

import * as net from "node:net";

// The same codec node-q uses on the client side, so the wire format cannot
// drift between the two. It ships no type declarations.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const codec = require("node-q/lib/c.js");

// Everything a request carries: the function or lambda invoked, and, for query
// requests, the arguments the extension packed alongside it.
export interface Request {
  fn: string;
  args?: { code?: string; ctx?: string; returnFormat?: string };
}

// A stand-in kdb+ process. It speaks just enough of the IPC protocol for
// LocalConnection to connect and run queries against it:
//
//   1. the client sends "user:pass" + a capability byte + NUL, and expects a
//      single byte >= 1 back (see Connection.prototype.auth in node-q);
//   2. every message afterwards is an 8 byte header — message type at byte 1,
//      length at byte 4 — followed by the serialized payload. Responses must
//      carry message type 2.
export class FakeQ {
  readonly requests: Request[] = [];

  // Sockets accepted, so a test can tell "never dialed" from "dialed but the
  // handshake failed".
  connections = 0;

  private server?: net.Server;

  listen(port: number) {
    return new Promise<void>((resolve, reject) => {
      this.server = net.createServer((socket) => this.serve(socket));
      this.server.once("error", (error: NodeJS.ErrnoException) =>
        reject(
          error.code === "EADDRINUSE"
            ? new Error(
                `Port ${port} is taken, so the stand-in kdb+ process cannot start. ` +
                  "Another end to end window is probably still open.",
              )
            : error,
        ),
      );
      this.server.listen(port, "127.0.0.1", resolve);
    });
  }

  close() {
    return new Promise<void>((resolve) => {
      if (!this.server) {
        return resolve();
      }
      this.server.close(() => resolve());
      this.server = undefined;
    });
  }

  clear() {
    this.requests.length = 0;
  }

  // Only the requests carrying user code, in order: the extension also polls
  // for globals and reserved words over the same connection.
  queries() {
    return this.requests.filter((request) => request.args?.code !== undefined);
  }

  private serve(socket: net.Socket) {
    this.connections++;
    let handshake = true;
    let pending = Buffer.alloc(0);

    socket.on("error", () => {});
    socket.on("data", (data) => {
      if (handshake) {
        handshake = false;
        socket.write(Buffer.from([3]));
        return;
      }

      pending = Buffer.concat([pending, data]);

      while (pending.length >= 8) {
        const length = pending.readUInt32LE(4);
        if (pending.length < length) {
          break;
        }
        const message = pending.subarray(0, length);
        pending = pending.subarray(length);
        this.respond(socket, codec.deserialize(message));
      }
    });
  }

  private respond(socket: net.Socket, payload: unknown) {
    // k(fn, cb) arrives as a bare string, k(fn, args, cb) as [fn, args].
    const [fn, args] = Array.isArray(payload)
      ? [payload[0], payload[1]]
      : [payload, undefined];

    this.requests.push({ fn, args });

    const response = codec.serialize(this.result(fn));
    response.writeUInt8(2, 1);
    socket.write(response);
  }

  private result(fn: string) {
    switch (fn) {
      // Answering this is what makes the extension use the .vscode namespace
      // rather than sending a lambda with every request.
      case ".vscode.getManifest":
        return { version: "fake" };
      case ".vscode.listMem":
        return [];
      case ".vscode.reservedWords":
        return [];
      default:
        // What LocalConnection.executeQuery expects: no error, and data it can
        // JSON.parse.
        return { error: false, data: JSON.stringify("OK") };
    }
  }
}
