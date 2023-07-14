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
