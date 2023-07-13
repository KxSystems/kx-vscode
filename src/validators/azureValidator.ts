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

import { ResourceGroups } from "@azure/arm-resources";
import { Debounce } from "./debounceValidation";
import { Validator } from "./validator";

const debounce = new Debounce();

export async function validateResourceGroupName(
  name: string,
  resourceGroups: ResourceGroups
): Promise<string | null> {
  const errors = new Validator(name)
    .isNotEmpty()
    .hasNoForbiddenChar(
      new RegExp("/^(?=.*[.]$).*$/g"),
      "Input value must not have '.' at the end."
    )
    .hasNoForbiddenChar(
      new RegExp("/[#`*\"'%;,!@$^&+=?/<>|[]{}:\\~]/g"),
      "'#', '`', '*', '\"', ''', '%', ';', ',', '!', '@', '$', '^', '&', '+', '=', '?', '/', '<', '>', '|', '[', ']', '{', '}', ':', '\\', '~'"
    )
    .inLengthRange(1, 90)
    .getErrors();

  if (errors) {
    return "Invalid resource group name";
  }

  const timeOverFunction = buildTimeOverFunction(
    name,
    resourceGroups.checkExistence.bind(resourceGroups),
    "A resource group with the same name already exists."
  );

  return await debounce.debounced(timeOverFunction);
}

function buildTimeOverFunction(
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  checkExistence: (name: string) => Promise<any>,
  errorMessage: string
): () => Promise<string | null> {
  return async () => {
    const validator = new Validator(name);

    await validator.isAvailable(checkExistence, errorMessage);

    return validator.getErrors();
  };
}
