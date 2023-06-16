import * as fs from "fs";
import path from "path";
import { ext } from "../extensionVariables";

export function createKdbDataSourcesFolder(): string {
  const rootPath = ext.context.globalStorageUri.fsPath;
  const kdbDataSourcesFolderPath = path.join(rootPath, ext.kdbDataSourceFolder);
  if (!fs.existsSync(rootPath)) {
    fs.mkdirSync(rootPath);
  }
  if (!fs.existsSync(kdbDataSourcesFolderPath)) {
    fs.mkdirSync(kdbDataSourcesFolderPath);
  }
  return kdbDataSourcesFolderPath;
}
