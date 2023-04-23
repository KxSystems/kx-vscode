import { ChildProcess } from 'node:child_process';

export interface LocalProcess {
  [name: string]: ChildProcess;
}
