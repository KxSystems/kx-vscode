/*
 * Copyright (c) 1998-2025 KX Systems Inc.
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
import { executeDataQuery } from "./executionCommands";
import {
  writeQueryResultsToConsole,
  writeQueryResultsToView,
} from "./serverCommand";
import { ServerType } from "../models/connectionsModels";
import { GetDataError } from "../models/data";
import {
  DataSourceFiles,
  DataSourceTypes,
  createDefaultDataSourceFile,
} from "../models/dataSource";
import { ExecutionTypes } from "../models/execution";
import { DataSourcesPanel } from "../panels/datasource";
import { noSelectedConnectionAction } from "../utils/core";
import {
  createKdbDataSourcesFolder,
  getConnectedInsightsNode,
} from "../utils/dataSource";
import { getDSExecutionType } from "../utils/execution";
import { MessageKind, notify } from "../utils/notifications";
import {
  addQueryHistory,
  getQSQLWrapper,
  handleScratchpadTableRes,
  handleWSError,
  handleWSResults,
} from "../utils/queryUtils";

const logger = "dataSourceCommand";

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
  notify(
    `Created ${fileName} in ${kdbDataSourcesFolderPath}.`,
    MessageKind.INFO,
    { logger, telemetry: "Datasource.Created" },
  );
}

export function convertDSDataResponse(dataQueryCall: any) {
  if (dataQueryCall?.error) {
    return parseError(dataQueryCall.error);
  } else if (dataQueryCall?.arrayBuffer) {
    const results = handleWSResults(dataQueryCall.arrayBuffer);
    return handleScratchpadTableRes(results);
  } else {
    return { error: "Datasource Data Query failed" };
  }
}

export async function runDataSource(
  dataSourceForm: DataSourceFiles,
  connLabel: string,
  executorName: string,
): Promise<any> {
  if (DataSourcesPanel.running) {
    return;
  }

  if (connLabel === "") {
    noSelectedConnectionAction();
    return;
  }

  DataSourcesPanel.running = true;

  try {
    dataSourceForm.insightsNode = getConnectedInsightsNode();
    let target;
    const fileContent = dataSourceForm;

    const selectedType = getSelectedType(fileContent);
    ext.isDatasourceExecution = true;

    notify(`Running ${fileContent.name} datasource...`, MessageKind.DEBUG, {
      logger,
      telemetry: "Datasource." + selectedType + ".Run",
    });

    const selectedDSExecutionType = getDSExecutionType(fileContent);

    if (selectedDSExecutionType === DataSourceTypes.QSQL) {
      target = fileContent.dataSource.qsql.selectedTarget;
    }

    const dataQueryCall = await executeDataQuery(
      connLabel,
      ExecutionTypes.QueryDatasource,
      target,
      fileContent,
    );

    let res = convertDSDataResponse(dataQueryCall);

    ext.isDatasourceExecution = false;
    if (res) {
      const success = !res.error;
      const querySample = getQuerySample(fileContent, selectedType);

      if (!success) {
        notify("Query execution failed.", MessageKind.DEBUG, {
          logger,
          params: res.error,
          telemetry: "Datasource." + selectedType + ".Run.Error",
        });
      }
      if (ext.isResultsTabVisible) {
        if (success) {
          const resultCount = typeof res === "string" ? "0" : res.rows.length;
          notify(`Results: ${resultCount} rows`, MessageKind.DEBUG, {
            logger,
          });
        } else if (!success) {
          res = res.errorMsg ? res.errorMsg : res.error;
        }

        await writeQueryResultsToView(
          res,
          querySample,
          connLabel,
          executorName,
          true,
          selectedType,
        );
      } else {
        if (success) {
          notify(
            `Results is a string with length: ${res.length}`,
            MessageKind.DEBUG,
            { logger },
          );
        } else if (res.error) {
          res = res.errorMsg ? res.errorMsg : res.error;
        }

        await writeQueryResultsToConsole(
          res,
          querySample,
          connLabel,
          executorName,
          true,
          selectedType,
        );
      }
      addDStoQueryHistory(dataSourceForm, success, connLabel, executorName);
    }
  } catch (error) {
    notify(`Datasource error: ${error}.`, MessageKind.DEBUG, {
      logger,
      params: error,
    });
    DataSourcesPanel.running = false;
  } finally {
    DataSourcesPanel.running = false;
  }
}

export function addDStoQueryHistory(
  dataSourceForm: DataSourceFiles,
  success: boolean,
  connLabel: string,
  executrorName: string,
) {
  addQueryHistory(
    dataSourceForm,
    executrorName,
    connLabel,
    ServerType.INSIGHTS,
    success,
    false,
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
    case DataSourceTypes.UDA:
      return "UDA";
    default:
      throw new Error(`Invalid selectedType: ${selectedType}`);
  }
}

export function getQuerySample(
  fileContent: DataSourceFiles,
  selectedType: string,
): string {
  switch (selectedType) {
    case "API":
      return `GetData - table: ${fileContent.dataSource.api.table}`;
    case "QSQL":
      return fileContent.dataSource.qsql.query;
    case "UDA":
      return `Executed UDA: ${fileContent.dataSource.uda?.name}`;
    case "SQL":
    default:
      return fileContent.dataSource.sql.query;
  }
}

export function parseError(error: GetDataError) {
  if (error instanceof Object && error.buffer) {
    return handleWSError(error.buffer);
  } else {
    notify(`Datasource error.`, MessageKind.DEBUG, {
      logger,
      params: error,
    });
    return {
      error,
    };
  }
}

export function getPartialDatasourceFile(
  query: string,
  selectedTarget?: string,
  isSql?: boolean,
  isPython?: boolean,
) {
  return isSql
    ? <DataSourceFiles>{
        dataSource: {
          selectedType: "SQL",
          sql: { query },
        },
      }
    : <DataSourceFiles>{
        dataSource: {
          selectedType: "QSQL",
          qsql: { query: getQSQLWrapper(query, isPython), selectedTarget },
        },
      };
}
