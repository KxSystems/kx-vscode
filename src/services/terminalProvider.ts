import { EventEmitter, Pseudoterminal, window } from 'vscode';
import { ext } from '../extensionVariables';

export function getPty(): Pseudoterminal {
  let line = '';
  const emt: EventEmitter<string> = new EventEmitter<string>();

  const pty = {
    onDidWrite: emt.event,
    open: () => emt.fire('q)'),
    close: () => {
      /* noop */
    },
    handleInput: async (data: string) => {
      if (data === '\r') {
        if (!ext.connection?.connected) {
          window.showErrorMessage('No active connection, please register/connect to a KDB server');
          close();
        }

        const result = await ext.connection?.execute(line);
        emt.fire(`\r\n${result}\r\n\r\nq)`);
        line = '';
        return;
      }

      if (data === '\x7f') {
        if (line.length === 0) {
          return;
        }
        line = line.substr(0, line.length - 1);
        emt.fire('\x1b[D');
        emt.fire('\x1b[P');
        return;
      }

      line += data;
      emt.fire(data);
    },
  };
  return pty;
}
