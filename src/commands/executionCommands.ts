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

import { ext } from "../extensionVariables";
import { getPartialDatasourceFile } from "./dataSourceCommand";
import {
  writeQueryResultsToConsole,
  writeQueryResultsToView,
  writeScratchpadResult,
} from "./serverCommand";
import {
  findConnection,
  getServerForUri,
  getTargetForUri,
  runOnRepl,
} from "./workspaceCommand";
import { InsightsConnection } from "../classes/insightsConnection";
import { LocalConnection } from "../classes/localConnection";
import { DataSourceFiles, DataSourceTypes } from "../models/dataSource";
import { ExecutionTypes } from "../models/execution";
import { scratchpadVariableInput } from "../models/items/server";
import { CellKind } from "../models/notebook";
import { Plot } from "../models/plot";
import { QueryHistory } from "../models/queryHistory";
import { ChartEditorProvider } from "../services/chartEditorProvider";
import { ConnectionManagementService } from "../services/connectionManagerService";
import { inputVariable } from "../services/notebookProviders";
import { getBasename } from "../utils/core";
import {
  convertDSDataResponse,
  defineNotepadExecutionType,
  getDataTypeForEditor,
  getDSExecutionType,
  getEditorExecutionType,
  getExecutionQueryContext,
  getQuery,
  isExecutionNotebook,
  isExecutionPython,
  retrieveEditorFileType,
  retrieveEditorText,
  retrieveQueryData,
} from "../utils/execution";
import { MessageKind, notify } from "../utils/notifications";
import {
  addDStoQueryHistory,
  getQuerySample,
  resultToBase64,
  sanitizeQuery,
} from "../utils/queryUtils";
import {
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

// Execute Notebook Query
export async function executeNotebookQuery(
  connLabel: string,
  cell: vscode.NotebookCell,
  kind: CellKind,
  target?: string,
  variable?: string,
): Promise<any> {
  const query = cell.document.getText();
  const executionType = defineNotepadExecutionType(kind, target, variable);

  if (target || kind === CellKind.SQL) {
    const partialDS = getPartialDatasourceFile(
      query,
      target,
      kind === CellKind.SQL,
      kind === CellKind.PYTHON,
    );
    return variable
      ? await prepareToPopulateScratchpad(
          connLabel,
          executionType,
          target,
          variable,
          partialDS,
        )
      : await executeDataQuery(connLabel, executionType, target, partialDS);
  } else {
    return await executeQuery(connLabel, executionType, query);
  }
}

// Execute Active Editor Query
export async function executeActiveEditorQuery(type?: ExecutionTypes) {
  if (ext.activeTextEditor) {
    const uri = ext.activeTextEditor.document.uri;
    const selectedServer = getServerForUri(uri);

    if (selectedServer === ext.REPL) {
      runOnRepl(ext.activeTextEditor, type);
    }

    const conn = await findConnection(uri);
    if (!conn) {
      return;
    }

    const isInsights = conn instanceof InsightsConnection;
    const executorName = getBasename(ext.activeTextEditor.document.uri);
    const target = isInsights ? getTargetForUri(uri) : undefined;
    const isSql = executorName.endsWith(".sql");
    const isPython = executorName.endsWith(".py");
    const documentType = retrieveEditorFileType(executorName);

    if (isSql && !isInsights) {
      notify(
        `SQL execution is not supported on ${conn.connLabel}.`,
        MessageKind.ERROR,
        { logger },
      );
      return;
    }

    if (!type) {
      type = getEditorExecutionType(isPython, target);
    }
    const isDataQuery = target && target !== "scratchpad";
    const query = retrieveQueryData();
    if (isDataQuery && isInsights) {
      const startTime = Date.now();
      const res = await executeDataQuery(conn.connLabel, type, target);
      const endTime = Date.now();
      const duration = (endTime - startTime).toString();
      const dataType = getDataTypeForEditor(executorName);

      const querySample = getQuerySample(query ? query : "", dataType);

      handleExecuteDataQueryResults(
        conn.connLabel,
        res,
        executorName,
        dataType,
        querySample,
        documentType,
        isPython,
        duration,
      );
      return;
    }
    const startTime = Date.now();
    const res = await executeQuery(conn.connLabel, type);
    const endTime = Date.now();
    const duration = (endTime - startTime).toString();
    let insightsConnVersion: number | undefined;

    if (conn instanceof InsightsConnection) {
      insightsConnVersion = conn.insightsVersion;
    }

    await handleExecuteQueryResults(
      conn.connLabel,
      res,
      executorName,
      query ? query : "",
      isInsights,
      documentType,
      isPython,
      duration,
      false,
      insightsConnVersion,
    );
    return;
  }
  notify("No active editor found to execute query.", MessageKind.ERROR, {
    logger,
  });
  return;
}

// Execute DataSources
export async function executeDataSourceQuery(
  connLabel: string,
  datasourceFile: DataSourceFiles,
): Promise<any> {
  const target =
    datasourceFile.dataSource.selectedType === DataSourceTypes.QSQL
      ? datasourceFile.dataSource.qsql.selectedTarget
      : undefined;
  const executionType = ExecutionTypes.QueryDatasource;

  return executeDataQuery(connLabel, executionType, target, datasourceFile);
}

export async function executeReRunQuery(queryHistoryItem: QueryHistory) {
  const isPython = queryHistoryItem.language === "python";
  const startTime = Date.now();
  const connMngService = new ConnectionManagementService();
  const isInsights = connMngService.isInsightsConnection(
    queryHistoryItem.connectionName,
  );
  let insightsConnVersion;
  if (isInsights) {
    const versionExist = await connMngService.retrieveInsightsConnVersion(
      queryHistoryItem.connectionName,
    );
    insightsConnVersion =
      versionExist && versionExist !== 0 ? versionExist : undefined;
  }
  if (typeof queryHistoryItem.query === "string") {
    const type = isPython
      ? ExecutionTypes.ReRunPythonQuery
      : ExecutionTypes.ReRunQuery;
    const res = await executeQuery(
      queryHistoryItem.connectionName,
      type,
      undefined,
      queryHistoryItem.query,
    );
    const endTime = Date.now();
    const duration = (endTime - startTime).toString();

    await handleExecuteQueryResults(
      queryHistoryItem.connectionName,
      res,
      queryHistoryItem.executorName,
      queryHistoryItem.query,
      isInsights,
      "RERUN-QUERY",
      isPython,
      duration,
      false,
      insightsConnVersion,
    );
  } else {
    const querySample = getQuerySample(
      queryHistoryItem.query,
      queryHistoryItem.query.dataSource.selectedType,
    );
    const target =
      queryHistoryItem.query.dataSource.selectedType === DataSourceTypes.QSQL
        ? queryHistoryItem.query.dataSource.qsql.selectedTarget
        : undefined;
    const type = isPython
      ? ExecutionTypes.ReRunPythonDataQuery
      : ExecutionTypes.ReRunDataQuery;
    const res = await executeDataQuery(
      queryHistoryItem.connectionName,
      type,
      target,
      queryHistoryItem.query,
    );
    const endTime = Date.now();
    const duration = (endTime - startTime).toString();
    const success = !res.error;
    await handleExecuteDataQueryResults(
      queryHistoryItem.connectionName,
      res,
      queryHistoryItem.executorName,
      queryHistoryItem.query.dataSource.selectedType,
      querySample,
      queryHistoryItem.isDatasource ? "DATASOURCE" : "RERUN-DATAQUERY",
      isPython,
      duration,
    );

    if (queryHistoryItem.isDatasource) {
      addDStoQueryHistory(
        queryHistoryItem.query,
        success,
        queryHistoryItem.connectionName,
        queryHistoryItem.executorName,
      );
    }
  }
}

// Execute Select View Query (for the future this will also handle variables from connected servers)
export async function executeSelectViewQuery(viewItem: any) {
  const connLabel = viewItem.connLabel;
  if (connLabel) {
    const executorName = connLabel + " - " + viewItem.coreIcon;
    const query = viewItem.label;
    const startTime = Date.now();
    const res = await executeQuery(
      connLabel,
      ExecutionTypes.QuerySelection,
      query,
    );
    const endTime = Date.now();
    const duration = (endTime - startTime).toString();
    await handleExecuteQueryResults(
      connLabel,
      res,
      executorName,
      query,
      false,
      "VIEW",
      false,
      duration,
      true,
    );
  } else {
    notify("Connection label not found", MessageKind.ERROR, {
      logger,
    });
  }
}

// Execute query or scratchpad
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
      case ExecutionTypes.DataQuerySelection:
      case ExecutionTypes.PythonDataQueryFile:
      case ExecutionTypes.NotebookDataQueryPython:
      case ExecutionTypes.NotebookDataQueryQSQL:
      case ExecutionTypes.NotebookDataQuerySQL:
      case ExecutionTypes.NotebookQueryPython:
      case ExecutionTypes.NotebookQueryQSQL:
        query = retrieveQueryData(queryData);
        break;
      case ExecutionTypes.QueryFile:
      case ExecutionTypes.PythonQueryFile:
      case ExecutionTypes.DataQueryFile:
        query = retrieveEditorText();
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
  const res = await connMngService.executeQuery(
    query,
    connLabel,
    context,
    isPython,
    isNotebook,
  );
  if (!res) {
    notify("Failed to execute query. No connection found.", MessageKind.ERROR, {
      logger,
    });
    return;
  }
  return res;
}

