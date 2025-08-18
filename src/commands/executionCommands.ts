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
import { GetDataObjectPayload } from "../models/data";
import { DataSourceFiles, DataSourceTypes } from "../models/dataSource";
import { ExecutionTypes } from "../models/execution";
import { scratchpadVariableInput } from "../models/items/server";
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
} from "../utils/execution";
import { MessageKind, notify, Runner } from "../utils/notifications";
import { needsScratchpad, sanitizeQuery } from "../utils/queryUtils";
import {
  generateScratchpadQueryReqBody,
  selectAndGenerateScratchpadImportReqBody,
  selectAndGenerateServicegatewayReqBody,
} from "../utils/requestBody";
import { validateScratchpadOutputVariableName } from "../validators/interfaceValidator";

const logger = "executionCommands";

export async function selectFileExecutionMethod(
  connLabel: string,
  type: ExecutionTypes,
  executorName: string,
  target: string | undefined,
  rerunQuery?: string,
) {
  const hasTarget = target !== undefined && target !== "scratchpad";
  const runner = Runner.create((_) => {
    return hasTarget
      ? executeDataQuery(connLabel, type, target)
      : executeQuery(connLabel, type, rerunQuery);
  });

  runner.title = `Executing ${executorName} on ${connLabel || "active connection"}.`;

  let res;

  if (hasTarget) {
    res = runner.execute();
  } else {
    res = needsScratchpad(connLabel, runner.execute());
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
): Promise<GetDataObjectPayload | undefined> {
  const isPython = isExecutionPython(type);
  const query = getQuery(datasourceFile);
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
  return await selectedConnection.getDataQuery(dsExecutionType, body, udaName);
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
