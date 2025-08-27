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
import { getPartialDatasourceFile } from "../utils/dataSource";
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

interface EditorContext {
  conn: InsightsConnection | LocalConnection;
  isInsights: boolean;
  executorName: string;
  target?: string;
  isSql: boolean;
  isPython: boolean;
  documentType: string;
}

interface ExecutionResult {
  result: any;
  duration: string;
}

interface InsightsVersionContext {
  isInsights: boolean;
  version?: number;
}

const QUERY_RETRIEVAL_STRATEGIES = {
  [ExecutionTypes.QuerySelection]: retrieveQueryData,
  [ExecutionTypes.PythonQuerySelection]: retrieveQueryData,
  [ExecutionTypes.DataQuerySelection]: retrieveQueryData,
  [ExecutionTypes.PythonDataQueryFile]: retrieveQueryData,
  [ExecutionTypes.NotebookDataQueryPython]: retrieveQueryData,
  [ExecutionTypes.NotebookDataQueryQSQL]: retrieveQueryData,
  [ExecutionTypes.NotebookDataQuerySQL]: retrieveQueryData,
  [ExecutionTypes.NotebookQueryPython]: retrieveQueryData,
  [ExecutionTypes.NotebookQueryQSQL]: retrieveQueryData,
  [ExecutionTypes.QueryFile]: retrieveEditorText,
  [ExecutionTypes.PythonQueryFile]: retrieveEditorText,
  [ExecutionTypes.DataQueryFile]: retrieveEditorText,
} as const;

// Helper functions for complexity reduction

async function withExecutionTiming<T>(
  fn: () => Promise<T>,
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const result = await fn();
  const endTime = Date.now();
  const duration = (endTime - startTime).toString();
  return { result, duration };
}

async function getEditorContext(
  uri: vscode.Uri,
): Promise<EditorContext | null> {
  const conn = await findConnection(uri);
  if (!conn) {
    return null;
  }

  const isInsights = conn instanceof InsightsConnection;
  const executorName = getBasename(ext.activeTextEditor!.document.uri);
  const target = isInsights ? getTargetForUri(uri) : undefined;
  const isSql = executorName.endsWith(".sql");
  const isPython = executorName.endsWith(".py");
  const documentType = retrieveEditorFileType(executorName);

  return {
    conn,
    isInsights,
    executorName,
    target,
    isSql,
    isPython,
    documentType,
  };
}

function validateSqlOnInsights(
  isSql: boolean,
  isInsights: boolean,
  connLabel: string,
): boolean {
  if (isSql && !isInsights) {
    notify(
      `SQL execution is not supported on ${connLabel}.`,
      MessageKind.ERROR,
      { logger },
    );
    return false;
  }
  return true;
}

async function executeDataQueryWithTiming(
  connLabel: string,
  type: ExecutionTypes,
  target?: string,
): Promise<ExecutionResult> {
  return withExecutionTiming(() => executeDataQuery(connLabel, type, target));
}

async function executeQueryWithTiming(
  connLabel: string,
  type: ExecutionTypes,
): Promise<ExecutionResult> {
  return withExecutionTiming(() => executeQuery(connLabel, type));
}

async function getInsightsVersionContext(
  connMngService: ConnectionManagementService,
  connectionName: string,
): Promise<InsightsVersionContext> {
  const isInsights = connMngService.isInsightsConnection(connectionName);

  if (!isInsights) {
    return { isInsights: false };
  }

  const versionExist =
    await connMngService.retrieveInsightsConnVersion(connectionName);
  const version = versionExist && versionExist !== 0 ? versionExist : undefined;

  return { isInsights: true, version };
}

async function executeStringQuery(
  queryHistoryItem: QueryHistory,
  isPython: boolean,
  versionContext: InsightsVersionContext,
): Promise<void> {
  const type = isPython
    ? ExecutionTypes.ReRunPythonQuery
    : ExecutionTypes.ReRunQuery;

  const { result: res, duration } = await withExecutionTiming(() =>
    executeQuery(
      queryHistoryItem.connectionName,
      type,
      undefined,
      queryHistoryItem.query as string,
    ),
  );

  await handleExecuteQueryResults(
    queryHistoryItem.connectionName,
    res,
    queryHistoryItem.executorName,
    queryHistoryItem.query as string,
    versionContext.isInsights,
    "RERUN-QUERY",
    isPython,
    duration,
    false,
    versionContext.version,
  );
}

