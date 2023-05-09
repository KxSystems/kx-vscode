import * as cp from "child_process";
import * as os from "os";
import { join } from "path";
import { ext } from "../extensionVariables";

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
    ...args
  );
  if (result.code !== 0) {
    ext.outputChannel.show();
    throw new Error(
      `Failed to run ${command} command.  Check output window for more details.`
    );
  } else {
    ext.outputChannel.append(
      `Finished running command: ${command} ${result.formattedArgs}`
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
      reject: (e: Error) => void
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
        workingDirectory = workingDirectory.replace(/(\s+)/g, "\\ ");
        childProc = cp.spawn(join(workingDirectory, command), args, options);
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
        ext.outputChannel.append(data);
      });

      childProc.stderr?.on("data", (data: string | Buffer) => {
        data = data.toString();
        cmdOutputIncludingStderr = cmdOutputIncludingStderr.concat(data);
        ext.outputChannel.append(data);
      });

      childProc.on("error", (error) => {
        console.log(error);
        reject(error);
      });

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
