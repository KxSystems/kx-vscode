/*
 * Copyright (c) 1998-2025 Kx Systems Inc.
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
import { DataSourceFiles } from "../models/dataSource";
import { DataSourcesPanel } from "../panels/datasource";
import { InsightsConnection } from "../classes/insightsConnection";
import { workspace, window, Uri } from "vscode";
import { Telemetry } from "./telemetryClient";
import { kdbOutputLog } from "./core";

export function createKdbDataSourcesFolder(): string {
  const rootPath = ext.context.globalStorageUri.fsPath;
  const kdbDataSourcesFolderPath = path.join(rootPath, ext.kdbDataSourceFolder);
  if (!fs.existsSync(rootPath)) {
    kdbOutputLog(
      `[DATSOURCE] Directory created to the extension folder: ${rootPath}`,
      "INFO",
    );
    fs.mkdirSync(rootPath);
  }
  if (!fs.existsSync(kdbDataSourcesFolderPath)) {
    kdbOutputLog(
      `[DATSOURCE] Directory created to the extension folder: ${kdbDataSourcesFolderPath}`,
      "INFO",
    );
    fs.mkdirSync(kdbDataSourcesFolderPath);
  }
  return kdbDataSourcesFolderPath;
}

export function convertTimeToTimestamp(time: string): string {
  try {
    const date = new Date(time);
    const isoString = date.toISOString();
    const parts = isoString.split(".");
    const datePart = parts[0];
    const timePart = parts[1].replace("Z", "0").padEnd(9, "0");
    return `${datePart}.${timePart}`;
  } catch (error) {
    kdbOutputLog(
      `The string param is in an incorrect format. Param: ${time} Error: ${error}`,
      "ERROR",
    );
    console.error(
      `The string param is in an incorrect format. Param: ${time} Error: ${error}`,
    );
    return "";
  }
}

export function getConnectedInsightsNode(): string {
  return ext.activeConnection instanceof InsightsConnection
    ? ext.activeConnection.connLabel
    : "";
}

export function checkFileFromInsightsNode(filePath: string): boolean {
  const insightsNode = getConnectedInsightsNode();
  if (!insightsNode || insightsNode === "") {
    return false;
  }
  try {
    const fileData = fs.readFileSync(filePath);
    const fileContent: DataSourceFiles = JSON.parse(fileData.toString());
    return fileContent.insightsNode === insightsNode;
  } catch {
    return false;
  }
}

export function checkIfTimeParamIsCorrect(
  startTS: string,
  endTS: string,
): boolean {
  try {
    const startDate = new Date(startTS);
    const endDate = new Date(endTS);
    return startDate < endDate;
  } catch (error) {
    console.error(
      `The string params are in an incorrect format. startTS: ${startTS}, endTS: ${endTS}, Error: ${error}`,
    );
    return false;
  }
}

export function refreshDataSourcesPanel(): void {
  if (DataSourcesPanel.currentPanel) {
    DataSourcesPanel.currentPanel.refresh();
  }
}

export function convertDataSourceFormToDataSourceFile(
  form: any,
): DataSourceFiles {
  return form as DataSourceFiles;
}

export function oldFilesExists(): boolean {
  const kdbDataSourcesFolderPath = createKdbDataSourcesFolder();
  const files = fs.readdirSync(kdbDataSourcesFolderPath);
  return files.length > 0;
}

/* istanbul ignore next */
export async function importOldDsFiles(): Promise<void> {
  const kdbDataSourcesFolderPath = createKdbDataSourcesFolder();
  const files = fs.readdirSync(kdbDataSourcesFolderPath);
  console.log(files.toString());
  for (const file of files) {
    const fileData = fs.readFileSync(path.join(kdbDataSourcesFolderPath, file));
    const fileContent: DataSourceFiles = JSON.parse(fileData.toString());
    //remove fields that will became deprecated in the future
    fileContent.name = undefined;
    fileContent.originalName = undefined;
    fileContent.insightsNode = undefined;
    // import DS
    await addDSToLocalFolder(fileContent);
    // remove old DS
    fs.unlinkSync(path.join(kdbDataSourcesFolderPath, file));
  }
  ext.oldDSformatExists = false;
}

/* istanbul ignore next */
export async function addDSToLocalFolder(ds: DataSourceFiles): Promise<void> {
  const folders = workspace.workspaceFolders;
  if (folders) {
    const folder = folders[0];
    const importToUri = Uri.joinPath(folder.uri, ".kx");
    await workspace.fs.createDirectory(importToUri);
    let i = 1;
    let fileName = `datasource-${i}.kdb.json`;
    let filePath = path.join(importToUri.fsPath, fileName);
    while (fs.existsSync(filePath)) {
      i++;
      fileName = `datasource-${i}.kdb.json`;
      filePath = path.join(importToUri.fsPath, fileName);
    }
    fs.writeFileSync(filePath, JSON.stringify(ds));
    window.showInformationMessage(`Datasource created.`);
    Telemetry.sendEvent("Datasource.Created");
  }
}
