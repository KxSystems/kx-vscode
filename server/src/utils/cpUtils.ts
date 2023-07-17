/*
 * Copyright (c) 1998-2023 Kx Systems Inc.
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

export async function executeCommand(
  workingDirectory: string | undefined,
  command: string,
  ...args: string[]
): Promise<string> {
  const result: ICommandResult = await tryExecuteCommand(
    workingDirectory,
    command,
    ...args
  );
  if (result.code !== 0) {
    throw new Error(
      `Failed to run ${command} command.  Check output window for more details.`
    );
  } else {
    console.log(`Finished running command: ${command} ${result.formattedArgs}`);
  }
  return result.cmdOutput;
}

export async function tryExecuteCommand(
  workingDirectory: string | undefined,
  command: string,
  ...args: string[]
): Promise<ICommandResult> {
  return await new Promise(
    (
      resolve: (res: ICommandResult) => void,
      reject: (e: Error) => void
    ): void => {
      let cmdOutput = "";
      let cmdOutputIncludingStderr = "";
      const formattedArgs: string = args.join(" ");

      workingDirectory = workingDirectory || os.tmpdir();
      const options: cp.SpawnOptions = {
        cwd: workingDirectory,
        shell: true,
      };
      const childProc: cp.ChildProcess = cp.spawn(command, args, options);

      childProc.stdout?.on("data", (data: string | Buffer) => {
        data = data.toString();
        cmdOutput = cmdOutput.concat(data);
        cmdOutputIncludingStderr = cmdOutputIncludingStderr.concat(data);
        console.log(data);
      });

      childProc.stderr?.on("data", (data: string | Buffer) => {
        data = data.toString();
        cmdOutputIncludingStderr = cmdOutputIncludingStderr.concat(data);
        console.log(data);
      });

      childProc.on("error", reject);

      childProc.on("close", (code: number) => {
        resolve({ code, cmdOutput, cmdOutputIncludingStderr, formattedArgs });
      });
    }
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
