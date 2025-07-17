/*
 * Copyright (c) 1998-2025 Kx Systems Inc.
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

import * as cp from "child_process";
import * as os from "os";
import { join } from "path";

import { ext } from "../extensionVariables";
import { getAutoFocusOutputOnEntrySetting } from "./core";
import { MessageKind, notify } from "./notifications";

const logger = "cpUtils";

export async function executeCommand(
  workingDirectory: string | undefined,
  command: string,
  spawnCallback: (cp: cp.ChildProcess, args: string[]) => void,
  ...args: string[]
): Promise<string> {
  const result: ICommandResult = await tryExecuteCommand(
    workingDirectory,
    command,
    spawnCallback,
    ...args,
  );
  if (getAutoFocusOutputOnEntrySetting()) {
    ext.outputChannel.show();
  }
  if (result.code !== 0) {
    throw new Error(
      `Failed to run ${command} command.  Check output window for more details.`,
    );
  } else {
    notify(
      `Finished running command: ${command} ${result.formattedArgs}`,
      MessageKind.DEBUG,
      { logger },
    );
  }
  return result.cmdOutput;
}

export async function tryExecuteCommand(
  workingDirectory: string | undefined,
  command: string,
  spawnCallback: (cp: cp.ChildProcess, args: string[]) => void,
  ...args: string[]
): Promise<ICommandResult> {
  return await new Promise(
    (
      resolve: (res: ICommandResult) => void,
      reject: (e: Error) => void,
    ): void => {
      let cmdOutput = "";
      let cmdOutputIncludingStderr = "";
      const formattedArgs: string = args.join(" ");

      workingDirectory = workingDirectory || os.tmpdir();
      const options: cp.SpawnOptions = {
        cwd: workingDirectory,
        shell: process.platform === "darwin" ? true : false,
      };
      let childProc: cp.ChildProcess;
      if (process.platform === "darwin") {
        // need to send the escaped working directory and command together for MacOS
        workingDirectory = workingDirectory.replace(/\s/g, "\\ ");
        childProc = cp.spawn(join(workingDirectory, command), args, options);
      } else if (process.platform === "linux") {
        childProc = cp.spawn(
          workingDirectory === os.tmpdir()
            ? command
            : join(workingDirectory, command),
          args,
          options,
        );
      } else {
        childProc = cp.spawn(command, args, options);
      }

      childProc.on("spawn", () => {
        spawnCallback(childProc, args);
      });

      childProc.stdout?.on("data", (data: string | Buffer) => {
        data = data.toString();
        cmdOutput = cmdOutput.concat(data);
        cmdOutputIncludingStderr = cmdOutputIncludingStderr.concat(data);
        notify(data, MessageKind.DEBUG, { logger });
      });

      childProc.stderr?.on("data", (data: string | Buffer) => {
        data = data.toString();
        cmdOutputIncludingStderr = cmdOutputIncludingStderr.concat(data);
        notify(data, MessageKind.DEBUG, { logger });
      });

      childProc.on("error", (error) => {
        notify(error.message, MessageKind.ERROR, { logger });
        reject(error);
      });

      childProc.on("close", (code: number) => {
        resolve({ code, cmdOutput, cmdOutputIncludingStderr, formattedArgs });
      });
    },
  );
}

export interface ICommandResult {
  code: number;
  cmdOutput: string;
  cmdOutputIncludingStderr: string;
  formattedArgs: string;
}

const quotationMark: string = process.platform === "win32" ? '"' : "'";

export function wrapArgInQuotes(arg?: string | boolean | number): string {
  arg ??= "";
  return typeof arg === "string"
    ? quotationMark + arg + quotationMark
    : String(arg);
}
