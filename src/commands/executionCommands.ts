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

import * as vscode from "vscode";

import { LocalConnection } from "../classes/localConnection";
import { ext } from "../extensionVariables";
import {
  writeQueryResultsToConsole,
  writeQueryResultsToView,
} from "./serverCommand";
import { ServerType } from "../models/connectionsModels";
import { DataSourceFiles, DataSourceTypes } from "../models/dataSource";
import { ExecutionTypes } from "../models/execution";
import { scratchpadVariableInput } from "../models/items/server";
import { Plot } from "../models/plot";
import { ChartEditorProvider } from "../services/chartEditorProvider";
import { ConnectionManagementService } from "../services/connectionManagerService";
import { inputVariable } from "../services/notebookProviders";
import {
  getExecutionQueryContext,
  isExecutionPython,
  retrieveEditorSelectionToExecute,
  retrieveEditorText,
  getQuery,
  getDSExecutionType,
  isExecutionNotebook,
  convertDSDataResponse,
  isExecutionDS,
  isExecutionWorkbook,
} from "../utils/execution";
import { MessageKind, notify, Runner } from "../utils/notifications";
import {
  addQueryHistory,
  needsScratchpad,
  resultToBase64,
  sanitizeQuery,
} from "../utils/queryUtils";
import {
  generateScratchpadQueryReqBody,
  selectAndGenerateScratchpadImportReqBody,
  selectAndGenerateServicegatewayReqBody,
} from "../utils/requestBody";
import {
  addWorkspaceFile,
  openWith,
  setUriContent,
  workspaceHas,
} from "../utils/workspace";
import { validateScratchpadOutputVariableName } from "../validators/interfaceValidator";

const logger = "executionCommands";

export async function selectFileExecutionMethod(
  connLabel: string,
  type: ExecutionTypes,
  executorName: string,
  target?: string,
  datasourceFile?: DataSourceFiles,
  rerunQuery?: string,
) {
  const isPython = isExecutionPython(type);
  const isDS = isExecutionDS(datasourceFile);
  const isWorkbook = isExecutionWorkbook(executorName);
  const isNotebook = isExecutionNotebook(type) ? true : false;
  const hasTarget = target !== undefined && target !== "scratchpad";
  const runner = Runner.create(async (_) => {
    return hasTarget
      ? await executeDataQuery(connLabel, type, target, datasourceFile)
      : await executeQuery(connLabel, type, rerunQuery);
  });

  runner.title = `Executing ${executorName} on ${connLabel || "active connection"}.`;

  let res, success;

  if (hasTarget) {
    const selectedType = datasourceFile?.dataSource?.selectedType
      ? datasourceFile.dataSource.selectedType
      : DataSourceTypes.QSQL;
    const querySample = getDataQuerySample(datasourceFile, selectedType, type);
    const startTime = Date.now();
    res = await runner.execute();
    const endTime = Date.now();
    const duration = (endTime - startTime).toString();
    success = await handleDataQueryResponse(
      res,
      querySample,
      connLabel,
      executorName,
      selectedType,
      isNotebook,
      isPython,
      isDS,
      isWorkbook,
      duration,
    );

    addQueryHistory(
      datasourceFile ? datasourceFile : querySample,
      executorName,
      connLabel,
      ServerType.INSIGHTS,
      success,
      isPython,
      isDS,
      isWorkbook,
      selectedType,
    );
  } else {
    const startTime = Date.now();
    res = await needsScratchpad(connLabel, runner.execute());
    const endTime = Date.now();
    const duration = (endTime - startTime).toString();
  }

  return hasTarget
    ? runner.execute()
    : needsScratchpad(connLabel, runner.execute());
}

