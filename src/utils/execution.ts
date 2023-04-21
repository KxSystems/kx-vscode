import path from 'path';
import { window } from 'vscode';
import { env } from 'node:process';

export function runQFileTerminal(filename: string) {
  const terminalName = path.parse(filename).base;
  const command = `q ${filename}`;
  window.terminals.forEach(terminal => {
    if(terminal.name === terminalName)
      terminal.dispose();    
  });
  const terminal = window.createTerminal(terminalName);
  if( env.QHOME){
    terminal.show();
    terminal.sendText(command);
  }
}
