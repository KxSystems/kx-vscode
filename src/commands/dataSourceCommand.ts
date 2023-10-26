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
import { InputBoxOptions, Uri, window } from "vscode";
import { ext } from "../extensionVariables";
import { getDataBodyPayload } from "../models/data";
import { DataSourceFiles, defaultDataSourceFile } from "../models/dataSource";
import { scratchpadVariableInput } from "../models/items/server";
import { DataSourcesPanel } from "../panels/datasource";
import { KdbDataSourceTreeItem } from "../services/dataSourceTreeProvider";
import {
  checkIfTimeParamIsCorrect,
  convertDataSourceFormToDataSourceFile,
  convertTimeToTimestamp,
  createKdbDataSourcesFolder,
  getConnectedInsightsNode,
} from "../utils/dataSource";
import { handleWSResults } from "../utils/queryUtils";
import { validateScratchpadOutputVariableName } from "../validators/interfaceValidator";
import {
  getDataInsights,
  getMeta,
  importScratchpad,
  writeQueryResultsToConsole,
  writeQueryResultsToView,
} from "./serverCommand";

export async function addDataSource(): Promise<void> {
  const kdbDataSourcesFolderPath = createKdbDataSourcesFolder();

  let length = 0;
  let fileName = `datasource-${length}${ext.kdbDataSourceFileExtension}`;
  let filePath = path.join(kdbDataSourcesFolderPath, fileName);

  while (fs.existsSync(filePath)) {
    length++;
    fileName = `datasource-${length}${ext.kdbDataSourceFileExtension}`;
    filePath = path.join(kdbDataSourcesFolderPath, fileName);
  }
  const dataSourceName = fileName.replace(ext.kdbDataSourceFileExtension, "");
  const defaultDataSourceContent = defaultDataSourceFile;
  const insightsNode = getConnectedInsightsNode();
  defaultDataSourceContent.name = dataSourceName;
  defaultDataSourceContent.insightsNode = insightsNode;

  fs.writeFileSync(filePath, JSON.stringify(defaultDataSourceContent));
  window.showInformationMessage(
    `Created ${fileName} in ${kdbDataSourcesFolderPath}.`
  );
}

export async function renameDataSource(
  oldName: string,
  newName: string
): Promise<void> {
  const kdbDataSourcesFolderPath = createKdbDataSourcesFolder();
  if (!kdbDataSourcesFolderPath) {
    return;
  }

  const oldFilePath = path.join(
    kdbDataSourcesFolderPath,
    `${oldName}${ext.kdbDataSourceFileExtension}`
  );
  const newFilePath = path.join(
    kdbDataSourcesFolderPath,
    `${newName}${ext.kdbDataSourceFileExtension}`
  );

  const dataSourceContent = fs.readFileSync(oldFilePath, "utf8");
  const data = JSON.parse(dataSourceContent) as DataSourceFiles;
  data.name = newName;
  const newFileContent = JSON.stringify(data);
  fs.writeFileSync(oldFilePath, newFileContent);

  fs.renameSync(oldFilePath, newFilePath);
}

export async function deleteDataSource(
  dataSource: KdbDataSourceTreeItem
): Promise<void> {
  const kdbDataSourcesFolderPath = createKdbDataSourcesFolder();
  if (!kdbDataSourcesFolderPath) {
    return;
  }

  const dataSourceFilePath = path.join(
    kdbDataSourcesFolderPath,
    `${dataSource.label}${ext.kdbDataSourceFileExtension}`
  );
  if (fs.existsSync(dataSourceFilePath)) {
    fs.unlinkSync(dataSourceFilePath);
    window.showInformationMessage(
      `Deleted ${dataSource.label} from ${kdbDataSourcesFolderPath}.`
    );
  }
}

