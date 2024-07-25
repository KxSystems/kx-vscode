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

import { ext } from "../extensionVariables";
import { validateUtils } from "../utils/validateUtils";

export const MAX_STR_LEN = 2048;

export function validateServerAlias(
  input: string | undefined,
  isLocal: boolean,
): string | undefined {
  // server alias is not required, but should be validated if entered
  if (input !== undefined) {
    if (input === "") {
      return "Server Name is required";
    }
    if (isAliasInUse(input)) {
      return "Server Name is already in use. Please use a different name.";
    }
    if (input[0] === " ") {
      return "Input value cannot start with a space.";
    }
    if (!validateUtils.isValidLength(input, 1, MAX_STR_LEN)) {
      return `Input value must be between 1 and ${MAX_STR_LEN} alphanumeric characters in length.`;
    }
    if (!validateUtils.isAlphanumericWithHypens(input)) {
      return "Input value must contain only alphanumeric characters and hypens";
    }

    if (input === "InsightsEnterprise") {
      return "Input value using restricted keywords of Insights Enterprise";
    }

    if (!isLocal && input.toLowerCase() === "local") {
      return "The server name “local” is reserved for connections to the Bundled q process";
    }
  }
  return undefined;
}

export function validateServerName(
  input: string | undefined,
): string | undefined {
  if (input !== undefined) {
    if (!validateUtils.isValidLength(input, 1, MAX_STR_LEN)) {
      return `Input value must be between 1 and ${MAX_STR_LEN} alphanumeric characters in length.`;
    }
  }
  return undefined;
}

export function validateServerPort(
  input: string | undefined,
): string | undefined {
  if (input !== undefined) {
    if (!validateUtils.isNumber(input)) {
      return "Input value must be a number.";
    }
    const parsedNumber = Number(input);
    return parsedNumber > 0 && parsedNumber < 65537
      ? undefined
      : "Invalid port number, valid range is 1-65536";
  }
  return undefined;
}

export function validateServerUsername(
  input: string | undefined,
): string | undefined {
  if (input !== undefined && input !== "") {
    if (!validateUtils.isValidLength(input, 1, MAX_STR_LEN)) {
      return `Input value must be between 1 and ${MAX_STR_LEN} alphanumeric characters in length.`;
    }
  }
  return undefined;
}

export function validateServerPassword(
  input: string | undefined,
): string | undefined {
  if (input !== undefined) {
    if (!validateUtils.isValidLength(input, 1, MAX_STR_LEN)) {
      return `Input value must be between 1 and ${MAX_STR_LEN} alphanumeric characters in length.`;
    }
  }
  return undefined;
}

export function validateTls(input: string | undefined): string | undefined {
  if (input !== undefined && input !== "") {
    if (!validateUtils.isBoolean(input)) {
      return "Input value must be a boolean (true or false)";
    }
  }
  return undefined;
}

export function isAliasInUse(alias: string): boolean {
  return !!ext.kdbConnectionAliasList.find(
    (item) => item.toLowerCase() === alias.toLowerCase(),
  );
}