async function executeDataSourceRerun(
  queryHistoryItem: QueryHistory,
  isPython: boolean,
): Promise<void> {
  const query = queryHistoryItem.query as DataSourceFiles;
  const querySample = getQuerySample(query, query.dataSource.selectedType);
  const target =
    query.dataSource.selectedType === DataSourceTypes.QSQL
      ? query.dataSource.qsql.selectedTarget
      : undefined;
  const type = isPython
    ? ExecutionTypes.ReRunPythonDataQuery
    : ExecutionTypes.ReRunDataQuery;

  const { result: res, duration } = await withExecutionTiming(() =>
    executeDataQuery(queryHistoryItem.connectionName, type, target, query),
  );

  const success = !res.error;
  await handleExecuteDataQueryResults(
    queryHistoryItem.connectionName,
    res,
    queryHistoryItem.executorName,
    query.dataSource.selectedType,
    querySample,
    queryHistoryItem.isDatasource ? "DATASOURCE" : "RERUN-DATAQUERY",
    isPython,
    duration,
  );

  if (queryHistoryItem.isDatasource) {
    addDStoQueryHistory(
      query,
      success,
      queryHistoryItem.connectionName,
      queryHistoryItem.executorName,
    );
  }
}

function getQueryFromExecutionType(
  type: ExecutionTypes,
  queryData?: string,
  rerunQuery?: string,
): string | undefined {
  if (rerunQuery) {
    return rerunQuery;
  }

  const strategy =
    QUERY_RETRIEVAL_STRATEGIES[type as keyof typeof QUERY_RETRIEVAL_STRATEGIES];
  if (strategy) {
    return strategy(queryData);
  }

  notify("No query provided for scratchpad execution.", MessageKind.ERROR, {
    logger,
  });
  return undefined;
}

function validateQuery(query: string | undefined): string | null {
  if (!query || query.trim() === "") {
    notify("No query provided for execution.", MessageKind.ERROR, { logger });
    return null;
  }
  return sanitizeQuery(query);
}

async function executeWithConnection(
  query: string,
  connLabel: string,
  context: string,
  isPython: boolean,
  isNotebook: boolean | undefined,
): Promise<any> {
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
    return null;
  }

  return res;
}

function validateDataQueryInputs(
  query: string | DataSourceFiles | undefined,
): boolean {
  if (!query || (query instanceof String && query.trim() === "")) {
    notify("No data provided for execution.", MessageKind.ERROR, { logger });
    return false;
  }
  return true;
}

function validateConnection(
  selectedConnection: any,
): selectedConnection is InsightsConnection {
  if (selectedConnection instanceof LocalConnection || !selectedConnection) {
    return false;
  }

  selectedConnection.getMeta();
  if (!selectedConnection?.meta?.payload.assembly) {
    notify(
      "No database running in the Insights connection.",
      MessageKind.ERROR,
      { logger },
    );
    return false;
  }

  return true;
}

async function executeServiceGateway(
  selectedConnection: InsightsConnection,
  dsExecutionType: DataSourceTypes,
  body: any,
  udaName: string,
): Promise<any> {
  const res = await selectedConnection.getDataQuery(
    dsExecutionType,
    body,
    udaName,
  );
  return convertDSDataResponse(res);
}

async function resolveVariable(
  outputVariable?: string,
): Promise<string | undefined> {
  return outputVariable || (await inputVariable());
}

function validateScratchpadInputs(
  query: string | DataSourceFiles | undefined,
  variable: string | undefined,
): boolean {
  if (!query || (typeof query === "string" && query.trim() === "")) {
    notify("No data provided to populate scratchpad.", MessageKind.ERROR, {
      logger,
    });
    return false;
  }

  if (!variable || variable.trim() === "") {
    notify(
      "No variable name provided to populate scratchpad.",
      MessageKind.INFO,
      { logger },
    );
    return false;
  }

  return true;
}

async function buildScratchpadBody(
  query: string | DataSourceFiles,
  dsExecutionType: DataSourceTypes,
  variable: string,
  connLabel: string,
  selectedTarget: string,
  isPython: boolean,
): Promise<any> {
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
    return null;
  }

  return body;
}

function formatDataQueryResult(res: any): {
  success: boolean;
  formattedRes: any;
} {
  const success = !res.error;

  if (!success) {
    notify("Query execution failed.", MessageKind.DEBUG, {
      logger,
      params: res.error,
      telemetry: "documentType.dataQueryType.Run.Error",
    });
  }

  return {
    success,
    formattedRes: success ? res : res.errorMsg || res.error,
  };
}

