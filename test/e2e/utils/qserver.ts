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

/**
 * A row of what listMem.q answers with, i.e. one item in the process memory.
 * `typeNum` is the q type of the value, which is what decides the category the
 * item is filed under: 98 a table, 99 a dictionary or a keyed table, 100 a
 * lambda, 104 a projection, 105 a composition, and anything below 98 a plain
 * variable.
 */
export interface MemoryItem {
  id: number;
  pid: number;
  name: string;
  fname: string;
  typeNum: number;
  namespace: string;
  context: string;
  isNs: boolean;
}

// What a failing query reports back.
export const FAILURE = "fake q failure";

/**
 * A q error response: message type 2 carrying type -128 and a null terminated
 * message, which is what makes node-q hand the caller an Error.
 */
function error(message: string) {
  const symbol = Buffer.from(`${message}\0`, "latin1");
  const buffer = Buffer.alloc(9 + symbol.length);
  buffer.writeUInt8(1, 0);
  buffer.writeUInt8(2, 1);
  buffer.writeUInt32LE(buffer.length, 4);
  buffer.writeInt8(-128, 8);
  symbol.copy(buffer, 9);
  return buffer;
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

  // Answer the manifest handshake, i.e. behave like a process with the .vscode
  // namespace loaded. Turn it off to make the extension fall back to sending
  // the evaluate lambda with every request, the way a plain kdb+ process is
  // driven.
  manifest = true;

  // What the process reports having in memory, and which of those names are
  // views. Both are empty until a test says otherwise, which is what every
  // other suite wants: an empty listing leaves the tree with nothing to draw.
  serverObjects: MemoryItem[] = [];
  views: string[] = [];

  // What a query answers with. A suite that renders the result rather than
  // asserting on the request replaces it with something worth rendering — the
  // structured text a real process answers a results view query with.
  data: unknown = "OK";

  // Any query carrying this comes back as a q error instead of a result.
  static readonly FAILS = "FAIL_QUERY";

  // Sockets accepted, so a test can tell "never dialed" from "dialed but the
  // handshake failed".
  connections = 0;

  // The credentials each connection introduced itself with, "user:password" or
  // "anonymous" (see Connection.prototype.auth in node-q).
  readonly handshakes: string[] = [];

  private server?: net.Server;
  private readonly sockets = new Set<net.Socket>();

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

  // Drops the connection from this side, the way a process going away does.
  drop() {
    for (const socket of this.sockets) {
      socket.destroy();
    }
    this.sockets.clear();
  }

  // Only the requests carrying user code, in order: the extension also polls
  // for globals and reserved words over the same connection.
  queries() {
    return this.requests.filter((request) => request.args?.code !== undefined);
  }

  private serve(socket: net.Socket) {
    this.connections++;
    this.sockets.add(socket);
    socket.on("close", () => this.sockets.delete(socket));
    let handshake = true;
    let pending = Buffer.alloc(0);

    socket.on("error", () => {});
    socket.on("data", (data) => {
      if (handshake) {
        handshake = false;
        // The capability byte and its terminator follow the credentials.
        this.handshakes.push(
          data.subarray(0, data.length - 2).toString("latin1"),
        );
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

    if (fn === ".vscode.getManifest" && !this.manifest) {
      socket.write(error(`${fn}`));
      return;
    }

    const response = codec.serialize(this.result(fn, args));
    response.writeUInt8(2, 1);
    socket.write(response);
  }

  private result(fn: string, args?: Request["args"]) {
    // Housekeeping calls carry no code: the manifest handshake, the globals
    // poll and the reserved words poll. Which of them arrives depends on
    // whether the .vscode namespace is in use — the lambda forms come through
    // here too — and an empty list satisfies all but the ones answered here.
    if (args?.code === undefined) {
      switch (fn) {
        case ".vscode.getManifest":
          return { version: "fake" };
        // loadServerObjects() evals what comes back rather than parsing it, so
        // the memory listing goes over the wire as a literal and not as a
        // value.
        case ".vscode.listMem":
          return this.serverObjects;
        case ".vscode.getViews":
          return this.views;
        default:
          return [];
      }
    }

    if (args.code.includes(FakeQ.FAILS)) {
      return { error: true, errorMsg: FAILURE };
    }

    // What LocalConnection.executeQuery expects: no error, and data it can
    // JSON.parse.
    return { error: false, data: JSON.stringify(this.data) };
  }
}
