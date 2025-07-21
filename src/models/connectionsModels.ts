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

export const enum ConnectionType {
  BundledQ,
  Kdb,
  Insights,
}

export enum ServerType {
  INSIGHTS,
  KDB,
  undefined,
}

export interface ServerDetails {
  serverName: string;
  serverPort: string;
  auth: boolean;
  serverAlias: string;
  managed: boolean;
  tls: boolean;
  username?: string;
  password?: string;
}

export interface Server {
  [name: string]: ServerDetails;
}

export interface kdbAuthMap {
  [name: string]: {
    username: string;
    password: string;
  };
}

export interface InsightDetails {
  alias: string;
  server: string;
  auth: boolean;
  realm?: string;
  insecure?: boolean;
}

export interface Insights {
  [name: string]: InsightDetails;
}

export interface ExportedConnections {
  connections: {
    Insights: InsightDetails[];
    KDB: ServerDetails[];
  };
}