export async function executeQuery(
  connLabel: string,
  type: ExecutionTypes,
  queryData?: string,
  rerunQuery?: string,
): Promise<any> {
  const context = getExecutionQueryContext();
  const isPython = isExecutionPython(type);
  const isNotebook = isExecutionNotebook(type);

  let query: any;
  if (!rerunQuery) {
    switch (type) {
      case ExecutionTypes.QuerySelection:
      case ExecutionTypes.PythonQuerySelection:
        query = queryData ? queryData : retrieveEditorSelectionToExecute();
        break;
      case ExecutionTypes.QueryFile:
      case ExecutionTypes.PythonQueryFile:
        query = retrieveEditorText();
        break;
      case ExecutionTypes.NotebookQueryPython:
      case ExecutionTypes.NotebookQueryQSQL:
        query = queryData;
        break;
      default:
        notify(
          "No query provided for scratchpad execution.",
          MessageKind.ERROR,
          {
            logger,
          },
        );
        return;
    }
  } else {
    query = rerunQuery;
  }

  if (!query || query.trim() === "") {
    notify("No query provided for execution.", MessageKind.ERROR, {
      logger,
    });
    return;
  }

  query = sanitizeQuery(query);

  const connMngService = new ConnectionManagementService();
  const selectedConnection =
    connMngService.retrieveConnectedConnection(connLabel);
  if (!selectedConnection) {
    return;
  }

  if (selectedConnection instanceof LocalConnection) {
    return await selectedConnection.executeQuery(
      query,
      context,
      isNotebook,
      isPython,
    );
  } else {
    const body = generateScratchpadQueryReqBody(query, context, isPython);

    return await selectedConnection.getScratchpadQuery(
      body,
      isPython,
      isNotebook,
    );
  }
}

export async function executeDataQuery(
  connLabel: string,
  type: ExecutionTypes,
  target?: string,
  datasourceFile?: DataSourceFiles,
): Promise<any> {
  const isPython = isExecutionPython(type);
  const query = getQuery(datasourceFile, type);
  const dsExecutionType = getDSExecutionType(datasourceFile);
  const udaName = datasourceFile?.dataSource?.uda?.name
    ? datasourceFile.dataSource.uda.name
    : "";

  if (!query || (query instanceof String && query.trim() === "")) {
    notify("No data provided for execution.", MessageKind.ERROR, { logger });
    return;
  }

  const body = await selectAndGenerateServicegatewayReqBody(
    query,
    dsExecutionType,
    target ?? "",
    isPython,
  );

  if (!body) {
    notify(
      "Failed to generate request body for data query execution.",
      MessageKind.ERROR,
      { logger },
    );
    return;
  }

  const connMngService = new ConnectionManagementService();
  const selectedConnection =
    connMngService.retrieveConnectedConnection(connLabel);

  if (selectedConnection instanceof LocalConnection || !selectedConnection) {
    return;
  }

  selectedConnection.getMeta();
  if (!selectedConnection?.meta?.payload.assembly) {
    notify(
      "No database running in the Insights connection.",
      MessageKind.ERROR,
      { logger },
    );
    return;
  }
  const res = await selectedConnection.getDataQuery(
    dsExecutionType,
    body,
    udaName,
  );

  return convertDSDataResponse(res);
}

export async function handleDataQueryResponse(
  res: any,
  querySample: string,
  connLabel: string,
  executorName: string,
  dataType: DataSourceTypes,
  isNotebook: boolean,
  isPython: boolean,
  isDS: boolean,
  isWorkbook: boolean,
  duration: string,
): Promise<boolean> {
  const success = !res.error;
  if (!success) {
    notify("Query execution failed.", MessageKind.DEBUG, {
      logger,
      params: res.error,
      telemetry: `Datasource.${dataType}.Run.Error`,
    });
  }
  if (isNotebook) {
    return success;
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
      isWorkbook ? "WORKBOOK" : dataType,
      isPython,
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
      dataType,
    );
  }
  return success;
}

export function getDataQuerySample(
  dsFile?: DataSourceFiles,
  selectedType?: DataSourceTypes,
  type?: ExecutionTypes,
): any {
  if (dsFile) {
    switch (selectedType) {
      case DataSourceTypes.API:
        return `GetData - table: ${dsFile.dataSource.api.table}`;
      case DataSourceTypes.QSQL:
        return dsFile.dataSource.qsql.query;
      case DataSourceTypes.UDA:
        return `Executed UDA: ${dsFile.dataSource.uda?.name}`;
      case DataSourceTypes.SQL:
      default:
        return dsFile.dataSource.sql.query;
    }
  } else {
    const query = getQuery(undefined, type);
    return query ? query : "No query provided.";
  }
}

