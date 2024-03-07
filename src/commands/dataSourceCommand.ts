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
import { GetDataError, getDataBodyPayload } from "../models/data";
import {
  DataSourceFiles,
  DataSourceTypes,
  createDefaultDataSourceFile,
} from "../models/dataSource";
import { scratchpadVariableInput } from "../models/items/server";
import { DataSourcesPanel } from "../panels/datasource";
import { KdbDataSourceTreeItem } from "../services/dataSourceTreeProvider";
import {
  checkIfTimeParamIsCorrect,
  convertTimeToTimestamp,
  createKdbDataSourcesFolder,
  getConnectedInsightsNode,
} from "../utils/dataSource";
import {
  addQueryHistory,
  handleScratchpadTableRes,
  handleWSError,
  handleWSResults,
} from "../utils/queryUtils";
import { validateScratchpadOutputVariableName } from "../validators/interfaceValidator";
import {
  getDataInsights,
  getMeta,
  importScratchpad,
  writeQueryResultsToConsole,
  writeQueryResultsToView,
} from "./serverCommand";
import { ServerType } from "../models/server";
import { Telemetry } from "../utils/telemetryClient";

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
  const defaultDataSourceContent = createDefaultDataSourceFile();
  const insightsNode = getConnectedInsightsNode();
  defaultDataSourceContent.name = dataSourceName;
  defaultDataSourceContent.insightsNode = insightsNode;

  fs.writeFileSync(filePath, JSON.stringify(defaultDataSourceContent));
  window.showInformationMessage(
    `Created ${fileName} in ${kdbDataSourcesFolderPath}.`,
  );
  Telemetry.sendEvent("Datasource.Created");
}

export async function renameDataSource(
  oldName: string,
  newName: string,
): Promise<void> {
  const kdbDataSourcesFolderPath = createKdbDataSourcesFolder();
  if (!kdbDataSourcesFolderPath) {
    return;
  }

  const oldFilePath = path.join(
    kdbDataSourcesFolderPath,
    `${oldName}${ext.kdbDataSourceFileExtension}`,
  );
  const newFilePath = path.join(
    kdbDataSourcesFolderPath,
    `${newName}${ext.kdbDataSourceFileExtension}`,
  );

  const dataSourceContent = fs.readFileSync(oldFilePath, "utf8");
  const data = JSON.parse(dataSourceContent) as DataSourceFiles;
  data.name = newName;
  const newFileContent = JSON.stringify(data);
  fs.writeFileSync(oldFilePath, newFileContent);

  fs.renameSync(oldFilePath, newFilePath);

  const panel = DataSourcesPanel.currentPanel;
  if (panel) {
    panel.reload(data);
  }
}

export async function deleteDataSource(
  dataSource: KdbDataSourceTreeItem,
): Promise<void> {
  const kdbDataSourcesFolderPath = createKdbDataSourcesFolder();
  if (!kdbDataSourcesFolderPath) {
    return;
  }

  const dataSourceFilePath = path.join(
    kdbDataSourcesFolderPath,
    `${dataSource.label}${ext.kdbDataSourceFileExtension}`,
  );
  if (fs.existsSync(dataSourceFilePath)) {
    fs.unlinkSync(dataSourceFilePath);
    window.showInformationMessage(
      `Deleted ${dataSource.label} from ${kdbDataSourcesFolderPath}.`,
    );
  }
}

export async function openDataSource(
  dataSource: KdbDataSourceTreeItem,
  uri: Uri,
): Promise<void> {
  const kdbDataSourcesFolderPath = createKdbDataSourcesFolder();
  Object.assign(ext.insightsMeta, await getMeta());
  if (!ext.insightsMeta.assembly) {
    ext.outputChannel.appendLine(
      `To edit or run a datasource you need to be connected to an Insights server`,
    );
    window.showErrorMessage(
      "To edit or run a datasource you need to be connected to an Insights server",
    );
  }
  if (!kdbDataSourcesFolderPath) {
    return;
  }
  fs.readFile(
    path.join(
      kdbDataSourcesFolderPath,
      `${dataSource.label}${ext.kdbDataSourceFileExtension}`,
    ),
    (err, data) => {
      if (err) {
        ext.outputChannel.appendLine(
          `Error reading the file ${dataSource.label}${ext.kdbDataSourceFileExtension}, this file maybe doesn't exist`,
        );
        window.showErrorMessage("Error reading file");
        return;
      }
      if (data) {
        const datasourceContent: DataSourceFiles = JSON.parse(data.toString());
        DataSourcesPanel.render(uri, datasourceContent);
      }
    },
  );
}