async function dispatchToResultsTab(
  res: any,
  success: boolean,
  querySample: string,
  connLabel: string,
  executorName: string,
  isInsights: boolean,
  documentType: string,
  isPython?: boolean,
  duration?: string,
  isFromConnTree?: boolean,
  connVersion?: number,
): Promise<void> {
  if (success && !isInsights) {
    const resultCount = typeof res === "string" ? "0" : res.rows.length;
    notify(`Results: ${resultCount} rows`, MessageKind.DEBUG, { logger });
  }

  await writeQueryResultsToView(
    res,
    querySample,
    connLabel,
    executorName,
    isInsights,
    documentType,
    isPython,
    duration,
    isFromConnTree,
    connVersion,
  );
}

async function dispatchToConsole(
  res: any,
  success: boolean,
  querySample: string,
  connLabel: string,
  executorName: string,
  isInsights: boolean,
  documentType: string,
  isPython?: boolean,
  duration?: string,
  isFromConnTree?: boolean,
): Promise<void> {
  if (success && !isInsights) {
    notify(
      `Results is a string with length: ${res.length}`,
      MessageKind.DEBUG,
      { logger },
    );
  }

  await writeQueryResultsToConsole(
    res,
    querySample,
    connLabel,
    executorName,
    isInsights,
    documentType,
    isPython,
    duration,
    isFromConnTree,
  );
}

// Execute Notebook Queries
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
    return variable && variable.trim() !== ""
      ? await prepareToPopulateScratchpad(
          connLabel,
          executionType,
          target,
          variable,
          partialDS,
        )
      : await executeDataQuery(connLabel, executionType, target, partialDS);
  }

  return await executeQuery(connLabel, executionType, query);
}

// Execute Active Editor Queries
export async function executeActiveEditorQuery(type?: ExecutionTypes) {
  if (!ext.activeTextEditor) {
    notify("No active editor found to execute query.", MessageKind.ERROR, {
      logger,
    });
    return;
  }

  const uri = ext.activeTextEditor.document.uri;
  const selectedServer = getServerForUri(uri);

  if (selectedServer === ext.REPL) {
    return runOnRepl(ext.activeTextEditor, type);
  }

  const context = await getEditorContext(uri);
  if (!context) {
    return;
  }

  if (
    !validateSqlOnInsights(
      context.isSql,
      context.isInsights,
      context.conn.connLabel,
    )
  ) {
    return;
  }

  const executionType =
    type || getEditorExecutionType(context.isPython, context.target);
  const isDataQuery = context.target && context.target !== "scratchpad";
  const query = retrieveQueryData();

  if (isDataQuery && context.isInsights) {
    const { result: res, duration } = await executeDataQueryWithTiming(
      context.conn.connLabel,
      executionType,
      context.target,
    );

    const dataType = getDataTypeForEditor(context.executorName);
    const querySample = getQuerySample(query || "", dataType);

    handleExecuteDataQueryResults(
      context.conn.connLabel,
      res,
      context.executorName,
      dataType,
      querySample,
      context.documentType,
      context.isPython,
      duration,
    );
    return;
  }

  const { result: res, duration } = await executeQueryWithTiming(
    context.conn.connLabel,
    executionType,
  );

  const insightsConnVersion =
    context.conn instanceof InsightsConnection
      ? context.conn.insightsVersion
      : undefined;

  await handleExecuteQueryResults(
    context.conn.connLabel,
    res,
    context.executorName,
    query || "",
    context.isInsights,
    context.documentType,
    context.isPython,
    duration,
    false,
    insightsConnVersion,
  );
}

// Execute Datasource Queries
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
  const connMngService = new ConnectionManagementService();
  const versionContext = await getInsightsVersionContext(
    connMngService,
    queryHistoryItem.connectionName,
  );

  if (typeof queryHistoryItem.query === "string") {
    await executeStringQuery(queryHistoryItem, isPython, versionContext);
  } else {
    await executeDataSourceRerun(queryHistoryItem, isPython);
  }
}

