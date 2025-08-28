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
import {
  executeDataSourceQuery,
  handleExecuteDataQueryResults,
} from "./executionCommand";
import { LocalConnection } from "../classes/localConnection";
import { GetDataError } from "../models/data";
import {
  DataSourceFiles,
  createDefaultDataSourceFile,
} from "../models/dataSource";
import { DataSourcesPanel } from "../panels/datasource";
import { ConnectionManagementService } from "../services/connectionManagerService";
import { noSelectedConnectionAction } from "../utils/core";
import {
  createKdbDataSourcesFolder,
  getConnectedInsightsNode,
} from "../utils/dataSource";
import { MessageKind, notify } from "../utils/notifications";
import {
  addDStoQueryHistory,
  getQuerySample,
  handleWSError,
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
    const selectedType = fileContent.dataSource.selectedType;

    ext.isDatasourceExecution = true;

    notify(`Running ${fileContent.name} datasource...`, MessageKind.DEBUG, {
      logger,
      telemetry: "Datasource." + selectedType + ".Run",
    });

    const res = await executeDataSourceQuery(connLabel, fileContent);

    ext.isDatasourceExecution = false;
    if (res) {
      const success = !res.error;
      const querySample = getQuerySample(fileContent, selectedType);

      await handleExecuteDataQueryResults(
        connLabel,
        res,
        executorName,
        selectedType,
        querySample,
        "DATASOURCE",
      );

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