// Execute via SERVICE GATEWAY
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

// Populate scratchpad methods
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
  const selectedTarget = target
    ? target
    : dsExecutionType === DataSourceTypes.QSQL
      ? datasourceFile?.dataSource?.qsql.selectedTarget
      : "";

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
    selectedTarget ?? "",
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

// Handle GG Plots
export async function handleGGPlotExecution(
  results: any,
  isPython: boolean,
): Promise<any> {
  const data = resultToBase64(results);
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
      const uri = await addWorkspaceFile(active.document.uri, "plot", ".plot");
      if (!workspaceHas(uri)) {
        await vscode.workspace.openTextDocument(uri);
        await openWith(
          uri,
          ChartEditorProvider.viewType,
          vscode.ViewColumn.Beside,
        );
      }
      await setUriContent(uri, JSON.stringify(plot));
      return true;
    }
  }
  return false;
}

// Handle Execution process for results to be displayed
export async function handleExecuteQueryResults(
  connLabel: string,
  res: any,
  executorName: string,
  querySample: string,
  isInsights: boolean,
  fileType: string,
  isPython: boolean,
  duration?: string,
  isFromConnTree?: boolean,
  connVersion?: number,
) {
  if (isInsights) {
    await writeScratchpadResult(
      res,
      querySample,
      connLabel,
      executorName,
      isPython,
      fileType,
      duration,
      connVersion,
    );
  } else {
    if (ext.isResultsTabVisible) {
      const ggplot = await handleGGPlotExecution(res, isPython);
      if (!ggplot) {
        await writeQueryResultsToView(
          res,
          querySample,
          connLabel,
          executorName,
          isInsights,
          fileType,
          isPython,
          duration,
          isFromConnTree,
          connVersion,
        );
      }
    } else {
      await writeQueryResultsToConsole(
        res,
        querySample,
        connLabel,
        executorName,
        isInsights,
        fileType,
        isPython,
        duration,
        isFromConnTree,
      );
    }
  }
}

export async function handleExecuteDataQueryResults(
  connLabel: string,
  res: any,
  executorName: string,
  dataQueryType: string,
  querySample: string,
  documentType: string,
  isPython?: boolean,
  duration?: string,
) {
  const success = !res.error;

  if (!success) {
    notify("Query execution failed.", MessageKind.DEBUG, {
      logger,
      params: res.error,
      telemetry: documentType + "." + dataQueryType + ".Run.Error",
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
      documentType,
      isPython,
      duration,
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
      documentType,
      isPython,
      duration,
    );
  }
}
