import * as fs from "fs";
import path from "path";
import { ext } from "../extensionVariables";
import {
  DataSourceFiles,
  DataSourceTypes,
  defaultDataSourceFile,
} from "../models/dataSource";

export function createKdbDataSourcesFolder(): string {
  const rootPath = ext.context.globalStorageUri.fsPath;
  const kdbDataSourcesFolderPath = path.join(rootPath, ext.kdbDataSourceFolder);
  if (!fs.existsSync(rootPath)) {
    ext.outputChannel.appendLine(
      `Directory created to the extension folder: ${rootPath}`
    );
    fs.mkdirSync(rootPath);
  }
  if (!fs.existsSync(kdbDataSourcesFolderPath)) {
    ext.outputChannel.appendLine(
      `Directory created to the extension folder: ${kdbDataSourcesFolderPath}`
    );
    fs.mkdirSync(kdbDataSourcesFolderPath);
  }
  return kdbDataSourcesFolderPath;
}

export function convertDataSourceFormToDataSourceFile(
  form: any
): DataSourceFiles {
  const fileContent = defaultDataSourceFile;
  const params: string[] = [];
  fileContent.name = form.name;
  fileContent.dataSource.selectedType = form.selectedType as DataSourceTypes;
  fileContent.dataSource.api.selectedApi = form.selectedApi;
  fileContent.dataSource.qsql.query = form.qsql;
  fileContent.dataSource.qsql.selectedTarget = form.selectedTarget;
  fileContent.dataSource.sql.query = form.sql;

  for (const [key, value] of Object.entries(form)) {
    if (key.includes("param")) {
      if (value) {
        params.push(value.toString());
      }
    }
  }
  fileContent.dataSource.api.params = params;

  return fileContent;
}
