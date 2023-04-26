import { env } from "node:process";
import path from "path";
import { window } from "vscode";
import { QueryResultType } from "../models/queryResult";
import { TableGenerator } from "./tableGenerator";

export function runQFileTerminal(filename: string) {
  filename = filename.replace(/\\/g, "/");
  const terminalName = path.parse(filename).base;
  const command = `q ${filename}`;
  window.terminals.forEach((terminal) => {
    if (terminal.name === terminalName) terminal.dispose();
  });
  const terminal = window.createTerminal(terminalName);
  if (env.QHOME) {
    terminal.show();
    terminal.sendText(command);
  }
}

export function handleQueryResults(
  results: any,
  type: QueryResultType
): string {
  let handledResult: string;
  switch (type) {
    case QueryResultType.Text:
      if (Array.isArray(JSON.parse(results))) {
        handledResult = JSON.parse(results).join(" ");
      } else {
        handledResult = results;
      }
      break;
    case QueryResultType.JSON:
      handledResult = new TableGenerator({ spacer: " " })
        .fromJson(JSON.parse(results))
        .toString();
      break;
    case QueryResultType.Error:
    default:
      handledResult = "!@#ERROR^&*%";
      break;
  }
  return handledResult;
}
