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

import { QuickPickItem } from "vscode";

export const serverEndpointPlaceHolder = "Select the kdb type";
export const kdbEndpoint = "Enter a kdb endpoint";
export const kdbInsightsEndpoint = "Connect to kdb insights";

export const serverEndpoints: QuickPickItem[] = [
  {
    label: kdbEndpoint,
    detail: "Enter the url, ip address, and port to connect to a kdb instance",
  },
  {
    label: kdbInsightsEndpoint,
    detail: "Either the url for the kdb insights instance",
  },
];

export const insightsAliasInput = {
  prompt:
    "Enter a name/alias for the connection (default will be the instance name)",
  placeholder: "server name / alias",
};

export const insightsUrlInput = {
  prompt: "Enter the insights endpoint url",
  placeholder: "https://<insights endpoint>",
};

export const connectionAliasInput = {
  prompt: "Enter a name/alias for the connection",
  placeholder: "server name / alias",
};

export const connectionHostnameInput = {
  prompt: "Enter the hostname or ip address of the kdb server",
  placeholder: "0.0.0.0",
};

export const connectionPortInput = {
  prompt: "Enter the port number of the kdb server",
  placeholder: "5001",
};

export const connectionUsernameInput = {
  prompt: "Enter username to authenticate with (optional)",
  placeholder: "username",
};

export const connectionPasswordInput = {
  prompt: "Enter password to authenticate with (optional)",
  placeholder: "password",
};

export const connnectionTls = {
  prompt: "Enable TLS encryption on KDB connection (optional)",
  placeholder: "false",
};

export const scratchpadVariableInput = {
  prompt: "Enter output variable name for scratchpad",
  placeholder: "Output Variable *",
};
