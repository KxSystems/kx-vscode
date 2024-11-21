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

import { ConnectionType } from "./connectionsModels";
import { DataSourceFiles } from "./dataSource";
import { MetaObjectPayload } from "./meta";

export type DataSourceMessage = {
  isInsights: boolean;
  insightsMeta: MetaObjectPayload;
  dataSourceName: string;
  dataSourceFile: DataSourceFiles;
  running?: boolean;
  servers?: string[];
  selectedServer?: string;
};

export const enum DataSourceCommand {
  Update,
  Change,
  Server,
  Save,
  Run,
  Populate,
  Refresh,
}

export interface DataSourceMessage2 {
  command: DataSourceCommand;
  servers: string[];
  selectedServer: string;
  selectedServerVersion: number;
  isInsights: boolean;
  insightsMeta: MetaObjectPayload;
  dataSourceFile: DataSourceFiles;
}

export interface EditConnectionMessage {
  connType: ConnectionType;
  serverName: string;
  serverAddress: string;
  port?: string;
  realm?: string;
  auth?: boolean;
  tls?: boolean;
  insecure?: boolean;
}