export async function handleQueryResponse(
  res: any,
  connLabel: string,
  isPython: boolean,
  executorName: string,
  isNotebook: boolean,
  isInsights: boolean,
): Promise<boolean> {
  const success = !res.error;
  if (!success) {
    notify("Query execution failed.", MessageKind.DEBUG, {
      logger,
      params: res.error,
      telemetry: "Query.Run.Error",
    });
  }
  const data = resultToBase64(res);

  if (ext.isResultsTabVisible) {
    if (data) {
      notify("GG Plot displayed", MessageKind.DEBUG, {
        logger,
        telemetry: "GGPLOT.Display" + (isPython ? ".Python" : ".q"),
      });
      const active = ext.activeTextEditor;
      if (active) {
        const plot = <Plot>{
          charts: [{ data }],
        };
        const uri = await addWorkspaceFile(
          active.document.uri,
          "plot",
          ".plot",
        );
        if (!workspaceHas(uri)) {
          await vscode.workspace.openTextDocument(uri);
          await openWith(
            uri,
            ChartEditorProvider.viewType,
            vscode.ViewColumn.Beside,
          );
        }
        await setUriContent(uri, JSON.stringify(plot));
      }
    } else {
      if (isNotebook) {
        return success;
      }
      await writeQueryResultsToView(
        res,
        "QUERY TEM QUE VIR AQUI",
        connLabel,
        executorName,
        isInsights,
      );
    }
    const resultCount =
      typeof res.values === "string" ? "0" : res.values.length;
  } else {
    if (isNotebook) {
      return success;
    }
    await writeQueryResultsToConsole(
      res,
      "QUERY TEM QUE VIR AQUI",
      connLabel,
      executorName,
      isInsights,
    );
  }

  return success;
}

export async function prepareToPopulateScratchpad(
  connLabel: string,
  type: ExecutionTypes,
  target?: string,
  outputVariable?: string,
  datasourceFile?: DataSourceFiles,
): Promise<void> {
  const isPython = isExecutionPython(type);
  const variable = outputVariable ? outputVariable : await inputVariable();
  const query = getQuery(datasourceFile);
  const dsExecutionType = getDSExecutionType(datasourceFile);

  if (!query || (typeof query === "string" && query.trim() === "")) {
    notify("No data provided to populate scratchpad.", MessageKind.ERROR, {
      logger,
    });
    return;
  }

  if (!variable || variable.trim() === "") {
    notify(
      "No variable name provided to populate scratchpad.",
      MessageKind.INFO,
      { logger },
    );
    return;
  }
  const body = await selectAndGenerateScratchpadImportReqBody(
    query ?? "",
    dsExecutionType,
    variable ?? "",
    connLabel,
    target ?? "",
    isPython,
  );

  if (!body) {
    notify("No data available to populate scratchpad.", MessageKind.ERROR, {
      logger,
    });
    return;
  }
  return populateScratchpad(connLabel, dsExecutionType, body, variable);
}

export async function populateScratchpad(
  connLabel: string,
  type: DataSourceTypes,
  body: any,
  outputVariable?: string,
  silent?: boolean,
): Promise<void> {
  const connMngService = new ConnectionManagementService();

  if (!outputVariable) {
    const scratchpadVariable: vscode.InputBoxOptions = {
      prompt: scratchpadVariableInput.prompt,
      placeHolder: scratchpadVariableInput.placeholder,
      validateInput: (value: string | undefined) =>
        validateScratchpadOutputVariableName(value),
    };
    outputVariable = await vscode.window.showInputBox(scratchpadVariable);
  }

  if (outputVariable !== undefined && outputVariable !== "") {
    const selectedConnection =
      connMngService.retrieveConnectedConnection(connLabel);

    if (selectedConnection instanceof LocalConnection || !selectedConnection) {
      return;
    }

    await selectedConnection.importScratchpad(
      outputVariable,
      body,
      type,
      silent,
    );
  } else {
    notify(
      `Invalid scratchpad output variable name: ${outputVariable}`,
      MessageKind.ERROR,
      { logger },
    );
  }
}