export async function openDataSource(
  dataSource: KdbDataSourceTreeItem,
  uri: Uri
): Promise<void> {
  const kdbDataSourcesFolderPath = createKdbDataSourcesFolder();
  Object.assign(ext.insightsMeta, await getMeta());
  if (!ext.insightsMeta.assembly) {
    ext.outputChannel.appendLine(
      `To edit or run a datasource you need to be connected to an Insights server`
    );
    window.showErrorMessage(
      "To edit or run a datasource you need to be connected to an Insights server"
    );
  }
  if (!kdbDataSourcesFolderPath) {
    return;
  }
  fs.readFile(
    path.join(
      kdbDataSourcesFolderPath,
      `${dataSource.label}${ext.kdbDataSourceFileExtension}`
    ),
    (err, data) => {
      if (err) {
        ext.outputChannel.appendLine(
          `Error reading the file ${dataSource.label}${ext.kdbDataSourceFileExtension}, this file maybe doesn't exist`
        );
        window.showErrorMessage("Error reading file");
        return;
      }
      if (data) {
        const datasourceContent: DataSourceFiles = JSON.parse(data.toString());
        DataSourcesPanel.render(uri, datasourceContent);
      }
    }
  );
}

export async function saveDataSource(dataSourceForm: any): Promise<void> {
  const kdbDataSourcesFolderPath = createKdbDataSourcesFolder();
  if (!kdbDataSourcesFolderPath) {
    return;
  }

  if (dataSourceForm.name === "") {
    window.showErrorMessage("Name is required");
    return;
  }
  if (dataSourceForm.name !== dataSourceForm.originalName) {
    await renameDataSource(dataSourceForm.originalName, dataSourceForm.name);
  }

  const fileContent = convertDataSourceFormToDataSourceFile(dataSourceForm);

  const dataSourceFilePath = path.join(
    kdbDataSourcesFolderPath,
    `${dataSourceForm.name}${ext.kdbDataSourceFileExtension}`
  );

  if (fs.existsSync(dataSourceFilePath)) {
    fs.writeFileSync(dataSourceFilePath, JSON.stringify(fileContent));
  }
  window.showInformationMessage(`DataSource ${dataSourceForm.name} saved.`);
}

export async function populateScratchpad(dataSourceForm: any): Promise<void> {
  const scratchpadVariable: InputBoxOptions = {
    prompt: scratchpadVariableInput.prompt,
    placeHolder: scratchpadVariableInput.placeholder,
    validateInput: (value: string | undefined) =>
      validateScratchpadOutputVariableName(value),
  };

  window.showInputBox(scratchpadVariable).then(async (outputVariable) => {
    if (outputVariable !== undefined && outputVariable !== "") {
      await importScratchpad(outputVariable!, dataSourceForm!);
    } else {
      ext.outputChannel.appendLine(
        `Invalid scratchpad output variable name: ${outputVariable}`
      );
    }
  });
}

export async function runDataSource(dataSourceForm: any): Promise<void> {
  Object.assign(ext.insightsMeta, await getMeta());
  if (!ext.insightsMeta.assembly) {
    ext.outputChannel.appendLine(
      `To run a datasource you need to be connected to an Insights server`
    );
    window.showErrorMessage(
      "To run a datasource you need to be connected to an Insights server"
    );
    return;
  }
  const fileContent = convertDataSourceFormToDataSourceFile(dataSourceForm);

  let res: any;
  const selectedType = getSelectedType(fileContent);

  switch (selectedType) {
    case "API":
      res = await runApiDataSource(fileContent);
      break;
    case "QSQL":
      res = await runQsqlDataSource(fileContent);
      break;
    case "SQL":
    default:
      res = await runSqlDataSource(fileContent);
      break;
  }

  if (ext.resultsViewProvider.isVisible()) {
    writeQueryResultsToView(res, selectedType);
  } else {
    writeQueryResultsToConsole(
      res,
      getQuery(fileContent, selectedType),
      selectedType
    );
  }
}

export function getSelectedType(fileContent: DataSourceFiles): string {
  const selectedType = fileContent.dataSource.selectedType.toString();
  switch (selectedType) {
    case "API":
    case "0":
      return "API";
    case "QSQL":
    case "1":
      return "QSQL";
    case "SQL":
    case "2":
      return "SQL";
    default:
      throw new Error(`Invalid selectedType: ${selectedType}`);
  }
}