export async function saveDataSource(
  dataSourceForm: DataSourceFiles,
): Promise<void> {
  const kdbDataSourcesFolderPath = createKdbDataSourcesFolder();
  if (!kdbDataSourcesFolderPath) {
    return;
  }

  if (!dataSourceForm.originalName || dataSourceForm.name === "") {
    window.showErrorMessage("Name is required");
    return;
  }

  if (dataSourceForm.name !== dataSourceForm.originalName) {
    await renameDataSource(dataSourceForm.originalName, dataSourceForm.name);
  }

  dataSourceForm.insightsNode = getConnectedInsightsNode();
  const fileContent = dataSourceForm;

  const dataSourceFilePath = path.join(
    kdbDataSourcesFolderPath,
    `${dataSourceForm.name}${ext.kdbDataSourceFileExtension}`,
  );

  if (fs.existsSync(dataSourceFilePath)) {
    fs.writeFileSync(dataSourceFilePath, JSON.stringify(fileContent));
    window.showInformationMessage(`DataSource ${dataSourceForm.name} saved.`);
  }
}

export async function populateScratchpad(
  dataSourceForm: DataSourceFiles,
): Promise<void> {
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
        `Invalid scratchpad output variable name: ${outputVariable}`,
      );
    }
  });
}

export async function runDataSource(
  dataSourceForm: DataSourceFiles,
): Promise<void> {
  if (DataSourcesPanel.running) {
    return;
  }
  DataSourcesPanel.running = true;

  try {
    Object.assign(ext.insightsMeta, await getMeta());
    if (!ext.insightsMeta.assembly) {
      ext.outputChannel.appendLine(
        `To run a datasource you need to be connected to an Insights server`,
      );
      window.showErrorMessage(
        "To run a datasource you need to be connected to an Insights server",
      );
      return;
    }

    dataSourceForm.insightsNode = getConnectedInsightsNode();
    const fileContent = dataSourceForm;

    ext.outputChannel.appendLine(`Running ${fileContent.name} datasource...`);
    let res: any;
    const selectedType = getSelectedType(fileContent);
    ext.isDatasourceExecution = true;
    Telemetry.sendEvent("Datasource." + selectedType + ".Run");
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

    ext.isDatasourceExecution = false;
    if (res.error) {
      window.showErrorMessage(res.error);
      addDStoQueryHistory(dataSourceForm, false);
    } else if (ext.resultsViewProvider.isVisible()) {
      ext.outputChannel.appendLine(
        `Results: ${typeof res === "string" ? "0" : res.rows.length} rows`,
      );
      addDStoQueryHistory(dataSourceForm, true);
      writeQueryResultsToView(
        res,
        getQuery(fileContent, selectedType),
        selectedType,
      );
    } else {
      ext.outputChannel.appendLine(
        `Results is a string with length: ${res.length}`,
      );
      addDStoQueryHistory(dataSourceForm, true);
      writeQueryResultsToConsole(
        res,
        getQuery(fileContent, selectedType),
        selectedType,
      );
    }
  } finally {
    DataSourcesPanel.running = false;
  }
}

export function addDStoQueryHistory(
  dataSourceForm: DataSourceFiles,
  success: boolean,
) {
  addQueryHistory(
    dataSourceForm,
    ext.connectionNode?.label ? ext.connectionNode.label : "",
    ServerType.INSIGHTS,
    success,
    false,
    true,
    dataSourceForm.dataSource.selectedType,
  );
}

export function getSelectedType(fileContent: DataSourceFiles): string {
  const selectedType = fileContent.dataSource.selectedType;
  switch (selectedType) {
    case DataSourceTypes.API:
      return "API";
    case DataSourceTypes.QSQL:
      return "QSQL";
    case DataSourceTypes.SQL:
      return "SQL";
    default:
      throw new Error(`Invalid selectedType: ${selectedType}`);
  }
}