// Execute Select View(for local conn atm) Queries
export async function executeSelectViewQuery(viewItem: any) {
  const connLabel = viewItem.connLabel;
  if (!connLabel) {
    notify("Connection label not found", MessageKind.ERROR, { logger });
    return;
  }

  const executorName = connLabel + " - " + viewItem.coreIcon;
  const query = viewItem.label;

  const { result: res, duration } = await withExecutionTiming(() =>
    executeQuery(connLabel, ExecutionTypes.QuerySelection, query),
  );

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
}

// Execute Queries
export async function executeQuery(
  connLabel: string,
  type: ExecutionTypes,
  queryData?: string,
  rerunQuery?: string,
): Promise<any> {
  const context = getExecutionQueryContext();
  const isPython = isExecutionPython(type);
  const isNotebook = isExecutionNotebook(type);

  const query = getQueryFromExecutionType(type, queryData, rerunQuery);
  if (!query) {
    return;
  }

  const sanitizedQuery = validateQuery(query);
  if (!sanitizedQuery) {
    return;
  }

  return executeWithConnection(
    sanitizedQuery,
    connLabel,
    context,
    isPython,
    isNotebook,
  );
}

// Execute Data Queries
export async function executeDataQuery(
  connLabel: string,
  type: ExecutionTypes,
  target?: string,
  datasourceFile?: DataSourceFiles,
): Promise<any> {
  const isPython = isExecutionPython(type);
  const query = getQuery(datasourceFile, type);
  const dsExecutionType = getDSExecutionType(datasourceFile);
  const udaName = datasourceFile?.dataSource?.uda?.name || "";

  if (!validateDataQueryInputs(query)) {
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

  if (!validateConnection(selectedConnection)) {
    return;
  }

  return executeServiceGateway(
    selectedConnection,
    dsExecutionType,
    body,
    udaName,
  );
}

// Populate Scratchpad
export async function prepareToPopulateScratchpad(
  connLabel: string,
  type: ExecutionTypes,
  target?: string,
  outputVariable?: string,
  datasourceFile?: DataSourceFiles,
): Promise<void> {
  const isPython = isExecutionPython(type);
  const variable = await resolveVariable(outputVariable);
  const query = getQuery(datasourceFile);
  const dsExecutionType = getDSExecutionType(datasourceFile);
  const selectedTarget = target
    ? target
    : dsExecutionType === DataSourceTypes.QSQL
      ? datasourceFile?.dataSource?.qsql.selectedTarget
      : "";

  if (!validateScratchpadInputs(query, variable)) {
    return;
  }

  const body = await buildScratchpadBody(
    query!,
    dsExecutionType,
    variable!,
    connLabel,
    selectedTarget || "",
    isPython,
  );

  if (!body) {
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

  if (!outputVariable || outputVariable === "") {
    notify(
      `Invalid scratchpad output variable name: ${outputVariable}`,
      MessageKind.ERROR,
      { logger },
    );
    return;
  }

  const selectedConnection =
    connMngService.retrieveConnectedConnection(connLabel);

  if (selectedConnection instanceof LocalConnection || !selectedConnection) {
    return;
  }

  await selectedConnection.importScratchpad(outputVariable, body, type, silent);
}

// Handlers
export async function handleGGPlotExecution(
  results: any,
  isPython: boolean,
): Promise<any> {
  const data = resultToBase64(results);
  if (!data) {
    return false;
  }

  notify("GG Plot displayed", MessageKind.DEBUG, {
    logger,
    telemetry: "GGPLOT.Display" + (isPython ? ".Python" : ".q"),
  });

  const active = ext.activeTextEditor;
  if (!active) {
    return false;
  }

  const plot = <Plot>{ charts: [{ data }] };
  const uri = await addWorkspaceFile(active.document.uri, "plot", ".plot");

  if (!workspaceHas(uri)) {
    await vscode.workspace.openTextDocument(uri);
    await openWith(uri, ChartEditorProvider.viewType, vscode.ViewColumn.Beside);
  }

  await setUriContent(uri, JSON.stringify(plot));
  return true;
}

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
    return;
  }

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
  const { success, formattedRes } = formatDataQueryResult(res);

  if (!success) {
    notify("Query execution failed.", MessageKind.DEBUG, {
      logger,
      params: res.error,
      telemetry: documentType + "." + dataQueryType + ".Run.Error",
    });
  }

  if (ext.isResultsTabVisible) {
    await dispatchToResultsTab(
      formattedRes,
      success,
      querySample,
      connLabel,
      executorName,
      true,
      documentType,
      isPython,
      duration,
    );
  } else {
    await dispatchToConsole(
      formattedRes,
      success,
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
