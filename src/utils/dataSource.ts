import * as fs from "fs";
import path from "path";
import { workspace } from "vscode";

export function createKdbDataSourcesFolder(): string | undefined {
  const workspaceFolders = workspace.workspaceFolders;
  if (!workspaceFolders) {
    return undefined;
  }

  const rootPath = workspaceFolders[0].uri.fsPath;
  const kdbDataSourcesFolderPath = path.join(rootPath, ".kdb-datasources");

  if (!fs.existsSync(kdbDataSourcesFolderPath)) {
    fs.mkdirSync(kdbDataSourcesFolderPath);
  }
  return kdbDataSourcesFolderPath;
}
