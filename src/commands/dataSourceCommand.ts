/*
 * Copyright (c) 1998-2026 KX Systems Inc.
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

import { CancellationToken, InputBoxOptions, window } from "vscode";

import { ext } from "../extensionVariables";
import {
  writeQueryResultsToConsole,
  writeQueryResultsToView,
} from "./serverCommand";
import { InsightsConnection } from "../classes/insightsConnection";
import { LocalConnection } from "../classes/localConnection";
import { ServerType } from "../models/connectionsModels";
import { GetDataError, getDataBodyPayload } from "../models/data";
import { DataSourceFiles, DataSourceTypes } from "../models/dataSource";
import { scratchpadVariableInput } from "../models/items/server";
import { UDARequestBody } from "../models/uda";
import { ConnectionManagementService } from "../services/connectionManagerService";
import { noSelectedConnectionAction } from "../utils/core";
import {
  checkIfTimeParamIsCorrect,
  getConnectedInsightsNode,
} from "../utils/dataSource";
import { MessageKind, notify } from "../utils/notifications";
import {
  addQueryHistory,
  appendStacktrace,
  convertRows,
  getQSQLWrapper,
} from "../utils/queryUtils";
import { updatedExtractRowData } from "../utils/resultsRenderer";
import { recastParams, retrieveUDAtoCreateReqBody } from "../utils/uda";
import { validateScratchpadOutputVariableName } from "../validators/interfaceValidator";

const logger = "dataSourceCommand";

let running = false;

export async function populateScratchpad(
  dataSourceForm: DataSourceFiles,
  connLabel: string,
  outputVariable?: string,
  silent?: boolean,
  token?: CancellationToken,
  timeout?: number,
): Promise<void> {
  const connMngService = new ConnectionManagementService();

  if (!outputVariable) {
    const scratchpadVariable: InputBoxOptions = {
      prompt: scratchpadVariableInput.prompt,
      placeHolder: scratchpadVariableInput.placeholder,
      validateInput: (value: string | undefined) =>
        validateScratchpadOutputVariableName(value),
    };
    outputVariable = await window.showInputBox(scratchpadVariable);
  }

  if (outputVariable !== undefined && outputVariable !== "") {
    const selectedConnection =
      connMngService.retrieveConnectedConnection(connLabel);

    if (selectedConnection instanceof LocalConnection || !selectedConnection) {
      running = false;
      return;
    }

    await selectedConnection.importScratchpad(
      outputVariable,
      dataSourceForm,
      silent,
      token,
      timeout,
    );
  } else {
    notify(
      `Invalid scratchpad output variable name: ${outputVariable}`,
      MessageKind.ERROR,
      { logger },
    );
  }
}

export async function runDataSource(
  dataSourceForm: DataSourceFiles,
  connLabel: string,
  executorName: string,
  token?: CancellationToken,
  timeout?: number,
): Promise<any> {
  if (running) {
    return;
  }

  if (connLabel === "") {
    noSelectedConnectionAction();
    return;
  }

  running = true;
  const connMngService = new ConnectionManagementService();
  const selectedConnection =
    connMngService.retrieveConnectedConnection(connLabel);

  try {
    if (selectedConnection instanceof LocalConnection || !selectedConnection) {
      return;
    }
    selectedConnection.getMeta();
    if (!selectedConnection?.meta?.payload.assembly) {
      throw new Error("No database running in the Insights connection");
    }

    dataSourceForm.insightsNode = getConnectedInsightsNode();
    const fileContent = dataSourceForm;

    let res: any;
    const selectedType = getSelectedType(fileContent);
    ext.isDatasourceExecution = true;

    notify(`Running ${fileContent.name} datasource...`, MessageKind.DEBUG, {
      logger,
    });

    const isNotebook = executorName.endsWith(".kxnb");

    switch (selectedType) {
      case "API":
        res = await runApiDataSource(fileContent, selectedConnection, timeout);
        break;
      case "QSQL":
        res = await runQsqlDataSource(
          fileContent,
          selectedConnection,
          isNotebook || undefined,
          timeout,
        );
        break;
      case "SQL":
        res = await runSqlDataSource(
          fileContent,
          selectedConnection,
          isNotebook || undefined,
          timeout,
        );
        break;
      case "UDA":
      default:
        res = await runUDADataSource(fileContent, selectedConnection, timeout);
        break;
    }

    ext.isDatasourceExecution = false;
    if (res && !token?.isCancellationRequested) {
      const success = !res.error;
      const query = getQuery(fileContent, selectedType);

      if (!success) {
        notify("Query execution failed.", MessageKind.DEBUG, {
          logger,
          params: res.error,
        });
      }
      if (isNotebook || ext.isResultsTabVisible) {
        if (success) {
          const resultCount =
            typeof res === "string"
              ? "0"
              : res.rows
                ? res.rows.length
                : res.columns?.[0]?.values?.length || 0;
          notify(`Results: ${resultCount} rows`, MessageKind.DEBUG, {
            logger,
          });
        } else if (!success) {
          res = formatDataSourceError(res);
        }

        if (isNotebook) {
          return res;
        }

        await writeQueryResultsToView(
          res,
          query,
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
          res = formatDataSourceError(res);
        }

        // Fit the table to the connection's console, which wraps what does not
        // fit; 0 (no console open) leaves it unlimited.
        const rowData = res.columns
          ? convertRows(
              updatedExtractRowData(res),
              ext.connectionConsoles.get(connLabel)?.columns ?? 0,
              res,
            )
          : res;

        await writeQueryResultsToConsole(
          rowData,
          query,
          connLabel,
          executorName,
          true,
          selectedType,
        );
      }
      addDStoQueryHistory(dataSourceForm, success, connLabel, executorName);
    }
  } catch (error) {
    // Backstop for anything the per-type runners did not turn into a result.
    // A notebook renders the failure into the cell that raised it, so let it
    // through; everywhere else the query failed and must say so rather than
    // logging out of sight, and the attempt is recorded so the query history
    // still increments (KXI-69283).
    if (executorName.endsWith(".kxnb")) {
      throw error;
    }
    if (!token?.isCancellationRequested) {
      notify(
        `Datasource error: ${error instanceof Error ? error.message : error}`,
        MessageKind.ERROR,
        { logger, params: error },
      );
      addDStoQueryHistory(dataSourceForm, false, connLabel, executorName);
    }
  } finally {
    ext.isDatasourceExecution = false;
    running = false;
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

export async function runApiDataSource(
  fileContent: DataSourceFiles,
  selectedConn: InsightsConnection,
  timeout?: number,
): Promise<any> {
  const payload = fileContent.dataSource.api.payload || {};
  const isTimeCorrect =
    !payload.startTS ||
    !payload.endTS ||
    checkIfTimeParamIsCorrect(payload.startTS, payload.endTS);
  if (!isTimeCorrect) {
    notify(
      "The time parameters (startTS and endTS) are not correct, please check the format or if the startTS is before the endTS",
      MessageKind.ERROR,
      { logger },
    );
    return;
  }
  const apiBody = getApiBody(fileContent, selectedConn);
  const apiCall = await selectedConn.getDatasourceQuery(
    DataSourceTypes.API,
    apiBody,
    timeout,
  );

  if (apiCall?.error) {
    return parseError(apiCall.error, apiCall.stacktrace);
  } else if (apiCall?.results) {
    return apiCall.results;
  } else {
    return { error: "Datasource API call failed" };
  }
}

export function getApiBody(
  fileContent: DataSourceFiles,
  selectedConn: InsightsConnection,
): Partial<getDataBodyPayload> {
  return selectedConn.scopedApiPayload(
    fileContent.dataSource.api.payload || {},
  );
}

export async function runQsqlDataSource(
  fileContent: DataSourceFiles,
  selectedConn: InsightsConnection,
  isTableView?: boolean,
  timeout?: number,
): Promise<any> {
  const qsqlBody = selectedConn.generateQSqlBody(
    fileContent.dataSource.qsql.query,
    fileContent.dataSource.qsql.selectedTarget,
    selectedConn.insightsVersion,
    {
      agg: fileContent.dataSource.qsql.agg,
      labels: fileContent.dataSource.qsql.labels,
    },
  );

  const qsqlCall = await selectedConn.getDatasourceQuery(
    DataSourceTypes.QSQL,
    qsqlBody,
    timeout,
  );

  if (qsqlCall?.error) {
    return parseError(qsqlCall.error, qsqlCall.stacktrace);
  } else if (qsqlCall?.results) {
    return qsqlCall.results;
  } else {
    return { error: "Datasource QSQL call failed" };
  }
}

export async function runSqlDataSource(
  fileContent: DataSourceFiles,
  selectedConn: InsightsConnection,
  isTableView?: boolean,
  timeout?: number,
): Promise<any> {
  const sqlBody = {
    query: fileContent.dataSource.sql.query,
  };
  const sqlCall = await selectedConn.getDatasourceQuery(
    DataSourceTypes.SQL,
    sqlBody,
    timeout,
  );

  if (sqlCall?.error) {
    return parseError(sqlCall.error, sqlCall.stacktrace);
  } else if (sqlCall?.results) {
    return sqlCall.results;
  } else {
    return { error: "Datasource SQL call failed" };
  }
}

export async function runUDADataSource(
  fileContent: DataSourceFiles,
  selectedConn: InsightsConnection,
  timeout?: number,
): Promise<any> {
  const uda = fileContent.dataSource.uda;

  const udaReqBody = await retrieveUDAtoCreateReqBody(uda, selectedConn);

  if (udaReqBody.error) {
    notify(`Datasource error.`, MessageKind.DEBUG, {
      logger,
      params: udaReqBody.error,
    });
    return udaReqBody;
  }

  // A REST request carries no types of its own, so the gateway casts each
  // parameter to the first type the UDA registered for it. Saying so beats
  // returning quietly mistyped results, since the form let the type be chosen.
  const recast = uda ? recastParams(uda) : [];
  if (recast.length > 0) {
    notify(
      `The service gateway will read ${recast.join(", ")} as the first type the UDA registers, not the type chosen. Populate Scratchpad honours the choice.`,
      MessageKind.WARNING,
      { logger },
    );
  }

  return await executeUDARequest(selectedConn, udaReqBody, timeout);
}

export async function executeUDARequest(
  selectedConn: InsightsConnection,
  udaReqBody: UDARequestBody,
  timeout?: number,
): Promise<any> {
  const udaCall = await selectedConn.getDatasourceQuery(
    DataSourceTypes.UDA,
    udaReqBody,
    timeout,
  );

  if (udaCall?.error) {
    return parseError(udaCall.error, udaCall.stacktrace);
  } else if (udaCall?.results) {
    return udaCall.results;
  } else {
    return { error: "UDA call failed" };
  }
}

export function getQuery(
  fileContent: DataSourceFiles,
  selectedType: string,
): string {
  switch (selectedType) {
    case "API":
      return `GetData - table: ${fileContent.dataSource.api.payload?.table}`;
    case "QSQL":
      return fileContent.dataSource.qsql.query;
    case "SQL":
      return fileContent.dataSource.sql.query;
    default:
      return `Executed UDA: ${fileContent.dataSource.uda?.name}`;
  }
}

export function parseError(error: GetDataError, stacktrace?: string) {
  notify(`Datasource error.`, MessageKind.DEBUG, {
    logger,
    params: { error, stacktrace },
  });
  return stacktrace ? { error, stacktrace } : { error };
}

export function formatDataSourceError(res: any) {
  const message = res.errorMsg ? res.errorMsg : res.error;
  return typeof message === "string"
    ? appendStacktrace(message, res.stacktrace)
    : message;
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
          source: query,
        },
      }
    : <DataSourceFiles>{
        dataSource: {
          selectedType: "QSQL",
          qsql: {
            query: getQSQLWrapper(query, "serialized", isPython),
            selectedTarget,
          },
          source: query,
        },
      };
}
