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

import type {
  PythonCommandRunConfiguration,
  PythonEnvironment,
} from "@vscode/python-environments";
import * as assert from "node:assert";

import { activationCommand, quote } from "../../../src/utils/replPython";

const environment = (
  execInfo: Partial<PythonEnvironment["execInfo"]>,
): PythonEnvironment =>
  <PythonEnvironment>{
    execInfo: { run: { executable: "/env/bin/python" }, ...execInfo },
  };

const shells = (entries: [string, PythonCommandRunConfiguration[]][]) =>
  new Map(entries);

describe("replPython", () => {
  describe("activationCommand", () => {
    it("should use the activation for the shell", () => {
      const env = environment({
        shellActivation: shells([
          ["bash", [{ executable: "source", args: ["/env/bin/activate"] }]],
          ["cmd", [{ executable: "C:\\env\\Scripts\\activate.bat" }]],
        ]),
      });
      assert.strictEqual(
        activationCommand(env, "bash", {}),
        "source /env/bin/activate",
      );
      assert.strictEqual(
        activationCommand(env, "cmd", {}),
        "C:\\env\\Scripts\\activate.bat",
      );
    });

    it("should fall back to the unknown shell activation", () => {
      const env = environment({
        shellActivation: shells([
          ["unknown", [{ executable: "source", args: ["/env/bin/activate"] }]],
        ]),
        activation: [{ executable: "ignored" }],
      });
      assert.strictEqual(
        activationCommand(env, "bash", {}),
        "source /env/bin/activate",
      );
    });

    it("should fall back to the generic activation", () => {
      const env = environment({
        shellActivation: shells([["zsh", [{ executable: "ignored" }]]]),
        activation: [{ executable: "source", args: ["/env/bin/activate"] }],
      });
      assert.strictEqual(
        activationCommand(env, "bash", {}),
        "source /env/bin/activate",
      );
    });

    it("should chain several commands", () => {
      const env = environment({
        activation: [
          { executable: "source", args: ["/conda/etc/profile.d/conda.sh"] },
          { executable: "conda", args: ["activate", "data"] },
        ],
      });
      assert.strictEqual(
        activationCommand(env, "bash", {}),
        "source /conda/etc/profile.d/conda.sh && conda activate data",
      );
    });

    it("should pass arguments a shell would change through the environment", () => {
      const env = environment({
        activation: [
          { executable: "source", args: ["/my $x/`id`/bin/activate"] },
          { executable: "conda", args: ["activate", "it's"] },
        ],
      });
      const vars: Record<string, string> = {};
      assert.strictEqual(
        activationCommand(env, "bash", vars),
        'source "$KX_REPL_ARG_0" && conda activate "$KX_REPL_ARG_1"',
      );
      assert.deepStrictEqual(vars, {
        KX_REPL_ARG_0: "/my $x/`id`/bin/activate",
        KX_REPL_ARG_1: "it's",
      });
    });

    it("should reference the environment the way cmd expands it", () => {
      const env = environment({
        activation: [{ executable: "C:\\100% env\\Scripts\\activate.bat" }],
      });
      const vars: Record<string, string> = {};
      assert.strictEqual(
        activationCommand(env, "cmd", vars),
        '"%KX_REPL_ARG_0%"',
      );
      assert.deepStrictEqual(vars, {
        KX_REPL_ARG_0: "C:\\100% env\\Scripts\\activate.bat",
      });
    });
  });

  describe("quote", () => {
    it("should keep a safe argument as it is", () => {
      const vars: Record<string, string> = {};
      assert.strictEqual(quote("/opt/q/m64/q", "bash", vars), "/opt/q/m64/q");
      assert.deepStrictEqual(vars, {});
    });

    it("should not quote again what is already quoted", () => {
      const vars: Record<string, string> = {};
      assert.strictEqual(
        quote('"C:\\My Env"', "cmd", vars),
        '"%KX_REPL_ARG_0%"',
      );
      assert.strictEqual(vars.KX_REPL_ARG_0, "C:\\My Env");
    });

    it("should pass a backslash to bash through the environment", () => {
      const vars: Record<string, string> = {};
      assert.strictEqual(quote("/a\\b/q", "bash", vars), '"$KX_REPL_ARG_0"');
      assert.strictEqual(quote("C:\\q\\q.exe", "cmd", vars), "C:\\q\\q.exe");
    });

    it("should not reuse a name that is taken", () => {
      const vars: Record<string, string> = { KX_REPL_ARG_1: "a b" };
      assert.strictEqual(quote("c d", "bash", vars), '"$KX_REPL_ARG_0"');
      assert.strictEqual(quote("e f", "bash", vars), '"$KX_REPL_ARG_2"');
      assert.strictEqual(vars.KX_REPL_ARG_1, "a b");
    });

    it("should number past the variables already set", () => {
      const vars: Record<string, string> = { KX_REPL_ARG_0: "a b", QHOME: "q" };
      assert.strictEqual(quote("c d", "bash", vars), '"$KX_REPL_ARG_1"');
      assert.strictEqual(vars.KX_REPL_ARG_1, "c d");
    });

    it("should be empty for an environment without activation", () => {
      assert.strictEqual(activationCommand(environment({}), "bash", {}), "");
    });
  });
});
