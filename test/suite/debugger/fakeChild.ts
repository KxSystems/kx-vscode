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

import { EventEmitter } from "node:events";
import proxyquire from "proxyquire";
import * as sinon from "sinon";

import type * as qProcessModule from "../../../src/debugger/qProcess";

export class FakeStdin extends EventEmitter {
  public readonly written: string[] = [];

  public write(text: string): boolean {
    this.written.push(text);
    return true;
  }
}

export class FakeChild extends EventEmitter {
  public readonly stdin = new FakeStdin();
  public readonly stdout = new EventEmitter();
  public readonly signals: (string | undefined)[] = [];

  public kill(signal?: string): boolean {
    this.signals.push(signal);
    return true;
  }

  public out(text: string): void {
    this.stdout.emit("data", Buffer.from(text));
  }

  public get lines(): string[] {
    return this.stdin.written.map((text) => text.replace(/\n$/, ""));
  }
}

export function loadQProcess() {
  const children: FakeChild[] = [];
  const spawn = sinon.stub().callsFake(() => {
    const child = new FakeChild();
    children.push(child);
    return child;
  });
  const module: typeof qProcessModule = proxyquire.noPreserveCache()(
    "../../../src/debugger/qProcess",
    { "node:child_process": { spawn } },
  );
  return { module, spawn, children };
}