export async function runApiDataSource(
  fileContent: DataSourceFiles,
): Promise<any> {
  const isTimeCorrect = checkIfTimeParamIsCorrect(
    fileContent.dataSource.api.startTS,
    fileContent.dataSource.api.endTS,
  );
  if (!isTimeCorrect) {
    window.showErrorMessage(
      "The time parameters(startTS and endTS) are not correct, please check the format or if the startTS is before the endTS",
    );
    return;
  }
  const apiBody = getApiBody(fileContent);
  const apiCall = await getDataInsights(
    ext.insightsServiceGatewayUrls.data,
    JSON.stringify(apiBody),
  );

  if (apiCall?.error) {
    return parseError(apiCall.error);
  } else if (apiCall?.arrayBuffer) {
    const results = handleWSResults(apiCall.arrayBuffer);
    return handleScratchpadTableRes(results);
  } else {
    return { error: "API call failed" };
  }
}

export function getApiBody(
  fileContent: DataSourceFiles,
): Partial<getDataBodyPayload> {
  const api = fileContent.dataSource.api;

  const apiBody: getDataBodyPayload = {
    table: fileContent.dataSource.api.table,
    startTS: convertTimeToTimestamp(api.startTS),
    endTS: convertTimeToTimestamp(api.endTS),
  };

  const optional = api.optional;

  if (optional) {
    if (optional.filled) {
      apiBody.fill = api.fill;
    }
    if (optional.temporal) {
      apiBody.temporality = api.temporality;
    }

    const labels = optional.labels.filter((label) => label.active);

    if (labels.length > 0) {
      apiBody.labels = Object.assign(
        {},
        ...labels.map((label) => ({ [label.key]: label.value })),
      );
    }

    const filters = optional.filters
      .filter((filter) => filter.active)
      .map((filter) => [
        filter.operator,
        filter.column,
        ((values: string) => {
          const tokens = values.split(/[;\s]+/).map((token) => {
            const number = parseFloat(token);
            return isNaN(number) ? token : number;
          });
          return tokens.length === 1 ? tokens[0] : tokens;
        })(filter.values),
      ]);

    if (filters.length > 0) {
      apiBody.filter = filters;
    }

    const sorts = optional.sorts
      .filter((sort) => sort.active)
      .map((sort) => sort.column);

    if (sorts.length > 0) {
      apiBody.sortCols = sorts;
    }

    const aggs = optional.aggs
      .filter((agg) => agg.active)
      .map((agg) => [agg.key, agg.operator, agg.column]);

    if (aggs.length > 0) {
      apiBody.agg = aggs;
    }

    const groups = optional.groups
      .filter((group) => group.active)
      .map((group) => group.column);

    if (groups.length > 0) {
      apiBody.groupBy = groups;
    }
  }

  return apiBody;
}

export async function runQsqlDataSource(
  fileContent: DataSourceFiles,
): Promise<any> {
  const assembly = fileContent.dataSource.qsql.selectedTarget.slice(0, -4);
  const target = fileContent.dataSource.qsql.selectedTarget.slice(-3);
  const qsqlBody = {
    assembly: assembly,
    target: target,
    query: fileContent.dataSource.qsql.query,
  };
  const qsqlCall = await getDataInsights(
    ext.insightsServiceGatewayUrls.qsql,
    JSON.stringify(qsqlBody),
  );

  if (qsqlCall?.error) {
    return parseError(qsqlCall.error);
  } else if (qsqlCall?.arrayBuffer) {
    const results = handleWSResults(qsqlCall.arrayBuffer);
    return handleScratchpadTableRes(results);
  } else {
    return { error: "API call failed" };
  }
}

export async function runSqlDataSource(
  fileContent: DataSourceFiles,
): Promise<any> {
  const sqlBody = {
    query: fileContent.dataSource.sql.query,
  };
  const sqlCall = await getDataInsights(
    ext.insightsServiceGatewayUrls.sql,
    JSON.stringify(sqlBody),
  );

  if (sqlCall?.error) {
    return parseError(sqlCall.error);
  } else if (sqlCall?.arrayBuffer) {
    const results = handleWSResults(sqlCall.arrayBuffer);
    return handleScratchpadTableRes(results);
  } else {
    return { error: "API call failed" };
  }
}

export function getQuery(
  fileContent: DataSourceFiles,
  selectedType: string,
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

function parseError(error: GetDataError) {
  if (error instanceof Object && error.buffer) {
    return handleWSError(error.buffer);
  } else {
    ext.outputChannel.appendLine(`Error: ${error}`);
    return {
      error,
    };
  }
}