export async function runApiDataSource(
  fileContent: DataSourceFiles
): Promise<any> {
  const isTimeCorrect = checkIfTimeParamIsCorrect(
    fileContent.dataSource.api.startTS,
    fileContent.dataSource.api.endTS
  );
  if (!isTimeCorrect) {
    window.showErrorMessage(
      "The time parameters(startTS and endTS) are not correct, please check the format or if the startTS is before the endTS"
    );
    return;
  }
  const apiBody = getApiBody(fileContent);
  const apiCall = await getDataInsights(
    ext.insightsAuthUrls.dataURL,
    JSON.stringify(apiBody)
  );
  if (apiCall?.arrayBuffer) {
    return handleWSResults(apiCall.arrayBuffer);
  }
}

export function getApiBody(
  fileContent: DataSourceFiles
): Partial<getDataBodyPayload> {
  const {
    startTS,
    endTS,
    fill,
    temporality,
    filter,
    groupBy,
    agg,
    sortCols,
    slice,
    labels,
    table,
  } = fileContent.dataSource.api;

  const startTSValue = startTS?.trim() ? convertTimeToTimestamp(startTS) : "";
  const endTSValue = endTS?.trim() ? convertTimeToTimestamp(endTS) : "";
  const fillValue = fill?.trim() || undefined;
  const temporalityValue = temporality?.trim() || undefined;
  const filterValue = filter.length ? filter : undefined;
  const groupByValue = groupBy.length ? groupBy : undefined;
  const aggValue = agg.length ? agg : undefined;
  const sortColsValue = sortCols.length ? sortCols : undefined;
  const sliceValue = slice.length ? slice : undefined;
  const labelsValue = labels.length ? labels : undefined;

  const apiBodyAux: getDataBodyPayload = {
    table,
    startTS: startTSValue,
    endTS: endTSValue,
    fill: fillValue,
    temporality: temporalityValue,
    groupBy: groupByValue,
    agg: aggValue,
    sortCols: sortColsValue,
    slice: sliceValue,
    labels: labelsValue,
  };

  if (filterValue !== undefined) {
    apiBodyAux.filter = filterValue.map((filterEl: string) => {
      return filterEl.split(";");
    });
  }

  const apiBody = Object.fromEntries(
    Object.entries(apiBodyAux).filter(([_, value]) => value !== undefined)
  );

  return apiBody;
}

export async function runQsqlDataSource(
  fileContent: DataSourceFiles
): Promise<any> {
  const assembly = fileContent.dataSource.qsql.selectedTarget.slice(0, -4);
  const target = fileContent.dataSource.qsql.selectedTarget.slice(-3);
  const qsqlBody = {
    assembly: assembly,
    target: target,
    query: fileContent.dataSource.qsql.query,
  };
  const qsqlCall = await getDataInsights(
    ext.insightsAuthUrls.qsqlURL,
    JSON.stringify(qsqlBody)
  );
  if (qsqlCall?.arrayBuffer) {
    return handleWSResults(qsqlCall.arrayBuffer);
  }
}

export async function runSqlDataSource(
  fileContent: DataSourceFiles
): Promise<any> {
  const sqlBody = {
    query: fileContent.dataSource.sql.query,
  };
  const sqlCall = await getDataInsights(
    ext.insightsAuthUrls.sqlURL,
    JSON.stringify(sqlBody)
  );
  if (sqlCall?.arrayBuffer) {
    return handleWSResults(sqlCall.arrayBuffer);
  }
}

export function getQuery(
  fileContent: DataSourceFiles,
  selectedType: string
): string {
  switch (selectedType) {
    case "API":
      return `GetData - table: ${fileContent.dataSource.api.table}`;
    case "QSQL":
      return fileContent.dataSource.qsql.query;
    case "SQL":
    default:
      return fileContent.dataSource.sql.query;
  }
}
