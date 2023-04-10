import { ChildProcess } from 'node:child_process';
import { ICommandResult, tryExecuteCommand } from './cpUtils';

const isWin = process.platform === 'win32';

export function log(childProcess: ChildProcess): void {
  // ext.outputChannel.appendLine(`Process ${childProcess.pid!} killed`);
}

export async function killPid(pid = NaN): Promise<void> {
  if (isNaN(pid)) {
    return;
  }

  let result: ICommandResult | undefined;
  if (isWin) {
    result = await tryExecuteCommand(undefined, killPidCommand(pid), log);
  } else if (process.platform === 'darwin') {
    result = await tryExecuteCommand('/bin', killPidCommand(pid), log);
  }
  // ext.outputChannel.appendLine(`Destroying Q process result: ${result}`);
  console.log(result);
}

function killPidCommand(pid: number): string {
  return isWin ? `taskkill /PID ${pid} /T /F` : `kill -9 ${pid}`;
}
